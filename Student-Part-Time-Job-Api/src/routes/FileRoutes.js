import { Router } from 'express';
import { getDokumen, getCv } from '../controllers/FileController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /api/files/dokumen/{id}:
 *   get:
 *     summary: Unduh dokumen verifikasi (Admin atau pemilik akun)
 *     tags: [File]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Isi file }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/dokumen/:id', requireAuth, getDokumen);

/**
 * @openapi
 * /api/files/lamaran/{id}/cv:
 *   get:
 *     summary: Unduh CV lamaran (pelamar, Employer pemilik lowongan, atau Admin)
 *     tags: [File]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, example: LM-001 } }
 *     responses:
 *       200: { description: File PDF }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/lamaran/:id/cv', requireAuth, getCv);

export default router;
