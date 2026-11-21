-- Student Part-Time Job Platform — skema database MySQL 8
-- Jalankan lewat `npm run db:setup` atau impor manual (mis. phpMyAdmin / MySQL Workbench).
-- PERHATIAN: tabel-tabel di bawah di-DROP lalu dibuat ulang.

CREATE DATABASE IF NOT EXISTS db_bm_parttime CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE db_bm_parttime;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS dokumen;
DROP TABLE IF EXISTS verifikasi;
DROP TABLE IF EXISTS lamaran;
DROP TABLE IF EXISTS lowongan_jadwal;
DROP TABLE IF EXISTS lowongan;
DROP TABLE IF EXISTS employer;
DROP TABLE IF EXISTS mahasiswa_availability;
DROP TABLE IF EXISTS mahasiswa;
DROP TABLE IF EXISTS otp;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admin;
DROP TABLE IF EXISTS periode;
DROP TABLE IF EXISTS perguruan_tinggi_domain;
DROP TABLE IF EXISTS perguruan_tinggi;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------ referensi
CREATE TABLE perguruan_tinggi (
  id        VARCHAR(10)  NOT NULL,
  nama      VARCHAR(150) NOT NULL,
  singkatan VARCHAR(30)  NULL,
  jenis     ENUM('negeri','swasta') NOT NULL DEFAULT 'swasta',
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Domain email kampus; subdomain ikut diterima (ugm.ac.id juga menerima @mail.ugm.ac.id)

CREATE TABLE perguruan_tinggi_domain (
  pt_id  VARCHAR(10)  NOT NULL,
  domain VARCHAR(100) NOT NULL,
  PRIMARY KEY (pt_id, domain),
  UNIQUE KEY uq_domain (domain),
  CONSTRAINT fk_ptd_pt FOREIGN KEY (pt_id) REFERENCES perguruan_tinggi (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE periode (
  id             INT          NOT NULL AUTO_INCREMENT,
  nama           VARCHAR(100) NOT NULL,
  tanggal_mulai  DATE         NOT NULL,
  batas_berlaku  DATE         NOT NULL,
  hari_pengingat TINYINT UNSIGNED NOT NULL DEFAULT 14,
  aktif          TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------ akun
-- Admin platform: login dengan username + kata sandi; dibuat lewat seeder / langsung di DB
CREATE TABLE admin (
  id            INT          NOT NULL AUTO_INCREMENT,
  nama          VARCHAR(100) NOT NULL,
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  dibuat_pada   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB;

-- Pengguna aplikasi (Mahasiswa & Employer): login dengan email + kata sandi
CREATE TABLE users (
  id                       INT          NOT NULL AUTO_INCREMENT,
  email                    VARCHAR(150) NOT NULL,
  password_hash            VARCHAR(100) NOT NULL,
  role                     ENUM('mahasiswa','employer') NOT NULL,
  email_terverifikasi_pada DATETIME     NULL,
  dibuat_pada              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE otp (
  id               INT        NOT NULL AUTO_INCREMENT,
  user_id          INT        NOT NULL,
  kode             CHAR(6)    NOT NULL,
  kedaluwarsa_pada DATETIME   NOT NULL,
  percobaan        TINYINT    NOT NULL DEFAULT 0,
  dikirim_pada     DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dipakai_pada     DATETIME   NULL,
  PRIMARY KEY (id),
  KEY idx_otp_user (user_id),
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------ mahasiswa
CREATE TABLE mahasiswa (
  id                   VARCHAR(10)  NOT NULL,
  user_id              INT          NOT NULL,
  nama                 VARCHAR(100) NOT NULL,
  pt_id                VARCHAR(10)  NOT NULL,
  prodi                VARCHAR(100) NULL,
  jenjang              ENUM('D3','D4','S1') NULL,
  semester             TINYINT UNSIGNED NULL,
  angkatan             SMALLINT UNSIGNED NULL,
  npm                  VARCHAR(20)  NULL,
  telepon              VARCHAR(20)  NULL,
  status               ENUM('belum_verifikasi','pending','terverifikasi','ditolak','kedaluwarsa') NOT NULL DEFAULT 'belum_verifikasi',
  berlaku_sampai       DATE         NULL,
  catatan_status       VARCHAR(255) NULL,
  catatan_availability VARCHAR(300) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mhs_user (user_id),
  UNIQUE KEY uq_mhs_npm (pt_id, npm),
  CONSTRAINT fk_mhs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_mhs_pt FOREIGN KEY (pt_id) REFERENCES perguruan_tinggi (id)
) ENGINE=InnoDB;

-- slot: <hari>-<waktu>, mis. "selasa-sore"
CREATE TABLE mahasiswa_availability (
  mahasiswa_id VARCHAR(10) NOT NULL,
  slot         VARCHAR(16) NOT NULL,
  PRIMARY KEY (mahasiswa_id, slot),
  CONSTRAINT fk_avail_mhs FOREIGN KEY (mahasiswa_id) REFERENCES mahasiswa (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------ employer
CREATE TABLE employer (
  id                VARCHAR(10)  NOT NULL,
  user_id           INT          NOT NULL,
  nama              VARCHAR(150) NOT NULL,
  tipe              ENUM('umkm','startup','perusahaan','perorangan') NOT NULL,
  tipe_label        VARCHAR(60)  NOT NULL,
  pj                VARCHAR(100) NOT NULL,
  jabatan           VARCHAR(60)  NULL,
  telepon           VARCHAR(20)  NULL,
  kota              VARCHAR(60)  NOT NULL,
  alamat            VARCHAR(255) NULL,
  nib               CHAR(13)     NULL,
  website           VARCHAR(200) NULL,
  deskripsi         VARCHAR(500) NULL,
  status            ENUM('belum_verifikasi','pending','terverifikasi','ditolak') NOT NULL DEFAULT 'belum_verifikasi',
  terverifikasi_pada DATE        NULL,
  catatan_status    VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emp_user (user_id),
  CONSTRAINT fk_emp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------ lowongan
CREATE TABLE lowongan (
  id               VARCHAR(10)  NOT NULL,
  employer_id      VARCHAR(10)  NOT NULL,
  posisi           VARCHAR(100) NOT NULL,
  jenis_kerja      ENUM('part_time','freelance_proyek') NOT NULL,
  sistem_kerja     ENUM('onsite','hybrid','remote') NOT NULL,
  kota             VARCHAR(60)  NOT NULL,
  area             VARCHAR(100) NOT NULL DEFAULT '',
  alamat           VARCHAR(255) NOT NULL DEFAULT '',
  jadwal_fleksibel TINYINT(1)   NOT NULL DEFAULT 0,
  jenjang          SET('D3','D4','S1') NULL,
  durasi_nilai     SMALLINT UNSIGNED NOT NULL,
  durasi_satuan    ENUM('hari','minggu','bulan') NOT NULL,
  beban_kerja      TINYINT UNSIGNED NOT NULL,
  gaji_min         INT UNSIGNED NOT NULL,
  gaji_maks        INT UNSIGNED NULL,
  satuan_gaji      ENUM('jam','hari','bulan','proyek') NOT NULL,
  job_desk         TEXT         NOT NULL,
  kriteria         TEXT         NOT NULL,
  batas_lamaran    DATE         NOT NULL,
  tayang           DATE         NULL,
  diperbarui       DATE         NOT NULL,
  status           ENUM('draft','menunggu_moderasi','publik','ditolak','ditutup') NOT NULL DEFAULT 'draft',
  alasan_penolakan VARCHAR(255) NULL,
  catatan_moderasi VARCHAR(300) NULL,
  PRIMARY KEY (id),
  KEY idx_low_status (status),
  KEY idx_low_emp (employer_id),
  CONSTRAINT fk_low_emp FOREIGN KEY (employer_id) REFERENCES employer (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE lowongan_jadwal (
  lowongan_id VARCHAR(10) NOT NULL,
  slot        VARCHAR(16) NOT NULL,
  PRIMARY KEY (lowongan_id, slot),
  CONSTRAINT fk_jadwal_low FOREIGN KEY (lowongan_id) REFERENCES lowongan (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------ lamaran
CREATE TABLE lamaran (
  id           VARCHAR(10)  NOT NULL,
  lowongan_id  VARCHAR(10)  NOT NULL,
  mahasiswa_id VARCHAR(10)  NOT NULL,
  status       ENUM('dikirim','ditinjau','diterima','ditolak') NOT NULL DEFAULT 'dikirim',
  dikirim_pada DATE         NOT NULL,
  pesan        TEXT         NOT NULL,
  portofolio   VARCHAR(255) NULL,
  telepon      VARCHAR(20)  NULL,
  cv_path      VARCHAR(255) NULL,
  cv_nama      VARCHAR(150) NULL,
  catatan      VARCHAR(300) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lamaran (lowongan_id, mahasiswa_id),
  KEY idx_lamaran_mhs (mahasiswa_id),
  CONSTRAINT fk_lm_low FOREIGN KEY (lowongan_id) REFERENCES lowongan (id) ON DELETE CASCADE,
  CONSTRAINT fk_lm_mhs FOREIGN KEY (mahasiswa_id) REFERENCES mahasiswa (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------ verifikasi akun
CREATE TABLE verifikasi (
  id            VARCHAR(10) NOT NULL,
  peran         ENUM('mahasiswa','employer') NOT NULL,
  mahasiswa_id  VARCHAR(10) NULL,
  employer_id   VARCHAR(10) NULL,
  jenis         ENUM('awal','re_verifikasi') NOT NULL DEFAULT 'awal',
  periode_id    INT         NULL,
  diajukan      DATE        NOT NULL,
  status        ENUM('pending','disetujui','ditolak') NOT NULL DEFAULT 'pending',
  jenis_bukti   ENUM('krs','surat') NULL,
  semester      TINYINT UNSIGNED NULL,
  alasan        VARCHAR(255) NULL,
  catatan       VARCHAR(300) NULL,
  ket           VARCHAR(255) NULL,
  ditinjau_oleh INT         NULL,
  ditinjau_pada DATETIME    NULL,
  PRIMARY KEY (id),
  KEY idx_verif_status (status),
  CONSTRAINT fk_v_mhs FOREIGN KEY (mahasiswa_id) REFERENCES mahasiswa (id) ON DELETE CASCADE,
  CONSTRAINT fk_v_emp FOREIGN KEY (employer_id) REFERENCES employer (id) ON DELETE CASCADE,
  CONSTRAINT fk_v_periode FOREIGN KEY (periode_id) REFERENCES periode (id) ON DELETE SET NULL,
  CONSTRAINT fk_v_admin FOREIGN KEY (ditinjau_oleh) REFERENCES admin (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE dokumen (
  id            INT          NOT NULL AUTO_INCREMENT,
  verifikasi_id VARCHAR(10)  NOT NULL,
  jenis         ENUM('ktm','bukti_aktif','legalitas','identitas') NOT NULL,
  path          VARCHAR(255) NOT NULL,
  nama_asli     VARCHAR(150) NOT NULL,
  mime          VARCHAR(60)  NOT NULL,
  ukuran        INT UNSIGNED NOT NULL,
  diunggah_pada DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_dok_v FOREIGN KEY (verifikasi_id) REFERENCES verifikasi (id) ON DELETE CASCADE
) ENGINE=InnoDB;
