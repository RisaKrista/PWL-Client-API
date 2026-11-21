import fs from 'fs';
import db from '../database/db.js';
import { absPath } from '../middleware/upload.js';
import { HttpError, handleError } from '../utils/errors.js';

const sendStored = (res, rel, nama, mime) => {
  const file = absPath(rel);
  if (!fs.existsSync(file)) throw new HttpError(404, 'File tidak ditemukan di server.');
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nama)}"`);
  res.sendFile(file);
};

// Dokumen verifikasi: hanya Admin dan pemilik akun
export const getDokumen = async (req, res) => {
  try {
    const [[d]] = await db.query(
      `SELECT d.*, COALESCE(m.user_id, e.user_id) AS owner_id
       FROM dokumen d JOIN verifikasi v ON v.id = d.verifikasi_id
       LEFT JOIN mahasiswa m ON m.id = v.mahasiswa_id LEFT JOIN employer e ON e.id = v.employer_id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!d) throw new HttpError(404, 'Dokumen tidak ditemukan.');
    if (req.user.role !== 'admin' && req.user.id !== d.owner_id) throw new HttpError(403, 'Anda tidak memiliki akses ke dokumen ini.');
    sendStored(res, d.path, d.nama_asli, d.mime);
  } catch (err) {
    handleError(res, err);
  }
};

// CV lamaran: pelamar sendiri, Employer pemilik lowongan, atau Admin
export const getCv = async (req, res) => {
  try {
    const [[lm]] = await db.query(
      `SELECT lm.cv_path, lm.cv_nama, lm.mahasiswa_id, l.employer_id
       FROM lamaran lm JOIN lowongan l ON l.id = lm.lowongan_id WHERE lm.id = ?`,
      [req.params.id]
    );
    if (!lm || !lm.cv_path) throw new HttpError(404, 'CV tidak tersedia.');
    const { role, profilId } = req.user;
    const allowed = role === 'admin' ||
      (role === 'mahasiswa' && profilId === lm.mahasiswa_id) ||
      (role === 'employer' && profilId === lm.employer_id);
    if (!allowed) throw new HttpError(403, 'Anda tidak memiliki akses ke CV ini.');
    sendStored(res, lm.cv_path, lm.cv_nama, 'application/pdf');
  } catch (err) {
    handleError(res, err);
  }
};
