import db from '../database/db.js';
import { getActivePeriode } from '../services/account.js';
import { BUKTI_LABEL, createVerifikasi } from '../services/verifikasi.js';
import { cleanupFiles, fileOf } from '../middleware/upload.js';
import { HttpError, handleError } from '../utils/errors.js';
import { withTransaction } from '../utils/ids.js';
import { today, daysBetween } from '../utils/dates.js';
import { isSlot } from '../utils/slots.js';
import { createValidator, str, int } from '../utils/validate.js';

const BUKTI_UKT_RE = /ukt|bayar|pembayaran/i;
const PESAN_UKT = 'Bukti pembayaran UKT tidak diterima. Gunakan KRS atau surat keterangan aktif kuliah.';

export const getProfil = async (req, res) => {
  try {
    const [[m]] = await db.query(
      `SELECT m.*, p.nama AS pt_nama, u.email
       FROM mahasiswa m JOIN perguruan_tinggi p ON p.id = m.pt_id JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
      [req.user.profilId]
    );
    const [slots] = await db.query('SELECT slot FROM mahasiswa_availability WHERE mahasiswa_id = ?', [m.id]);
    delete m.user_id;
    res.json({ ...m, availability: slots.map((s) => s.slot) });
  } catch (err) {
    handleError(res, err);
  }
};

export const updateAvailability = async (req, res) => {
  try {
    const availability = Array.isArray(req.body.availability) ? [...new Set(req.body.availability)] : null;
    const catatan = str(req.body.catatan_availability);
    const v = createValidator();
    v.check('availability', availability && availability.every(isSlot), 'Slot availability tidak valid.');
    v.check('catatan_availability', catatan.length <= 300, 'Catatan maksimal 300 karakter.');
    v.throwIfAny();

    await withTransaction(db, async (conn) => {
      await conn.query('DELETE FROM mahasiswa_availability WHERE mahasiswa_id = ?', [req.user.profilId]);
      if (availability.length) {
        await conn.query('INSERT INTO mahasiswa_availability (mahasiswa_id, slot) VALUES ?', [availability.map((s) => [req.user.profilId, s])]);
      }
      await conn.query('UPDATE mahasiswa SET catatan_availability = ? WHERE id = ?', [catatan || null, req.user.profilId]);
    });
    res.json({ availability, catatan_availability: catatan || null });
  } catch (err) {
    handleError(res, err);
  }
};

export const submitVerifikasi = async (req, res) => {
  try {
    if (!['belum_verifikasi', 'ditolak'].includes(req.user.status)) {
      throw new HttpError(409, req.user.status === 'pending' ? 'Data verifikasi Anda sedang ditinjau Admin.' : 'Akun Anda sudah terverifikasi.');
    }
    const b = req.body;
    const npm = str(b.npm);
    const prodi = str(b.prodi);
    const jenjang = str(b.jenjang);
    const semester = int(b.semester);
    const angkatan = int(b.angkatan);
    const jenisBukti = str(b.jenis_bukti);
    const ktm = fileOf(req, 'ktm');
    const bukti = fileOf(req, 'bukti');
    const tahunIni = Number(today().slice(0, 4));

    const v = createValidator();
    v.check('npm', /^\d{8,15}$/.test(npm), 'NPM harus terdiri atas 8–15 digit angka.');
    v.check('prodi', prodi.length >= 3 && prodi.length <= 100, 'Program studi minimal 3 karakter.');
    v.check('jenjang', ['D3', 'D4', 'S1'].includes(jenjang), 'Pilih jenjang.');
    v.check('semester', Number.isInteger(semester) && semester >= 1 && semester <= 14, 'Semester harus antara 1 dan 14.');
    v.check('angkatan', Number.isInteger(angkatan) && angkatan >= 2019 && angkatan <= tahunIni, `Tahun angkatan antara 2019 dan ${tahunIni}.`);
    v.check('jenis_bukti', BUKTI_LABEL[jenisBukti], 'Pilih jenis bukti aktif.');
    v.check('ktm', ktm, 'File KTM wajib diunggah.');
    v.check('bukti', bukti, 'File bukti aktif wajib diunggah.');
    if (bukti) v.check('bukti', !BUKTI_UKT_RE.test(bukti.originalname), PESAN_UKT);
    v.throwIfAny();

    const [[dup]] = await db.query(
      'SELECT m.id FROM mahasiswa m JOIN mahasiswa self ON self.id = ? WHERE m.pt_id = self.pt_id AND m.npm = ? AND m.id <> self.id',
      [req.user.profilId, npm]
    );
    if (dup) {
      const msg = 'NPM ini sudah terdaftar pada akun lain di perguruan tinggi yang sama. Hubungi Admin bila ini kesalahan.';
      throw new HttpError(409, msg, { npm: msg });
    }

    const periode = await getActivePeriode();
    const id = await withTransaction(db, async (conn) => {
      await conn.query(
        "UPDATE mahasiswa SET npm = ?, prodi = ?, jenjang = ?, semester = ?, angkatan = ?, status = 'pending', catatan_status = NULL WHERE id = ?",
        [npm, prodi, jenjang, semester, angkatan, req.user.profilId]
      );
      return createVerifikasi(conn, {
        peran: 'mahasiswa', mahasiswa_id: req.user.profilId, jenis: 'awal', periode_id: periode?.id,
        diajukan: today(), jenis_bukti: jenisBukti, semester
      }, [{ jenis: 'ktm', file: ktm }, { jenis: 'bukti_aktif', file: bukti }]);
    });
    res.status(201).json({ id, status: 'pending', message: 'Data verifikasi terkirim. Admin akan meninjau data Anda.' });
  } catch (err) {
    cleanupFiles(req);
    handleError(res, err);
  }
};

export const submitReVerifikasi = async (req, res) => {
  try {
    const periode = await getActivePeriode();
    const [[m]] = await db.query('SELECT status, berlaku_sampai FROM mahasiswa WHERE id = ?', [req.user.profilId]);
    const segeraBerakhir = m.status === 'terverifikasi' && m.berlaku_sampai &&
      daysBetween(today(), m.berlaku_sampai) <= (periode?.hari_pengingat ?? 14);
    if (!(m.status === 'kedaluwarsa' || segeraBerakhir)) {
      throw new HttpError(409, 'Verifikasi ulang dibuka 14 hari sebelum masa verifikasi berakhir atau setelah status kedaluwarsa.');
    }
    const [[pending]] = await db.query(
      "SELECT id FROM verifikasi WHERE mahasiswa_id = ? AND status = 'pending'",
      [req.user.profilId]
    );
    if (pending) throw new HttpError(409, 'Bukti aktif sudah terkirim dan menunggu tinjauan Admin.');

    const semester = int(req.body.semester);
    const jenisBukti = str(req.body.jenis_bukti);
    const bukti = fileOf(req, 'bukti');
    const v = createValidator();
    v.check('semester', Number.isInteger(semester) && semester >= 1 && semester <= 14, 'Semester harus antara 1 dan 14.');
    v.check('jenis_bukti', BUKTI_LABEL[jenisBukti], 'Pilih jenis bukti aktif.');
    v.check('bukti', bukti, 'File bukti aktif wajib diunggah.');
    if (bukti) v.check('bukti', !BUKTI_UKT_RE.test(bukti.originalname), PESAN_UKT);
    v.throwIfAny();

    const id = await withTransaction(db, (conn) => createVerifikasi(conn, {
      peran: 'mahasiswa', mahasiswa_id: req.user.profilId, jenis: 're_verifikasi', periode_id: periode?.id,
      diajukan: today(), jenis_bukti: jenisBukti, semester
    }, [{ jenis: 'bukti_aktif', file: bukti }]));
    res.status(201).json({ id, status: 'pending', message: 'Bukti aktif terkirim dan menunggu tinjauan Admin.' });
  } catch (err) {
    cleanupFiles(req);
    handleError(res, err);
  }
};

export const getRiwayatVerifikasi = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.id, v.jenis, v.diajukan, v.status, v.jenis_bukti, v.alasan, v.ket, p.nama AS periode
       FROM verifikasi v LEFT JOIN periode p ON p.id = v.periode_id
       WHERE v.mahasiswa_id = ? ORDER BY v.diajukan DESC, v.id DESC`,
      [req.user.profilId]
    );
    res.json(rows.map((v) => ({
      ...v,
      bukti: BUKTI_LABEL[v.jenis_bukti] || null,
      ket: v.ket || (v.status === 'pending' ? 'Menunggu tinjauan Admin' : v.alasan)
    })));
  } catch (err) {
    handleError(res, err);
  }
};

export const getLamaranSaya = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT lm.id, lm.lowongan_id, lm.status, lm.dikirim_pada, lm.catatan, lm.cv_nama,
              l.posisi, l.status AS lowongan_status, e.nama AS employer_nama
       FROM lamaran lm JOIN lowongan l ON l.id = lm.lowongan_id JOIN employer e ON e.id = l.employer_id
       WHERE lm.mahasiswa_id = ? ORDER BY lm.dikirim_pada DESC, lm.id DESC`,
      [req.user.profilId]
    );
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
};
