import db from '../database/db.js';
import { findLowongan, findLowonganById } from '../services/lowongan.js';
import { cleanupFiles, fileOf, relPath } from '../middleware/upload.js';
import { HttpError, handleError } from '../utils/errors.js';
import { nextId, withTransaction } from '../utils/ids.js';
import { today } from '../utils/dates.js';
import { createValidator, str, TELEPON_RE } from '../utils/validate.js';

const csv = (v) => str(v).split(',').map((s) => s.trim()).filter(Boolean);

// Mahasiswa kedaluwarsa/ditolak tidak boleh mencari & melamar (aturan mockup)
const assertBolehMencari = (user) => {
  if (user.role !== 'mahasiswa') return;
  if (user.status === 'kedaluwarsa') throw new HttpError(403, 'Masa verifikasi status mahasiswa telah berakhir. Lakukan verifikasi ulang untuk melanjutkan.');
  if (user.status === 'ditolak') throw new HttpError(403, 'Verifikasi akun ditolak. Perbaiki data lalu ajukan ulang.');
};

// Gaji dinormalkan ke per-jam untuk pengurutan (sama dengan mockup)
const ORDER = {
  terbaru: 'l.tayang DESC, l.id DESC',
  batas: 'l.batas_lamaran ASC, l.id ASC',
  gaji: `(CASE l.satuan_gaji WHEN 'jam' THEN 1 WHEN 'hari' THEN 1/8 WHEN 'bulan' THEN 1/160 ELSE 1/40 END)
         * COALESCE(l.gaji_maks, l.gaji_min) DESC`
};

export const searchLowongan = async (req, res) => {
  try {
    assertBolehMencari(req.user);
    const where = ["l.status = 'publik'", "e.status = 'terverifikasi'", 'l.batas_lamaran >= ?'];
    const params = [today()];
    const q = str(req.query.q).toLowerCase();
    if (q) {
      where.push('LOWER(CONCAT_WS(\' \', l.posisi, e.nama, l.job_desk)) LIKE ?');
      params.push(`%${q}%`);
    }
    const lokasi = str(req.query.lokasi);
    if (lokasi === 'remote') where.push("l.sistem_kerja = 'remote'");
    else if (lokasi) {
      where.push("l.kota = ? AND l.sistem_kerja <> 'remote'");
      params.push(lokasi);
    }
    const jenis = csv(req.query.jenis);
    if (jenis.length) {
      where.push('l.jenis_kerja IN (?)');
      params.push(jenis);
    }
    const sistem = csv(req.query.sistem);
    if (sistem.length) {
      where.push('l.sistem_kerja IN (?)');
      params.push(sistem);
    }
    const rows = await findLowongan({ where: where.join(' AND '), params, orderBy: ORDER[req.query.sort] || ORDER.terbaru });
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
};

// Daftar kota yang punya lowongan publik on-site/hybrid (untuk filter lokasi)
export const getKotaLowongan = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT kota FROM lowongan WHERE status = 'publik' AND sistem_kerja <> 'remote' AND batas_lamaran >= ? ORDER BY kota",
      [today()]
    );
    res.json(rows.map((r) => r.kota));
  } catch (err) {
    handleError(res, err);
  }
};

export const getLowonganDetail = async (req, res) => {
  try {
    assertBolehMencari(req.user);
    const l = await findLowonganById(req.params.id);
    const isOwner = l && req.user.role === 'employer' && l.employer_id === req.user.profilId;
    const visible = l && (req.user.role === 'admin' || isOwner || ['publik', 'ditutup'].includes(l.status));
    if (!visible) throw new HttpError(404, 'Lowongan tidak ditemukan atau sudah tidak tersedia.');
    if (req.user.role === 'mahasiswa') {
      const [[lm]] = await db.query(
        'SELECT id, status FROM lamaran WHERE lowongan_id = ? AND mahasiswa_id = ?',
        [l.id, req.user.profilId]
      );
      l.lamaran_saya = lm || null;
    }
    res.json(l);
  } catch (err) {
    handleError(res, err);
  }
};

export const kirimLamaran = async (req, res) => {
  try {
    const user = req.user;
    assertBolehMencari(user);
    if (user.status !== 'terverifikasi') throw new HttpError(403, 'Lamaran hanya dapat dikirim oleh akun yang sudah diverifikasi Admin.');

    const l = await findLowonganById(req.params.id);
    if (!l || !['publik', 'ditutup'].includes(l.status)) throw new HttpError(404, 'Lowongan tidak ditemukan atau sudah tidak tersedia.');
    if (l.status === 'ditutup' || l.batas_lamaran < today()) throw new HttpError(409, 'Lowongan ini sudah ditutup dan tidak menerima lamaran baru.');

    const pesan = str(req.body.pesan);
    const portofolio = str(req.body.portofolio);
    const telepon = str(req.body.telepon);
    const cv = fileOf(req, 'cv');
    const v = createValidator();
    v.check('pesan', pesan.length >= 50 && pesan.length <= 1000, 'Pesan minimal 50 dan maksimal 1.000 karakter.');
    if (portofolio) v.check('portofolio', /^https:\/\/\S+\.\S+/.test(portofolio), 'Tautan harus diawali https://');
    v.check('telepon', TELEPON_RE.test(telepon), 'Nomor telepon harus diawali 08 dan terdiri atas 10–13 digit.');
    v.throwIfAny();

    const lamaran = await withTransaction(db, async (conn) => {
      const [[dup]] = await conn.query(
        'SELECT id FROM lamaran WHERE lowongan_id = ? AND mahasiswa_id = ?',
        [l.id, user.profilId]
      );
      if (dup) throw new HttpError(409, 'Lamaran untuk lowongan ini sudah pernah dikirim.');
      const id = await nextId(conn, 'lamaran', 'LM-', 3);
      const row = {
        id,
        lowongan_id: l.id,
        mahasiswa_id: user.profilId,
        status: 'dikirim',
        dikirim_pada: today(),
        pesan,
        portofolio: portofolio || null,
        telepon,
        cv_path: cv ? relPath(cv) : null,
        cv_nama: cv ? cv.originalname : null
      };
      await conn.query('INSERT INTO lamaran SET ?', row);
      return row;
    });
    delete lamaran.cv_path;
    res.status(201).json(lamaran);
  } catch (err) {
    cleanupFiles(req);
    handleError(res, err);
  }
};
