// Membuat ID berikutnya berformat mockup (mis. L-014, M-06, LM-006).
// Panggil di dalam transaksi agar baris terakhir terkunci (FOR UPDATE).
export const nextId = async (conn, table, prefix, pad) => {
  const [rows] = await conn.query(
    'SELECT id FROM ?? WHERE id LIKE ? ORDER BY CAST(SUBSTRING(id, ?) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE',
    [table, `${prefix}%`, prefix.length + 1]
  );
  const n = rows.length ? Number(rows[0].id.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(pad, '0');
};

// Menjalankan fn(conn) dalam satu transaksi
export const withTransaction = async (db, fn) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
