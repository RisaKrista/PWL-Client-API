import db from '../database/db.js';
import { getActivePeriode } from '../services/account.js';
import { findLowongan, findLowonganById } from '../services/lowongan.js';
import { BUKTI_LABEL } from '../services/verifikasi.js';
import { HttpError, handleError } from '../utils/errors.js';
import { nextId, withTransaction } from '../utils/ids.js';
import { today, daysBetween } from '../utils/dates.js';
import { createValidator, str, int, ISO_DATE_RE, DOMAIN_RE, emailCocokDomain, pecahDomain } from '../utils/validate.js';

const VERIF_SELECT = `
  SELECT v.*, p.nama AS periode,
         COALESCE(m.nama, e.nama) AS nama, u.email,
         COALESCE(pt.nama, e.tipe_label) AS asal,
         COALESCE(v.mahasiswa_id, v.employer_id) AS user
  FROM verifikasi v
  LEFT JOIN mahasiswa m ON m.id = v.mahasiswa_id
  LEFT JOIN perguruan_tinggi pt ON pt.id = m.pt_id
  LEFT JOIN employer e ON e.id = v.employer_id
  JOIN users u ON u.id = COALESCE(m.user_id, e.user_id)
  LEFT JOIN periode p ON p.id = v.periode_id`;

const formatVerif = (v) => ({
  id: v.id,
  user: v.user,
  peran: v.peran,
  nama: v.nama,
  email: v.email,
  asal: v.asal,
  jenis: v.jenis,
  periode: v.periode || '—',
  diajukan: v.diajukan,
  status: v.status,
  jenis_bukti: v.jenis_bukti,
  bukti: BUKTI_LABEL[v.jenis_bukti] || null,
  semester: v.semester,
  alasan: v.alasan,
  catatan: v.catatan,
  ket: v.ket,
  ditinjau_pada: v.ditinjau_pada
});

// ------------------------------------------------------------ dashboard
export const getDashboard = async (req, res) => {
  try {
    const periode = await getActivePeriode();
    const [verif] = await db.query(`${VERIF_SELECT} WHERE v.status = 'pending' ORDER BY v.diajukan ASC, v.id ASC`);
    const moderasi = await findLowongan({ where: "l.status = 'menunggu_moderasi'", orderBy: 'l.diperbarui ASC, l.id ASC' });
    const [[segera]] = await db.query(
      "SELECT COUNT(*) AS n FROM mahasiswa WHERE status = 'terverifikasi' AND DATEDIFF(berlaku_sampai, ?) <= ?",
      [today(), periode?.hari_pengingat ?? 14]
    );
    res.json({
      verifikasi_pending: verif.map(formatVerif),
      moderasi_pending: moderasi,
      verifikasi_segera_berakhir: Number(segera.n)
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------------------------------------ verifikasi akun
export const listVerifikasi = async (req, res) => {
  try {
    const where = ['1 = 1'];
    const params = [];
    for (const key of ['peran', 'status', 'jenis']) {
      const val = str(req.query[key]);
      if (val) {
        where.push(`v.${key} = ?`);
        params.push(val);
      }
    }
    const q = str(req.query.q).toLowerCase();
    if (q) {
      where.push('LOWER(CONCAT_WS(\' \', COALESCE(m.nama, e.nama), u.email)) LIKE ?');
      params.push(`%${q}%`);
    }
    const [rows] = await db.query(`${VERIF_SELECT} WHERE ${where.join(' AND ')} ORDER BY v.diajukan DESC, v.id DESC`, params);
    res.json(rows.map(formatVerif));
  } catch (err) {
    handleError(res, err);
  }
};

export const getVerifikasi = async (req, res) => {
  try {
    const [[v]] = await db.query(`${VERIF_SELECT} WHERE v.id = ?`, [req.params.id]);
    if (!v) throw new HttpError(404, 'Pengajuan verifikasi tidak ditemukan.');
    const [dokumen] = await db.query('SELECT id, jenis, nama_asli, mime, ukuran FROM dokumen WHERE verifikasi_id = ?', [v.id]);
    const result = { ...formatVerif(v), dokumen, periode_aktif: await getActivePeriode() };

    if (v.peran === 'mahasiswa') {
      const [[m]] = await db.query(
        `SELECT m.id, m.nama, m.pt_id, p.nama AS pt_nama, u.email, m.prodi, m.jenjang, m.semester, m.angkatan, m.npm, m.status, m.berlaku_sampai
         FROM mahasiswa m JOIN perguruan_tinggi p ON p.id = m.pt_id JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
        [v.mahasiswa_id]
      );
      const [[dup]] = await db.query(
        'SELECT COUNT(*) AS n FROM mahasiswa WHERE pt_id = ? AND npm = ? AND id <> ?',
        [m.pt_id, m.npm, m.id]
      );
      const [domains] = await db.query('SELECT domain FROM perguruan_tinggi_domain WHERE pt_id = ?', [m.pt_id]);
      result.mahasiswa = {
        ...m,
        npm_duplikat: Number(dup.n) > 0,
        domain_cocok: emailCocokDomain(m.email, domains.map((d) => d.domain))
      };
    } else {
      const [[e]] = await db.query(
        'SELECT e.*, u.email FROM employer e JOIN users u ON u.id = e.user_id WHERE e.id = ?',
        [v.employer_id]
      );
      delete e.user_id;
      result.employer = e;
    }
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
};

export const putuskanVerifikasi = async (req, res) => {
  try {
    const keputusan = str(req.body.keputusan);
    const alasan = str(req.body.alasan);
    const catatan = str(req.body.catatan);
    const v = createValidator();
    v.check('keputusan', ['setujui', 'tolak'].includes(keputusan), 'Pilih keputusan.');
    if (keputusan === 'tolak') {
      v.check('alasan', alasan, 'Pilih alasan penolakan.');
      if (alasan === 'Lainnya') v.check('catatan', catatan, 'Catatan wajib diisi bila alasan Lainnya.');
    }
    v.check('catatan', catatan.length <= 300, 'Catatan maksimal 300 karakter.');
    v.throwIfAny();

    const [[verif]] = await db.query('SELECT * FROM verifikasi WHERE id = ?', [req.params.id]);
    if (!verif) throw new HttpError(404, 'Pengajuan verifikasi tidak ditemukan.');
    if (verif.status !== 'pending') throw new HttpError(409, 'Pengajuan ini sudah diputuskan.');

    const setuju = keputusan === 'setujui';
    const periode = await getActivePeriode();
    const alasanTampil = alasan === 'Lainnya' ? catatan : alasan;
    let ket = setuju ? null : alasanTampil;

    await withTransaction(db, async (conn) => {
      if (verif.peran === 'mahasiswa') {
        if (setuju) {
          if (!periode) throw new HttpError(409, 'Atur periode semester terlebih dahulu.');
          ket = `Berlaku sampai ${periode.batas_berlaku}`;
          await conn.query(
            "UPDATE mahasiswa SET status = 'terverifikasi', berlaku_sampai = ?, catatan_status = NULL, semester = COALESCE(?, semester) WHERE id = ?",
            [periode.batas_berlaku, verif.semester, verif.mahasiswa_id]
          );
        } else if (verif.jenis === 'awal') {
          await conn.query("UPDATE mahasiswa SET status = 'ditolak', catatan_status = ? WHERE id = ?", [alasanTampil, verif.mahasiswa_id]);
        } else {
          // Re-verifikasi ditolak: status tetap (mis. kedaluwarsa), alasan dicatat
          await conn.query('UPDATE mahasiswa SET catatan_status = ? WHERE id = ?', [alasanTampil, verif.mahasiswa_id]);
        }
      } else if (setuju) {
        await conn.query(
          "UPDATE employer SET status = 'terverifikasi', terverifikasi_pada = ?, catatan_status = NULL WHERE id = ?",
          [today(), verif.employer_id]
        );
      } else {
        await conn.query("UPDATE employer SET status = 'ditolak', catatan_status = ? WHERE id = ?", [alasanTampil, verif.employer_id]);
      }
      await conn.query(
        'UPDATE verifikasi SET status = ?, alasan = ?, catatan = ?, ket = ?, ditinjau_oleh = ?, ditinjau_pada = NOW() WHERE id = ?',
        [setuju ? 'disetujui' : 'ditolak', setuju ? null : alasan, catatan || null, ket, req.user.id, verif.id]
      );
    });
    res.json({ id: verif.id, status: setuju ? 'disetujui' : 'ditolak', ket });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------------------------------------ moderasi lowongan
export const listLowongan = async (req, res) => {
  try {
    const status = str(req.query.status);
    const items = await findLowongan(status ? { where: 'l.status = ?', params: [status] } : {});
    const [counts] = await db.query('SELECT status, COUNT(*) AS n FROM lowongan GROUP BY status');
    res.json({ items, counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) });
  } catch (err) {
    handleError(res, err);
  }
};

export const moderasiLowongan = async (req, res) => {
  try {
    const l = await findLowonganById(req.params.id);
    if (!l) throw new HttpError(404, 'Lowongan tidak ditemukan.');
    if (l.status !== 'menunggu_moderasi') throw new HttpError(409, 'Lowongan ini tidak sedang menunggu moderasi.');
    const keputusan = str(req.body.keputusan);
    const alasan = str(req.body.alasan);
    const catatan = str(req.body.catatan) || null;
    const v = createValidator();
    v.check('keputusan', ['setujui', 'tolak'].includes(keputusan), 'Pilih keputusan.');
    if (keputusan === 'tolak') v.check('alasan', alasan, 'Pilih alasan penolakan.');
    v.throwIfAny();

    if (keputusan === 'setujui') {
      await db.query(
        "UPDATE lowongan SET status = 'publik', tayang = ?, alasan_penolakan = NULL, catatan_moderasi = ? WHERE id = ?",
        [today(), catatan, l.id]
      );
    } else {
      const alasanLengkap = catatan ? `${alasan}: ${catatan}` : alasan;
      await db.query(
        "UPDATE lowongan SET status = 'ditolak', alasan_penolakan = ?, catatan_moderasi = ? WHERE id = ?",
        [alasanLengkap, catatan, l.id]
      );
    }
    res.json(await findLowonganById(l.id));
  } catch (err) {
    handleError(res, err);
  }
};

export const tutupLowongan = async (req, res) => {
  try {
    const l = await findLowonganById(req.params.id);
    if (!l) throw new HttpError(404, 'Lowongan tidak ditemukan.');
    if (l.status !== 'publik') throw new HttpError(409, 'Hanya lowongan publik yang dapat ditutup.');
    const alasan = str(req.body.alasan);
    if (!alasan) throw new HttpError(422, 'Pilih alasan.', { alasan: 'Pilih alasan.' });
    await db.query("UPDATE lowongan SET status = 'ditutup', catatan_moderasi = ? WHERE id = ?", [alasan, l.id]);
    res.json(await findLowonganById(l.id));
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------------------------------------ periode & eligibilitas
export const getPeriode = async (req, res) => {
  try {
    res.json(await getActivePeriode());
  } catch (err) {
    handleError(res, err);
  }
};

export const updatePeriode = async (req, res) => {
  try {
    const nama = str(req.body.nama);
    const mulai = str(req.body.tanggal_mulai);
    const batas = str(req.body.batas_berlaku);
    const hari = int(req.body.hari_pengingat);
    const v = createValidator();
    v.check('nama', nama.length >= 3 && nama.length <= 100, 'Nama periode wajib diisi.');
    v.check('tanggal_mulai', ISO_DATE_RE.test(mulai), 'Tanggal mulai wajib diisi.');
    v.check('batas_berlaku', ISO_DATE_RE.test(batas), 'Batas berlaku wajib diisi.');
    if (!v.errors.tanggal_mulai && !v.errors.batas_berlaku) v.check('batas_berlaku', batas > mulai, 'Batas berlaku harus setelah tanggal mulai.');
    v.check('hari_pengingat', Number.isInteger(hari) && hari >= 1 && hari <= 60, 'Hari pengingat antara 1 dan 60.');
    v.throwIfAny();

    const aktif = await getActivePeriode();
    if (aktif) {
      await db.query(
        'UPDATE periode SET nama = ?, tanggal_mulai = ?, batas_berlaku = ?, hari_pengingat = ? WHERE id = ?',
        [nama, mulai, batas, hari, aktif.id]
      );
    } else {
      await db.query(
        'INSERT INTO periode (nama, tanggal_mulai, batas_berlaku, hari_pengingat, aktif) VALUES (?, ?, ?, ?, 1)',
        [nama, mulai, batas, hari]
      );
    }
    res.json(await getActivePeriode());
  } catch (err) {
    handleError(res, err);
  }
};

export const getEligibilitas = async (req, res) => {
  try {
    const periode = await getActivePeriode();
    const t = today();
    const [rows] = await db.query(
      `SELECT m.id, m.nama, u.email, p.nama AS pt_nama, m.status, m.berlaku_sampai, m.catatan_status,
              (SELECT v.id FROM verifikasi v WHERE v.mahasiswa_id = m.id AND v.jenis = 're_verifikasi' AND v.status = 'pending' LIMIT 1) AS reverifikasi_pending
       FROM mahasiswa m JOIN users u ON u.id = m.user_id JOIN perguruan_tinggi p ON p.id = m.pt_id
       ORDER BY m.id`
    );
    res.json({
      periode,
      mahasiswa: rows.map((m) => ({
        ...m,
        sisa_hari: m.status === 'terverifikasi' && m.berlaku_sampai ? daysBetween(t, m.berlaku_sampai) : null
      }))
    });
  } catch (err) {
    handleError(res, err);
  }
};

// Mengubah mahasiswa terverifikasi yang masa berlakunya lewat (per tanggal tertentu) menjadi kedaluwarsa
export const jalankanEligibilitas = async (req, res) => {
  try {
    const tanggal = str(req.body.tanggal) || today();
    if (!ISO_DATE_RE.test(tanggal)) throw new HttpError(422, 'Tanggal tidak valid.', { tanggal: 'Tanggal tidak valid.' });
    const [r] = await db.query(
      "UPDATE mahasiswa SET status = 'kedaluwarsa' WHERE status = 'terverifikasi' AND berlaku_sampai < ?",
      [tanggal]
    );
    res.json({ tanggal, jumlah_kedaluwarsa: r.affectedRows });
  } catch (err) {
    handleError(res, err);
  }
};

export const cabutVerifikasi = async (req, res) => {
  try {
    const alasan = str(req.body.alasan);
    if (!alasan) throw new HttpError(422, 'Pilih alasan.', { alasan: 'Pilih alasan.' });
    const [[m]] = await db.query('SELECT id, status FROM mahasiswa WHERE id = ?', [req.params.id]);
    if (!m) throw new HttpError(404, 'Mahasiswa tidak ditemukan.');
    if (m.status !== 'terverifikasi') throw new HttpError(409, 'Hanya akun terverifikasi yang dapat dicabut.');
    await db.query(
      "UPDATE mahasiswa SET status = 'ditolak', berlaku_sampai = NULL, catatan_status = ? WHERE id = ?",
      [`Verifikasi dicabut Admin: ${alasan}`, m.id]
    );
    res.json({ id: m.id, status: 'ditolak' });
  } catch (err) {
    handleError(res, err);
  }
};

// ------------------------------------------------------------ perguruan tinggi (ADM-06)
const PT_SELECT = `
  SELECT p.id, p.nama, p.singkatan, p.jenis,
         GROUP_CONCAT(d.domain ORDER BY d.domain) AS domain,
         (SELECT COUNT(*) FROM mahasiswa m WHERE m.pt_id = p.id) AS jumlah_mahasiswa
  FROM perguruan_tinggi p LEFT JOIN perguruan_tinggi_domain d ON d.pt_id = p.id`;
const PT_GROUP = 'GROUP BY p.id, p.nama, p.singkatan, p.jenis';

const formatPt = (r) => ({
  ...r,
  domain: r.domain ? r.domain.split(',') : [],
  jumlah_mahasiswa: Number(r.jumlah_mahasiswa)
});

const findPt = async (id, conn = db) => {
  const [[r]] = await conn.query(`${PT_SELECT} WHERE p.id = ? ${PT_GROUP}`, [id]);
  return r ? formatPt(r) : null;
};

// Validasi isian form perguruan tinggi; domain dipecah dari teks "a.ac.id, b.ac.id"
const parsePt = (body) => {
  const d = {
    nama: str(body.nama),
    singkatan: str(body.singkatan) || null,
    jenis: str(body.jenis) || 'swasta',
    domain: pecahDomain(body.domain_email)
  };
  const v = createValidator();
  v.check('nama', d.nama.length >= 3 && d.nama.length <= 150, 'Nama perguruan tinggi minimal 3 karakter.');
  v.check('singkatan', !d.singkatan || d.singkatan.length <= 30, 'Singkatan maksimal 30 karakter.');
  v.check('jenis', ['negeri', 'swasta'].includes(d.jenis), 'Pilih jenis perguruan tinggi.');
  v.check('domain_email', d.domain.length > 0, 'Isi minimal satu domain email kampus.');
  const salah = d.domain.find((x) => !DOMAIN_RE.test(x));
  if (salah) v.check('domain_email', false, `Domain "${salah}" tidak valid. Tulis tanpa @, mis. widyatama.ac.id.`);
  v.throwIfAny();
  return d;
};

// Satu domain hanya boleh dimiliki satu perguruan tinggi
const cekDomainBebas = async (conn, domains, kecualiId = null) => {
  const [rows] = await conn.query(
    'SELECT d.domain, p.nama FROM perguruan_tinggi_domain d JOIN perguruan_tinggi p ON p.id = d.pt_id WHERE d.domain IN (?) AND d.pt_id <> ?',
    [domains, kecualiId || '']
  );
  if (rows.length) {
    const msg = `Domain @${rows[0].domain} sudah dipakai oleh ${rows[0].nama}.`;
    throw new HttpError(409, msg, { domain_email: msg });
  }
};

const simpanDomain = async (conn, id, domains) => {
  await conn.query('DELETE FROM perguruan_tinggi_domain WHERE pt_id = ?', [id]);
  await conn.query('INSERT INTO perguruan_tinggi_domain (pt_id, domain) VALUES ?', [domains.map((x) => [id, x])]);
};

export const listPerguruanTinggi = async (req, res) => {
  try {
    const where = ['1 = 1'];
    const params = [];
    const q = str(req.query.q).toLowerCase();
    if (q) {
      where.push('(LOWER(CONCAT_WS(\' \', p.nama, p.singkatan)) LIKE ? OR p.id IN (SELECT pt_id FROM perguruan_tinggi_domain WHERE domain LIKE ?))');
      params.push(`%${q}%`, `%${q}%`);
    }
    const jenis = str(req.query.jenis);
    if (['negeri', 'swasta'].includes(jenis)) {
      where.push('p.jenis = ?');
      params.push(jenis);
    }
    const [rows] = await db.query(`${PT_SELECT} WHERE ${where.join(' AND ')} ${PT_GROUP} ORDER BY p.jenis, p.nama`, params);
    res.json(rows.map(formatPt));
  } catch (err) {
    handleError(res, err);
  }
};

export const createPerguruanTinggi = async (req, res) => {
  try {
    const d = parsePt(req.body);
    const id = await withTransaction(db, async (conn) => {
      await cekDomainBebas(conn, d.domain);
      const newId = await nextId(conn, 'perguruan_tinggi', 'PT-', 2);
      await conn.query('INSERT INTO perguruan_tinggi (id, nama, singkatan, jenis) VALUES (?, ?, ?, ?)', [newId, d.nama, d.singkatan, d.jenis]);
      await simpanDomain(conn, newId, d.domain);
      return newId;
    });
    res.status(201).json(await findPt(id));
  } catch (err) {
    handleError(res, err);
  }
};

export const updatePerguruanTinggi = async (req, res) => {
  try {
    const pt = await findPt(req.params.id);
    if (!pt) throw new HttpError(404, 'Perguruan tinggi tidak ditemukan.');
    const d = parsePt(req.body);
    await withTransaction(db, async (conn) => {
      await cekDomainBebas(conn, d.domain, pt.id);
      await conn.query('UPDATE perguruan_tinggi SET nama = ?, singkatan = ?, jenis = ? WHERE id = ?', [d.nama, d.singkatan, d.jenis, pt.id]);
      await simpanDomain(conn, pt.id, d.domain);
    });
    res.json(await findPt(pt.id));
  } catch (err) {
    handleError(res, err);
  }
};

export const deletePerguruanTinggi = async (req, res) => {
  try {
    const pt = await findPt(req.params.id);
    if (!pt) throw new HttpError(404, 'Perguruan tinggi tidak ditemukan.');
    if (pt.jumlah_mahasiswa > 0) {
      throw new HttpError(409, `${pt.nama} masih memiliki ${pt.jumlah_mahasiswa} mahasiswa terdaftar dan tidak dapat dihapus.`);
    }
    await db.query('DELETE FROM perguruan_tinggi WHERE id = ?', [pt.id]);
    res.status(204).end();
  } catch (err) {
    handleError(res, err);
  }
};
