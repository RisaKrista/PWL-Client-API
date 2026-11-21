# PWL-Client-API

A platform where university students (Mahasiswa) find part-time jobs posted by verified employers. Admins verify accounts and moderate job postings.

The repo has two projects:

| Folder | What it is |
| --- | --- |
| [`Student-Part-Time-Job-Api`](Student-Part-Time-Job-Api/README.md) | REST API: Node.js, Express 5, MySQL 8, JWT auth, Swagger docs |
| [`Student-Part-Time-Job-Platform`](Student-Part-Time-Job-Platform/README.md) | Frontend: static HTML, CSS and vanilla JS, with no build step |

The API also serves the frontend, so you only need to run one server.

## Requirements
- Node.js 20 or newer (for example `nvm use 22.2.0`)
- MySQL 8

## Quick start
```bash
cd Student-Part-Time-Job-Api
npm install      # fill in DB_USER / DB_PASSWORD
npm run dev
```

On first start the server creates the `db_bm_parttime` database and loads the initial data.

| URL | Page |
| --- | --- |
| http://localhost:3000/ | Page hub (links to every page) |
| http://localhost:3000/pages/umum/masuk.html | Login |
| http://localhost:3000/api-docs | API docs (Swagger) |

Default admin login: **admin** / **admin123**. Change it after installation.

## Roles
- **Mahasiswa (student):** registers with a campus email, uploads verification documents, sets availability, then searches and applies for jobs.
- **Employer:** registers, uploads legal documents for verification, posts jobs and manages applicants.
- **Admin:** verifies accounts, moderates job postings, monitors student eligibility and manages the list of universities.

## More details
- Setup, environment variables, the database, auth and adding admins: [API README](Student-Part-Time-Job-Api/README.md)
- Page structure and adding a page: [Frontend README](Student-Part-Time-Job-Platform/README.md)
