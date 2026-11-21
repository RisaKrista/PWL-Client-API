// Tanggal "hari ini" (YYYY-MM-DD). APP_TODAY dapat diisi untuk demo agar sesuai data contoh.
export const today = () => process.env.APP_TODAY || new Date().toLocaleDateString('sv-SE');

export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
