import { Router } from 'express';
import {
  getProfil,
  updateAvailability,
  submitVerifikasi,
  submitReVerifikasi,
  getRiwayatVerifikasi,
  getLamaranSaya
} from '../controllers/MahasiswaController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFiles } from '../middleware/upload.js';

const router = Router();
router.use(requireAuth, requireRole('mahasiswa'));

/**
 * @openapi
 * /api/mahasiswa/me:
 *   get:
 *     summary: Profil mahasiswa beserta availability
 *     tags: [Mahasiswa]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profil mahasiswa }
 */
router.get('/me', getProfil);

/**
 * @openapi
 * /api/mahasiswa/me/availability:
 *   put:
 *     summary: Simpan availability mingguan
 *     tags: [Mahasiswa]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               availability: { type: array, items: { type: string }, example: [selasa-sore, kamis-sore] }
 *               catatan_availability: { type: string }
 *     responses:
 *       200: { description: Availability tersimpan }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put('/me/availability', updateAvailability);

/**
 * @openapi
 * /api/mahasiswa/me/verifikasi:
 *   get:
 *     summary: Riwayat pengajuan verifikasi
 *     tags: [Mahasiswa]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar pengajuan }
 *   post:
 *     summary: Ajukan verifikasi status mahasiswa (KTM + bukti aktif)
 *     tags: [Mahasiswa]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [npm, prodi, jenjang, semester, angkatan, jenis_bukti, ktm, bukti]
 *             properties:
 *               npm: { type: string, example: '2410500377' }
 *               prodi: { type: string, example: Sistem Informasi }
 *               jenjang: { type: string, enum: [D3, D4, S1] }
 *               semester: { type: integer, example: 3 }
 *               angkatan: { type: integer, example: 2024 }
 *               jenis_bukti: { type: string, enum: [krs, surat] }
 *               ktm: { type: string, format: binary }
 *               bukti: { type: string, format: binary }
 *     responses:
 *       201: { description: Pengajuan terkirim; status akun menjadi pending }
 *       409: { description: NPM duplikat atau status tidak memungkinkan }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/me/verifikasi', getRiwayatVerifikasi);
router.post('/me/verifikasi', uploadFiles('ktm', 'bukti'), submitVerifikasi);

/**
 * @openapi
 * /api/mahasiswa/me/re-verifikasi:
 *   post:
 *     summary: Ajukan verifikasi ulang (kedaluwarsa atau ≤ hari pengingat sebelum berakhir)
 *     tags: [Mahasiswa]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [semester, jenis_bukti, bukti]
 *             properties:
 *               semester: { type: integer, example: 8 }
 *               jenis_bukti: { type: string, enum: [krs, surat] }
 *               bukti: { type: string, format: binary }
 *     responses:
 *       201: { description: Pengajuan terkirim }
 *       409: { description: Belum waktunya atau masih ada pengajuan pending }
 */
router.post('/me/re-verifikasi', uploadFiles('bukti'), submitReVerifikasi);

/**
 * @openapi
 * /api/mahasiswa/me/lamaran:
 *   get:
 *     summary: Daftar lamaran milik mahasiswa
 *     tags: [Mahasiswa]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar lamaran }
 */
router.get('/me/lamaran', getLamaranSaya);

export default router;
