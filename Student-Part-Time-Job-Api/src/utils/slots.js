// Slot jadwal mingguan: <hari>-<waktu>, sama dengan frontend (app.js)
export const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
export const SLOT_HOURS = { pagi: 4, siang: 4, sore: 4, malam: 3 };

export const isSlot = (s) => {
  if (typeof s !== 'string') return false;
  const [d, k] = s.split('-');
  return DAYS.includes(d) && k in SLOT_HOURS;
};

export const totalHours = (slots) => slots.reduce((sum, s) => sum + SLOT_HOURS[s.split('-')[1]], 0);
