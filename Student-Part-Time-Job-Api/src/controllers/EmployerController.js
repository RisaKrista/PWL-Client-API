import db from '../database/db.js';
import { findLowongan, findLowonganById } from '../services/lowongan.js';
import { createVerifikasi } from '../services/verifikasi.js';
import { cleanupFiles, fileOf } from '../middleware/upload.js';
import { HttpError, handleError } from '../utils/errors.js';
import { nextId, withTransaction } from '../utils/ids.js';
import { today, addDays } from '../utils/dates.js';
import { isSlot, totalHours } from '../utils/slots.js';
import { createValidator, str, int, ISO_DATE_RE } from '../utils/validate.js';

const JENIS = ['part_time', 'freelance_proyek'];
const SISTEM = ['onsite', 'hybrid', 'remote'];
const DURASI_SATUAN = { hari: 1, minggu: 7, bulan: 30 };
const SATUAN_GAJI = ['jam', 'hari', 'bulan', 'proyek'];
const JENJANG = ['D3', 'D4', 'S1'];

// ------------------------------------------------------------ profil & verifikasi
export const getProfil = async (req, res) => {
  try {
    const [[e]] = await db.query(
      `SELECT e.*, u.email FROM employer e JOIN users u ON u.id = e.user_id WHERE e.id = ?`,
      [req.user.profilId]
    );
    const [[v]] = await db.query(
      'SELECT id, status, alasan, catatan, diajukan FROM verifikasi WHERE employer_id = ? ORDER BY diajukan DESC, id DESC LIMIT 1',
      [e.id]
    );
    delete e.user_id;
    res.json({ ...e, verifikasi_terakhir: v || null });
  } catch (err) {
    handleError(res, err);
  }
};

export const submitVerifikasi = async (req, res) => {
  try {
    if (!['belum_verifikasi', 'ditolak'].includes(req.user.status)) {
      throw new HttpError(409, req.user.status === 'pending' ? 'Dokumen Anda sedang ditinjau Admin.' : 'Akun Anda sudah terverifikasi.');
    }
    const [[e]] = await db.query('SELECT id, tipe FROM employer WHERE id = ?', [req.user.profilId]);
    const perorangan = e.tipe === 'perorangan';
    const nib = str(req.body.nib);
    const website = str(req.body.website);
    const alamat = str(req.body.alamat);
    const deskripsi = str(req.body.deskripsi);
    const legal = fileOf(req, 'legal');
    const identitas = fileOf(req, 'identitas');

    const v = createValidator();
    if (!perorangan) {
      v.check('nib', /^\d{13}$/.test(nib), 'NIB harus terdiri atas 13 digit angka.');
      v.check('legal', legal, 'Dokumen legalitas wajib diunggah.');
    } else {
      v.check('identitas', identitas, 'Identitas penanggung jawab wajib diunggah.');
    }
    if (website) v.check('website', /^https:\/\/\S+\.\S+/.test(website), 'Tautan harus diawali https://');
    v.check('alamat', alamat.length >= 10 && alamat.length <= 300, 'Alamat minimal 10 karakter.');
    v.check('deskripsi', deskripsi.length <= 300, 'Deskripsi maksimal 300 karakter.');
    v.throwIfAny();

    const id = await withTransaction(db, async (conn) => {
      await conn.query(
        "UPDATE employer SET nib = ?, website = ?, alamat = ?, deskripsi = ?, status = 'pending', catatan_status = NULL WHERE id = ?",
        [perorangan ? null : nib, website || null, alamat, deskripsi || null, e.id]
      );
      return createVerifikasi(conn, { peran: 'employer', employer_id: e.id, jenis: 'awal', diajukan: today() }, [
        { jenis: 'legalitas', file: perorangan ? null : legal },
        { jenis: 'identitas', file: identitas }
      ]);
    });
    res.status(201).json({ id, status: 'pending', message: 'Dokumen terkirim. Status akun: Pending sampai ditinjau Admin.' });
  } catch (err) {
    cleanupFiles(req);
    handleError(res, err);
  }
};

export const getDashboard = async (req, res) => {
  try {
    const empId = req.user.profilId;
    const [counts] = await db.query('SELECT status, COUNT(*) AS n FROM lowongan WHERE employer_id = ? GROUP BY status', [empId]);
    const [[baru]] = await db.query(
      "SELECT COUNT(*) AS n FROM lamaran lm JOIN lowongan l ON l.id = lm.lowongan_id WHERE l.employer_id = ? AND lm.status = 'dikirim'",
      [empId]
    );
    const by = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]));
    res.json({
      publik: by.publik || 0,
      menunggu_moderasi: by.menunggu_moderasi || 0,
      draft: by.draft || 0,
      pelamar_baru: Number(baru.n),
      terbaru: await findLowongan({ where: 'l.employer_id = ?', params: [empId], limit: 5 })
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------------------------------------ lowongan milik employer
const getOwnLowongan = async (req) => {
  const l = await findLowonganById(req.params.id);
  if (!l) throw new HttpError(404, 'Lowongan tidak ditemukan.');
  if (l.employer_id !== req.user.profilId) throw new HttpError(403, 'Anda tidak memiliki akses ke lowongan ini.');
  return l;
};

// Validasi & normalisasi isian formulir lowongan (EMP-04). Draft boleh belum lengkap.
const parseLowongan = (body, isDraft) => {
  const t = today();
  const d = {
    posisi: str(body.posisi),
    job_desk: str(body.job_desk),
    jenis_kerja: str(body.jenis_kerja) || 'part_time',
    sistem_kerja: str(body.sistem_kerja) || 'onsite',
    kota: str(body.kota),
    alamat: str(body.alamat),
    jadwal_fleksibel: body.jadwal_fleksibel === true || body.jadwal_fleksibel === 'true' || body.jadwal_fleksibel === 1,
    jadwal: Array.isArray(body.jadwal) ? [...new Set(body.jadwal)] : [],
    jenjang: Array.isArray(body.jenjang) ? [...new Set(body.jenjang)] : [],
    durasi_nilai: int(body.durasi_nilai),
    durasi_satuan: str(body.durasi_satuan) || 'bulan',
    beban_kerja: int(body.beban_kerja),
    gaji_min: int(body.gaji_min),
    gaji_maks: int(body.gaji_maks) || null,
    satuan_gaji: str(body.satuan_gaji) || 'jam',
    kriteria: str(body.kriteria),
    batas_lamaran: str(body.batas_lamaran)
  };
  if (d.jadwal_fleksibel) d.jadwal = [];
  // Area diambil dari bagian kedua alamat, mis. "Jl. X No. 1, Coblong, Bandung" → "Coblong"
  d.area = d.sistem_kerja === 'remote' ? '' : (d.alamat.split(',')[1] || '').trim();

  const v = createValidator();
  // Nilai enum & slot selalu dicek; kelengkapan hanya saat dikirim untuk moderasi
  v.check('jenis_kerja', JENIS.includes(d.jenis_kerja), 'Pilih jenis kerja.');
  v.check('sistem_kerja', SISTEM.includes(d.sistem_kerja), 'Pilih sistem kerja.');
  v.check('durasi_satuan', d.durasi_satuan in DURASI_SATUAN, 'Satuan durasi tidak valid.');
  v.check('satuan_gaji', SATUAN_GAJI.includes(d.satuan_gaji), 'Satuan gaji tidak valid.');
  v.check('jadwal', d.jadwal.every(isSlot), 'Slot jadwal tidak valid.');
  v.check('jenjang', d.jenjang.every((j) => JENJANG.includes(j)), 'Jenjang tidak valid.');
  v.check('posisi', d.posisi.length >= (isDraft ? 1 : 5) && d.posisi.length <= 80, isDraft ? 'Isi nama posisi untuk menyimpan draft.' : 'Posisi minimal 5 dan maksimal 80 karakter.');
  if (d.batas_lamaran) v.check('batas_lamaran', ISO_DATE_RE.test(d.batas_lamaran), 'Tanggal tidak valid.');

  if (!isDraft) {
    const min = addDays(t, 1);
    const max = addDays(t, 60);
    v.check('job_desk', d.job_desk.length >= 50 && d.job_desk.length <= 2000, 'Job desk minimal 50 karakter.');
    v.check('kota', d.kota, 'Pilih kota.');
    if (d.sistem_kerja !== 'remote') v.check('alamat', d.alamat.length >= 5 && d.alamat.length <= 150, 'Alamat wajib diisi untuk sistem kerja on-site atau hybrid.');
    v.check('jadwal', d.jadwal_fleksibel || d.jadwal.length, 'Pilih minimal satu slot jadwal atau centang jadwal fleksibel.');
    v.check('durasi_nilai', Number.isInteger(d.durasi_nilai) && d.durasi_nilai >= 1 && d.durasi_nilai <= 180, 'Durasi harus lebih dari 0.');
    if (!v.errors.durasi_nilai) v.check('durasi_nilai', d.durasi_nilai * (DURASI_SATUAN[d.durasi_satuan] || 1) <= 183, 'Durasi maksimal 6 bulan (proyek jangka pendek).');
    v.check('beban_kerja', Number.isInteger(d.beban_kerja) && d.beban_kerja >= 1 && d.beban_kerja <= 40, 'Beban kerja harus antara 1 dan 40 jam/minggu.');
    if (!v.errors.beban_kerja && !d.jadwal_fleksibel && d.jadwal.length) {
      const hours = totalHours(d.jadwal);
      v.check('beban_kerja', d.beban_kerja <= hours, `Beban kerja melebihi total jam pada jadwal yang dipilih (maks. ${hours} jam/minggu).`);
    }
    v.check('gaji_min', Number.isInteger(d.gaji_min) && d.gaji_min >= 1000 && d.gaji_min <= 100000000, 'Gaji harus angka Rupiah yang wajar.');
    if (d.gaji_maks !== null) v.check('gaji_maks', d.gaji_maks >= (d.gaji_min || 0), 'Gaji maksimum tidak boleh lebih kecil dari gaji minimum.');
    v.check('kriteria', d.kriteria.length >= 20 && d.kriteria.length <= 1000, 'Kriteria minimal 20 karakter.');
    v.check('batas_lamaran', d.batas_lamaran >= min && d.batas_lamaran <= max, `Batas lamaran harus antara ${min} dan ${max}.`);
  }
  v.throwIfAny();

  // Nilai bawaan untuk kolom wajib pada draft yang belum lengkap
  return {
    ...d,
    durasi_nilai: d.durasi_nilai || 1,
    beban_kerja: d.beban_kerja || 1,
    gaji_min: d.gaji_min || 0,
    batas_lamaran: d.batas_lamaran || addDays(t, 30)
  };
};

const saveLowongan = async (conn, id, d, extra) => {
  const { jadwal, jenjang, ...cols } = d;
  const row = { ...cols, ...extra, jenjang: jenjang.length ? jenjang.join(',') : null, diperbarui: today() };
  await conn.query('UPDATE lowongan SET ? WHERE id = ?', [row, id]);
  await conn.query('DELETE FROM lowongan_jadwal WHERE lowongan_id = ?', [id]);
  if (jadwal.length) await conn.query('INSERT INTO lowongan_jadwal (lowongan_id, slot) VALUES ?', [jadwal.map((s) => [id, s])]);
};

// action=draft → draft; action=submit → menunggu_moderasi (employer belum terverifikasi → tetap draft)
const targetStatus = (req) => {
  const kirim = req.body.action === 'submit';
  if (!kirim) return { status: 'draft', disimpan_sebagai_draft: false };
  if (req.user.status !== 'terverifikasi') return { status: 'draft', disimpan_sebagai_draft: true };
  return { status: 'menunggu_moderasi', disimpan_sebagai_draft: false };
};

export const listLowongan = async (req, res) => {
  try {
    res.json(await findLowongan({ where: 'l.employer_id = ?', params: [req.user.profilId] }));
  } catch (err) {
    handleError(res, err);
  }
};

export const getLowongan = async (req, res) => {
  try {
    res.json(await getOwnLowongan(req));
  } catch (err) {
    handleError(res, err);
  }
};

export const createLowongan = async (req, res) => {
  try {
    const { status, disimpan_sebagai_draft } = targetStatus(req);
    const d = parseLowongan(req.body, req.body.action !== 'submit');
    const id = await withTransaction(db, async (conn) => {
      const newId = await nextId(conn, 'lowongan', 'L-', 3);
      await conn.query(
        `INSERT INTO lowongan (id, employer_id, posisi, jenis_kerja, sistem_kerja, kota, durasi_nilai, durasi_satuan,
           beban_kerja, gaji_min, satuan_gaji, job_desk, kriteria, batas_lamaran, diperbarui, status)
         VALUES (?, ?, '', 'part_time', 'onsite', '', 1, 'bulan', 1, 0, 'jam', '', '', ?, ?, 'draft')`,
        [newId, req.user.profilId, today(), today()]
      );
      await saveLowongan(conn, newId, d, { status });
      return newId;
    });
    res.status(201).json({ ...(await findLowonganById(id)), disimpan_sebagai_draft });
  } catch (err) {
    handleError(res, err);
  }
};

export const updateLowongan = async (req, res) => {
  try {
    const l = await getOwnLowongan(req);
    if (l.status === 'ditutup') throw new HttpError(409, 'Lowongan yang sudah ditutup tidak dapat diubah.');
    if (req.body.action !== 'submit' && ['publik', 'menunggu_moderasi'].includes(l.status)) {
      throw new HttpError(409, 'Lowongan yang sudah dikirim tidak dapat dikembalikan menjadi draft.');
    }
    const { status, disimpan_sebagai_draft } = targetStatus(req);
    const d = parseLowongan(req.body, req.body.action !== 'submit');
    await withTransaction(db, (conn) => saveLowongan(conn, l.id, d, { status, alasan_penolakan: status === 'menunggu_moderasi' ? null : l.alasan_penolakan }));
    res.json({ ...(await findLowonganById(l.id)), disimpan_sebagai_draft });
  } catch (err) {
    handleError(res, err);
  }
};

export const tutupLowongan = async (req, res) => {
  try {
    const l = await getOwnLowongan(req);
    if (l.status !== 'publik') throw new HttpError(409, 'Hanya lowongan publik yang dapat ditutup.');
    await db.query("UPDATE lowongan SET status = 'ditutup', diperbarui = ? WHERE id = ?", [today(), l.id]);
    res.json({ id: l.id, status: 'ditutup' });
  } catch (err) {
    handleError(res, err);
  }
};

export const deleteLowongan = async (req, res) => {
  try {
    const l = await getOwnLowongan(req);
    if (l.status !== 'draft') throw new HttpError(409, 'Hanya draft yang dapat dihapus.');
    await db.query('DELETE FROM lowongan WHERE id = ?', [l.id]);
    res.status(204).end();
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------------------------------------ pelamar
// Data pelamar yang boleh dilihat Employer (tanpa NPM, email kampus, KTM; telepon setelah diterima)
const formatPelamar = (r, slots) => ({
  id: r.id,
  lowongan_id: r.lowongan_id,
  status: r.status,
  dikirim_pada: r.dikirim_pada,
  pesan: r.pesan,
  portofolio: r.portofolio,
  cv_nama: r.cv_nama,
  ada_cv: !!r.cv_path,
  catatan: r.catatan,
  telepon: r.status === 'diterima' ? r.telepon : null,
  mahasiswa: {
    id: r.mahasiswa_id,
    nama: r.nama,
    pt_nama: r.pt_nama,
    prodi: r.prodi,
    jenjang: r.jenjang,
    semester: r.semester,
    status: r.mhs_status,
    availability: slots[r.mahasiswa_id] || []
  }
});

const findPelamar = async (where, params) => {
  const [rows] = await db.query(
    `SELECT lm.*, m.nama, m.prodi, m.jenjang, m.semester, m.status AS mhs_status, p.nama AS pt_nama
     FROM lamaran lm JOIN mahasiswa m ON m.id = lm.mahasiswa_id JOIN perguruan_tinggi p ON p.id = m.pt_id
     WHERE ${where} ORDER BY lm.dikirim_pada DESC, lm.id DESC`,
    params
  );
  const slots = {};
  if (rows.length) {
    const [s] = await db.query('SELECT mahasiswa_id, slot FROM mahasiswa_availability WHERE mahasiswa_id IN (?)', [[...new Set(rows.map((r) => r.mahasiswa_id))]]);
    s.forEach((x) => (slots[x.mahasiswa_id] = slots[x.mahasiswa_id] || []).push(x.slot));
  }
  return rows.map((r) => formatPelamar(r, slots));
};

export const getPelamar = async (req, res) => {
  try {
    const l = await findLowonganById(req.params.id);
    if (!l) throw new HttpError(404, 'Lowongan tidak ditemukan.');
    if (l.employer_id !== req.user.profilId) throw new HttpError(403, 'Anda tidak memiliki akses ke data pelamar lowongan ini.');
    res.json({ lowongan: l, pelamar: await findPelamar('lm.lowongan_id = ?', [l.id]) });
  } catch (err) {
    handleError(res, err);
  }
};

export const updateStatusLamaran = async (req, res) => {
  try {
    const [[lm]] = await db.query(
      'SELECT lm.id, lm.status, l.employer_id FROM lamaran lm JOIN lowongan l ON l.id = lm.lowongan_id WHERE lm.id = ?',
      [req.params.id]
    );
    if (!lm) throw new HttpError(404, 'Lamaran tidak ditemukan.');
    if (lm.employer_id !== req.user.profilId) throw new HttpError(403, 'Anda tidak memiliki akses ke lamaran ini.');

    const status = str(req.body.status);
    const catatan = str(req.body.catatan);
    const boleh = { ditinjau: ['dikirim'], diterima: ['dikirim', 'ditinjau'], ditolak: ['dikirim', 'ditinjau'] };
    if (!boleh[status]) throw new HttpError(422, 'Status lamaran tidak valid.', { status: 'Status lamaran tidak valid.' });
    if (!boleh[status].includes(lm.status)) throw new HttpError(409, `Lamaran berstatus ${lm.status} tidak dapat diubah menjadi ${status}.`);
    if (catatan.length > 300) throw new HttpError(422, 'Catatan maksimal 300 karakter.', { catatan: 'Catatan maksimal 300 karakter.' });

    await db.query('UPDATE lamaran SET status = ?, catatan = ? WHERE id = ?', [status, status === 'ditolak' ? catatan || null : null, lm.id]);
    const [updated] = await findPelamar('lm.id = ?', [lm.id]);
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
};
