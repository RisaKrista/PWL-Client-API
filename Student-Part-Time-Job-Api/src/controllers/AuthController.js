import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { loadUser, signToken } from '../services/account.js';
import { HttpError, handleError } from '../utils/errors.js';
import { nextId, withTransaction } from '../utils/ids.js';
import { createValidator, str, isStrongPassword, isEmailPribadi, emailCocokDomain, EMAIL_RE, TELEPON_RE } from '../utils/validate.js';

const OTP_TTL_MENIT = 10;
const OTP_MAKS_PERCOBAAN = 3;
const OTP_JEDA_DETIK = 60;
const TIPE_LABEL = { umkm: 'UMKM', startup: 'Startup', perusahaan: 'Perusahaan', perorangan: 'Perorangan' };
const PESAN_PASSWORD = 'Kata sandi minimal 8 karakter dan memuat huruf serta angka.';

// Mode dev: kode OTP dicetak ke console (dan ikut di response bila NODE_ENV=development)
const createOtp = async (conn, user) => {
  const kode = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await conn.query('UPDATE otp SET dipakai_pada = NOW() WHERE user_id = ? AND dipakai_pada IS NULL', [user.id]);
  await conn.query(
    'INSERT INTO otp (user_id, kode, kedaluwarsa_pada) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [user.id, kode, OTP_TTL_MENIT]
  );
  console.log(`[OTP] ${user.email} → ${kode} (berlaku ${OTP_TTL_MENIT} menit)`);
  return kode;
};

const otpResponse = (email, kode) => ({
  message: 'Kode verifikasi telah dikirim ke email Anda.',
  email,
  ...(process.env.NODE_ENV === 'development' && { otp_dev: kode })
});

const ensureEmailFree = async (email) => {
  const [[exists]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (exists) throw new HttpError(409, 'Email ini sudah terdaftar. Silakan masuk.', { email: 'Email ini sudah terdaftar. Silakan masuk.' });
};

export const registerMahasiswa = async (req, res) => {
  try {
    const nama = str(req.body.nama);
    const ptId = str(req.body.pt_id);
    const email = str(req.body.email).toLowerCase();
    const password = req.body.password;

    const v = createValidator();
    v.check('nama', nama.length >= 3 && nama.length <= 100, 'Nama lengkap minimal 3 karakter.');
    v.check('pt_id', ptId, 'Pilih perguruan tinggi.');
    v.check('email', EMAIL_RE.test(email), 'Format email tidak valid.');
    v.check('email', !isEmailPribadi(email), 'Gunakan email kampus. Email pribadi (mis. Gmail) tidak dapat digunakan.');
    v.check('password', isStrongPassword(password), PESAN_PASSWORD);
    if (ptId && !v.errors.email) {
      const [domains] = await db.query('SELECT domain FROM perguruan_tinggi_domain WHERE pt_id = ?', [ptId]);
      if (v.check('pt_id', domains.length, 'Perguruan tinggi tidak ditemukan.')) {
        v.check('email', emailCocokDomain(email, domains.map((d) => d.domain)), 'Domain email ini tidak sesuai dengan perguruan tinggi yang dipilih.');
      }
    }
    v.throwIfAny();
    await ensureEmailFree(email);

    const hash = await bcrypt.hash(password, 10);
    const kode = await withTransaction(db, async (conn) => {
      const [r] = await conn.query("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'mahasiswa')", [email, hash]);
      const id = await nextId(conn, 'mahasiswa', 'M-', 2);
      await conn.query('INSERT INTO mahasiswa (id, user_id, nama, pt_id) VALUES (?, ?, ?, ?)', [id, r.insertId, nama, ptId]);
      return createOtp(conn, { id: r.insertId, email });
    });
    res.status(201).json(otpResponse(email, kode));
  } catch (err) {
    handleError(res, err);
  }
};

export const registerEmployer = async (req, res) => {
  try {
    const tipe = str(req.body.tipe);
    const pj = str(req.body.pj);
    const nama = str(req.body.nama) || pj; // nama usaha opsional untuk perorangan
    const jabatan = str(req.body.jabatan) || null;
    const email = str(req.body.email).toLowerCase();
    const telepon = str(req.body.telepon);
    const kota = str(req.body.kota);
    const password = req.body.password;

    const v = createValidator();
    v.check('tipe', TIPE_LABEL[tipe], 'Pilih tipe employer.');
    if (tipe !== 'perorangan') v.check('nama', str(req.body.nama).length >= 3, 'Nama usaha wajib diisi untuk tipe UMKM, Startup, dan Perusahaan.');
    v.check('pj', pj.length >= 3 && pj.length <= 100, 'Nama penanggung jawab minimal 3 karakter.');
    v.check('email', EMAIL_RE.test(email), 'Format email tidak valid.');
    v.check('telepon', TELEPON_RE.test(telepon), 'Nomor telepon harus diawali 08 dan terdiri atas 10–13 digit.');
    v.check('kota', kota, 'Pilih kota.');
    v.check('password', isStrongPassword(password), PESAN_PASSWORD);
    v.throwIfAny();
    await ensureEmailFree(email);

    const hash = await bcrypt.hash(password, 10);
    const kode = await withTransaction(db, async (conn) => {
      const [r] = await conn.query("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'employer')", [email, hash]);
      const id = await nextId(conn, 'employer', 'E-', 2);
      await conn.query(
        'INSERT INTO employer (id, user_id, nama, tipe, tipe_label, pj, jabatan, telepon, kota) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, r.insertId, nama, tipe, TIPE_LABEL[tipe], pj, jabatan, telepon, kota]
      );
      return createOtp(conn, { id: r.insertId, email });
    });
    res.status(201).json(otpResponse(email, kode));
  } catch (err) {
    handleError(res, err);
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const email = str(req.body.email).toLowerCase();
    const kode = str(req.body.kode);
    const [[user]] = await db.query('SELECT id, email, role, email_terverifikasi_pada FROM users WHERE email = ?', [email]);
    if (!user) throw new HttpError(404, 'Akun dengan email ini tidak ditemukan.');
    if (user.email_terverifikasi_pada) throw new HttpError(400, 'Email sudah terverifikasi. Silakan masuk.');

    const [[otp]] = await db.query(
      'SELECT id, kode, percobaan, kedaluwarsa_pada < NOW() AS kedaluwarsa FROM otp WHERE user_id = ? AND dipakai_pada IS NULL ORDER BY id DESC LIMIT 1',
      [user.id]
    );
    if (!otp || otp.kedaluwarsa) throw new HttpError(400, 'Kode verifikasi sudah tidak berlaku. Kirim ulang kode untuk mendapatkan kode baru.');
    if (otp.percobaan >= OTP_MAKS_PERCOBAAN) throw new HttpError(429, 'Kode verifikasi salah 3 kali. Kirim ulang kode untuk mendapatkan kode baru.', { sisa_percobaan: 0 });

    if (otp.kode !== kode) {
      await db.query('UPDATE otp SET percobaan = percobaan + 1 WHERE id = ?', [otp.id]);
      const sisa = OTP_MAKS_PERCOBAAN - otp.percobaan - 1;
      throw sisa > 0
        ? new HttpError(400, `Kode verifikasi salah. Sisa percobaan: ${sisa}.`, { sisa_percobaan: sisa })
        : new HttpError(429, 'Kode verifikasi salah 3 kali. Kirim ulang kode untuk mendapatkan kode baru.', { sisa_percobaan: 0 });
    }

    await db.query('UPDATE otp SET dipakai_pada = NOW() WHERE id = ?', [otp.id]);
    await db.query('UPDATE users SET email_terverifikasi_pada = NOW() WHERE id = ?', [user.id]);
    // Langsung masuk agar dapat melanjutkan ke unggah dokumen verifikasi
    res.json({ token: signToken(user), user: await loadUser(user.id, user.role) });
  } catch (err) {
    handleError(res, err);
  }
};

export const resendOtp = async (req, res) => {
  try {
    const email = str(req.body.email).toLowerCase();
    const [[user]] = await db.query('SELECT id, email, email_terverifikasi_pada FROM users WHERE email = ?', [email]);
    if (!user) throw new HttpError(404, 'Akun dengan email ini tidak ditemukan.');
    if (user.email_terverifikasi_pada) throw new HttpError(400, 'Email sudah terverifikasi. Silakan masuk.');
    const [[last]] = await db.query(
      'SELECT TIMESTAMPDIFF(SECOND, dikirim_pada, NOW()) AS detik FROM otp WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [user.id]
    );
    if (last && last.detik < OTP_JEDA_DETIK) {
      throw new HttpError(429, `Tunggu ${OTP_JEDA_DETIK - last.detik} detik sebelum mengirim ulang kode.`);
    }
    const kode = await createOtp(db, user);
    res.json(otpResponse(email, kode));
  } catch (err) {
    handleError(res, err);
  }
};

// Admin masuk dengan username (tabel admin)
const loginAdmin = async (username, password) => {
  const [[admin]] = await db.query('SELECT id, password_hash FROM admin WHERE username = ?', [username]);
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    throw new HttpError(401, 'Username atau kata sandi salah. Periksa kembali lalu coba lagi.');
  }
  return { token: signToken({ id: admin.id, role: 'admin' }), user: await loadUser(admin.id, 'admin') };
};

// Satu form masuk: email → Mahasiswa/Employer (tabel users), username tanpa "@" → Admin (tabel admin)
export const login = async (req, res) => {
  try {
    const identitas = str(req.body.username || req.body.email).toLowerCase();
    const password = req.body.password || '';
    if (identitas && !identitas.includes('@')) return res.json(await loginAdmin(identitas, password));

    const email = identitas;
    const [[user]] = await db.query('SELECT id, email, role, password_hash, email_terverifikasi_pada FROM users WHERE email = ?', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, 'Email atau kata sandi salah. Periksa kembali lalu coba lagi.');
    }
    if (!user.email_terverifikasi_pada) {
      const kode = await createOtp(db, user);
      return res.status(403).json({
        ...otpResponse(email, kode),
        message: 'Email belum diverifikasi. Kode verifikasi baru telah dikirim.',
        perlu_otp: true
      });
    }
    res.json({ token: signToken(user), user: await loadUser(user.id, user.role) });
  } catch (err) {
    handleError(res, err);
  }
};

export const me = async (req, res) => {
  res.json(req.user);
};
