/* Student Part-Time Job Platform — core/utils.js
   Variabel global, util DOM, format tanggal/gaji/jadwal, badge status, dan kecocokan jadwal. */
"use strict";


let CONFIG = { today: new Date().toISOString().slice(0, 10), periode: null };
let TODAY = CONFIG.today;
let USER = null; // akun yang sedang masuk (GET /auth/me)

/* ------------------------------------------------------------------ util */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mkStore = (area) => ({
  get(k, d) { try { const v = window[area].getItem("sptjp:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { window[area].setItem("sptjp:" + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { window[area].removeItem("sptjp:" + k); } catch (e) {} },
});
const sess = mkStore("sessionStorage");
const icon = (n, cls = "") => `<i data-lucide="${n}" class="${cls}" aria-hidden="true"></i>`;
function refreshIcons() { try { if (window.lucide) window.lucide.createIcons(); } catch (e) {} }
function go(url) { if (url) window.location.href = url; }
// Semua halaman berada di pages/<peran>/; `home` dari API relatif terhadap root platform
const ROOT = "../../";
function goHome(user) { go(ROOT + user.home); }
function flash(type, text) { sess.set("flash", { type, text }); }

const BODY = document.body;
const PAGE = BODY.dataset.page;
const ROLE = BODY.dataset.role || "publik";
const STATES = ["default", "empty", "loading", "error", "success", "denied", "reminder"];

const params = new URLSearchParams(location.search);
const hashToken = decodeURIComponent((location.hash || "").slice(1));
function currentState() {
  const q = params.get("state");
  if (q && STATES.includes(q)) return q;
  if (STATES.includes(hashToken)) return hashToken;
  return sess.get("state:" + PAGE, "default");
}
function currentId(prefix, fallback) {
  const q = params.get("id");
  if (q && q.startsWith(prefix)) { sess.set("id:" + prefix, q); return q; }
  if (/^[A-Z]-\d{3}$/.test(hashToken) && hashToken.startsWith(prefix)) { sess.set("id:" + prefix, hashToken); return hashToken; }
  return sess.get("id:" + prefix, fallback);
}
const STATE = currentState();
let STATUS = null; // status akun dari API: belum_verifikasi | pending | terverifikasi | ditolak | kedaluwarsa

/* ------------------------------------------------------------------ format */
const DAYS = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];
const DAY_S = { senin: "Sen", selasa: "Sel", rabu: "Rab", kamis: "Kam", jumat: "Jum", sabtu: "Sab", minggu: "Min" };
const SLOTS = [
  { k: "pagi", l: "Pagi", t: "07.00–11.00", h: 4 }, { k: "siang", l: "Siang", t: "11.00–15.00", h: 4 },
  { k: "sore", l: "Sore", t: "15.00–19.00", h: 4 }, { k: "malam", l: "Malam", t: "19.00–22.00", h: 3 },
];
const SLOT_H = Object.fromEntries(SLOTS.map((s) => [s.k, s.h]));
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function tgl(iso, short) { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${d} ${(short ? BLN : BULAN)[m - 1]} ${y}`; }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function addDays(iso, n) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const rp = (n) => "Rp" + Number(n).toLocaleString("id-ID");
const SATUAN = { jam: "jam", hari: "hari", bulan: "bulan", proyek: "proyek" };
const gaji = (l) => (l.gaji_maks ? `${rp(l.gaji_min)}–${rp(l.gaji_maks)}` : rp(l.gaji_min)) + "/" + SATUAN[l.satuan_gaji];
const JENIS = { part_time: "Part-time", freelance_proyek: "Freelance-proyek" };
const SISTEM = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };
const lokasi = (l) => l.sistem_kerja === "remote" ? "Remote" : `${l.kota}${l.area ? " · " + l.area : ""}`;
const durasi = (l) => `${l.durasi_nilai} ${l.durasi_satuan}`;
const initials = (nama) => String(nama || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
function jadwalText(l, withTime = true) {
  if (l.jadwal_fleksibel) return "Jadwal fleksibel";
  const byDay = {};
  l.jadwal.forEach((s) => { const [d, k] = s.split("-"); (byDay[d] = byDay[d] || []).push(k); });
  const groups = {};
  DAYS.forEach((d) => { if (byDay[d]) { const key = SLOTS.filter((s) => byDay[d].includes(s.k)).map((s) => s.k).join("+"); (groups[key] = groups[key] || []).push(d); } });
  return Object.entries(groups).map(([key, days]) => {
    const ks = key.split("+"); const sl = ks.map((k) => SLOTS.find((s) => s.k === k).l).join(" + ");
    const t = withTime && ks.length === 1 ? " " + SLOTS.find((s) => s.k === ks[0]).t : "";
    return `${days.map((d) => DAY_S[d]).join(", ")} · ${sl}${t}`;
  }).join("; ") + (withTime ? " WIB" : "");
}
const BUKTI = { krs: "KRS semester berjalan", surat: "Surat keterangan aktif kuliah" };

/* status badges — konsisten dengan Bagian 8 & 15.2 */
const BADGE = {
  pending: ["warning", "clock", "Pending"], terverifikasi: ["success", "badge-check", "Terverifikasi"],
  ditolak: ["error", "circle-x", "Ditolak"], kedaluwarsa: ["neutral", "calendar-x", "Kedaluwarsa"],
  belum_verifikasi: ["neutral", "file-up", "Belum verifikasi"],
  draft: ["neutral", "file-pen", "Draft"], menunggu_moderasi: ["warning", "clock", "Menunggu moderasi"],
  publik: ["success", "badge-check", "Publik"], ditutup: ["neutral", "lock", "Ditutup"],
  dikirim: ["info", "send", "Dikirim"], ditinjau: ["info", "eye", "Ditinjau"], diterima: ["success", "circle-check", "Diterima"],
  disetujui: ["success", "circle-check", "Disetujui"],
};
function badge(s, label) { const b = BADGE[s] || ["neutral", "info", s]; return `<span class="badge badge--${b[0]}">${icon(b[1])}${esc(label || b[2])}</span>`; }

/* ------------------------------------------------------------------ availability & kecocokan jadwal */
let MY_AVAIL = [];
function matchInfo(l, avail = MY_AVAIL) {
  if (l.jadwal_fleksibel) return { type: "flex", text: "Jadwal fleksibel", n: 0, total: 0 };
  const n = l.jadwal.filter((s) => avail.includes(s)).length;
  const total = l.jadwal.length;
  return { type: n === total ? "full" : n > 0 ? "part" : "none", n, total, text: `Cocok ${n}/${total} slot` };
}
function matchPill(m) {
  if (m.type === "flex") return `<span class="match match--flex">${icon("calendar-clock")}Jadwal fleksibel</span>`;
  if (m.type === "full") return `<span class="match match--full">${icon("circle-check")}${m.text}</span>`;
  return `<span class="match match--part">${icon("triangle-alert")}${m.text}</span>`;
}

// Registri halaman: diisi oleh src/views/*.js, dijalankan oleh src/boot.js
const PAGES = {};
