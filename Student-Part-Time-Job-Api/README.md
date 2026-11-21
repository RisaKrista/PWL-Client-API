# Student Part-Time Job Platform — API

REST API (Express 5 + MySQL) for the `Student-Part-Time-Job-Platform` frontend (set by `FRONTEND_DIR` in `.env`). The server also serves the frontend, so it runs at `http://localhost:3000/`.

## Requirements
- **Node.js 20 or newer.** Some dependencies (swagger-jsdoc → lru-cache, and prisma) don't run on Node 18. With nvm, run `nvm use 22.2.0`.
- MySQL 8

## Setup
```bash
npm install
cp .env.example .env      # fill in DB_USER / DB_PASSWORD
npm run dev               # or: npm start
```
- App: http://localhost:3000/ (page hub) · Login: http://localhost:3000/pages/umum/masuk.html
- API docs (Swagger): http://localhost:3000/api-docs

**On first start the server creates the database automatically.** If `db_bm_parttime` doesn't exist or has no tables, it creates the schema and loads the initial data. A database that already has tables is never changed.

To reset everything back to the initial data, run `npm run db:setup`. It **drops and recreates** the platform tables. For a manual import, run `database/schema.sql` then `database/seed.sql`.

## Initial data
`database/seed.sql` contains only master data:
- 21 universities (`perguruan_tinggi`: 10 PTN + 10 PTS from Webometrics Jan 2026, plus Universitas Widyatama) and their campus email domains. Subdomains are accepted, so `widyatama.ac.id` also accepts `@student.widyatama.ac.id`. Admins manage this list on the Perguruan Tinggi page (ADM-06).
- the active semester period
- one Admin in the `admin` table: username **admin**, password **admin123** (change it after installation)

There are no sample students, employers, jobs, applications or verifications. Create them through the app: register as Mahasiswa or Employer → upload verification documents → Admin approves → the employer posts a job → Admin moderates it → the student applies.

## Authentication
- **JWT:** `POST /api/auth/login` returns a token (valid for `JWT_EXPIRES_IN`, default 1 day). Send it as `Authorization: Bearer <token>`. Every route except login/registration/OTP and the reference data requires it.
- **Roles:** Mahasiswa and Employer log in with **email** (table `users`) after verifying it by OTP. Admins log in with a **username** (table `admin`) on the same login page. Each route checks the role, e.g. `/api/admin/*` is admin-only and returns 403 for other roles.
- **Passwords** are stored as bcrypt hashes.

### Adding an admin manually
1. Generate a password hash:
   ```bash
   node -e "console.log(require('bcryptjs').hashSync('kata-sandi-baru', 10))"
   ```
2. Insert it into the `admin` table:
   ```sql
   INSERT INTO admin (nama, username, password_hash) VALUES ('Nama Admin', 'username', '<hash dari langkah 1>');
   ```
To change a password, run step 1 and then `UPDATE admin SET password_hash = '<hash>' WHERE username = 'admin';`.

## Notes
- **OTP:** in development mode, the registration OTP code is printed to the server console. With `NODE_ENV=development` it is also returned in the response as `otp_dev` and shown on the OTP page.
- **Uploads:** files (KTM, proof of active status, legal documents, PDF CV) are stored in `UPLOAD_DIR` (default `uploads/`). They are only accessible through the authenticated `/api/files/...` endpoints.
- **`APP_TODAY`:** optionally overrides the server's "today" date (format `YYYY-MM-DD`) for testing. Leave it empty to use the real date.

## Structure
```
database/      schema.sql, seed.sql
scripts/       db-setup.js
src/
  controllers/ Auth, Reference, Lowongan, Mahasiswa, Employer, Admin, File, User
  routes/      one router per area, each documented with @openapi
  middleware/  auth.js (JWT + role), upload.js (multer)
  services/    account, lowongan, verifikasi
  utils/       errors, validate, dates, slots, ids
```
