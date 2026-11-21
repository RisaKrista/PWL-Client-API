import { Router } from 'express';
import {
  getDashboard,
  listVerifikasi,
  getVerifikasi,
  putuskanVerifikasi,
  listLowongan,
  moderasiLowongan,
  tutupLowongan,
  getPeriode,
  updatePeriode,
  getEligibilitas,
  jalankanEligibilitas,
  cabutVerifikasi,
  listPerguruanTinggi,
  createPerguruanTinggi,
  updatePerguruanTinggi,
  deletePerguruanTinggi
} from '../controllers/AdminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/**
 * @openapi
 * /api/admin/dashboard:
 *   get:
 *     summary: Antrean verifikasi & moderasi serta jumlah verifikasi yang segera berakhir
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Ringkasan dashboard }
 */
router.get('/dashboard', getDashboard);

/**
 * @openapi
 * /api/admin/verifikasi:
 *   get:
 *     summary: Antrean verifikasi akun
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: peran, schema: { type: string, enum: [mahasiswa, employer] } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, disetujui, ditolak] } }
 *       - { in: query, name: jenis, schema: { type: string, enum: [awal, re_verifikasi] } }
 *       - { in: query, name: q, schema: { type: string } }
 *     responses:
 *       200: { description: Daftar pengajuan }
 */
router.get('/verifikasi', listVerifikasi);

/**
 * @openapi
 * /api/admin/verifikasi/{id}:
 *   get:
 *     summary: Detail pengajuan verifikasi beserta dokumen & cek duplikasi NPM
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, example: V-003 } }
 *     responses:
 *       200: { description: Detail pengajuan }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/verifikasi/:id', getVerifikasi);

/**
 * @openapi
 * /api/admin/verifikasi/{id}/keputusan:
 *   post:
 *     summary: Setujui atau tolak pengajuan verifikasi
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keputusan: { type: string, enum: [setujui, tolak] }
 *               alasan: { type: string, description: Wajib bila menolak }
 *               catatan: { type: string, description: Wajib bila alasan "Lainnya" }
 *     responses:
 *       200: { description: Keputusan tersimpan }
 *       409: { description: Sudah diputuskan }
 */
router.post('/verifikasi/:id/keputusan', putuskanVerifikasi);

/**
 * @openapi
 * /api/admin/lowongan:
 *   get:
 *     summary: Daftar lowongan untuk moderasi beserta jumlah per status
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [draft, menunggu_moderasi, publik, ditolak, ditutup] } }
 *     responses:
 *       200: { description: '{ items, counts }' }
 */
router.get('/lowongan', listLowongan);

/**
 * @openapi
 * /api/admin/lowongan/{id}/moderasi:
 *   patch:
 *     summary: Setujui (publik) atau tolak lowongan yang menunggu moderasi
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keputusan: { type: string, enum: [setujui, tolak] }
 *               alasan: { type: string }
 *               catatan: { type: string }
 *     responses:
 *       200: { description: Lowongan diperbarui }
 */
router.patch('/lowongan/:id/moderasi', moderasiLowongan);

/**
 * @openapi
 * /api/admin/lowongan/{id}/tutup:
 *   patch:
 *     summary: Tutup lowongan publik yang melanggar
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alasan: { type: string }
 *     responses:
 *       200: { description: Lowongan ditutup }
 */
router.patch('/lowongan/:id/tutup', tutupLowongan);

/**
 * @openapi
 * /api/admin/periode:
 *   get:
 *     summary: Periode semester aktif
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Periode
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Periode' }
 *   put:
 *     summary: Ubah periode semester aktif
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Periode' }
 *     responses:
 *       200: { description: Periode tersimpan }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/periode', getPeriode);
router.put('/periode', updatePeriode);

/**
 * @openapi
 * /api/admin/eligibilitas:
 *   get:
 *     summary: Monitoring masa berlaku verifikasi mahasiswa
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: '{ periode, mahasiswa[] }' }
 */
router.get('/eligibilitas', getEligibilitas);

/**
 * @openapi
 * /api/admin/eligibilitas/jalankan:
 *   post:
 *     summary: Ubah verifikasi yang lewat masa berlaku (per tanggal) menjadi kedaluwarsa
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tanggal: { type: string, example: '2027-03-01', description: Bawaan hari ini }
 *     responses:
 *       200: { description: '{ tanggal, jumlah_kedaluwarsa }' }
 */
router.post('/eligibilitas/jalankan', jalankanEligibilitas);

/**
 * @openapi
 * /api/admin/mahasiswa/{id}/cabut:
 *   post:
 *     summary: Cabut verifikasi mahasiswa (status menjadi ditolak)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, example: M-02 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alasan: { type: string }
 *     responses:
 *       200: { description: Verifikasi dicabut }
 */
router.post('/mahasiswa/:id/cabut', cabutVerifikasi);

/**
 * @openapi
 * /api/admin/perguruan-tinggi:
 *   get:
 *     summary: Daftar perguruan tinggi beserta domain email dan jumlah mahasiswa (ADM-06)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: q, schema: { type: string }, description: Cari nama, singkatan, atau domain }
 *       - { in: query, name: jenis, schema: { type: string, enum: [negeri, swasta] } }
 *     responses:
 *       200: { description: Daftar perguruan tinggi }
 *   post:
 *     summary: Tambah perguruan tinggi
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PerguruanTinggiInput' }
 *     responses:
 *       201: { description: Perguruan tinggi ditambahkan }
 *       409: { description: Domain sudah dipakai perguruan tinggi lain }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/perguruan-tinggi', listPerguruanTinggi);
router.post('/perguruan-tinggi', createPerguruanTinggi);

/**
 * @openapi
 * /api/admin/perguruan-tinggi/{id}:
 *   put:
 *     summary: Ubah perguruan tinggi (domain diganti seluruhnya)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, example: PT-21 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PerguruanTinggiInput' }
 *     responses:
 *       200: { description: Perguruan tinggi tersimpan }
 *       409: { description: Domain sudah dipakai perguruan tinggi lain }
 *   delete:
 *     summary: Hapus perguruan tinggi (hanya bila belum ada mahasiswa)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Dihapus }
 *       409: { description: Masih memiliki mahasiswa terdaftar }
 */
router.put('/perguruan-tinggi/:id', updatePerguruanTinggi);
router.delete('/perguruan-tinggi/:id', deletePerguruanTinggi);

export default router;
