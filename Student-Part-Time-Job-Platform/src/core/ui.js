/* Student Part-Time Job Platform — core/ui.js
   Komponen render (kartu lowongan, grid slot, empty state, alert), toast, modal, layout, aturan status, panel demo. */
"use strict";

/* ------------------------------------------------------------------ komponen render */
function jobCard(l) {
  const e = l.employer; const m = matchInfo(l);
  return `<article class="job-card" data-id="${l.id}">
    <div class="badges">${badge("terverifikasi", "Employer terverifikasi")}${matchPill(m)}</div>
    <h3 class="job-card__title"><a href="../mahasiswa/detail-lowongan.html#${l.id}">${esc(l.posisi)}</a></h3>
    <p class="job-card__employer">${esc(e.nama)}</p>
    <ul class="job-card__meta">
      <li>${icon("briefcase")}${JENIS[l.jenis_kerja]} · ${SISTEM[l.sistem_kerja]}</li>
      <li>${icon("map-pin")}${esc(lokasi(l))}</li>
      <li>${icon("calendar-clock")}${esc(jadwalText(l))}</li>
      <li>${icon("hourglass")}${esc(durasi(l))} · ${l.beban_kerja} jam/minggu</li>
    </ul>
    <div class="job-card__footer"><span class="job-card__salary">${gaji(l)}</span>
      <span class="job-card__date">Tutup ${tgl(l.batas_lamaran, true)} · Tayang ${tgl(l.tayang, true)}</span></div>
  </article>`;
}
function slotGrid({ name = "slot", selected = [], mode = "edit", compare = null, mini = false, disabled = false, label = "Jadwal" }) {
  const head = DAYS.map((d) => `<th scope="col">${DAY_S[d]}</th>`).join("");
  const rows = SLOTS.map((s) => {
    const cells = DAYS.map((d) => {
      const key = `${d}-${s.k}`; const on = selected.includes(key);
      const lbl = `${label}: ${d[0].toUpperCase() + d.slice(1)}, ${s.l} ${s.t}`;
      if (mode === "edit") return `<td><label class="slot"><input type="checkbox" name="${name}" value="${key}" ${on ? "checked" : ""} ${disabled ? "disabled" : ""} aria-label="${lbl}"><span></span></label></td>`;
      let cls = "slot slot--view";
      if (compare) { if (on && compare.includes(key)) cls += " slot--match"; else if (on) cls += " slot--clash"; else if (compare.includes(key)) cls += " slot--mine"; }
      else if (on) cls += " slot--view";
      const inner = !compare && on ? `<span style="background:var(--color-primary-600);border-color:var(--color-primary-700);color:#fff">✓</span>` : `<span></span>`;
      return `<td><span class="${cls}" role="img" aria-label="${lbl}${on ? " — terpilih" : ""}">${inner}</span></td>`;
    }).join("");
    return `<tr><th scope="row">${s.l}${mini ? "" : `<small>${s.t}</small>`}</th>${cells}</tr>`;
  }).join("");
  return `<div class="slotgrid ${mini ? "slotgrid--mini" : ""}"><table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function emptyState({ icon: ic = "inbox", title, text, actions = "", kind = "" }) {
  return `<div class="empty-state ${kind}"><div class="empty-state__icon">${icon(ic)}</div><p class="empty-state__title">${esc(title)}</p>${text ? `<p>${esc(text)}</p>` : ""}${actions ? `<div class="row">${actions}</div>` : ""}</div>`;
}
function alertBox(type, html, extra = "") {
  const ic = { info: "info", success: "circle-check", warning: "triangle-alert", error: "circle-alert" }[type];
  return `<div class="alert alert--${type}" role="${type === "error" ? "alert" : "status"}">${icon(ic)}<div>${html}</div>${extra}</div>`;
}
function skeletons(n = 3, cls = "skeleton--card") { return Array.from({ length: n }, () => `<div class="skeleton ${cls}"></div>`).join(""); }
const reloadBtn = () => `<button class="btn btn--sm btn--secondary" data-reset-state>${icon("refresh-cw")}Muat ulang</button>`;

/* ------------------------------------------------------------------ toast */
function toast(text, type = "success") {
  let zone = $(".toast-zone");
  if (!zone) { zone = document.createElement("div"); zone.className = "toast-zone"; zone.setAttribute("aria-live", "polite"); BODY.append(zone); }
  const t = document.createElement("div"); t.className = `toast toast--${type}`;
  t.innerHTML = `${icon(type === "error" ? "circle-alert" : "circle-check")}<span>${esc(text)}</span>`;
  zone.append(t); refreshIcons(); setTimeout(() => t.remove(), 4000);
}

/* ------------------------------------------------------------------ modal & drawer */
function openModal(id) { const d = document.getElementById(id); if (!d) return; try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } refreshIcons(); }
function closeModal(el) { const d = el.closest("dialog"); if (d) { try { d.close(); } catch (e) { d.removeAttribute("open"); } } }
document.addEventListener("click", (e) => {
  const o = e.target.closest("[data-open]"); if (o) { e.preventDefault(); openModal(o.dataset.open); }
  const c = e.target.closest("[data-close]"); if (c) { e.preventDefault(); closeModal(c); }
});
$$("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

// Tombol dengan indikator loading selama aksi async berjalan
async function withLoading(btn, fn) {
  btn.classList.add("is-loading"); btn.disabled = true;
  try { return await fn(); } finally { btn.classList.remove("is-loading"); btn.disabled = false; }
}

/* ------------------------------------------------------------------ navigasi layout */
function initChrome() {
  const nt = $(".navbar__toggle");
  if (nt) nt.addEventListener("click", () => { const m = $(".navbar__menu"); const open = m.classList.toggle("is-open"); nt.setAttribute("aria-expanded", open); });
  const st = $(".topbar__toggle");
  if (st) st.addEventListener("click", () => {
    const sb = $(".sidebar"); sb.classList.add("is-open");
    const scrim = document.createElement("div"); scrim.className = "sidebar-scrim"; BODY.append(scrim);
    scrim.addEventListener("click", () => { sb.classList.remove("is-open"); scrim.remove(); });
  });
  $$("[data-logout]").forEach((a) => a.addEventListener("click", () => { API.clearToken(); sess.del("state:" + PAGE); }));
  const f = sess.get("flash", null);
  if (f) {
    sess.del("flash");
    const slot = $("[data-flash]") || $(".page");
    if (slot) { const w = document.createElement("div"); w.innerHTML = alertBox(f.type, esc(f.text)); slot.prepend(w.firstElementChild); }
  }
}
// Nama & status pada user-chip diisi dari akun yang masuk
function renderUserChip() {
  if (!USER) return;
  const nama = USER.role === "employer" ? USER.pj || USER.nama : USER.nama;
  $$(".user-chip").forEach((chip) => {
    const av = $(".avatar", chip); if (av) av.textContent = initials(nama);
    const meta = $(".user-chip__meta", chip);
    if (meta && meta.firstChild && meta.firstChild.nodeType === 3) meta.firstChild.textContent = nama;
    const sub = meta && $("span:not([data-me-status])", meta);
    if (sub) sub.textContent = USER.role === "employer" ? USER.nama : USER.role === "admin" ? "Admin platform" : sub.textContent;
  });
  if (USER.role === "employer") $$(".page__head .eyebrow").forEach((el) => { el.textContent = USER.nama; });
  $$("[data-me-status]").forEach((el) => { el.innerHTML = STATUS ? badge(STATUS) : ""; });
}

/* ------------------------------------------------------------------ state & status */
function applyStatusRules() {
  // Akun yang belum mengajukan verifikasi diperlakukan seperti pending untuk pesan status
  const asStatus = STATUS === "belum_verifikasi" ? "pending" : STATUS;
  $$("[data-show-status]").forEach((el) => { el.hidden = !el.dataset.showStatus.split(" ").includes(asStatus); });
  $$("[data-require-verified]").forEach((el) => {
    if (STATUS !== "terverifikasi") { el.disabled = true; el.classList.add("is-disabled"); el.setAttribute("aria-disabled", "true"); if (el.dataset.deniedMsg) el.title = el.dataset.deniedMsg; }
  });
  if (ROLE === "mahasiswa") {
    const allow = { kedaluwarsa: ["MHS-07", "MHS-08", "MHS-09"], ditolak: ["MHS-03", "MHS-07", "MHS-08", "MHS-09"] }[STATUS];
    if (allow && !allow.includes(PAGE)) {
      flash("warning", STATUS === "kedaluwarsa" ? "Masa verifikasi status mahasiswa telah berakhir. Lakukan verifikasi ulang untuk melanjutkan." : "Verifikasi akun ditolak. Perbaiki data lalu ajukan ulang.");
      go("../mahasiswa/status-akses.html"); return false;
    }
  }
  if (ROLE === "employer" && STATUS === "ditolak" && ["EMP-04", "EMP-06"].includes(PAGE)) {
    flash("error", "Verifikasi akun ditolak. Lihat alasan dan ajukan ulang di halaman Verifikasi Akun."); go("../employer/verifikasi.html"); return false;
  }
  return true;
}
function applyGenericState(state) {
  const content = $("[data-view='content']"); if (!content) return;
  $$("[data-state-view]").forEach((el) => { el.hidden = el.dataset.stateView !== state; });
  const custom = $(`[data-state-view="${state}"]`);
  if (["default", "success", "reminder"].includes(state)) { content.hidden = false; return; }
  content.hidden = true;
  if (custom) return;
  const box = document.createElement("div"); box.className = "panel"; box.dataset.generated = "1";
  if (state === "loading") box.innerHTML = `<div class="stack" aria-busy="true" aria-label="Memuat">${skeletons(1, "skeleton--line")}${skeletons(3)}</div>`;
  if (state === "error") box.innerHTML = alertBox("error", "Data gagal dimuat. Coba muat ulang halaman.", reloadBtn());
  if (state === "empty") box.innerHTML = emptyState({ icon: "inbox", title: "Belum ada data", text: "Data akan tampil di sini setelah tersedia." });
  if (state === "denied") box.innerHTML = emptyState({ icon: "lock", kind: "empty-state--denied", title: "Akses ditolak", text: "Anda tidak memiliki akses ke halaman ini.", actions: `<a class="btn btn--primary" href="../umum/beranda.html">Kembali ke beranda</a>` });
  content.parentNode.insertBefore(box, content);
}
document.addEventListener("click", (e) => { if (e.target.closest("[data-reset-state]")) { sess.del("state:" + PAGE); location.href = location.pathname.split("/").pop() + location.hash; } });

// Halaman gagal memuat data dari API
function showLoadError(err) {
  const content = $("[data-view='content']") || $(".page");
  if (!content) { toast(err.message, "error"); return; }
  const box = document.createElement("div"); box.className = "panel";
  box.innerHTML = alertBox("error", esc(err.message || "Data gagal dimuat."), reloadBtn());
  if (content.matches("[data-view='content']")) { content.hidden = true; content.parentNode.insertBefore(box, content); }
  else content.prepend(box);
  refreshIcons();
}

/* ------------------------------------------------------------------ panel demo (presentasi) */
function initDemoPanel() {
  const fab = document.createElement("button"); fab.className = "demo-fab"; fab.type = "button";
  fab.innerHTML = `${icon("monitor-smartphone")}Demo · ${PAGE}`; fab.setAttribute("aria-expanded", "false");
  const panel = document.createElement("div"); panel.className = "demo-panel"; panel.hidden = true;
  const extra = (BODY.dataset.states || "").split(" ").filter(Boolean);
  const states = ["default", "empty", "loading", "error", "success", "denied"].concat(extra);
  panel.innerHTML = `<div class="row row--between"><h4>Panel demo</h4><span class="demo-panel__id">${PAGE}</span></div>
    <div><h4>State halaman</h4><div class="demo-panel__opts">${states.map((s) => `<button type="button" data-demo-state="${s}" aria-pressed="${s === STATE}">${s}</button>`).join("")}</div></div>
    ${USER ? `<p class="xs muted">Masuk sebagai ${esc(USER.email)} · status ${esc(STATUS || "—")}</p>` : ""}`;
  fab.addEventListener("click", () => { panel.hidden = !panel.hidden; fab.setAttribute("aria-expanded", String(!panel.hidden)); });
  panel.addEventListener("click", (e) => {
    const s = e.target.closest("[data-demo-state]");
    if (s) { sess.set("state:" + PAGE, s.dataset.demoState); location.reload(); }
  });
  BODY.append(panel, fab);
}
