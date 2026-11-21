/* Student Part-Time Job Platform — core/forms.js
   Validasi formulir, error dari API, submit async, dropzone, dan tab filter. */
"use strict";

/* ------------------------------------------------------------------ validasi formulir */
function setError(field, msg) {
  if (!field) return;
  let er = $(".field__error", field);
  const ctl = $("input:not([type=checkbox]):not([type=radio]), select, textarea", field) || $("input", field);
  if (msg) {
    field.classList.add("is-error");
    if (!er) { er = document.createElement("p"); er.className = "field__error"; er.id = (ctl?.id || "f" + Math.random().toString(36).slice(2)) + "-err"; field.append(er); }
    er.innerHTML = `${icon("circle-alert")}<span>${esc(msg)}</span>`; refreshIcons();
    if (ctl) { ctl.setAttribute("aria-invalid", "true"); ctl.setAttribute("aria-describedby", er.id); }
  } else {
    field.classList.remove("is-error"); if (er) er.remove();
    if (ctl) { ctl.removeAttribute("aria-invalid"); }
  }
}
const CUSTOM = {}; // id field -> fn(el) -> pesan error | ""
function hasRule(el) { return el.required || el.minLength > 0 || el.dataset.pattern || el.type === "email" || el.type === "number" || el.type === "file" || el.dataset.match || el.type === "url" || CUSTOM[el.id]; }
function validateField(el) {
  const field = el.closest(".field");
  if (!field || el.closest("[data-group-required]") || el.closest("[hidden]") || el.disabled || !hasRule(el)) return true;
  let msg = "";
  const isCheck = el.type === "checkbox";
  const val = isCheck ? el.checked : el.type === "file" ? el.files.length : el.value.trim();
  if (el.required && !val) msg = el.dataset.msgRequired || (isCheck ? "Kotak ini wajib dicentang." : el.type === "file" ? "File wajib diunggah." : "Kolom ini wajib diisi.");
  else if (val && !isCheck && el.type !== "file") {
    if (el.minLength > 0 && el.value.trim().length < el.minLength) msg = el.dataset.msgMinlength || `Minimal ${el.minLength} karakter.`;
    else if (el.dataset.pattern && !new RegExp(el.dataset.pattern).test(el.value.trim())) msg = el.dataset.msgPattern || "Format tidak sesuai.";
    else if (el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) msg = "Format email tidak valid.";
    else if (el.type === "url" && !/^https:\/\/\S+\.\S+/.test(val)) msg = "Tautan harus diawali https://";
    else if (el.type === "number") { const n = Number(el.value); if ((el.min !== "" && n < Number(el.min)) || (el.max !== "" && n > Number(el.max))) msg = el.dataset.msgRange || `Nilai harus antara ${el.min} dan ${el.max}.`; }
    if (!msg && el.dataset.match) { const o = document.getElementById(el.dataset.match); if (o && o.value !== el.value) msg = el.dataset.msgMatch || "Isian tidak sama."; }
  }
  if (!msg && el.type === "file" && el.files.length) {
    const f = el.files[0];
    if (f.size > 2 * 1024 * 1024) msg = "Ukuran file maksimal 2 MB.";
    else if (!new RegExp(el.dataset.ext || "\\.(jpe?g|png|pdf)$", "i").test(f.name)) msg = el.dataset.msgExt || "Format file harus JPG, PNG, atau PDF.";
  }
  if (!msg && CUSTOM[el.id]) msg = CUSTOM[el.id](el) || "";
  setError(field, msg); return !msg;
}
function validateForm(form) {
  const bad = [];
  $$("input, select, textarea", form).forEach((el) => { if (!validateField(el)) bad.push(el); });
  $$("[data-group-required]", form).forEach((g) => {
    if (g.closest("[hidden]") || g.dataset.skip === "1") { setError(g.closest(".field"), ""); return; }
    const any = $$("input", g).some((i) => i.checked);
    setError(g.closest(".field"), any ? "" : g.dataset.msg || "Pilih minimal satu.");
    if (!any) bad.push($("input", g));
  });
  const sum = $("[data-summary]", form);
  if (sum) {
    if (bad.length) {
      const labels = [...new Set(bad.map((el) => el.closest(".field")?.querySelector(".field__label")?.dataset.name || el.closest(".field")?.querySelector(".field__label")?.textContent.replace("*", "").trim()).filter(Boolean))];
      sum.innerHTML = alertBox("error", `<strong>${esc(sum.dataset.title || "Periksa kembali isian berikut.").replace("{n}", labels.length)}</strong><ul>${labels.map((l) => `<li><a href="#" data-jump="${esc(l)}">${esc(l)}</a></li>`).join("")}</ul>`);
      sum.hidden = false; refreshIcons();
      $$("[data-jump]", sum).forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); const el = bad.find((b) => (b.closest(".field")?.querySelector(".field__label")?.dataset.name || b.closest(".field")?.querySelector(".field__label")?.textContent.replace("*", "").trim()) === a.dataset.jump); el?.focus(); el?.scrollIntoView({ block: "center" }); }));
      sum.scrollIntoView({ block: "start" });
    } else { sum.hidden = true; sum.innerHTML = ""; }
  }
  if (bad.length && !sum) { bad[0].focus(); }
  return bad.length === 0;
}

// Menampilkan error dari API: pesan per field (errors) ke field terkait, sisanya sebagai toast/alert
const FIELD_MAP = {}; // id form -> { field_api: id_elemen }
function showApiError(err, form, alertEl) {
  const map = (form && FIELD_MAP[form.id]) || {};
  let shown = 0;
  Object.entries(err.errors || {}).forEach(([k, msg]) => {
    const el = map[k] && document.getElementById(map[k]);
    if (el && typeof msg === "string") { setError(el.closest(".field"), msg); shown++; }
  });
  if (alertEl) { alertEl.innerHTML = alertBox("error", esc(err.message)); refreshIcons(); }
  else toast(err.message, "error");
  const first = form && $(".is-error", form); if (shown && first) first.scrollIntoView({ block: "center" });
}

const HOOKS = {};
function initForms() {
  $$("form[data-validate]").forEach((form) => {
    form.noValidate = true;
    $$("input, select, textarea", form).forEach((el) => {
      el.addEventListener("blur", () => { if (el.type !== "checkbox" && el.type !== "radio" && el.value) validateField(el); });
      el.addEventListener("change", () => { if (el.closest(".field")?.classList.contains("is-error")) { validateField(el); const g = el.closest("[data-group-required]"); if (g && $$("input", g).some((i) => i.checked)) setError(g.closest(".field"), ""); } });
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.submitter || $("button[type=submit]", form);
      const action = btn?.dataset.action || "submit";
      if (action !== "draft" && !validateForm(form)) return;
      const hook = HOOKS[form.id];
      if (!hook) { go(form.dataset.next); return; }
      const run = async () => { try { await hook(form, action, btn); } catch (err) { if (err instanceof API.ApiError) showApiError(err, form); else { console.error(err); toast("Terjadi kesalahan. Coba lagi.", "error"); } } };
      if (btn && !btn.dataset.noLoading) await withLoading(btn, run); else await run();
    });
  });
  // penghitung karakter
  $$("[data-counter]").forEach((ta) => {
    const out = document.createElement("div"); out.className = "field__counter"; ta.after(out);
    const upd = () => { out.textContent = `${ta.value.length.toLocaleString("id-ID")}/${Number(ta.maxLength).toLocaleString("id-ID")} karakter`; };
    ta.addEventListener("input", upd); upd();
  });
  // dropzone
  $$(".dropzone").forEach((dz) => {
    const input = $("input[type=file]", dz); const out = dz.parentElement.querySelector(".dropzone__out");
    const show = () => {
      if (!input.files.length) { if (out) out.innerHTML = ""; return; }
      const f = input.files[0];
      if (out) {
        out.innerHTML = `<div class="dropzone__file">${icon("file-text")}<div style="flex:1;min-width:0"><div class="cell-title" style="overflow-wrap:anywhere">${esc(f.name)}</div><div class="dropzone__bar"><i></i></div></div><button type="button" class="btn btn--ghost btn--icon" aria-label="Hapus file">${icon("x")}</button></div>`;
        refreshIcons(); requestAnimationFrame(() => requestAnimationFrame(() => { const bar = $(".dropzone__bar i", out); if (bar) bar.style.width = "100%"; }));
        $("button", out).addEventListener("click", () => { input.value = ""; show(); });
      }
      validateField(input);
    };
    input.addEventListener("change", show);
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, () => dz.classList.add("is-over")));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove("is-over")));
    const sample = dz.parentElement.querySelector("[data-sample]");
    if (sample) sample.addEventListener("click", () => {
      try { const dt = new DataTransfer(); dt.items.add(new File(["contoh"], sample.dataset.sample, { type: sample.dataset.sample.endsWith(".pdf") ? "application/pdf" : "image/jpeg" })); input.files = dt.files; show(); }
      catch (e) { toast("Browser ini tidak mendukung file contoh. Pilih file secara manual.", "error"); }
    });
  });
}
const fileVal = (id) => document.getElementById(id)?.files?.[0] || null;
function formData(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== "") fd.append(k, v); });
  return fd;
}

/* ------------------------------------------------------------------ tabs (filter baris) */
function initTabs(root = document, onChange) {
  $$("[data-tabs]", root).forEach((tabs) => {
    const target = document.querySelector(tabs.dataset.tabs);
    const btns = $$(".tab", tabs);
    const apply = (val) => {
      btns.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.filter === val)));
      if (target) {
        let shown = 0;
        $$("[data-row-status]", target).forEach((r) => { const ok = val === "semua" || r.dataset.rowStatus === val; r.hidden = !ok; if (ok) shown++; });
        $$("[data-row-sub]", target).forEach((r) => { const p = target.querySelector(`[data-row-id="${r.dataset.rowSub}"]`); r.hidden = !p || p.hidden; });
        const em = document.querySelector(tabs.dataset.empty || "_none");
        if (em) { em.hidden = shown > 0; if (!shown) { const lbl = btns.find((b) => b.dataset.filter === val)?.dataset.label || ""; const t = $("[data-empty-label]", em); if (t) t.textContent = lbl; } }
      }
      if (onChange) onChange(val);
    };
    if (!tabs._bound) { btns.forEach((b) => b.addEventListener("click", () => tabs._apply(b.dataset.filter))); tabs._bound = true; }
    tabs._apply = apply;
    apply(btns.find((b) => b.getAttribute("aria-selected") === "true")?.dataset.filter || btns[0].dataset.filter);
  });
}
function updateTabCounts(tabs, rows) {
  $$(".tab", tabs).forEach((b) => { const c = $(".tab__count", b); if (c) c.textContent = b.dataset.filter === "semua" ? rows.length : rows.filter((r) => r === b.dataset.filter).length; });
}
