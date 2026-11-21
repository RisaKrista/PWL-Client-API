/* Student Part-Time Job Platform — boot.js
   Inisialisasi halaman: konfigurasi, cek login & peran, lalu menjalankan PAGES[data-page]. Dimuat paling akhir. */
"use strict";

async function boot() {
  initChrome();
  try { CONFIG = await API.get("/config"); TODAY = CONFIG.today; } catch (e) { console.warn("Konfigurasi API tidak dapat dimuat:", e.message); }
  if (ROLE !== "publik") {
    if (!API.getToken()) { flash("info", "Silakan masuk terlebih dahulu."); go("../umum/masuk.html"); return; }
    try { USER = await API.get("/auth/me"); }
    catch (err) {
      if (err.status === 401) { API.clearToken(); flash("warning", err.message); go("../umum/masuk.html"); return; }
      showLoadError(err); initDemoPanel(); refreshIcons(); return;
    }
    // Halaman milik peran lain → halaman 403, dengan tombol kembali ke halaman awal akun
    if (USER.role !== ROLE) { go(`${ROOT}pages/error/403.html?kembali=${encodeURIComponent("/" + USER.home)}`); return; }
    STATUS = USER.status;
    renderUserChip();
  }
  if (!applyStatusRules()) return;
  initForms();
  let handled = false;
  try { if (PAGES[PAGE]) handled = await PAGES[PAGE](STATE); }
  catch (err) { console.error(err); showLoadError(err); handled = true; }
  if (!handled) applyGenericState(STATE);
  else $$("[data-state-view]").forEach((el) => { el.hidden = el.dataset.stateView !== STATE; });
  initDemoPanel();
  refreshIcons();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
window.addEventListener("load", refreshIcons);
