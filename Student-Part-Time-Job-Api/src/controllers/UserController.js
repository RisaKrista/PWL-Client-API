import db from '../database/db.js';

export const getAllUsers = async (req, res) => {
  try {
    // password_hash tidak pernah dikirim ke klien
    const [rows] = await db.query('SELECT id, email, role, email_terverifikasi_pada, dibuat_pada FROM users ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
