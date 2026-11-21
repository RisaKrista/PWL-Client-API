/* Student Part-Time Job Platform — api.js
   Klien REST untuk Student-Part-Time-Job-Api. Dimuat pertama, sebelum src/core/*.js.
   Token JWT disimpan di localStorage (sptjp:token) dan dikirim sebagai header Authorization. */
"use strict";

const API = (() => {
  // Saat dibuka lewat file:// arahkan ke server lokal; bila disajikan oleh API cukup /api
  const BASE = window.API_BASE || (location.protocol === "file:" ? "http://localhost:3000/api" : "/api");
  const TOKEN_KEY = "sptjp:token";

  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } };
  const setToken = (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {} };
  const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} };

  class ApiError extends Error {
    constructor(status, body) {
      super((body && body.message) || "Terjadi kesalahan. Coba lagi beberapa saat.");
      this.status = status;
      this.errors = (body && body.errors) || {};
      this.body = body || {};
    }
  }

  async function request(method, path, body, { raw = false } = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }

    let res;
    try { res = await fetch(BASE + path, { method, headers, body: payload }); }
    catch (e) { throw new ApiError(0, { message: "Tidak dapat terhubung ke server. Pastikan API berjalan lalu coba lagi." }); }

    if (raw && res.ok) return res;
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      // Sesi kedaluwarsa di halaman yang butuh login → kembali ke halaman masuk
      if (res.status === 401 && token && !path.startsWith("/auth/")) {
        clearToken();
        try { sessionStorage.setItem("sptjp:flash", JSON.stringify({ type: "warning", text: "Sesi berakhir. Silakan masuk kembali." })); } catch (e) {}
        location.href = "../umum/masuk.html";
      }
      throw new ApiError(res.status, data);
    }
    return data;
  }

  return {
    BASE, ApiError, getToken, setToken, clearToken,
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b),
    put: (p, b) => request("PUT", p, b),
    patch: (p, b) => request("PATCH", p, b),
    del: (p) => request("DELETE", p),
    // Mengambil file terproteksi (dokumen/CV) sebagai object URL untuk <img>/<iframe>/tab baru
    async blobUrl(path) {
      const res = await request("GET", path, undefined, { raw: true });
      return URL.createObjectURL(await res.blob());
    },
  };
})();
