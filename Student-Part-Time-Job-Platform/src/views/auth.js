/* Student Part-Time Job Platform — views/auth.js
   Halaman publik: UMM-02 Masuk, MHS-01/MHS-02 registrasi mahasiswa & OTP, EMP-01 registrasi employer. */
"use strict";

const DEMO_PASSWORD = "admin123"; // kata sandi Admin bawaan (seeder)

async function doLogin(email, password, alertEl) {
  try {
    const res = await API.post("/auth/login", { email, password });
    API.setToken(res.token);
    if (res.user.status === "kedaluwarsa") flash("warning", "Masa verifikasi status mahasiswa telah berakhir. Lakukan verifikasi ulang untuk melanjutkan.");
    goHome(res.user);
  } catch (err) {
    if (err.body.perlu_otp) {
      sess.set("regEmail", email); if (err.body.otp_dev) sess.set("otpDev", err.body.otp_dev);
      flash("warning", err.message); go("../mahasiswa/verifikasi-email.html"); return;
    }
    alertEl.innerHTML = alertBox("error", esc(err.message)); refreshIcons();
  }
}

/* ---------- UMM-02 Masuk */
PAGES["UMM-02"] = () => {
  // Hanya akun Admin yang ada di data awal; Mahasiswa & Employer mendaftar lewat aplikasi
  const DEMO = { admin: "admin" }; // username Admin bawaan (tabel admin)
  $$("[data-demo-login]").forEach((b) => b.addEventListener("click", () => withLoading(b, () => doLogin(DEMO[b.dataset.demoLogin], DEMO_PASSWORD, $("#login-alert")))));
  HOOKS["form-masuk"] = async () => {
    const email = $("#login-email").value.trim().toLowerCase(); const pw = $("#login-password").value;
    $("#login-alert").innerHTML = "";
    await doLogin(email, pw, $("#login-alert"));
    $("#login-password").value = "";
  };
  return false;
};

/* ---------- MHS-01 Registrasi Mahasiswa */
PAGES["MHS-01"] = async () => {
  const PERSONAL = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|icloud|live|me|proton|protonmail|aol|mail|gmx|yandex|zoho)\./i;
  const PT = await API.get("/perguruan-tinggi");
  // Dikelompokkan Negeri / Swasta seperti versi Laravel
  const grup = (jenis, label) => {
    const opsi = PT.filter((p) => p.jenis === jenis);
    return opsi.length ? `<optgroup label="${label}">${opsi.map((p) => `<option value="${esc(p.id)}">${esc(p.nama)}${p.singkatan ? ` (${esc(p.singkatan)})` : ""}</option>`).join("")}</optgroup>` : "";
  };
  $("#reg-pt").innerHTML = `<option value="">Pilih perguruan tinggi</option>` + grup("negeri", "Perguruan Tinggi Negeri") + grup("swasta", "Perguruan Tinggi Swasta");
  FIELD_MAP["form-reg"] = { nama: "reg-nama", pt_id: "reg-pt", email: "reg-email", password: "reg-password" };
  // Subdomain ikut diterima: widyatama.ac.id juga menerima @student.widyatama.ac.id
  const cocokDomain = (email, domains) => { const host = email.split("@")[1] || ""; return domains.some((d) => host === d || host.endsWith("." + d)); };
  CUSTOM["reg-email"] = (el) => {
    const v = el.value.trim().toLowerCase();
    if (PERSONAL.test(v)) return "Gunakan email kampus. Email pribadi (mis. Gmail) tidak dapat digunakan.";
    const pt = PT.find((p) => p.id === $("#reg-pt").value);
    if (pt && !cocokDomain(v, pt.domain)) return "Domain email ini tidak sesuai dengan perguruan tinggi yang dipilih.";
    return "";
  };
  CUSTOM["reg-password"] = (el) => (/[A-Za-z]/.test(el.value) && /\d/.test(el.value) ? "" : "Kata sandi minimal 8 karakter dan memuat huruf serta angka.");
  $("#reg-pt").addEventListener("change", (e) => { const pt = PT.find((p) => p.id === e.target.value); $("#reg-email-hint").textContent = pt ? `Gunakan email berdomain @${pt.domain.join(" atau @")} (subdomain juga diterima).` : "Gunakan email kampus. Email pribadi tidak diterima."; });
  $("#reg-fill").addEventListener("click", () => { $("#reg-nama").value = "Dinda Lestari"; $("#reg-pt").value = PT.find((p) => p.singkatan === "UTama")?.id || PT[0]?.id || ""; $("#reg-pt").dispatchEvent(new Event("change")); $("#reg-email").value = "dinda.lestari@widyatama.ac.id"; $("#reg-password").value = "kerja2026"; $("#reg-password2").value = "kerja2026"; $("#reg-consent").checked = true; });
  HOOKS["form-reg"] = async () => {
    const email = $("#reg-email").value.trim().toLowerCase();
    const res = await API.post("/auth/register/mahasiswa", { nama: $("#reg-nama").value.trim(), pt_id: $("#reg-pt").value, email, password: $("#reg-password").value });
    sess.set("regEmail", email); if (res.otp_dev) sess.set("otpDev", res.otp_dev);
    go("../mahasiswa/verifikasi-email.html");
  };
  return false;
};

/* ---------- OTP (MHS-02 & EMP-01B) */
function initOtp(root, getEmail, onOk) {
  const inputs = $$(".otp input", root);
  inputs.forEach((inp, i) => {
    inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, "").slice(-1); if (inp.value && inputs[i + 1]) inputs[i + 1].focus(); upd(); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !inp.value && inputs[i - 1]) inputs[i - 1].focus(); });
    inp.addEventListener("paste", (e) => { const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (t) { e.preventDefault(); t.split("").forEach((c, j) => { if (inputs[j]) inputs[j].value = c; }); upd(); inputs[Math.min(t.length, 5)].focus(); } });
  });
  const btn = $("[data-otp-submit]", root); const field = $(".otp", root).closest(".field");
  let locked = false;
  function upd() { btn.disabled = inputs.some((i) => !i.value) || locked; }
  upd();
  // Mode pengembangan: API mengembalikan kode OTP agar demo tidak membutuhkan email sungguhan
  const devHint = (code) => {
    let el = $("[data-otp-dev]", root);
    if (!el) { el = document.createElement("p"); el.className = "xs muted"; el.dataset.otpDev = ""; field.after(el); }
    el.textContent = code ? `Mode pengembangan — kode verifikasi: ${code} (juga tercetak di console server).` : "";
  };
  devHint(sess.get("otpDev", ""));
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    const kode = inputs.map((i) => i.value).join("");
    try {
      const res = await withLoading(btn, () => API.post("/auth/otp/verify", { email: getEmail(), kode }));
      setError(field, ""); sess.del("otpDev"); API.setToken(res.token); onOk(res);
    } catch (err) {
      inputs.forEach((i) => { i.value = ""; }); inputs[0].focus();
      if (err.status === 429) { locked = true; inputs.forEach((i) => { i.disabled = true; }); }
      setError(field, err.message); upd();
    }
  });
  const resend = $("[data-otp-resend]", root);
  if (resend) {
    let left = 60; let timer = null;
    const tick = () => { if (left > 0) { resend.disabled = true; resend.textContent = `Kirim ulang kode (${left} dtk)`; left--; } else { resend.disabled = false; resend.textContent = "Kirim ulang kode"; clearInterval(timer); } };
    const start = () => { left = 60; clearInterval(timer); timer = setInterval(tick, 1000); tick(); };
    start();
    resend.addEventListener("click", async () => {
      try {
        const res = await API.post("/auth/otp/resend", { email: getEmail() });
        locked = false; inputs.forEach((i) => { i.disabled = false; i.value = ""; }); setError(field, "");
        if (res.otp_dev) devHint(res.otp_dev);
        toast("Kode baru telah dikirim. Periksa juga folder spam."); start(); upd();
      } catch (err) { toast(err.message, "error"); }
    });
    root._restartResend = start;
  }
  root._devHint = devHint;
}
// Halaman verifikasi email: MHS-02 (mahasiswa) & EMP-01B (employer)
const otpPage = (pesanSukses) => () => {
  const email = sess.get("regEmail", "");
  if (!email) { flash("info", "Daftar atau masuk terlebih dahulu untuk memverifikasi email."); go("../umum/masuk.html"); return true; }
  const [u, d] = email.split("@"); $("#otp-email").textContent = `${u[0]}•••@${d}`;
  initOtp(document, () => email, (res) => { sess.del("regEmail"); flash("success", pesanSukses); goHome(res.user); });
  return false;
};
PAGES["MHS-02"] = otpPage("Email berhasil diverifikasi.");
PAGES["EMP-01B"] = otpPage("Email berhasil diverifikasi. Lanjutkan dengan mengunggah dokumen.");

/* ---------- EMP-01 Registrasi employer */
PAGES["EMP-01"] = () => {
  const sync = () => { const t = $("[name=tipe]:checked").value; const per = t === "perorangan"; $("#er-usaha").required = !per; $("#er-usaha-req").hidden = per; $("#er-usaha-field").querySelector(".field__hint").textContent = per ? "Opsional untuk Perorangan." : "Wajib untuk UMKM, Startup, dan Perusahaan."; };
  $$("[name=tipe]").forEach((r) => r.addEventListener("change", sync)); sync();
  $("#er-usaha").dataset.msgRequired = "Nama usaha wajib diisi untuk tipe UMKM, Startup, dan Perusahaan.";
  FIELD_MAP["form-emp-reg"] = { nama: "er-usaha", pj: "er-pj", email: "er-email", telepon: "er-telp", kota: "er-kota", password: "er-password" };
  CUSTOM["er-password"] = (el) => (/[A-Za-z]/.test(el.value) && /\d/.test(el.value) ? "" : "Kata sandi minimal 8 karakter dan memuat huruf serta angka.");
  $("#er-fill").addEventListener("click", () => { $("#er-usaha").value = "Studio Foto Lensa Kota"; $("#er-pj").value = "Arif Nugraha"; $("#er-jabatan").value = "Pemilik"; $("#er-email").value = "arif@lensakota-contoh.id"; $("#er-telp").value = "081200000777"; $("#er-kota").value = "Bandung"; $("#er-password").value = "studio2026"; $("#er-password2").value = "studio2026"; $("#er-consent").checked = true; $("[name=tipe][value=umkm]").checked = true; sync(); });
  // Setelah daftar → halaman verifikasi email employer (EMP-01B)
  HOOKS["form-emp-reg"] = async () => {
    const email = $("#er-email").value.trim().toLowerCase();
    const res = await API.post("/auth/register/employer", {
      tipe: $("[name=tipe]:checked").value, nama: $("#er-usaha").value.trim(), pj: $("#er-pj").value.trim(), jabatan: $("#er-jabatan").value.trim(),
      email, telepon: $("#er-telp").value.trim(), kota: $("#er-kota").value, password: $("#er-password").value,
    });
    sess.set("regEmail", email); if (res.otp_dev) sess.set("otpDev", res.otp_dev);
    go("../employer/verifikasi-email.html");
  };
  return false;
};
