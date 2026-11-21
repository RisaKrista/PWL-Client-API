import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_bm_parttime',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Kolom DATE dikembalikan sebagai string 'YYYY-MM-DD', sama seperti format di frontend
  dateStrings: true
});

export default pool;
