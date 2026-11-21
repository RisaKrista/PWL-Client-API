/* Student Part-Time Job Platform — views/mahasiswa.js
   Halaman mahasiswa: MHS-03 s.d. MHS-09. */
"use strict";

/* ---------- MHS-03 Verifikasi status */
PAGES["MHS-03"] = () => {
  FIELD_MAP["form-verif"] = { npm: "v-npm", prodi: "v-prodi", jenjang: "v-jenjang", semester: "v-semester", angkatan: "v-angkatan", jenis_bukti: "v-jenis", ktm: "v-ktm", bukti: "v-bukti" };
  const tahun = Number(TODAY.slice(0, 4));
  $("#v-angkatan").max = tahun; $("#v-angkatan").dataset.msgRange = `Tahun angkatan antara 2019 dan ${tahun}.`;
  CUSTOM["v-bukti"] = (el) => (el.files.length && /ukt|bayar|pembayaran/i.test(el.files[0].name) ? "Bukti pembayaran UKT tidak diterima. Gunakan KRS atau surat keterangan aktif kuliah." : "");
  $("#v-fill").addEventListener("click", () => { $("#v-npm").value = "2410500377"; $("#v-prodi").value = "Sistem Informasi"; $("#v-jenjang").value = "S1"; $("#v-semester").value = "3"; $("#v-angkatan").value = "2024"; $("#v-jenis").value = "krs"; $("#v-asli").checked = true; $$("[data-sample]").forEach((b) => b.click()); });
  if (["pending", "terverifikasi"].includes(STATUS)) {
    $("[data-view='content']").innerHTML = `<div class="panel">${alertBox("info", STATUS === "pending" ? "Data verifikasi Anda sudah terkirim dan sedang ditinjau Admin." : "Akun Anda sudah terverifikasi.")}
      <div class="row"><a class="btn btn--primary" href="../mahasiswa/cari-lowongan.html">${icon("search")}Cari lowongan</a><a class="btn btn--ghost" href="../mahasiswa/status-akses.html">Lihat status akses</a></div></div>`;
    refreshIcons(); return false;
  }
  HOOKS["form-verif"] = async () => {
    await API.post("/mahasiswa/me/verifikasi", formData({
      npm: $("#v-npm").value.trim(), prodi: $("#v-prodi").value.trim(), jenjang: $("#v-jenjang").value,
      semester: $("#v-semester").value, angkatan: $("#v-angkatan").value, jenis_bukti: $("#v-jenis").value,
      ktm: fileVal("v-ktm"), bukti: fileVal("v-bukti"),
    }));
    STATUS = "pending"; renderUserChip();
    $("[data-view='content']").innerHTML = `<div class="panel">${alertBox("success", "Data verifikasi terkirim. Admin akan meninjau data Anda; status dapat dipantau di halaman Status Akses.")}
      <div class="row"><a class="btn btn--primary" href="../mahasiswa/cari-lowongan.html">${icon("search")}Mulai jelajahi lowongan</a><a class="btn btn--ghost" href="../mahasiswa/status-akses.html">Lihat status akses</a></div></div>`;
    refreshIcons(); window.scrollTo(0, 0);
  };
  return false;
};

async function loadMyAvail() {
  const prof = await API.get("/mahasiswa/me");
  MY_AVAIL = prof.availability;
  return prof;
}

/* ---------- MHS-04 Cari lowongan */
PAGES["MHS-04"] = async (state) => {
  const list = $("#job-list"); const count = $("#job-count"); const empty = $("#job-empty");
  if (state === "loading") { list.innerHTML = skeletons(3); count.textContent = "Memuat lowongan…"; return true; }
  if (state === "error") { list.innerHTML = alertBox("error", "Lowongan gagal dimuat. Coba muat ulang halaman.", reloadBtn()); count.textContent = ""; return true; }
  list.innerHTML = skeletons(3); count.textContent = "Memuat lowongan…";
  const [, kota] = await Promise.all([loadMyAvail(), API.get("/lowongan/kota")]);
  const avail = MY_AVAIL;
  $("#mini-avail").innerHTML = avail.length ? slotGrid({ selected: avail, mode: "view", mini: true, label: "Availability" }) : `<p class="small muted">Isi availability terlebih dahulu agar filter jadwal dapat digunakan.</p>`;
  const tgl_ = $("#f-match");
  if (!avail.length) { tgl_.checked = false; tgl_.disabled = true; }
  $("#f-lokasi").innerHTML = `<option value="">Semua lokasi</option>${kota.map((k) => `<option>${esc(k)}</option>`).join("")}<option value="remote">Remote</option>`;
  let seq = 0;
  const render = async () => {
    const my = ++seq;
    const qs = new URLSearchParams();
    const kw = $("#f-q").value.trim(); if (kw) qs.set("q", kw);
    const lok = $("#f-lokasi").value; if (lok) qs.set("lokasi", lok);
    const jenis = $$("[name=f-jenis]:checked").map((i) => i.value); if (jenis.length) qs.set("jenis", jenis.join(","));
    const sistem = $$("[name=f-sistem]:checked").map((i) => i.value); if (sistem.length) qs.set("sistem", sistem.join(","));
    qs.set("sort", { gaji: "gaji", batas: "batas" }[$("#f-sort").value] || "terbaru");
    let rows;
    try { rows = state === "empty" ? [] : await API.get("/lowongan?" + qs); }
    catch (err) { if (my === seq) { list.innerHTML = alertBox("error", esc(err.message), reloadBtn()); count.textContent = ""; refreshIcons(); } return; }
    if (my !== seq) return; // hasil permintaan lama diabaikan
    // Filter "hanya yang cocok jadwal" bergantung pada availability, dihitung di klien
    if (tgl_.checked) rows = rows.filter((l) => { const m = matchInfo(l, avail); return m.type === "full" || m.type === "flex"; });
    list.innerHTML = rows.map(jobCard).join("");
    count.textContent = rows.length ? `${rows.length} lowongan ditemukan` : "";
    empty.hidden = rows.length > 0; $("#job-pagination").hidden = rows.length === 0;
    refreshIcons();
  };
  let deb = null;
  $$("#filter-form input, #filter-form select, #f-sort").forEach((el) => el.addEventListener("change", render));
  $("#f-q").addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(render, 300); });
  $("#search-form").addEventListener("submit", (e) => { e.preventDefault(); render(); });
  $$("[data-reset-filter]").forEach((b) => b.addEventListener("click", () => { $("#filter-form").reset(); $("#f-q").value = ""; if (avail.length) tgl_.checked = true; if (state === "empty") { sess.del("state:" + PAGE); location.reload(); return; } render(); }));
  $(".filter-open").addEventListener("click", () => { const p = $(".filter-panel"); const open = p.classList.toggle("is-open"); $(".filter-open").setAttribute("aria-expanded", open); });
  await render();
  return ["empty", "loading", "error"].includes(state);
};

/* ---------- MHS-05 Detail lowongan */
PAGES["MHS-05"] = async (state) => {
  const id = currentId("L-", "L-001");
  const root = $("#detail");
  if (state === "loading") { root.innerHTML = `<div class="stack">${skeletons(1, "skeleton--line")}${skeletons(2)}</div>`; return true; }
  let l = null;
  try { if (state !== "error") [l] = await Promise.all([API.get(`/lowongan/${encodeURIComponent(id)}`), loadMyAvail()]); }
  catch (err) { if (err.status !== 404) throw err; }
  if (!l) {
    root.innerHTML = `<div class="panel">${emptyState({ icon: "search-x", title: "Lowongan tidak ditemukan", text: "Lowongan tidak ditemukan atau sudah tidak tersedia.", actions: `<a class="btn btn--primary" href="../mahasiswa/cari-lowongan.html">Kembali ke hasil</a>` })}</div>`;
    refreshIcons(); return true;
  }
  const e = l.employer; const avail = MY_AVAIL; const m = matchInfo(l, avail);
  const applied = l.lamaran_saya;
  const closed = l.status === "ditutup" || l.batas_lamaran < TODAY;
  $("#crumb-pos").textContent = l.posisi;
  document.title = `${l.posisi} · Student Part-Time Job Platform`;
  const matchMsg = m.type === "flex" ? "Jadwal fleksibel — atur jam kerja bersama Employer." : m.type === "full" ? `Cocok dengan availability Anda (${m.n} dari ${m.total} slot).` : `Sebagian jadwal di luar availability Anda (${m.total - m.n} dari ${m.total} slot). Pastikan tidak bentrok dengan jadwal kuliah.`;
  let cta;
  if (closed) cta = alertBox("info", "Lowongan ini sudah ditutup dan tidak menerima lamaran baru.");
  else if (applied) cta = `<div class="stack"><div class="row">${badge(applied.status)}<span class="small muted">Anda sudah melamar lowongan ini.</span></div><a class="btn btn--secondary btn--block" href="../mahasiswa/lamaran-saya.html">Lihat status lamaran</a></div>`;
  else if (STATUS !== "terverifikasi") cta = `<div class="stack"><button class="btn btn--primary btn--block" disabled title="Lamaran dapat dikirim setelah akun Anda diverifikasi Admin.">Lamar sekarang</button><p class="xs muted">Lamaran dapat dikirim setelah akun Anda diverifikasi Admin.</p></div>`;
  else cta = `<a class="btn btn--primary btn--block" href="../mahasiswa/formulir-lamaran.html#${l.id}">${icon("send")}Lamar sekarang</a>`;
  root.innerHTML = `
  <div class="split">
    <div class="stack" style="gap:20px;min-width:0">
      <header class="panel">
        <div class="badges">${badge("terverifikasi", "Employer terverifikasi")}<span class="badge badge--success">${icon("shield-check")}Lolos moderasi</span>${closed ? badge("ditutup") : ""}</div>
        <div style="display:grid;gap:4px"><h1>${esc(l.posisi)}</h1><p class="muted">${esc(e.nama)} · Tayang ${tgl(l.tayang)}</p></div>
        <dl class="facts">
          <div><dt>${icon("briefcase")}Jenis · sistem kerja</dt><dd>${JENIS[l.jenis_kerja]} · ${SISTEM[l.sistem_kerja]}</dd></div>
          <div><dt>${icon("map-pin")}Lokasi</dt><dd>${esc(l.sistem_kerja === "remote" ? "Remote" : l.kota + (l.area ? " · " + l.area : ""))}</dd></div>
          <div><dt>${icon("calendar-clock")}Jadwal</dt><dd>${esc(jadwalText(l))}</dd></div>
          <div><dt>${icon("hourglass")}Durasi</dt><dd>${esc(durasi(l))}</dd></div>
          <div><dt>${icon("timer")}Beban kerja</dt><dd>${l.beban_kerja} jam/minggu</dd></div>
          <div><dt>${icon("wallet")}Gaji/upah</dt><dd class="tnum">${gaji(l)}</dd></div>
        </dl>
      </header>
      <section class="panel" aria-labelledby="h-jadwal">
        <div class="panel__head"><h2 id="h-jadwal">Jadwal kerja</h2>${matchPill(m)}</div>
        ${l.jadwal_fleksibel ? `<p class="muted">Pekerjaan ini tidak terikat slot waktu tertentu. Total beban kerja ${l.beban_kerja} jam/minggu.</p>` : slotGrid({ selected: l.jadwal, mode: "view", compare: avail, label: "Jadwal" }) + `<div class="legend"><span><i style="background:var(--color-success-100);border-color:var(--color-success-700)"></i>Jadwal kerja, cocok dengan availability Anda</span><span><i style="background:var(--color-warning-100);border-color:var(--color-warning-500)"></i>Jadwal kerja, di luar availability</span><span><i style="background:var(--color-primary-100)"></i>Availability Anda</span></div>`}
        <p class="small ${m.type === "part" ? "" : "muted"}">${esc(matchMsg)}</p>
      </section>
      <section class="panel" aria-labelledby="h-jd"><h2 id="h-jd">Job desk</h2><div class="prose"><ul>${l.job_desk.split("\n").filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></section>
      <section class="panel" aria-labelledby="h-kr"><h2 id="h-kr">Kriteria kandidat</h2><div class="prose"><ul>${l.kriteria.split("\n").filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${l.jenjang ? `<p class="small muted">Jenjang yang diterima: ${l.jenjang.join(", ")}</p>` : ""}</div></section>
      <section class="panel" aria-labelledby="h-emp"><h2 id="h-emp">Tentang Employer</h2>
        <dl class="kv"><dt>Nama</dt><dd>${esc(e.nama)}</dd><dt>Tipe</dt><dd>${esc(e.tipe_label)}</dd><dt>Kota</dt><dd>${esc(e.kota)}</dd><dt>Status</dt><dd>${badge("terverifikasi")} <span class="small muted">sejak ${tgl(e.terverifikasi_pada)}</span></dd></dl>
        ${l.alamat ? `<p class="small muted">${icon("map-pin")} ${esc(l.alamat)}</p>` : ""}
      </section>
    </div>
    <aside class="panel sticky hide-on-mobile-bar" aria-label="Ringkasan lamaran">
      <div><div class="xs muted">Gaji/upah</div><div class="job-card__salary" style="font-size:var(--text-xl)">${gaji(l)}</div></div>
      <dl class="kv"><dt>Batas lamaran</dt><dd>${tgl(l.batas_lamaran)}</dd><dt>Kecocokan jadwal</dt><dd>${matchPill(m)}</dd></dl>
      ${cta}
      ${["pending", "belum_verifikasi"].includes(STATUS) ? alertBox("warning", STATUS === "pending" ? "Akun Anda menunggu verifikasi Admin." : `Lengkapi <a href="../mahasiswa/verifikasi-status.html">verifikasi status mahasiswa</a> agar dapat melamar.`) : ""}
    </aside>
  </div>
  <div class="mobile-bar"><div><div class="xs muted">Tutup ${tgl(l.batas_lamaran, true)}</div><div class="job-card__salary">${gaji(l)}</div></div>
    ${closed ? badge("ditutup") : applied ? `<a class="btn btn--secondary" href="../mahasiswa/lamaran-saya.html">Lihat status</a>` : STATUS !== "terverifikasi" ? `<button class="btn btn--primary" disabled>Lamar sekarang</button>` : `<a class="btn btn--primary" href="../mahasiswa/formulir-lamaran.html#${l.id}">Lamar sekarang</a>`}</div>`;
  refreshIcons();
  return ["loading", "error"].includes(state);
};

/* ---------- MHS-06 Formulir lamaran */
PAGES["MHS-06"] = async () => {
  const id = currentId("L-", "L-001");
  const [l, prof] = await Promise.all([API.get(`/lowongan/${encodeURIComponent(id)}`), loadMyAvail()]);
  const e = l.employer;
  FIELD_MAP["form-lamaran"] = { pesan: "lm-pesan", portofolio: "lm-porto", telepon: "lm-telp", cv: "lm-cv" };
  $("#lm-title").textContent = `Lamar: ${l.posisi}`;
  $("#lm-back").href = `../mahasiswa/detail-lowongan.html#${l.id}`; $("#lm-cancel").href = `../mahasiswa/detail-lowongan.html#${l.id}`;
  $("#lm-summary").innerHTML = `<div class="badges">${badge("terverifikasi", "Employer terverifikasi")}${matchPill(matchInfo(l))}</div>
    <h2>${esc(l.posisi)}</h2><p class="muted small">${esc(e.nama)}</p>
    <dl class="kv"><dt>Jadwal</dt><dd>${esc(jadwalText(l))}</dd><dt>Lokasi</dt><dd>${esc(lokasi(l))}</dd><dt>Gaji/upah</dt><dd>${gaji(l)}</dd></dl>`;
  $("#lm-shared").innerHTML = `<dl class="kv"><dt>Nama</dt><dd>${esc(prof.nama)}</dd><dt>Perguruan tinggi</dt><dd>${esc(prof.pt_nama)}</dd><dt>Program studi</dt><dd>${esc(prof.prodi || "—")} (${esc(prof.jenjang || "—")})</dd><dt>Semester</dt><dd>${prof.semester ?? "—"}</dd><dt>Status verifikasi</dt><dd>${badge(STATUS)}</dd></dl>
    <div><div class="xs muted" style="margin-bottom:6px">Availability</div>${slotGrid({ selected: MY_AVAIL, mode: "view", mini: true, label: "Availability" })}</div>`;
  $("#lm-confirm-text").textContent = `Kirim lamaran ke ${e.nama}? Lamaran yang sudah dikirim tidak dapat diubah.`;
  if (prof.telepon && !$("#lm-telp").value) $("#lm-telp").value = prof.telepon.replace(/\D/g, "");
  const disable = (msg) => { $("#lm-block").innerHTML = alertBox(msg[0], msg[1]); $$("#form-lamaran input, #form-lamaran textarea, #form-lamaran button[type=submit]").forEach((x) => { x.disabled = true; }); };
  if (STATUS !== "terverifikasi") disable(["warning", "Lamaran hanya dapat dikirim oleh akun yang sudah diverifikasi Admin."]);
  else if (l.lamaran_saya) disable(["info", `Lamaran untuk lowongan ini sudah pernah dikirim. <a href="../mahasiswa/lamaran-saya.html">Lihat Lamaran Saya</a>`]);
  else if (l.status === "ditutup" || l.batas_lamaran < TODAY) disable(["info", "Lowongan ini sudah ditutup dan tidak menerima lamaran baru."]);
  $("#lm-fill").addEventListener("click", () => { $("#lm-pesan").value = "Saya mahasiswa Sistem Informasi semester 7 yang sudah dua tahun mengajar les privat matematika SMP. Jadwal Selasa dan Kamis sore kosong sepanjang semester ini."; $("#lm-pesan").dispatchEvent(new Event("input")); $("#lm-porto").value = "https://portofolio-contoh.dev/reza"; $("#lm-telp").value = "081200000127"; $("#lm-consent").checked = true; });
  HOOKS["form-lamaran"] = () => { openModal("modal-kirim"); };
  $("#lm-send").addEventListener("click", async (ev) => {
    const b = ev.currentTarget;
    try {
      await withLoading(b, () => API.post(`/lowongan/${encodeURIComponent(l.id)}/lamaran`, formData({
        pesan: $("#lm-pesan").value.trim(), portofolio: $("#lm-porto").value.trim(), telepon: $("#lm-telp").value.trim(), cv: fileVal("lm-cv"),
      })));
      flash("success", "Lamaran berhasil dikirim. Pantau statusnya di halaman ini.");
      go("../mahasiswa/lamaran-saya.html");
    } catch (err) { closeModal(b); showApiError(err, $("#form-lamaran")); }
  });
  return false;
};

/* ---------- MHS-07 Lamaran saya */
PAGES["MHS-07"] = async (state) => {
  const rows = state === "empty" ? [] : await API.get("/mahasiswa/me/lamaran");
  const body = $("#lm-rows");
  body.innerHTML = rows.map((x) => {
    const st = x.status;
    const note = st === "diterima" ? `<div class="cell-sub" style="color:var(--color-success-800)">Employer akan menghubungi Anda melalui nomor telepon yang dicantumkan.</div>` : st === "ditolak" && x.catatan ? `<div class="cell-sub">Catatan Employer: ${esc(x.catatan)}</div>` : "";
    return `<tr data-row-status="${st}"><td><div class="cell-title">${esc(x.posisi)}</div>${note}</td><td>${esc(x.employer_nama)}</td><td class="tnum">${tgl(x.dikirim_pada, true)}</td><td>${badge(st)}</td><td><a class="btn btn--ghost btn--sm" href="../mahasiswa/detail-lowongan.html#${x.lowongan_id}">Lihat lowongan</a></td></tr>`;
  }).join("");
  updateTabCounts($("#lm-tabs"), rows.map((x) => x.status));
  initTabs();
  $("#lm-table").hidden = rows.length === 0; $("#lm-empty-all").hidden = rows.length > 0;
  if (state === "success" && !$(".alert--success")) $("[data-flash]").innerHTML = alertBox("success", "Lamaran berhasil dikirim. Pantau statusnya di halaman ini.");
  refreshIcons();
  return state === "empty";
};

/* ---------- MHS-08 Profil & availability */
PAGES["MHS-08"] = async (state) => {
  const prof = await loadMyAvail();
  const npm = prof.npm ? `${prof.npm.slice(0, 2)}•••••${prof.npm.slice(-3)}` : "—";
  $("#profile").innerHTML = `<div class="row" style="gap:14px"><span class="avatar" style="width:52px;height:52px;font-size:var(--text-lg)">${esc(initials(prof.nama))}</span><div><h2>${esc(prof.nama)}</h2><p class="small muted">${esc(prof.pt_nama)}</p></div></div>
    <dl class="kv"><dt>Program studi</dt><dd>${esc(prof.prodi || "—")}</dd><dt>Jenjang · semester</dt><dd>${esc(prof.jenjang || "—")} · semester ${prof.semester ?? "—"}</dd><dt>NPM</dt><dd class="tnum">${npm}</dd><dt>Status akun</dt><dd>${badge(STATUS)}</dd><dt>Berlaku sampai</dt><dd>${STATUS === "terverifikasi" ? tgl(prof.berlaku_sampai) : "—"}</dd></dl>`;
  const sel = state === "empty" ? [] : MY_AVAIL;
  $("#avail-grid").innerHTML = slotGrid({ name: "avail", selected: sel, label: "Availability" });
  $("#avail-empty").hidden = sel.length > 0;
  $("#avail-note").value = prof.catatan_availability || "";
  $("#btn-weekend").addEventListener("click", () => $$("[name=avail]").forEach((i) => { if (/^(sabtu|minggu)-/.test(i.value)) i.checked = true; }));
  $("#btn-clear").addEventListener("click", () => $$("[name=avail]").forEach((i) => { i.checked = false; }));
  HOOKS["form-avail"] = async () => {
    const v = $$("[name=avail]:checked").map((i) => i.value);
    const res = await API.put("/mahasiswa/me/availability", { availability: v, catatan_availability: $("#avail-note").value });
    MY_AVAIL = res.availability;
    $("#avail-empty").hidden = MY_AVAIL.length > 0; toast("Availability berhasil disimpan.");
  };
  return state === "empty";
};

/* ---------- MHS-09 Status akses */
PAGES["MHS-09"] = async (state) => {
  const [prof, hist] = await Promise.all([API.get("/mahasiswa/me"), state === "empty" ? [] : API.get("/mahasiswa/me/verifikasi")]);
  const P = CONFIG.periode || { hari_pengingat: 14 };
  const berlaku = prof.berlaku_sampai;
  const sisa = berlaku ? daysBetween(TODAY, berlaku) : null;
  const reminder = state === "reminder" || (STATUS === "terverifikasi" && sisa !== null && sisa <= P.hari_pengingat);
  const reverif = hist.some((v) => v.jenis === "re_verifikasi" && v.status === "pending");
  const V = {
    terverifikasi: ["success", "badge-check", "Status mahasiswa terverifikasi", reminder ? `Masa verifikasi berakhir dalam ${Math.max(sisa ?? 0, 0)} hari (${tgl(berlaku)}). Unggah bukti aktif semester berikutnya agar akses melamar tidak terputus.` : `Status mahasiswa terverifikasi sampai ${tgl(berlaku)}. Formulir verifikasi ulang terbuka ${P.hari_pengingat} hari sebelum tanggal tersebut.`],
    pending: ["warning", "clock", "Akun Anda menunggu verifikasi Admin", "Anda sudah dapat mencari lowongan. Tombol melamar aktif setelah Admin menyetujui data Anda."],
    belum_verifikasi: ["neutral", "file-up", "Lengkapi verifikasi status mahasiswa", "Unggah KTM dan bukti aktif kuliah agar Admin dapat memverifikasi akun Anda."],
    ditolak: ["error", "circle-x", "Verifikasi ditolak", `Alasan: ${prof.catatan_status || "Data tidak sesuai."} Perbaiki data lalu ajukan ulang.`],
    kedaluwarsa: ["neutral", "calendar-x", "Masa verifikasi berakhir", `Masa verifikasi status mahasiswa Anda berakhir pada ${tgl(berlaku)}. Unggah bukti aktif semester terbaru untuk memulihkan akses mencari dan melamar lowongan.`],
  }[STATUS];
  const showForm = (STATUS === "kedaluwarsa" || (STATUS === "terverifikasi" && reminder)) && !reverif;
  const cta = STATUS === "ditolak" ? `<a class="btn btn--primary" href="../mahasiswa/verifikasi-status.html">Ajukan ulang</a>`
    : STATUS === "belum_verifikasi" ? `<a class="btn btn--primary" href="../mahasiswa/verifikasi-status.html">Lengkapi verifikasi</a>`
    : `<a class="btn btn--secondary" href="../mahasiswa/profil-availability.html">${icon("calendar-days")}Perbarui availability</a>`;
  $("#status-card").innerHTML = `<div class="status-hero"><div class="status-hero__icon tone-${V[0]}">${icon(V[1])}</div><div class="stack" style="gap:6px"><div class="row">${badge(STATUS)}</div><h2>${esc(V[2])}</h2><p class="muted">${esc(V[3])}</p>
    ${STATUS === "kedaluwarsa" ? `<ul class="small muted" style="margin:4px 0 0;padding-left:18px"><li>Mencari dan melihat lowongan: ditutup</li><li>Melamar: ditutup</li><li>Lamaran Saya dan Profil & Availability: tetap dapat dibuka</li></ul>` : ""}
    ${reverif ? alertBox("info", "Bukti aktif terkirim dan menunggu tinjauan Admin. Akses dipulihkan setelah disetujui.") : ""}
    <div class="row">${cta}</div></div></div>`;
  $("#reverif").hidden = !showForm;
  if (reminder && STATUS === "terverifikasi") $("[data-flash]").innerHTML = alertBox("warning", `Masa verifikasi berakhir dalam ${Math.max(sisa ?? 0, 0)} hari. Unggah bukti aktif semester berikutnya agar akses melamar tidak terputus.`);
  FIELD_MAP["form-reverif"] = { semester: "rv-semester", jenis_bukti: "rv-jenis", bukti: "rv-bukti" };
  HOOKS["form-reverif"] = async () => {
    await API.post("/mahasiswa/me/re-verifikasi", formData({ semester: $("#rv-semester").value, jenis_bukti: $("#rv-jenis").value, bukti: fileVal("rv-bukti") }));
    flash("success", "Bukti aktif terkirim dan menunggu tinjauan Admin. Akses dipulihkan setelah disetujui."); location.reload();
  };
  $("#rv-fill").addEventListener("click", () => { $("#rv-semester").value = String(Math.min((prof.semester || 7) + 1, 14)); $("#rv-jenis").value = "surat"; $("#rv-asli").checked = true; $$("[data-sample]").forEach((b) => b.click()); });
  $("#hist-rows").innerHTML = hist.map((v) => `<tr><td>${esc(v.periode || "—")}</td><td>${v.jenis === "awal" ? "Awal" : "Re-verifikasi"}</td><td class="tnum">${tgl(v.diajukan, true)}</td><td>${badge(v.status)}</td><td class="small">${esc(v.ket || "—")}</td></tr>`).join("");
  $("#hist-empty").hidden = hist.length > 0;
  refreshIcons();
  return ["empty", "reminder"].includes(state);
};
