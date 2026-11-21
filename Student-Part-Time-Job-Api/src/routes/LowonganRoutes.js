import { Router } from 'express';
import {
  searchLowongan,
  getKotaLowongan,
  getLowonganDetail,
  kirimLamaran
} from '../controllers/LowonganController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadFiles } from '../middleware/upload.js';

const router = Router();

/**
 * @openapi
 * /api/lowongan:
 *   get:
 *     summary: Cari lowongan publik (mahasiswa kedaluwarsa/ditolak tidak diizinkan)
 *     tags: [Lowongan]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: q, schema: { type: string }, description: Kata kunci posisi/employer/job desk }
 *       - { in: query, name: lokasi, schema: { type: string }, description: Nama kota atau "remote" }
 *       - { in: query, name: jenis, schema: { type: string }, description: 'Dipisah koma: part_time,freelance_proyek' }
 *       - { in: query, name: sistem, schema: { type: string }, description: 'Dipisah koma: onsite,hybrid,remote' }
 *       - { in: query, name: sort, schema: { type: string, enum: [terbaru, gaji, batas] } }
 *     responses:
 *       200:
 *         description: Daftar lowongan
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/Lowongan' } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', requireAuth, searchLowongan);

/**
 * @openapi
 * /api/lowongan/kota:
 *   get:
 *     summary: Daftar kota yang memiliki lowongan publik (untuk filter lokasi)
 *     tags: [Lowongan]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar nama kota }
 */
router.get('/kota', requireAuth, getKotaLowongan);

/**
 * @openapi
 * /api/lowongan/{id}:
 *   get:
 *     summary: Detail lowongan (publik/ditutup; pemilik & admin dapat melihat semua status)
 *     tags: [Lowongan]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, example: L-001 } }
 *     responses:
 *       200:
 *         description: Detail lowongan; untuk mahasiswa disertai lamaran_saya
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lowongan' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', requireAuth, getLowonganDetail);

/**
 * @openapi
 * /api/lowongan/{id}/lamaran:
 *   post:
 *     summary: Kirim lamaran (hanya mahasiswa terverifikasi, satu kali per lowongan)
 *     tags: [Lowongan]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, example: L-003 } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pesan, telepon]
 *             properties:
 *               pesan: { type: string, minLength: 50, maxLength: 1000 }
 *               portofolio: { type: string, example: 'https://portofolio-contoh.dev/reza' }
 *               telepon: { type: string, example: '081200000127' }
 *               cv: { type: string, format: binary, description: PDF maks. 2 MB }
 *     responses:
 *       201: { description: Lamaran terkirim }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { description: Sudah pernah melamar atau lowongan ditutup }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/:id/lamaran', requireAuth, requireRole('mahasiswa'), uploadFiles('cv'), kirimLamaran);

export default router;
