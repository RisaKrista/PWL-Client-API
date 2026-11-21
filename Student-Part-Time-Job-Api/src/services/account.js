import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { today } from '../utils/dates.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-ganti-di-env';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

// Halaman awal setelah masuk (relatif terhadap root platform), mengikuti alur mockup
export const homeFor = (role, status) => {
  if (role === 'admin') return 'pages/admin/dashboard.html';
  if (role === 'employer') return status === 'belum_verifikasi' ? 'pages/employer/verifikasi.html' : 'pages/employer/dashboard.html';
  if (status === 'belum_verifikasi') return 'pages/mahasiswa/verifikasi-status.html';
  if (status === 'kedaluwarsa' || status === 'ditolak') return 'pages/mahasiswa/status-akses.html';
  return 'pages/mahasiswa/cari-lowongan.html';
};

export const getActivePeriode = async (conn = db) => {
  const [[periode]] = await conn.query(
    'SELECT id, nama, tanggal_mulai, batas_berlaku, hari_pengingat FROM periode WHERE aktif = 1 ORDER BY id DESC LIMIT 1'
  );
  return periode || null;
};

// Akun Admin dari tabel admin (login dengan username)
const loadAdmin = async (adminId) => {
  const [[a]] = await db.query('SELECT id, nama, username FROM admin WHERE id = ?', [adminId]);
  if (!a) return null;
  return {
    id: a.id,
    email: null,
    username: a.username,
    role: 'admin',
    emailTerverifikasi: true,
    profilId: null,
    nama: a.nama,
    pj: null,
    status: null,
    home: homeFor('admin', null)
  };
};

// Memuat akun beserta profil & status terbaru (status dibaca ulang tiap request).
// role dari token menentukan tabel: admin → tabel admin, selain itu → tabel users.
export const loadUser = async (userId, role) => {
  if (role === 'admin') return loadAdmin(userId);
  const [[u]] = await db.query(
    'SELECT id, email, role, email_terverifikasi_pada FROM users WHERE id = ?',
    [userId]
  );
  if (!u) return null;

  let profil = null;
  if (u.role === 'mahasiswa') {
    [[profil]] = await db.query(
      'SELECT id, nama, status, berlaku_sampai FROM mahasiswa WHERE user_id = ?',
      [u.id]
    );
    // Masa verifikasi habis → kedaluwarsa
    if (profil && profil.status === 'terverifikasi' && profil.berlaku_sampai && profil.berlaku_sampai < today()) {
      await db.query("UPDATE mahasiswa SET status = 'kedaluwarsa' WHERE id = ?", [profil.id]);
      profil.status = 'kedaluwarsa';
    }
  } else if (u.role === 'employer') {
    [[profil]] = await db.query(
      'SELECT id, nama, pj, status FROM employer WHERE user_id = ?',
      [u.id]
    );
  }

  const status = profil?.status ?? null;
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    emailTerverifikasi: !!u.email_terverifikasi_pada,
    profilId: profil?.id ?? null,
    nama: profil?.nama ?? null,
    pj: profil?.pj ?? null,
    status,
    home: homeFor(u.role, status)
  };
};
