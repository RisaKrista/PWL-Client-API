import { nextId } from '../utils/ids.js';
import { relPath } from '../middleware/upload.js';

export const BUKTI_LABEL = { krs: 'KRS semester berjalan', surat: 'Surat keterangan aktif kuliah' };

// Membuat pengajuan verifikasi + menyimpan dokumen terunggah.
// docs: [{ jenis: 'ktm'|'bukti_aktif'|'legalitas'|'identitas', file }]
export const createVerifikasi = async (conn, data, docs) => {
  const id = await nextId(conn, 'verifikasi', 'V-', 3);
  await conn.query(
    `INSERT INTO verifikasi (id, peran, mahasiswa_id, employer_id, jenis, periode_id, diajukan, jenis_bukti, semester)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.peran, data.mahasiswa_id || null, data.employer_id || null, data.jenis || 'awal',
      data.periode_id || null, data.diajukan, data.jenis_bukti || null, data.semester || null]
  );
  for (const { jenis, file } of docs.filter((d) => d.file)) {
    await conn.query(
      'INSERT INTO dokumen (verifikasi_id, jenis, path, nama_asli, mime, ukuran) VALUES (?, ?, ?, ?, ?, ?)',
      [id, jenis, relPath(file), file.originalname, file.mimetype, file.size]
    );
  }
  return id;
};
