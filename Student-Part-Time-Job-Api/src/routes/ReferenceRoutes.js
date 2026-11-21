import { Router } from 'express';
import { getConfig, getPerguruanTinggi } from '../controllers/ReferenceController.js';

const router = Router();

/**
 * @openapi
 * /api/config:
 *   get:
 *     summary: Tanggal hari ini (server) dan periode semester aktif
 *     tags: [Referensi]
 *     responses:
 *       200:
 *         description: Konfigurasi aplikasi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 today: { type: string, example: '2026-10-10' }
 *                 periode: { $ref: '#/components/schemas/Periode' }
 */
router.get('/config', getConfig);

/**
 * @openapi
 * /api/perguruan-tinggi:
 *   get:
 *     summary: Daftar perguruan tinggi beserta domain email kampus
 *     tags: [Referensi]
 *     responses:
 *       200:
 *         description: Daftar perguruan tinggi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, example: PT-01 }
 *                   nama: { type: string }
 *                   domain: { type: array, items: { type: string } }
 */
router.get('/perguruan-tinggi', getPerguruanTinggi);

export default router;
