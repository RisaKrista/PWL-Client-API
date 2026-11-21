-- Student Part-Time Job Platform — data awal (master data)
-- Hanya data referensi + satu akun Admin (tabel admin). Mahasiswa, Employer, lowongan, lamaran, dan
-- verifikasi dibuat lewat aplikasi (registrasi → verifikasi Admin → posting lowongan → lamaran).
USE db_bm_parttime;

-- Perguruan tinggi & domain email kampus (subdomain ikut diterima, mis. @student.widyatama.ac.id)
-- 10 PTN + 10 PTS teratas versi Webometrics Januari 2026, ditambah Universitas Widyatama.
INSERT INTO perguruan_tinggi (id, nama, singkatan, jenis) VALUES
  ('PT-01', 'Universitas Indonesia', 'UI', 'negeri'),
  ('PT-02', 'Universitas Gadjah Mada', 'UGM', 'negeri'),
  ('PT-03', 'Institut Teknologi Bandung', 'ITB', 'negeri'),
  ('PT-04', 'IPB University', 'IPB', 'negeri'),
  ('PT-05', 'Universitas Brawijaya', 'UB', 'negeri'),
  ('PT-06', 'Universitas Diponegoro', 'Undip', 'negeri'),
  ('PT-07', 'Universitas Sebelas Maret', 'UNS', 'negeri'),
  ('PT-08', 'Institut Teknologi Sepuluh Nopember', 'ITS', 'negeri'),
  ('PT-09', 'Universitas Hasanuddin', 'Unhas', 'negeri'),
  ('PT-10', 'Universitas Pendidikan Indonesia', 'UPI', 'negeri'),
  ('PT-11', 'Universitas Bina Nusantara', 'BINUS', 'swasta'),
  ('PT-12', 'Telkom University', 'Tel-U', 'swasta'),
  ('PT-13', 'Universitas Muhammadiyah Yogyakarta', 'UMY', 'swasta'),
  ('PT-14', 'Universitas Muhammadiyah Malang', 'UMM', 'swasta'),
  ('PT-15', 'Universitas Muhammadiyah Surakarta', 'UMS', 'swasta'),
  ('PT-16', 'Universitas Medan Area', 'UMA', 'swasta'),
  ('PT-17', 'Universitas Pelita Harapan', 'UPH', 'swasta'),
  ('PT-18', 'Universitas Kristen Satya Wacana', 'UKSW', 'swasta'),
  ('PT-19', 'Universitas Katolik Parahyangan', 'Unpar', 'swasta'),
  ('PT-20', 'Universitas Ahmad Dahlan', 'UAD', 'swasta'),
  ('PT-21', 'Universitas Widyatama', 'UTama', 'swasta');
INSERT INTO perguruan_tinggi_domain (pt_id, domain) VALUES
  ('PT-01', 'ui.ac.id'),
  ('PT-02', 'ugm.ac.id'),
  ('PT-03', 'itb.ac.id'),
  ('PT-04', 'ipb.ac.id'),
  ('PT-05', 'ub.ac.id'),
  ('PT-06', 'undip.ac.id'),
  ('PT-07', 'uns.ac.id'),
  ('PT-08', 'its.ac.id'),
  ('PT-09', 'unhas.ac.id'),
  ('PT-10', 'upi.edu'),
  ('PT-11', 'binus.ac.id'),
  ('PT-12', 'telkomuniversity.ac.id'),
  ('PT-13', 'umy.ac.id'),
  ('PT-14', 'umm.ac.id'),
  ('PT-15', 'ums.ac.id'),
  ('PT-16', 'uma.ac.id'),
  ('PT-17', 'uph.edu'),
  ('PT-18', 'uksw.edu'),
  ('PT-19', 'unpar.ac.id'),
  ('PT-20', 'uad.ac.id'),
  ('PT-21', 'widyatama.ac.id');

-- Periode semester aktif (menentukan masa berlaku verifikasi mahasiswa)
INSERT INTO periode (id, nama, tanggal_mulai, batas_berlaku, hari_pengingat, aktif) VALUES
  (1, 'Semester Ganjil 2026/2027', '2026-09-01', '2027-02-28', 14, 1);

-- Akun Admin (tabel admin, login dengan username) — ganti kata sandi setelah instalasi
-- username: admin · kata sandi: admin123
INSERT INTO admin (id, nama, username, password_hash) VALUES
  (1, 'Administrator', 'admin', '$2b$10$XlaDgRNuCw126YwmwddhuOBTOxTbdGOoYx6VaoLSeO4R2LDHtnD9G');
