# Student Part-Time Job Platform — Frontend

A static frontend (HTML, CSS and vanilla JS, with no build step) for the **Student-Part-Time-Job-Api** REST API. All data comes from the API (MySQL, JWT auth). This folder has no database or backend of its own.

> This folder used to be a Laravel 12 app and was converted to use our API.

## Running it
The API serves this folder, so you don't need a separate web server:
```powershell
cd ..\Student-Part-Time-Job-Api
nvm use 22.2.0          # Node 20+
npm install             # first time only
npm run dev
```
Then open:
- http://localhost:3000/ to see every page
- http://localhost:3000/pages/umum/masuk.html to log in. The default admin is **admin** / **admin123**.

The API's `.env` points at this folder with `FRONTEND_DIR=../Student-Part-Time-Job-Platform`.

## Structure
```
index.html                 page hub
assets/
  css/styles.css, fonts.css
  fonts/                   Plus Jakarta Sans (local, OFL license)
  js/lucide.min.js         icons (local, no CDN)
pages/
  umum/       beranda, masuk
  mahasiswa/  registrasi, verifikasi-email, verifikasi-status, cari-lowongan, detail-lowongan,
              formulir-lamaran, lamaran-saya, profil-availability, status-akses
  employer/   registrasi, verifikasi-email, verifikasi, dashboard, formulir-lowongan,
              lowongan-saya, kelola-pelamar
  admin/      dashboard, verifikasi-akun, tinjau-verifikasi, moderasi-lowongan,
              monitoring-eligibilitas, perguruan-tinggi
  error/      403, 404, 500
src/
  api.js                   REST client (JWT stored in localStorage)
  core/                    utils.js, ui.js, forms.js (shared code)
  views/                   auth.js, mahasiswa.js, employer.js, admin.js (one PAGES["…"] per page)
  boot.js                  login/role check, then runs PAGES[data-page]
```
Every page has `<body data-page="MHS-04" data-role="mahasiswa">`. `boot.js` checks the login and role and then runs the matching page handler. Script order matters: `api.js` → `core/*` → `views/<role>.js` → `boot.js`.

## Adding a page
1. Create `pages/<role>/<name>.html` with a `data-page`/`data-role` and the same `<script>` tags as other pages of that role.
2. Write `PAGES["XXX-NN"] = async (state) => { … }` in `src/views/<role>.js`.
3. Link to other pages relatively: `../<role>/<page>.html`.
