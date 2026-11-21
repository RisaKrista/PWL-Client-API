import { Router } from 'express';
import {
  registerMahasiswa,
  registerEmployer,
  verifyOtp,
  resendOtp,
  login,
  me
} from '../controllers/AuthController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /api/auth/register/mahasiswa:
 *   post:
 *     summary: Registrasi mahasiswa dengan email kampus (mengirim OTP)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nama, pt_id, email, password]
 *             properties:
 *               nama: { type: string, example: Dinda Lestari }
 *               pt_id: { type: string, example: PT-01 }
 *               email: { type: string, example: dinda.lestari@mhs.kampus-contoh.ac.id }
 *               password: { type: string, example: kerja2026 }
 *     responses:
 *       201: { description: Akun dibuat; OTP dikirim (otp_dev tersedia di mode development) }
 *       409: { description: Email sudah terdaftar }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/register/mahasiswa', registerMahasiswa);

/**
 * @openapi
 * /api/auth/register/employer:
 *   post:
 *     summary: Registrasi employer (mengirim OTP)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipe, pj, email, telepon, kota, password]
 *             properties:
 *               tipe: { type: string, enum: [umkm, startup, perusahaan, perorangan] }
 *               nama: { type: string, description: Nama usaha (opsional untuk perorangan), example: Studio Foto Lensa Kota }
 *               pj: { type: string, example: Arif Nugraha }
 *               jabatan: { type: string, example: Pemilik }
 *               email: { type: string, example: arif@lensakota-contoh.id }
 *               telepon: { type: string, example: '081200000777' }
 *               kota: { type: string, example: Bandung }
 *               password: { type: string, example: studio2026 }
 *     responses:
 *       201: { description: Akun dibuat; OTP dikirim }
 *       409: { description: Email sudah terdaftar }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/register/employer', registerEmployer);

/**
 * @openapi
 * /api/auth/otp/verify:
 *   post:
 *     summary: Verifikasi kode OTP email (maks. 3 percobaan); berhasil → token login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               kode: { type: string, example: '123456' }
 *     responses:
 *       200: { $ref: '#/components/responses/LoginResult' }
 *       400: { description: Kode salah atau kedaluwarsa }
 *       429: { description: Salah 3 kali; kirim ulang kode }
 */
router.post('/otp/verify', verifyOtp);

/**
 * @openapi
 * /api/auth/otp/resend:
 *   post:
 *     summary: Kirim ulang kode OTP (jeda 60 detik)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: Kode baru dikirim }
 *       429: { description: Masih dalam jeda kirim ulang }
 */
router.post('/otp/resend', resendOtp);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Masuk — Mahasiswa/Employer dengan email, Admin dengan username (tabel admin)
 *     description: Isi `email` untuk Mahasiswa/Employer atau `username` untuk Admin. Nilai tanpa "@" pada `email` juga dianggap username Admin.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, example: dinda@mhs.kampus-contoh.ac.id }
 *               username: { type: string, example: admin }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200: { $ref: '#/components/responses/LoginResult' }
 *       401: { description: Email/username atau kata sandi salah }
 *       403: { description: Email belum diverifikasi (OTP baru dikirim) }
 */
router.post('/login', login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Akun yang sedang masuk beserta status terbarunya
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Data akun
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', requireAuth, me);

export default router;
