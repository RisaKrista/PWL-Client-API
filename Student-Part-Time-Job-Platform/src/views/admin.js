/* Student Part-Time Job Platform — views/admin.js
   Halaman admin: ADM-01 s.d. ADM-05. */
"use strict";

/* ---------- ADM-01 Dashboard */
PAGES["ADM-01"] = async (state) => {
  const D = await API.get("/admin/dashboard");
  const V = state === "empty" ? [] : D.verifikasi_pending;
  const M = state === "empty" ? [] : D.moderasi_pending;
  const hari = CONFIG.periode?.hari_pengingat ?? 14;
  const tiles = [["Verifikasi Mahasiswa menunggu", V.filter((v) => v.peran === "mahasiswa").length, "graduation-cap", "../admin/verifikasi-akun.html"], ["Verifikasi Employer menunggu", V.filter((v) => v.peran === "employer").length, "building-2", "../admin/verifikasi-akun.html#employer"], ["Lowongan menunggu moderasi", M.length, "clipboard-check", "../admin/moderasi-lowongan.html"], [`Verifikasi berakhir ≤ ${hari} hari`, state === "empty" ? 0 : D.verifikasi_segera_berakhir, "calendar-clock", "../admin/monitoring-eligibilitas.html"]];
  $("#adm-stats").innerHTML = tiles.map(([lab, n, ic, href]) => `<a class="stat" href="${href}"><span class="stat__value">${n}</span><span class="stat__label">${icon(ic)}${lab}</span></a>`).join("");
  $("#adm-v").innerHTML = V.length ? V.map((v) => `<tr><td><div class="cell-title">${esc(v.nama)}</div><div class="cell-sub">${v.peran === "mahasiswa" ? "Mahasiswa" : "Employer"} · ${v.jenis === "awal" ? "Awal" : "Re-verifikasi"}</div></td><td class="tnum">${tgl(v.diajukan, true)}</td><td><a class="btn btn--ghost btn--sm" href="../admin/tinjau-verifikasi.html#${v.id}">Tinjau</a></td></tr>`).join("") : `<tr><td colspan="3" class="muted">Tidak ada antrean.</td></tr>`;
  $("#adm-m").innerHTML = M.length ? M.map((l) => `<tr><td><div class="cell-title">${esc(l.posisi)}</div><div class="cell-sub">${esc(l.employer.nama)}</div></td><td class="tnum">${tgl(l.diperbarui, true)}</td><td><a class="btn btn--ghost btn--sm" href="../admin/moderasi-lowongan.html#${l.id}">Tinjau</a></td></tr>`).join("") : `<tr><td colspan="3" class="muted">Tidak ada antrean.</td></tr>`;
  refreshIcons(); return state === "empty";
};

/* ---------- ADM-02 Antrean verifikasi */
PAGES["ADM-02"] = async (state) => {
  const rows = state === "empty" ? [] : await API.get("/admin/verifikasi");
  const render = () => {
    const peran = $("#vq-tabs .tab[aria-selected=true]").dataset.filter; const q = $("#vq-q").value.trim().toLowerCase(); const s = $("#vq-status").value; const j = $("#vq-jenis").value;
    const R = rows.filter((v) => v.peran === peran && (!q || (v.nama + v.email).toLowerCase().includes(q)) && (!s || v.status === s) && (!j || v.jenis === j));
    $("#vq-rows").innerHTML = R.map((v) => `<tr><td><div class="cell-title">${esc(v.nama)}</div><div class="cell-sub">${esc(v.email)}</div></td><td>${esc(v.asal)}</td><td>${v.jenis === "awal" ? "Awal" : "Re-verifikasi"}</td><td class="tnum">${tgl(v.diajukan, true)}</td><td class="tnum">${v.status === "pending" ? daysBetween(v.diajukan, TODAY) + " hari" : "—"}</td><td>${badge(v.status)}</td><td><a class="btn btn--${v.status === "pending" ? "primary" : "ghost"} btn--sm" href="../admin/tinjau-verifikasi.html#${v.id}">${v.status === "pending" ? "Tinjau" : "Lihat"}</a></td></tr>`).join("");
    $("#vq-table").hidden = !R.length; $("#vq-empty").hidden = !!R.length;
    $$("#vq-tabs .tab").forEach((b) => { $(".tab__count", b).textContent = rows.filter((v) => v.peran === b.dataset.filter && v.status === "pending").length; });
  };
  if (hashToken === "employer") $$("#vq-tabs .tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.filter === "employer")));
  $$("#vq-tabs .tab").forEach((b) => b.addEventListener("click", () => { $$("#vq-tabs .tab").forEach((x) => x.setAttribute("aria-selected", String(x === b))); render(); }));
  ["#vq-q", "#vq-status", "#vq-jenis"].forEach((s) => $(s).addEventListener("input", render));
  render(); refreshIcons(); return state === "empty";
};

/* ---------- ADM-03 Tinjau verifikasi */
PAGES["ADM-03"] = async (state) => {
  let id = currentId("V-", null);
  if (!id) id = (await API.get("/admin/verifikasi?status=pending"))[0]?.id;
  if (!id) { $("[data-view='content']").innerHTML = `<div class="panel">${emptyState({ icon: "inbox", title: "Tidak ada pengajuan", text: "Antrean verifikasi kosong.", actions: `<a class="btn btn--primary" href="../admin/verifikasi-akun.html">Kembali ke antrean</a>` })}</div>`; refreshIcons(); return true; }
  const v = await API.get(`/admin/verifikasi/${encodeURIComponent(id)}`);
  if (state === "error") { $("#doc-viewer").innerHTML = alertBox("error", "Dokumen gagal dimuat.", reloadBtn()); }
  const status = v.status;
  const batas = v.periode_aktif?.batas_berlaku;
  $("#tv-crumb").textContent = v.nama; $("#tv-title").textContent = v.nama;
  $("#tv-badges").innerHTML = `${badge(status)}<span class="badge badge--neutral">${v.peran === "mahasiswa" ? "Mahasiswa" : "Employer"} · ${v.jenis === "awal" ? "Awal" : "Re-verifikasi"}</span>`;
  let data = "";
  const docOf = (jenis) => v.dokumen.find((d) => d.jenis === jenis);
  if (v.peran === "mahasiswa") {
    const m = v.mahasiswa;
    data = `<dl class="kv"><dt>Nama</dt><dd>${esc(m.nama)}</dd><dt>Email kampus</dt><dd>${esc(m.email)} ${m.domain_cocok ? `<span class="badge badge--success">${icon("check")}Domain cocok</span>` : `<span class="badge badge--error">Domain tidak cocok</span>`}</dd><dt>Perguruan tinggi</dt><dd>${esc(m.pt_nama)}</dd><dt>Program studi</dt><dd>${esc(m.prodi || "—")} (${esc(m.jenjang || "—")})</dd><dt>Semester · angkatan</dt><dd>${v.semester ?? m.semester ?? "—"} · ${m.angkatan ?? "—"}</dd><dt>NPM</dt><dd class="tnum">${esc(m.npm || "—")}</dd><dt>Cek duplikasi NPM</dt><dd>${m.npm_duplikat ? `<span class="badge badge--error">NPM ini juga digunakan oleh akun lain di perguruan tinggi yang sama.</span>` : `<span class="badge badge--success">${icon("check")}Tidak ada duplikasi</span>`}</dd><dt>Jenis bukti aktif</dt><dd>${esc(v.bukti || "—")}</dd></dl>`;
    $("#tv-tabs").innerHTML = (v.jenis === "awal" ? `<button type="button" class="tab" aria-selected="true" data-doc="ktm">KTM</button>` : "") + `<button type="button" class="tab" aria-selected="${v.jenis !== "awal"}" data-doc="bukti_aktif">Bukti aktif</button>`;
    $("#tv-checks").innerHTML = ["Nama di KTM sesuai data akun", "NPM di KTM sesuai data akun", "Bukti aktif untuk semester berjalan", "Perguruan tinggi sesuai domain email"].map((t, i) => `<label class="check"><input type="checkbox" name="cek" id="cek-${i}"> ${t}</label>`).join("") + `<label class="check"><input type="checkbox" id="cek-pddikti"> <span>Cek manual di laman publik PDDikti <span class="xs muted">(opsional; data mungkin tidak mutakhir)</span></span></label>`;
    $("#tv-until").hidden = false; $("#tv-until-val").textContent = tgl(batas);
  } else {
    const e = v.employer;
    data = `<dl class="kv"><dt>Nama usaha</dt><dd>${esc(e.nama)}</dd><dt>Tipe</dt><dd>${esc(e.tipe_label)}</dd><dt>Penanggung jawab</dt><dd>${esc(e.pj)}${e.jabatan ? ` <span class="small muted">(${esc(e.jabatan)})</span>` : ""}</dd><dt>Email</dt><dd>${esc(v.email)}</dd><dt>Telepon</dt><dd>${esc(e.telepon || "—")}</dd><dt>Kota</dt><dd>${esc(e.kota)}</dd><dt>Alamat</dt><dd>${esc(e.alamat || "—")}</dd><dt>NIB</dt><dd>${e.nib ? esc(e.nib) : "— (Perorangan)"}</dd>${e.website ? `<dt>Website</dt><dd><a href="${esc(e.website)}" target="_blank" rel="noopener">${esc(e.website)}</a></dd>` : ""}${e.deskripsi ? `<dt>Deskripsi</dt><dd>${esc(e.deskripsi)}</dd>` : ""}</dl>`;
    const jenisDoc = e.tipe === "perorangan" ? "identitas" : "legalitas";
    $("#tv-tabs").innerHTML = `<button type="button" class="tab" aria-selected="true" data-doc="${jenisDoc}">${e.tipe === "perorangan" ? "Identitas penanggung jawab" : "Dokumen legalitas"}</button>`;
    $("#tv-checks").innerHTML = ["Nama usaha/penanggung jawab sesuai dokumen", "Dokumen terbaca dan masih berlaku", "Alamat sesuai dokumen"].map((t, i) => `<label class="check"><input type="checkbox" name="cek" id="cek-${i}"> ${t}</label>`).join("");
    $("#tv-until").hidden = true;
  }
  $("#tv-data").innerHTML = data;
  const WM = `<div class="doc-viewer__wm">HANYA UNTUK VERIFIKASI<br>Student Part-Time Job Platform</div>`;
  // Placeholder untuk data contoh yang tidak memiliki file unggahan
  const placeholder = (doc) => {
    const m = v.mahasiswa;
    return doc === "ktm" && m ? `<div class="doc-viewer__card"><div class="ph">${icon("user")}</div><div><b>${esc(m.pt_nama)}</b>KARTU TANDA MAHASISWA<br><br><b>${esc(m.nama)}</b>${esc(m.npm || "")}<br>${esc(m.prodi || "")}</div></div>${WM}`
      : `<div class="doc-viewer__paper"><b style="font-size:12px">${doc === "bukti_aktif" ? esc(v.bukti || "Bukti aktif") : "Dokumen legalitas usaha"}</b><span>${doc === "bukti_aktif" ? esc(v.periode) : "Contoh dokumen (tanpa file)"}</span><i></i><i style="width:80%"></i><i></i><i style="width:60%"></i><i></i><i style="width:70%"></i></div>${WM}`;
  };
  const viewer = async (doc) => {
    if (state === "error") return;
    const box = $("#doc-viewer"); const d = docOf(doc);
    if (!d) { box.innerHTML = placeholder(doc); refreshIcons(); return; }
    box.innerHTML = `<div class="stack" aria-busy="true">${skeletons(1)}</div>`;
    try {
      const url = await API.blobUrl(`/files/dokumen/${d.id}`);
      box.innerHTML = (d.mime === "application/pdf"
        ? `<iframe src="${url}" title="${esc(d.nama_asli)}" style="width:100%;min-height:420px;border:0"></iframe>`
        : `<img src="${url}" alt="${esc(d.nama_asli)}" style="max-width:100%;display:block;margin:auto">`) +
        `<p class="xs muted" style="margin-top:6px"><a href="${url}" target="_blank" rel="noopener">${icon("external-link")} Buka ${esc(d.nama_asli)}</a></p>`;
      const img = $("img", box); if (img) img.addEventListener("error", () => { box.innerHTML = placeholder(doc) + `<p class="xs muted">File ${esc(d.nama_asli)} tidak dapat ditampilkan sebagai gambar.</p>`; refreshIcons(); });
    } catch (err) { box.innerHTML = alertBox("error", esc(err.message)); }
    refreshIcons();
  };
  viewer($("#tv-tabs .tab[aria-selected=true]")?.dataset.doc);
  $("#tv-tabs").addEventListener("click", (e) => { const t = e.target.closest("[data-doc]"); if (!t) return; $$("#tv-tabs .tab").forEach((x) => x.setAttribute("aria-selected", String(x === t))); viewer(t.dataset.doc); });
  const syncDec = () => { const tolak = $("[name=keputusan]:checked")?.value === "tolak"; $("#tv-reason-wrap").hidden = !tolak; $("#tv-alasan").required = tolak; $("#tv-until").hidden = tolak || v.peran !== "mahasiswa"; };
  $$("[name=keputusan]").forEach((r) => r.addEventListener("change", syncDec)); syncDec();
  $("#tv-alasan").innerHTML = `<option value="">Pilih alasan</option>` + (v.peran === "mahasiswa" ? ["Dokumen tidak terbaca", "Data tidak sesuai dokumen", "Bukti aktif bukan semester berjalan", "Status tidak aktif atau lulus", "Lainnya"] : ["Dokumen tidak terbaca", "Data tidak sesuai dokumen", "Dokumen legalitas tidak valid", "Lainnya"]).map((x) => `<option>${x}</option>`).join("");
  $("#tv-alasan").dataset.msgRequired = "Pilih alasan penolakan.";
  FIELD_MAP["tv-form"] = { alasan: "tv-alasan", catatan: "tv-catatan" };
  CUSTOM["tv-catatan"] = (el) => ($("#tv-alasan").value === "Lainnya" && !$("#tv-alasan").closest("[hidden]") && !el.value.trim() ? "Catatan wajib diisi bila alasan Lainnya." : "");
  if (status !== "pending") { $("#tv-form").innerHTML = alertBox(status === "ditolak" ? "error" : "success", status === "ditolak" ? `Pengajuan ini sudah ditolak${v.ket ? ": " + esc(v.ket) : ""}.` : `Pengajuan ini sudah disetujui${v.ket ? ". " + esc(v.ket) : ""}.`); refreshIcons(); return state === "error"; }
  HOOKS["tv-form"] = () => {
    const tolak = $("[name=keputusan]:checked").value === "tolak";
    if (!tolak && $$("[name=cek]").some((c) => !c.checked)) { $("#tv-msg").innerHTML = alertBox("error", "Centang seluruh daftar periksa sebelum menyetujui."); refreshIcons(); return; }
    $("#tv-msg").innerHTML = "";
    $("#tv-confirm-title").textContent = tolak ? "Tolak verifikasi?" : "Setujui verifikasi?";
    $("#tv-confirm-text").textContent = tolak ? `Verifikasi ${v.nama} akan ditolak dengan alasan "${$("#tv-alasan").value}". Alasan ditampilkan kepada pengguna.` : v.peran === "mahasiswa" ? `Setujui verifikasi ${v.nama}? Akses melamar berlaku sampai ${tgl(batas)}.` : `Setujui verifikasi ${v.nama}? Employer dapat mempublikasikan lowongan setelah ini.`;
    $("#tv-do").className = `btn ${tolak ? "btn--danger" : "btn--success"}`; $("#tv-do").textContent = tolak ? "Tolak" : "Setujui";
    $("#tv-confirm-icon").className = `modal__icon ${tolak ? "modal__icon--danger" : "modal__icon--success"}`;
    openModal("modal-tv");
  };
  $("#tv-do").addEventListener("click", async (e) => {
    const b = e.currentTarget; const tolak = $("[name=keputusan]:checked").value === "tolak";
    try {
      await withLoading(b, () => API.post(`/admin/verifikasi/${encodeURIComponent(v.id)}/keputusan`, { keputusan: tolak ? "tolak" : "setujui", alasan: tolak ? $("#tv-alasan").value : "", catatan: $("#tv-catatan").value.trim() }));
      closeModal(b); flash("success", tolak ? "Verifikasi ditolak. Alasan ditampilkan kepada pengguna." : "Verifikasi disetujui."); go("../admin/verifikasi-akun.html" + (v.peran === "employer" ? "#employer" : ""));
    } catch (err) { closeModal(b); showApiError(err, $("#tv-form"), $("#tv-msg")); }
  });
  refreshIcons(); return state === "error";
};

/* ---------- ADM-04 Moderasi lowongan */
PAGES["ADM-04"] = async (state) => {
  let all = (await API.get("/admin/lowongan")).items;
  let tab = "menunggu_moderasi"; let sel = /^L-\d{3,}$/.test(hashToken) ? hashToken : null;
  const list = () => (state === "empty" ? [] : all.filter((l) => l.status === tab));
  const reloadAll = async () => { all = (await API.get("/admin/lowongan")).items; };
  const renderList = () => {
    const L = list();
    $$("#md-tabs .tab").forEach((b) => { $(".tab__count", b).textContent = state === "empty" ? 0 : all.filter((l) => l.status === b.dataset.filter).length; b.setAttribute("aria-selected", String(b.dataset.filter === tab)); });
    if (!L.find((l) => l.id === sel)) sel = L[0]?.id || null;
    $("#md-list").innerHTML = L.length ? L.map((l) => `<button type="button" class="md-item ${l.id === sel ? "is-active" : ""}" data-id="${l.id}"><span class="cell-title">${esc(l.posisi)}</span><span class="cell-sub">${esc(l.employer.nama)} · ${tgl(l.diperbarui || l.tayang, true)}</span></button>`).join("")
      : emptyState({ icon: "clipboard-check", title: tab === "menunggu_moderasi" ? "Tidak ada lowongan yang menunggu moderasi." : "Tidak ada lowongan di kategori ini." });
    renderPanel(); refreshIcons();
  };
  const act = async (fn, msg) => { try { await fn(); toast(msg); await reloadAll(); renderList(); } catch (err) { toast(err.message, "error"); } };
  const renderPanel = () => {
    const l = all.find((x) => x.id === sel); const p = $("#md-panel");
    if (!l) { p.innerHTML = `<div class="panel">${emptyState({ icon: "inbox", title: "Pilih lowongan", text: "Detail lowongan tampil di sini." })}</div>`; refreshIcons(); return; }
    const e = l.employer;
    const decision = l.status === "menunggu_moderasi"
      ? `<form id="md-form" class="form" novalidate><div class="field"><span class="field__label">Daftar periksa moderasi</span><div class="check-list">${["Informasi lengkap dan konsisten", "Gaji jelas dan wajar", "Tidak meminta biaya dari pelamar", "Sesuai lingkup (part-time/proyek pendek)"].map((t, i) => `<label class="check"><input type="checkbox" name="mcek" id="mcek-${i}"> ${t}</label>`).join("")}</div></div>
         <div class="field"><label class="field__label" for="md-alasan">Alasan (wajib bila menolak)</label><select class="field__input" id="md-alasan"><option value="">Pilih alasan</option><option>Informasi tidak lengkap/tidak konsisten</option><option>Indikasi penipuan atau meminta biaya</option><option>Di luar lingkup platform</option><option>Konten tidak pantas</option><option>Lainnya</option></select></div>
         <div class="field"><label class="field__label" for="md-catatan">Catatan</label><textarea class="field__input" id="md-catatan" maxlength="300" style="min-height:70px"></textarea></div>
         <div id="md-msg"></div><div class="row"><button type="button" class="btn btn--success" id="md-ok">${icon("check")}Setujui</button><button type="button" class="btn btn--danger" id="md-no">${icon("x")}Tolak</button></div></form>`
      : l.status === "publik" ? `<div class="row"><button type="button" class="btn btn--danger" id="md-close">${icon("lock")}Tutup lowongan</button><span class="small muted">Gunakan bila lowongan publik terbukti melanggar.</span></div>`
      : l.status === "ditolak" ? alertBox("error", `Ditolak: ${esc(l.alasan_penolakan || "—")}`) : "";
    p.innerHTML = `<div class="panel"><div class="badges">${badge(l.status)}${badge(e.status, e.status === "terverifikasi" ? "Employer terverifikasi" : "Employer " + e.status)}</div>
      <div><h2>${esc(l.posisi)}</h2><p class="small muted">${esc(e.nama)} · ${esc(e.tipe_label)} · ${l.id}</p></div>
      <dl class="facts"><div><dt>${icon("briefcase")}Jenis · sistem</dt><dd>${JENIS[l.jenis_kerja]} · ${SISTEM[l.sistem_kerja]}</dd></div><div><dt>${icon("map-pin")}Lokasi</dt><dd>${esc(lokasi(l))}</dd></div><div><dt>${icon("calendar-clock")}Jadwal</dt><dd>${esc(jadwalText(l))}</dd></div><div><dt>${icon("hourglass")}Durasi</dt><dd>${esc(durasi(l))}</dd></div><div><dt>${icon("timer")}Beban kerja</dt><dd>${l.beban_kerja} jam/minggu</dd></div><div><dt>${icon("wallet")}Gaji/upah</dt><dd>${gaji(l)}</dd></div></dl>
      <div class="grid-2"><div class="stack"><h3>Job desk</h3><ul class="small" style="margin:0;padding-left:18px">${l.job_desk.split("\n").filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div class="stack"><h3>Kriteria</h3><ul class="small" style="margin:0;padding-left:18px">${l.kriteria.split("\n").filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      <p class="small muted">Batas lamaran ${tgl(l.batas_lamaran)}</p><hr class="divider">${decision}</div>`;
    const catatan = () => $("#md-catatan")?.value.trim() || "";
    $("#md-ok")?.addEventListener("click", (ev) => {
      if ($$("[name=mcek]").some((c) => !c.checked)) { $("#md-msg").innerHTML = alertBox("error", "Centang seluruh daftar periksa sebelum menyetujui."); refreshIcons(); return; }
      withLoading(ev.currentTarget, () => act(() => API.patch(`/admin/lowongan/${l.id}/moderasi`, { keputusan: "setujui", catatan: catatan() }), "Lowongan disetujui dan kini tampil kepada mahasiswa."));
    });
    $("#md-no")?.addEventListener("click", (ev) => {
      const a = $("#md-alasan").value; if (!a) { setError($("#md-alasan").closest(".field"), "Pilih alasan penolakan."); return; }
      withLoading(ev.currentTarget, () => act(() => API.patch(`/admin/lowongan/${l.id}/moderasi`, { keputusan: "tolak", alasan: a, catatan: catatan() }), "Lowongan ditolak. Employer dapat memperbaiki dan mengajukan ulang."));
    });
    $("#md-close")?.addEventListener("click", () => openModal("modal-md-close"));
    $("#md-close-do").onclick = async (ev) => {
      const a = $("#md-close-alasan").value; if (!a) { setError($("#md-close-alasan").closest(".field"), "Pilih alasan."); return; }
      const b = ev.currentTarget;
      await withLoading(b, () => act(() => API.patch(`/admin/lowongan/${l.id}/tutup`, { alasan: a }), "Lowongan ditutup dan tidak lagi tampil kepada mahasiswa."));
      closeModal(b);
    };
    refreshIcons();
  };
  $("#md-tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (!b) return; tab = b.dataset.filter; sel = null; renderList(); });
  $("#md-list").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (!b) return; sel = b.dataset.id; $$("#md-list .md-item").forEach((x) => x.classList.toggle("is-active", x === b)); renderPanel(); if (window.innerWidth < 1024) $("#md-panel").scrollIntoView({ block: "start" }); });
  if (sel) { const l = all.find((x) => x.id === sel); if (l) tab = l.status; }
  renderList();
  return state === "empty";
};

/* ---------- ADM-05 Monitoring eligibilitas */
PAGES["ADM-05"] = async (state) => {
  let E = await API.get("/admin/eligibilitas");
  const fillPeriode = (P) => { if (!P) return; $("#pr-nama").value = P.nama; $("#pr-mulai").value = P.tanggal_mulai; $("#pr-batas").value = P.batas_berlaku; $("#pr-hari").value = P.hari_pengingat; };
  fillPeriode(E.periode);
  FIELD_MAP["form-periode"] = { nama: "pr-nama", tanggal_mulai: "pr-mulai", batas_berlaku: "pr-batas", hari_pengingat: "pr-hari" };
  CUSTOM["pr-batas"] = (el) => (el.value && el.value <= $("#pr-mulai").value ? "Batas berlaku harus setelah tanggal mulai." : "");
  HOOKS["form-periode"] = async () => {
    const np = await API.put("/admin/periode", { nama: $("#pr-nama").value, tanggal_mulai: $("#pr-mulai").value, batas_berlaku: $("#pr-batas").value, hari_pengingat: Number($("#pr-hari").value) });
    CONFIG.periode = np;
    toast(`Periode semester disimpan. Verifikasi yang disetujui setelah ini berlaku sampai ${tgl(np.batas_berlaku)}.`);
    await reload();
  };
  let filter = "semua";
  const reload = async () => { E = await API.get("/admin/eligibilitas"); render(); };
  const render = () => {
    const per = E.periode || { hari_pengingat: 14 };
    const R = state === "empty" ? [] : E.mahasiswa;
    const segera = (m) => m.status === "terverifikasi" && m.sisa_hari !== null && m.sisa_hari <= per.hari_pengingat;
    $("#el-stats").innerHTML = [["Terverifikasi", R.filter((m) => m.status === "terverifikasi").length, "badge-check", ""], ["Berakhir ≤ " + per.hari_pengingat + " hari", R.filter(segera).length, "calendar-clock", " stat--warn"], ["Kedaluwarsa", R.filter((m) => m.status === "kedaluwarsa").length, "calendar-x", ""]].map(([l, n, ic, c]) => `<div class="stat${c}"><span class="stat__value">${n}</span><span class="stat__label">${icon(ic)}${l}</span></div>`).join("");
    const F = R.filter((m) => filter === "semua" || (filter === "segera" ? segera(m) : m.status === filter));
    $("#el-rows").innerHTML = F.map((m) => `<tr><td><div class="cell-title">${esc(m.nama)}</div><div class="cell-sub">${esc(m.email)}</div></td><td>${esc(m.pt_nama)}</td><td class="tnum">${m.berlaku_sampai ? tgl(m.berlaku_sampai, true) : "—"}</td><td class="tnum">${m.sisa_hari != null ? m.sisa_hari + " hari" : "—"}</td><td>${badge(m.status)}</td><td>${m.reverifikasi_pending ? `<a href="../admin/tinjau-verifikasi.html#${m.reverifikasi_pending}" class="btn btn--ghost btn--sm">Tinjau re-verifikasi</a>` : "<span class='muted small'>—</span>"}</td><td>${m.status === "terverifikasi" ? `<button class="btn btn--ghost btn--sm" style="color:var(--color-error-700)" data-cabut="${m.id}">Cabut verifikasi</button>` : ""}</td></tr>`).join("");
    $("#el-table").hidden = !F.length; $("#el-empty").hidden = !!F.length;
    refreshIcons();
  };
  $("#el-filter").addEventListener("change", (e) => { filter = e.target.value; render(); });
  // Pemeriksaan kedaluwarsa per hari ini: verifikasi yang lewat masa berlaku menjadi Kedaluwarsa
  $("#el-run").addEventListener("click", async (e) => {
    try {
      const r = await withLoading(e.currentTarget, () => API.post("/admin/eligibilitas/jalankan", { tanggal: TODAY }));
      $("#el-result").innerHTML = alertBox("info", `Pemeriksaan per tanggal ${tgl(r.tanggal)} selesai: ${r.jumlah_kedaluwarsa} akun berubah menjadi Kedaluwarsa.`);
      await reload();
    } catch (err) { toast(err.message, "error"); }
  });
  let target = null;
  $("#el-rows").addEventListener("click", (e) => { const c = e.target.closest("[data-cabut]"); if (c) { target = c.dataset.cabut; const m = E.mahasiswa.find((x) => x.id === target); $("#cabut-text").textContent = `Cabut verifikasi ${m.nama}? Akses mencari dan melamar akan ditutup.`; openModal("modal-cabut"); } });
  $("#do-cabut").addEventListener("click", async (e) => {
    if (!$("#cb-alasan").value) { setError($("#cb-alasan").closest(".field"), "Pilih alasan."); return; }
    const b = e.currentTarget;
    try { await withLoading(b, () => API.post(`/admin/mahasiswa/${encodeURIComponent(target)}/cabut`, { alasan: $("#cb-alasan").value })); closeModal(b); toast("Verifikasi dicabut. Status akun menjadi Ditolak."); await reload(); }
    catch (err) { closeModal(b); toast(err.message, "error"); }
  });
  render(); return state === "empty";
};

/* ---------- ADM-06 Perguruan tinggi */
PAGES["ADM-06"] = async (state) => {
  FIELD_MAP["form-pt"] = { nama: "pt-nama", singkatan: "pt-singkatan", jenis: "pt-jenis", domain_email: "pt-domain" };
  const form = $("#form-pt");
  let daftar = [];
  let ubahId = null; // id perguruan tinggi yang sedang diubah (null = tambah baru)

  const isiForm = (pt) => {
    ubahId = pt ? pt.id : null;
    $("#pt-nama").value = pt ? pt.nama : "";
    $("#pt-singkatan").value = pt ? pt.singkatan || "" : "";
    $("#pt-jenis").value = pt ? pt.jenis : "swasta";
    $("#pt-domain").value = pt ? pt.domain.join(", ") : "";
    $$(".field", form).forEach((f) => setError(f, ""));
    $("#pt-form-title").textContent = pt ? `Ubah: ${pt.nama}` : "Tambah perguruan tinggi";
    $("#pt-simpan").innerHTML = pt ? `${icon("save")}Simpan perubahan` : `${icon("plus")}Tambah`;
    $("#pt-batal").hidden = !pt;
    refreshIcons();
  };

  const render = () => {
    const rows = state === "empty" ? [] : daftar;
    $("#pt-count").textContent = rows.length;
    $("#pt-rows").innerHTML = rows.map((p) => `<tr>
      <td><div class="cell-title">${esc(p.nama)}</div>${p.singkatan ? `<div class="cell-sub">${esc(p.singkatan)}</div>` : ""}</td>
      <td><span class="badge badge--${p.jenis === "negeri" ? "info" : "neutral"}">${p.jenis === "negeri" ? "Negeri" : "Swasta"}</span></td>
      <td class="small">${p.domain.map((d) => `<code>@${esc(d)}</code>`).join(", ")}</td>
      <td class="tnum">${p.jumlah_mahasiswa}</td>
      <td style="white-space:nowrap"><button type="button" class="btn btn--ghost btn--sm" data-ubah="${esc(p.id)}">Ubah</button>${p.jumlah_mahasiswa === 0 ? `<button type="button" class="btn btn--ghost btn--sm" style="color:var(--color-error-700)" data-hapus="${esc(p.id)}">Hapus</button>` : ""}</td></tr>`).join("");
    $("#pt-table").hidden = !rows.length;
    $("#pt-empty").hidden = !!rows.length;
    $("#pt-empty").innerHTML = rows.length ? "" : emptyState({ icon: "school", title: "Tidak ada perguruan tinggi yang cocok." });
    refreshIcons();
  };

  const muat = async () => {
    const qs = new URLSearchParams();
    const q = $("#pt-q").value.trim(); if (q) qs.set("q", q);
    const j = $("#pt-jenis-filter").value; if (j) qs.set("jenis", j);
    daftar = await API.get("/admin/perguruan-tinggi" + (qs.toString() ? "?" + qs : ""));
    render();
  };

  HOOKS["form-pt"] = async () => {
    const body = { nama: $("#pt-nama").value.trim(), singkatan: $("#pt-singkatan").value.trim(), jenis: $("#pt-jenis").value, domain_email: $("#pt-domain").value };
    const pt = ubahId ? await API.put(`/admin/perguruan-tinggi/${encodeURIComponent(ubahId)}`, body) : await API.post("/admin/perguruan-tinggi", body);
    toast(ubahId ? `${pt.nama} diperbarui.` : `${pt.nama} ditambahkan.`);
    isiForm(null);
    await muat();
  };
  $("#pt-batal").addEventListener("click", () => isiForm(null));
  $("#pt-filter").addEventListener("submit", (e) => { e.preventDefault(); muat().catch((err) => toast(err.message, "error")); });
  $("#pt-jenis-filter").addEventListener("change", () => muat().catch((err) => toast(err.message, "error")));

  let target = null;
  $("#pt-rows").addEventListener("click", (e) => {
    const u = e.target.closest("[data-ubah]"); const h = e.target.closest("[data-hapus]");
    if (u) { isiForm(daftar.find((p) => p.id === u.dataset.ubah)); form.scrollIntoView({ block: "start" }); $("#pt-nama").focus(); }
    if (h) {
      target = daftar.find((p) => p.id === h.dataset.hapus);
      $("#hapus-pt-text").textContent = `Hapus ${target.nama} dari daftar? Mahasiswa kampus ini tidak bisa mendaftar sampai ditambahkan lagi.`;
      openModal("modal-hapus-pt");
    }
  });
  $("#do-hapus-pt").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    try {
      await withLoading(b, () => API.del(`/admin/perguruan-tinggi/${encodeURIComponent(target.id)}`));
      closeModal(b); toast(`${target.nama} dihapus.`);
      if (ubahId === target.id) isiForm(null);
      await muat();
    } catch (err) { closeModal(b); toast(err.message, "error"); }
  });

  await muat();
  return state === "empty";
};
