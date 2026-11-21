import db from '../database/db.js';

const BASE_SELECT = `
  SELECT l.*,
         e.nama AS employer_nama, e.tipe AS employer_tipe, e.tipe_label AS employer_tipe_label,
         e.kota AS employer_kota, e.status AS employer_status, e.terverifikasi_pada AS employer_terverifikasi_pada,
         (SELECT COUNT(*) FROM lamaran x WHERE x.lowongan_id = l.id) AS jumlah_pelamar
  FROM lowongan l
  JOIN employer e ON e.id = l.employer_id`;

// Mengubah baris DB menjadi bentuk objek lowongan yang dipakai frontend
const format = (r, jadwal) => ({
  id: r.id,
  employer_id: r.employer_id,
  posisi: r.posisi,
  jenis_kerja: r.jenis_kerja,
  sistem_kerja: r.sistem_kerja,
  kota: r.kota,
  area: r.area,
  alamat: r.alamat,
  jadwal: jadwal[r.id] || [],
  jadwal_fleksibel: !!r.jadwal_fleksibel,
  jenjang: r.jenjang ? r.jenjang.split(',') : null,
  durasi_nilai: r.durasi_nilai,
  durasi_satuan: r.durasi_satuan,
  beban_kerja: r.beban_kerja,
  gaji_min: r.gaji_min,
  gaji_maks: r.gaji_maks,
  satuan_gaji: r.satuan_gaji,
  job_desk: r.job_desk,
  kriteria: r.kriteria,
  batas_lamaran: r.batas_lamaran,
  tayang: r.tayang,
  diperbarui: r.diperbarui,
  status: r.status,
  alasan_penolakan: r.alasan_penolakan,
  catatan_moderasi: r.catatan_moderasi,
  jumlah_pelamar: Number(r.jumlah_pelamar),
  employer: {
    id: r.employer_id,
    nama: r.employer_nama,
    tipe: r.employer_tipe,
    tipe_label: r.employer_tipe_label,
    kota: r.employer_kota,
    status: r.employer_status,
    terverifikasi_pada: r.employer_terverifikasi_pada
  }
});

// where/params: potongan SQL setelah WHERE; orderBy: potongan ORDER BY
export const findLowongan = async ({ where = '1 = 1', params = [], orderBy = 'l.diperbarui DESC, l.id DESC', limit, conn = db } = {}) => {
  const [rows] = await conn.query(`${BASE_SELECT} WHERE ${where} ORDER BY ${orderBy}${limit ? ` LIMIT ${Number(limit)}` : ''}`, params);
  if (!rows.length) return [];
  const [slots] = await conn.query(
    'SELECT lowongan_id, slot FROM lowongan_jadwal WHERE lowongan_id IN (?)',
    [rows.map((r) => r.id)]
  );
  const jadwal = {};
  slots.forEach((s) => (jadwal[s.lowongan_id] = jadwal[s.lowongan_id] || []).push(s.slot));
  return rows.map((r) => format(r, jadwal));
};

export const findLowonganById = async (id, conn = db) => {
  const [l] = await findLowongan({ where: 'l.id = ?', params: [id], conn });
  return l || null;
};
