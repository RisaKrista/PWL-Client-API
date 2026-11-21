import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import userRoutes from './src/routes/UserRoutes.js';
import referenceRoutes from './src/routes/ReferenceRoutes.js';
import authRoutes from './src/routes/AuthRoutes.js';
import lowonganRoutes from './src/routes/LowonganRoutes.js';
import mahasiswaRoutes from './src/routes/MahasiswaRoutes.js';
import employerRoutes from './src/routes/EmployerRoutes.js';
import adminRoutes from './src/routes/AdminRoutes.js';
import fileRoutes from './src/routes/FileRoutes.js';
import { HttpError } from './src/utils/errors.js';
import { ensureDatabase } from './src/database/setup.js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.resolve(process.env.FRONTEND_DIR || '../Student-Part-Time-Job-Platform');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Student Part-Time Job Platform API',
      version: '1.0.0',
      description: 'Autentikasi JWT. Masuk lewat POST /api/auth/login (Admin bawaan: username `admin`, kata sandi `admin123`), salin token, lalu tekan Authorize.'
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            errors: { type: 'object', additionalProperties: { type: 'string' }, description: 'Pesan per field' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string', nullable: true, description: 'null untuk Admin' },
            username: { type: 'string', description: 'Hanya untuk Admin' },
            role: { type: 'string', enum: ['mahasiswa', 'employer', 'admin'] },
            profilId: { type: 'string', example: 'M-01' },
            nama: { type: 'string' },
            status: { type: 'string', example: 'terverifikasi' },
            home: { type: 'string', example: 'pages/mahasiswa/cari-lowongan.html' }
          }
        },
        Periode: {
          type: 'object',
          properties: {
            nama: { type: 'string', example: 'Semester Ganjil 2026/2027' },
            tanggal_mulai: { type: 'string', example: '2026-09-01' },
            batas_berlaku: { type: 'string', example: '2027-02-28' },
            hari_pengingat: { type: 'integer', example: 14 }
          }
        },
        PerguruanTinggiInput: {
          type: 'object',
          required: ['nama', 'jenis', 'domain_email'],
          properties: {
            nama: { type: 'string', example: 'Universitas Widyatama' },
            singkatan: { type: 'string', example: 'UTama' },
            jenis: { type: 'string', enum: ['negeri', 'swasta'] },
            domain_email: { type: 'string', example: 'widyatama.ac.id', description: 'Tanpa @; pisahkan dengan koma bila lebih dari satu. Subdomain otomatis diterima.' }
          }
        },
        LowonganInput: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['draft', 'submit'] },
            posisi: { type: 'string', example: 'Tutor Kimia SMA' },
            job_desk: { type: 'string' },
            jenis_kerja: { type: 'string', enum: ['part_time', 'freelance_proyek'] },
            sistem_kerja: { type: 'string', enum: ['onsite', 'hybrid', 'remote'] },
            kota: { type: 'string', example: 'Bandung' },
            alamat: { type: 'string', example: 'Jl. Contoh Raya No. 10, Coblong' },
            jadwal_fleksibel: { type: 'boolean' },
            jadwal: { type: 'array', items: { type: 'string' }, example: ['senin-sore', 'rabu-sore'] },
            jenjang: { type: 'array', items: { type: 'string', enum: ['D3', 'D4', 'S1'] } },
            durasi_nilai: { type: 'integer', example: 3 },
            durasi_satuan: { type: 'string', enum: ['hari', 'minggu', 'bulan'] },
            beban_kerja: { type: 'integer', example: 6 },
            gaji_min: { type: 'integer', example: 55000 },
            gaji_maks: { type: 'integer', nullable: true },
            satuan_gaji: { type: 'string', enum: ['jam', 'hari', 'bulan', 'proyek'] },
            kriteria: { type: 'string' },
            batas_lamaran: { type: 'string', example: '2026-11-07' }
          }
        },
        Lowongan: {
          allOf: [
            { $ref: '#/components/schemas/LowonganInput' },
            {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'L-001' },
                employer_id: { type: 'string', example: 'E-01' },
                area: { type: 'string' },
                tayang: { type: 'string', nullable: true },
                diperbarui: { type: 'string' },
                status: { type: 'string', enum: ['draft', 'menunggu_moderasi', 'publik', 'ditolak', 'ditutup'] },
                alasan_penolakan: { type: 'string', nullable: true },
                jumlah_pelamar: { type: 'integer' },
                employer: { type: 'object', additionalProperties: true }
              }
            }
          ]
        }
      },
      responses: {
        Unauthorized: { description: 'Belum masuk / token tidak valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        Forbidden: { description: 'Tidak memiliki akses', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        NotFound: { description: 'Data tidak ditemukan', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        ValidationError: { description: 'Isian tidak valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        LoginResult: {
          description: 'Token JWT dan data akun',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./index.js', './src/routes/*.js']
});

app.use(cors());
app.use(morgan('dev'));

// Parse incoming JSON payloads
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Check whether the API is running
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 */
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Mount API routes
app.use('/api', referenceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/lowongan', lowonganRoutes);
app.use('/api/mahasiswa', mahasiswaRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

// Frontend disajikan dari origin yang sama (FRONTEND_DIR)
app.use(express.static(FRONTEND_DIR));

// Halaman error frontend (pages/error/*.html) bila tersedia
const errorPage = (status) => {
  const file = path.join(FRONTEND_DIR, 'pages', 'error', `${status}.html`);
  return fs.existsSync(file) ? file : null;
};

// Halaman yang tidak ada → 404.html
app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.accepts('html')) return next();
  const page = errorPage(404);
  if (!page) return next();
  res.status(404).sendFile(page);
});

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.errors && { errors: err.errors }) });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 2 MB.' : 'File tidak valid.';
    return res.status(422).json({ message, errors: { [err.field]: message } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format JSON tidak valid.' });
  }
  console.error(err.stack);
  // Permintaan halaman (bukan API) → 500.html
  const page = !req.path.startsWith('/api') && req.accepts('html') && errorPage(500);
  if (page) return res.status(500).sendFile(page);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Buat database + data contoh otomatis bila belum ada
try {
  await ensureDatabase();
} catch (err) {
  console.error(`Tidak dapat menyiapkan database: ${err.message}`);
  console.error('Periksa DB_HOST, DB_PORT, DB_USER, dan DB_PASSWORD di file .env, dan pastikan MySQL berjalan.');
  process.exit(1);
}

if (!fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))) {
  console.warn(`Peringatan: frontend tidak ditemukan di ${FRONTEND_DIR}. Periksa FRONTEND_DIR di file .env (halaman web akan 404).`);
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API docs at http://localhost:${PORT}/api-docs`);
});
