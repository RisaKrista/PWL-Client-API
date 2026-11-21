// Membuat skema (database/schema.sql) dan mengisi data awal/master (database/seed.sql).
// Dipakai oleh `npm run db:setup` dan otomatis saat server start (ensureDatabase).
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const SQL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'database');
const DB_NAME = process.env.DB_NAME || 'db_bm_parttime';

// Nama database di file SQL bisa diganti lewat DB_NAME
const readSql = (file) => fs.readFileSync(path.join(SQL_DIR, file), 'utf8').replaceAll('db_bm_parttime', DB_NAME);

// Daftar tabel diambil dari schema.sql agar tidak perlu ditulis dua kali
const TABLES = [...readSql('schema.sql').matchAll(/CREATE TABLE (\w+)/g)].map((m) => m[1]);

// Koneksi tanpa memilih database (database mungkin belum ada)
const connect = () => mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
});

// Membuat ulang semua tabel (DROP + CREATE), lalu mengisi data awal bila seed = true
export const runSetup = async ({ seed = true } = {}) => {
  const conn = await connect();
  try {
    await conn.query(readSql('schema.sql'));
    console.log(`Skema dibuat di database "${DB_NAME}".`);
    if (seed) {
      await conn.query(readSql('seed.sql'));
      console.log('Data awal dimuat: perguruan tinggi, periode, dan akun Admin (username: admin, kata sandi: admin123).');
    }
  } finally {
    await conn.end();
  }
};

// Dipanggil saat server start: bila database/tabel belum ada → buat skema + data awal.
// Database yang sudah berisi tabel tidak pernah diubah.
export const ensureDatabase = async () => {
  const conn = await connect();
  let ada;
  try {
    const [rows] = await conn.query(
      'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ? AND table_name IN (?)',
      [DB_NAME, TABLES]
    );
    ada = rows.length;
  } finally {
    await conn.end();
  }

  if (ada === TABLES.length) return;
  if (ada === 0) {
    console.log(`Database "${DB_NAME}" belum ada atau kosong — membuat skema dan data awal...`);
    await runSetup({ seed: true });
    return;
  }
  console.warn(
    `Peringatan: database "${DB_NAME}" hanya memiliki ${ada} dari ${TABLES.length} tabel. ` +
    'Jalankan `npm run db:setup` untuk membuat ulang (data yang ada akan dihapus).'
  );
};
