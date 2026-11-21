import db from '../database/db.js';
import { getActivePeriode } from '../services/account.js';
import { handleError } from '../utils/errors.js';
import { today } from '../utils/dates.js';

export const getConfig = async (req, res) => {
  try {
    res.json({ today: today(), periode: await getActivePeriode() });
  } catch (err) {
    handleError(res, err);
  }
};

export const getPerguruanTinggi = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.nama, p.singkatan, p.jenis, GROUP_CONCAT(d.domain ORDER BY d.domain) AS domain
       FROM perguruan_tinggi p LEFT JOIN perguruan_tinggi_domain d ON d.pt_id = p.id
       GROUP BY p.id, p.nama, p.singkatan, p.jenis ORDER BY p.jenis, p.nama`
    );
    res.json(rows.map((r) => ({ ...r, domain: r.domain ? r.domain.split(',') : [] })));
  } catch (err) {
    handleError(res, err);
  }
};
