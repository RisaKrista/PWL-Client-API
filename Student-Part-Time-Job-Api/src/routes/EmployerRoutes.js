import { Router } from 'express';
import {
  getProfil,
  submitVerifikasi,
  getDashboard,
  listLowongan,
  getLowongan,
  createLowongan,
  updateLowongan,
  tutupLowongan,
  deleteLowongan,
  getPelamar,
  updateStatusLamaran
} from '../controllers/EmployerController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFiles } from '../middleware/upload.js';

const router = Router();
router.use(requireAuth, requireRole('employer'));

/**
 * @openapi
 * /api/employer/me:
 *   get:
 *     summary: Profil employer beserta verifikasi terakhir
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profil employer }
 */
router.get('/me', getProfil);

/**
 * @openapi
 * /api/employer/me/verifikasi:
 *   post:
 *     summary: Unggah dokumen verifikasi employer
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nib: { type: string, description: 13 digit (wajib selain perorangan) }
 *               website: { type: string }
 *               alamat: { type: string }
 *               deskripsi: { type: string }
 *               legal: { type: string, format: binary, description: Dokumen legalitas (badan usaha) }
 *               identitas: { type: string, format: binary, description: Identitas penanggung jawab (perorangan) }
 *     responses:
 *       201: { description: Dokumen terkirim; status pending }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/me/verifikasi', uploadFiles('legal', 'identitas'), submitVerifikasi);

/**
 * @openapi
 * /api/employer/dashboard:
 *   get:
 *     summary: Ringkasan lowongan & pelamar baru
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Statistik dan 5 lowongan terbaru }
 */
router.get('/dashboard', getDashboard);

/**
 * @openapi
 * /api/employer/lowongan:
 *   get:
 *     summary: Daftar lowongan milik employer
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Daftar lowongan
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/Lowongan' } }
 *   post:
 *     summary: Buat lowongan (action=draft atau submit untuk moderasi)
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LowonganInput' }
 *     responses:
 *       201: { description: Lowongan tersimpan (disimpan_sebagai_draft=true bila employer belum terverifikasi) }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/lowongan', listLowongan);
router.post('/lowongan', createLowongan);

/**
 * @openapi
 * /api/employer/lowongan/{id}:
 *   get:
 *     summary: Detail lowongan milik employer
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Lowongan }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   put:
 *     summary: Ubah lowongan (lowongan publik yang diubah kembali ke moderasi)
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LowonganInput' }
 *     responses:
 *       200: { description: Lowongan tersimpan }
 *       409: { description: Lowongan ditutup }
 *   delete:
 *     summary: Hapus draft
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Draft dihapus }
 *       409: { description: Bukan draft }
 */
router.get('/lowongan/:id', getLowongan);
router.put('/lowongan/:id', updateLowongan);
router.delete('/lowongan/:id', deleteLowongan);

/**
 * @openapi
 * /api/employer/lowongan/{id}/tutup:
 *   patch:
 *     summary: Tutup lowongan publik
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Lowongan ditutup }
 */
router.patch('/lowongan/:id/tutup', tutupLowongan);

/**
 * @openapi
 * /api/employer/lowongan/{id}/lamaran:
 *   get:
 *     summary: Daftar pelamar sebuah lowongan (telepon tampil setelah diterima)
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, example: L-001 } }
 *     responses:
 *       200: { description: Lowongan dan daftar pelamar }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/lowongan/:id/lamaran', getPelamar);

/**
 * @openapi
 * /api/employer/lamaran/{id}/status:
 *   patch:
 *     summary: Ubah status lamaran (ditinjau, diterima, ditolak)
 *     tags: [Employer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, example: LM-001 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [ditinjau, diterima, ditolak] }
 *               catatan: { type: string, description: Catatan untuk pelamar bila ditolak }
 *     responses:
 *       200: { description: Lamaran diperbarui }
 *       409: { description: Transisi status tidak diizinkan }
 */
router.patch('/lamaran/:id/status', updateStatusLamaran);

export default router;
