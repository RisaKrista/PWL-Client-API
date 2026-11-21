/* Student Part-Time Job Platform — views/employer.js
   Halaman employer: EMP-02 s.d. EMP-06. */
"use strict";

/* ---------- EMP-02 Verifikasi employer */
PAGES["EMP-02"] = async () => {
  const prof = await API.get("/employer/me");
  const st = STATUS;
  const alasan = prof.catatan_status || prof.verifikasi_terakhir?.alasan || "Dokumen tidak sesuai.";
  const S = {
    terverifikasi: ["success", "badge-check", "Akun Employer terverifikasi", `Terverifikasi sejak ${tgl(prof.terverifikasi_pada)}. Anda sudah dapat mempublikasikan lowongan.`],
    pending: ["warning", "clock", "Menunggu verifikasi Admin", "Dokumen sudah diterima. Lowongan dapat disimpan sebagai draft, tetapi belum dapat dipublikasikan."],
    belum_verifikasi: ["info", "file-up", "Lengkapi verifikasi akun", "Unggah dokumen agar Admin dapat memverifikasi akun Anda. Lowongan dapat disimpan sebagai draft sambil menunggu."],
    ditolak: ["error", "circle-x", "Verifikasi ditolak", `Alasan: ${alasan}. Unggah ulang dokumen yang jelas.`],
  }[st];
  $("#emp-status").innerHTML = `<div class="status-hero"><div class="status-hero__icon tone-${S[0]}">${icon(S[1])}</div><div class="stack" style="gap:6px"><div class="row">${badge(st)}<span class="small muted">${esc(prof.nama)} · ${esc(prof.tipe_label)}</span></div><h2>${esc(S[2])}</h2><p class="muted">${esc(S[3])}</p></div></div>`;
  $("#emp-doc-panel").hidden = !["belum_verifikasi", "ditolak"].includes(st);
  $("#emp-stepper").hidden = st !== "belum_verifikasi";
  const per = prof.tipe === "perorangan";
  $$("[data-for-badan]").forEach((el) => { el.hidden = per; }); $$("[data-for-perorangan]").forEach((el) => { el.hidden = !per; });
  $("#ed-tipe").textContent = prof.tipe_label;
  if (prof.nib) $("#ed-nib").value = prof.nib;
  if (prof.alamat) $("#ed-alamat").value = prof.alamat;
  if (prof.website) $("#ed-web").value = prof.website;
  if (prof.deskripsi) $("#ed-deskripsi").value = prof.deskripsi;
  FIELD_MAP["form-emp-doc"] = { nib: "ed-nib", website: "ed-web", alamat: "ed-alamat", deskripsi: "ed-deskripsi", legal: "ed-legal", identitas: "ed-identitas" };
  $("#ed-fill").addEventListener("click", () => { $("#ed-nib").value = "0000000000013"; $("#ed-alamat").value = "Jl. Contoh Raya No. 10, Coblong, Bandung"; $("#ed-web").value = "https://bimbel-contoh.id"; $$("[data-sample]").forEach((b) => { if (!b.closest("[hidden]")) b.click(); }); });
  HOOKS["form-emp-doc"] = async () => {
    await API.post("/employer/me/verifikasi", formData({
      nib: per ? "" : $("#ed-nib").value.trim(), website: $("#ed-web").value.trim(), alamat: $("#ed-alamat").value.trim(), deskripsi: $("#ed-deskripsi").value.trim(),
      legal: per ? null : fileVal("ed-legal"), identitas: fileVal("ed-identitas"),
    }));
    flash("success", "Dokumen terkirim. Status akun: Pending sampai ditinjau Admin."); go("../employer/dashboard.html");
  };
  refreshIcons(); return false;
};

/* ---------- EMP-03 Dashboard employer */
PAGES["EMP-03"] = async (state) => {
  const D = await API.get("/employer/dashboard");
  const L = state === "empty" ? [] : D.terbaru;
  const firstPelamar = L.find((l) => ["publik", "ditutup"].includes(l.status));
  const tiles = [["Lowongan Publik", D.publik, "badge-check", "publik"], ["Menunggu moderasi", D.menunggu_moderasi, "clock", "menunggu_moderasi"], ["Draft", D.draft, "file-pen", "draft"], ["Pelamar baru", D.pelamar_baru, "users", null]];
  $("#emp-stats").innerHTML = tiles.map(([lab, n, ic, f]) => `<a class="stat" href="${f ? "../employer/lowongan-saya.html#" + f : firstPelamar ? "../employer/kelola-pelamar.html#" + firstPelamar.id : "../employer/lowongan-saya.html"}"><span class="stat__value">${state === "empty" ? 0 : n}</span><span class="stat__label">${icon(ic)}${lab}</span></a>`).join("");
  $("#emp-recent").innerHTML = L.map((l) => `<tr><td><div class="cell-title">${esc(l.posisi)}</div><div class="cell-sub">${JENIS[l.jenis_kerja]} · ${SISTEM[l.sistem_kerja]}</div></td><td>${badge(l.status)}</td><td class="tnum">${l.jumlah_pelamar}</td><td class="tnum">${tgl(l.batas_lamaran, true)}</td><td>${l.status === "publik" || l.status === "ditutup" ? `<a class="btn btn--ghost btn--sm" href="../employer/kelola-pelamar.html#${l.id}">Kelola pelamar</a>` : `<a class="btn btn--ghost btn--sm" href="../employer/formulir-lowongan.html#${l.id}">Ubah</a>`}</td></tr>`).join("");
  $("#emp-recent-wrap").hidden = !L.length; $("#emp-empty").hidden = !!L.length;
  refreshIcons(); return state === "empty";
};

/* ---------- EMP-04 Formulir lowongan (UC1) */
PAGES["EMP-04"] = async () => {
  const editId = /^L-\d{3,}$/.test(hashToken) ? hashToken : null;
  const src = editId ? await API.get(`/employer/lowongan/${encodeURIComponent(editId)}`) : null;
  $("#jadwal-grid").innerHTML = slotGrid({ name: "jadwal", selected: src?.jadwal || [], label: "Jadwal kerja" });
  if (src) {
    $("#lw-heading").textContent = "Ubah Lowongan"; document.title = "Ubah Lowongan · Student Part-Time Job Platform";
    const set = (id, v) => { if (v != null && v !== "") $(id).value = v; };
    set("#lw-posisi", src.posisi); set("#lw-jobdesk", src.job_desk); set("#lw-kota", src.kota); set("#lw-alamat", src.alamat); set("#lw-durasi", src.durasi_nilai); set("#lw-durasi-sat", src.durasi_satuan);
    set("#lw-beban", src.beban_kerja); set("#lw-gmin", src.gaji_min || null); set("#lw-gmax", src.gaji_maks); set("#lw-satuan", src.satuan_gaji); set("#lw-kriteria", src.kriteria); set("#lw-batas", src.batas_lamaran);
    if (src.jenis_kerja) $(`[name=jenis][value=${src.jenis_kerja}]`).checked = true;
    if (src.sistem_kerja) $(`[name=sistem][value=${src.sistem_kerja}]`).checked = true;
    $$("[name=jenjang]").forEach((c) => { c.checked = !!src.jenjang?.includes(c.value); });
    $("#lw-fleksibel").checked = !!src.jadwal_fleksibel;
    if (src.status === "publik") $("#lw-edit-note").hidden = false;
    $$("[data-counter]").forEach((ta) => ta.dispatchEvent(new Event("input")));
  }
  FIELD_MAP["form-lowongan"] = { posisi: "lw-posisi", job_desk: "lw-jobdesk", kota: "lw-kota", alamat: "lw-alamat", jadwal: "jadwal-group", durasi_nilai: "lw-durasi", beban_kerja: "lw-beban", gaji_min: "lw-gmin", gaji_maks: "lw-gmax", kriteria: "lw-kriteria", batas_lamaran: "lw-batas" };
  const grid = $("#jadwal-grid"); const flex = $("#lw-fleksibel");
  const syncFlex = () => { $$("[name=jadwal]").forEach((i) => { i.disabled = flex.checked; }); $("#jadwal-group").dataset.skip = flex.checked ? "1" : "0"; if (flex.checked) setError(grid.closest(".field"), ""); };
  const syncSistem = () => { const s = $("[name=sistem]:checked")?.value; const req = s === "onsite" || s === "hybrid"; $("#lw-alamat").required = req; $("#lw-alamat-req").hidden = !req; };
  flex.addEventListener("change", () => { syncFlex(); preview(); });
  $$("[name=sistem]").forEach((r) => r.addEventListener("change", () => { syncSistem(); preview(); }));
  syncFlex(); syncSistem();
  const min = addDays(TODAY, 1); const max = addDays(TODAY, 60);
  $("#lw-batas").min = min; $("#lw-batas").max = max;
  CUSTOM["lw-batas"] = (el) => (el.value && (el.value < min || el.value > max) ? `Batas lamaran harus antara ${tgl(min, true)} dan ${tgl(max, true)}.` : "");
  CUSTOM["lw-gmax"] = (el) => (el.value && Number(el.value) < Number($("#lw-gmin").value || 0) ? "Gaji maksimum tidak boleh lebih kecil dari gaji minimum." : "");
  CUSTOM["lw-beban"] = (el) => {
    if (flex.checked || !el.value) return "";
    const hours = $$("[name=jadwal]:checked").reduce((s, i) => s + SLOT_H[i.value.split("-")[1]], 0);
    return hours && Number(el.value) > hours ? `Beban kerja melebihi total jam pada jadwal yang dipilih (maks. ${hours} jam/minggu).` : "";
  };
  CUSTOM["lw-durasi"] = (el) => { const n = Number(el.value); const sat = $("#lw-durasi-sat").value; const days = sat === "hari" ? n : sat === "minggu" ? n * 7 : n * 30; return el.value && days > 183 ? "Durasi maksimal 6 bulan (proyek jangka pendek)." : ""; };
  function current() {
    return { posisi: $("#lw-posisi").value.trim() || "Posisi lowongan", jenis_kerja: $("[name=jenis]:checked")?.value || "part_time", sistem_kerja: $("[name=sistem]:checked")?.value || "onsite", kota: $("#lw-kota").value || "Kota", area: ($("#lw-alamat").value.split(",")[1] || "").trim(), jadwal_fleksibel: flex.checked, jadwal: $$("[name=jadwal]:checked").map((i) => i.value), durasi_nilai: $("#lw-durasi").value || "–", durasi_satuan: $("#lw-durasi-sat").value, beban_kerja: $("#lw-beban").value || "–", gaji_min: Number($("#lw-gmin").value) || 0, gaji_maks: Number($("#lw-gmax").value) || null, satuan_gaji: $("#lw-satuan").value, batas_lamaran: $("#lw-batas").value || TODAY };
  }
  // Data yang dikirim ke API
  const payload = (action) => ({
    action,
    posisi: $("#lw-posisi").value.trim(), job_desk: $("#lw-jobdesk").value.trim(),
    jenis_kerja: $("[name=jenis]:checked")?.value || null, sistem_kerja: $("[name=sistem]:checked")?.value || null,
    kota: $("#lw-kota").value, alamat: $("#lw-alamat").value.trim(),
    jadwal_fleksibel: flex.checked, jadwal: $$("[name=jadwal]:checked").map((i) => i.value), jenjang: $$("[name=jenjang]:checked").map((i) => i.value),
    durasi_nilai: $("#lw-durasi").value, durasi_satuan: $("#lw-durasi-sat").value, beban_kerja: $("#lw-beban").value,
    gaji_min: $("#lw-gmin").value, gaji_maks: $("#lw-gmax").value || null, satuan_gaji: $("#lw-satuan").value,
    kriteria: $("#lw-kriteria").value.trim(), batas_lamaran: $("#lw-batas").value,
  });
  function preview() {
    const l = current();
    $("#lw-preview").innerHTML = `<article class="job-card"><div class="badges">${badge(STATUS === "terverifikasi" ? "terverifikasi" : "pending", STATUS === "terverifikasi" ? "Employer terverifikasi" : "Employer belum terverifikasi")}</div>
      <h3 class="job-card__title">${esc(l.posisi)}</h3><p class="job-card__employer">${esc(USER.nama)}</p>
      <ul class="job-card__meta"><li>${icon("briefcase")}${JENIS[l.jenis_kerja]} · ${SISTEM[l.sistem_kerja]}</li><li>${icon("map-pin")}${esc(lokasi(l))}</li><li>${icon("calendar-clock")}${l.jadwal_fleksibel || l.jadwal.length ? esc(jadwalText(l)) : "Belum ada jadwal"}</li><li>${icon("hourglass")}${esc(durasi(l))} · ${esc(l.beban_kerja)} jam/minggu</li></ul>
      <div class="job-card__footer"><span class="job-card__salary">${l.gaji_min ? gaji(l) : "Rp—"}</span><span class="job-card__date">Tutup ${tgl(l.batas_lamaran, true)}</span></div></article>`;
    refreshIcons();
  }
  $("#form-lowongan").addEventListener("input", preview); $("#form-lowongan").addEventListener("change", preview); preview();
  $("#lw-fill").addEventListener("click", () => {
    $("#lw-posisi").value = "Tutor Kimia SMA"; $("#lw-jobdesk").value = "Mengajar kimia kelas 10–12 sesuai kurikulum.\nMenyiapkan latihan soal dan pembahasan.\nMelaporkan perkembangan siswa setiap bulan.";
    $("[name=jenis][value=part_time]").checked = true; $("[name=sistem][value=onsite]").checked = true; syncSistem(); $("#lw-kota").value = "Bandung"; $("#lw-alamat").value = "Jl. Contoh Raya No. 10, Coblong";
    flex.checked = false; syncFlex(); $$("[name=jadwal]").forEach((i) => { i.checked = ["senin-sore", "rabu-sore"].includes(i.value); });
    $("#lw-durasi").value = 3; $("#lw-durasi-sat").value = "bulan"; $("#lw-beban").value = 6; $("#lw-gmin").value = 55000; $("#lw-satuan").value = "jam";
    $("#lw-kriteria").value = "Mahasiswa aktif semester 3 ke atas.\nMenguasai kimia SMA.\nKomunikatif dan sabar."; $("#lw-batas").value = addDays(TODAY, 28);
    $$("[data-counter]").forEach((ta) => ta.dispatchEvent(new Event("input"))); preview();
  });
  const save = (action) => (src ? API.put(`/employer/lowongan/${encodeURIComponent(src.id)}`, payload(action)) : API.post("/employer/lowongan", payload(action)));
  HOOKS["form-lowongan"] = async (form, action) => {
    if (action === "draft") { await save("draft"); flash("success", "Draft tersimpan."); go("../employer/lowongan-saya.html#draft"); return; }
    if (src && src.status === "publik" && !form.dataset.confirmed) { openModal("modal-edit-publik"); return; }
    const res = await save("submit");
    if (res.disimpan_sebagai_draft) { openModal("modal-af2"); return; }
    flash("success", "Lowongan dikirim untuk moderasi Admin. Lowongan tampil kepada mahasiswa setelah disetujui."); go("../employer/lowongan-saya.html#menunggu_moderasi");
  };
  $("#confirm-edit").addEventListener("click", async () => {
    const f = $("#form-lowongan"); f.dataset.confirmed = "1"; closeModal($("#confirm-edit"));
    try { await HOOKS["form-lowongan"](f, "submit"); } catch (err) { showApiError(err, f); }
  });
  if (STATE === "error") { $("#lw-publish").click(); }
  return false;
};

/* ---------- EMP-05 Lowongan saya */
PAGES["EMP-05"] = async (state) => {
  const L = state === "empty" ? [] : await API.get("/employer/lowongan");
  const tb = $("#lw-rows");
  tb.innerHTML = L.map((l) => {
    const s = l.status; const n = l.jumlah_pelamar;
    const actions = [
      s !== "ditutup" ? `<a class="btn btn--ghost btn--sm" href="../employer/formulir-lowongan.html#${l.id}">${icon("pencil")}Ubah</a>` : "",
      ["publik", "ditutup"].includes(s) ? `<a class="btn btn--ghost btn--sm" href="../employer/kelola-pelamar.html#${l.id}">${icon("users")}Pelamar</a>` : "",
      s === "publik" ? `<button class="btn btn--ghost btn--sm" data-tutup="${l.id}">${icon("lock")}Tutup</button>` : "",
      s === "draft" ? `<button class="btn btn--ghost btn--sm" data-hapus="${l.id}" style="color:var(--color-error-700)">${icon("trash-2")}Hapus</button>` : "",
    ].join("");
    const sub = s === "ditolak" ? `<tr class="table__sub" data-row-sub="${l.id}"><td colspan="6">${icon("circle-alert")} Ditolak Admin: ${esc(l.alasan_penolakan)}. Perbaiki lalu publikasikan ulang.</td></tr>` : "";
    return `<tr data-row-status="${s}" data-row-id="${l.id}"><td><div class="cell-title">${esc(l.posisi)}</div><div class="cell-sub">${l.id} · ${JENIS[l.jenis_kerja]} · ${SISTEM[l.sistem_kerja]}</div></td><td>${badge(s)}</td><td class="tnum">${n}</td><td class="tnum">${tgl(l.batas_lamaran, true)}</td><td class="tnum">${tgl(l.diperbarui || l.tayang || TODAY, true)}</td><td><div class="row" style="gap:4px;flex-wrap:nowrap">${actions}</div></td></tr>${sub}`;
  }).join("");
  updateTabCounts($("#lw-tabs"), L.map((l) => l.status));
  const tabs = $("#lw-tabs");
  if (["draft", "menunggu_moderasi", "publik", "ditolak", "ditutup"].includes(hashToken)) $$(".tab", tabs).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.filter === hashToken)));
  initTabs();
  let target = null;
  tb.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tutup]"); const h = e.target.closest("[data-hapus]");
    if (t) { target = t.dataset.tutup; openModal("modal-tutup"); }
    if (h) { target = h.dataset.hapus; openModal("modal-hapus"); }
  });
  $("#do-tutup").addEventListener("click", async (e) => {
    try { await withLoading(e.currentTarget, () => API.patch(`/employer/lowongan/${target}/tutup`)); flash("success", "Lowongan ditutup."); location.reload(); }
    catch (err) { closeModal(e.target); toast(err.message, "error"); }
  });
  $("#do-hapus").addEventListener("click", async (e) => {
    try { await withLoading(e.currentTarget, () => API.del(`/employer/lowongan/${target}`)); flash("success", "Draft dihapus."); location.reload(); }
    catch (err) { closeModal(e.target); toast(err.message, "error"); }
  });
  refreshIcons(); return false;
};

/* ---------- EMP-06 Kelola pelamar */
PAGES["EMP-06"] = async (state) => {
  let id = currentId("L-", null);
  if (!id) { const mine = await API.get("/employer/lowongan"); id = mine.find((l) => ["publik", "ditutup"].includes(l.status))?.id || mine[0]?.id; }
  const denied = (text) => { $("[data-view='content']").innerHTML = `<div class="panel">${emptyState({ icon: "lock", kind: "empty-state--denied", title: "Akses ditolak", text, actions: `<a class="btn btn--primary" href="../employer/lowongan-saya.html">Kembali ke Lowongan Saya</a>` })}</div>`; refreshIcons(); return true; };
  if (!id) return denied("Belum ada lowongan untuk dikelola.");
  let data;
  try { data = await API.get(`/employer/lowongan/${encodeURIComponent(id)}/lamaran`); }
  catch (err) { if (err.status === 403 || err.status === 404) return denied(err.message); throw err; }
  const l = data.lowongan;
  $("#pl-title").textContent = l.posisi; $("#pl-status").innerHTML = badge(l.status);
  const apps = state === "empty" ? [] : data.pelamar;
  $("#pl-count").textContent = `${apps.length} pelamar · Batas lamaran ${tgl(l.batas_lamaran)}`;
  const setStatus = async (x, status, catatan) => {
    const upd = await API.patch(`/employer/lamaran/${encodeURIComponent(x.id)}/status`, { status, catatan });
    Object.assign(x, upd); return x;
  };
  const render = () => {
    $("#pl-rows").innerHTML = apps.map((x) => {
      const m = x.mahasiswa; const mi = matchInfo(l, m.availability);
      return `<tr class="table__row--clickable" tabindex="0" data-row-status="${x.status}" data-app="${x.id}"><td><div class="cell-title">${esc(m.nama)}</div><div class="cell-sub">${esc(m.pt_nama)}</div></td><td>${esc(m.prodi || "—")} · ${esc(m.jenjang || "—")}</td><td class="tnum">${m.semester ?? "—"}</td><td>${matchPill(mi)}</td><td>${badge(m.status)}</td><td>${badge(x.status)}</td><td class="tnum">${tgl(x.dikirim_pada, true)}</td></tr>`;
    }).join("");
    updateTabCounts($("#pl-tabs"), apps.map((x) => x.status)); initTabs(); refreshIcons();
  };
  render();
  $("#pl-table").hidden = !apps.length; $("#pl-empty").hidden = !!apps.length;
  let cur = null;
  const openApp = async (appId) => {
    const x = apps.find((a) => a.id === appId); cur = x; const m = x.mahasiswa;
    if (x.status === "dikirim") { try { await setStatus(x, "ditinjau"); render(); } catch (err) { toast(err.message, "error"); } }
    const s = x.status; const mi = matchInfo(l, m.availability);
    $("#dr-name").textContent = m.nama; $("#dr-sub").textContent = `${m.pt_nama} · ${m.prodi || "—"} (${m.jenjang || "—"}) · semester ${m.semester ?? "—"}`;
    $("#dr-body").innerHTML = `
      <div class="badges">${badge(s)}${badge(m.status, m.status === "terverifikasi" ? "Mahasiswa terverifikasi" : undefined)}${matchPill(mi)}</div>
      ${m.status === "kedaluwarsa" ? alertBox("warning", "Masa verifikasi status mahasiswa pelamar ini telah berakhir.") : ""}
      <section class="stack"><h3>Pesan</h3><p class="small">${esc(x.pesan)}</p></section>
      <dl class="kv"><dt>Portofolio</dt><dd>${x.portofolio ? `<a href="${esc(x.portofolio)}" target="_blank" rel="noopener">${esc(x.portofolio)}</a>` : "—"}</dd><dt>CV</dt><dd>${x.ada_cv ? `<button type="button" class="btn btn--ghost btn--sm" data-cv="${x.id}">${icon("file-text")} ${esc(x.cv_nama)}</button>` : x.cv_nama ? `${icon("file-text")} ${esc(x.cv_nama)} <span class="xs muted">(file demo)</span>` : "—"}</dd>
        <dt>Nomor telepon</dt><dd>${s === "diterima" ? `<span class="tnum" style="user-select:all">${esc(x.telepon || "—")}</span>` : `<span class="muted" style="font-weight:500">${icon("lock")} Nomor telepon tampil setelah pelamar diterima.</span>`}</dd>
        <dt>Dikirim</dt><dd>${tgl(x.dikirim_pada)}</dd></dl>
      <section class="stack"><h3>Availability vs jadwal lowongan</h3>${l.jadwal_fleksibel ? `<p class="small muted">Lowongan berjadwal fleksibel.</p>` : slotGrid({ selected: l.jadwal, mode: "view", compare: m.availability, label: "Jadwal" })}
        <div class="legend"><span><i style="background:var(--color-success-100);border-color:var(--color-success-700)"></i>Cocok</span><span><i style="background:var(--color-warning-100);border-color:var(--color-warning-500)"></i>Di luar availability</span><span><i style="background:var(--color-primary-100)"></i>Availability pelamar</span></div></section>
      <p class="xs muted">${icon("shield-check")} NPM, email kampus, dan dokumen KTM pelamar tidak dibagikan kepada Employer.</p>`;
    const done = ["diterima", "ditolak"].includes(s);
    $("#dr-accept").hidden = done; $("#dr-reject").hidden = done;
    openModal("drawer-pelamar"); refreshIcons();
  };
  $("#dr-body").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cv]"); if (!b) return;
    try { const url = await withLoading(b, () => API.blobUrl(`/files/lamaran/${encodeURIComponent(b.dataset.cv)}/cv`)); window.open(url, "_blank"); }
    catch (err) { toast(err.message, "error"); }
  });
  $("#pl-rows").addEventListener("click", (e) => { const r = e.target.closest("[data-app]"); if (r) openApp(r.dataset.app); });
  $("#pl-rows").addEventListener("keydown", (e) => { const r = e.target.closest("[data-app]"); if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openApp(r.dataset.app); } });
  $("#do-accept").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    try { await withLoading(b, () => setStatus(cur, "diterima")); closeModal(b); render(); toast("Status lamaran diperbarui menjadi Diterima."); openApp(cur.id); }
    catch (err) { closeModal(b); toast(err.message, "error"); }
  });
  $("#do-reject").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    try { await withLoading(b, () => setStatus(cur, "ditolak", $("#rej-note").value)); closeModal(b); render(); toast("Status lamaran diperbarui menjadi Ditolak."); try { $("#drawer-pelamar").close(); } catch (er) {} }
    catch (err) { closeModal(b); toast(err.message, "error"); }
  });
  refreshIcons(); return state === "empty";
};
