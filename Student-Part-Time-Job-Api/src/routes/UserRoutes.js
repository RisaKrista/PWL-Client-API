import { Router } from 'express';
import {
  getAllUsers
} from '../controllers/UserController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get all users (admin only, without password hashes)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 additionalProperties: true
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         description: Database query failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
  */
router.get('/', requireAuth, requireRole('admin'), getAllUsers);

export default router;
