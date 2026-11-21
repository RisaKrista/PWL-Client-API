// Membuat ulang database dari database/schema.sql lalu mengisi database/seed.sql
// Pemakaian: npm run db:setup   (atau: npm run db:setup -- --no-seed)
// Catatan: server juga membuat database otomatis saat start bila belum ada.
import { runSetup } from '../src/database/setup.js';

try {
  await runSetup({ seed: !process.argv.includes('--no-seed') });
} catch (err) {
  console.error(`Gagal menyiapkan database: ${err.message}`);
  console.error('Periksa DB_HOST, DB_PORT, DB_USER, dan DB_PASSWORD di file .env, dan pastikan MySQL berjalan.');
  process.exit(1);
}
