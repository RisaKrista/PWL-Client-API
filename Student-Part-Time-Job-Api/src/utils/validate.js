import { HttpError } from './errors.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

// Penyedia email umum yang tidak boleh dipakai untuk registrasi mahasiswa
const EMAIL_PRIBADI = ['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.id', 'ymail.com', 'outlook.com', 'outlook.co.id',
  'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com', 'mail.com', 'gmx.com', 'yandex.com', 'zoho.com'];
const hostOf = (email) => String(email).toLowerCase().split('@')[1] || '';

export const isEmailPribadi = (email) => {
  const host = hostOf(email);
  return EMAIL_PRIBADI.includes(host) || /^(gmail|yahoo|ymail|outlook|hotmail|icloud|live)\./.test(host);
};

// Email cocok bila host = domain kampus atau subdomainnya (ugm.ac.id menerima @mail.ugm.ac.id)
export const emailCocokDomain = (email, domains) => {
  const host = hostOf(email);
  return domains.some((d) => host === d || host.endsWith('.' + d));
};

// "a.ac.id, @B.ac.id ; c.edu" → ['a.ac.id', 'b.ac.id', 'c.edu']
export const pecahDomain = (teks) =>
  [...new Set(String(teks ?? '').toLowerCase().split(/[\s,;]+/).map((d) => d.replace(/^[@.]+/, '').trim()).filter(Boolean))];
export const TELEPON_RE = /^08\d{8,11}$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
export const int = (v) => (str(v) === '' ? null : Number(v));
export const isStrongPassword = (pw) => typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

// Mengumpulkan pesan error per field, lalu melempar 422 sekaligus
export const createValidator = () => {
  const errors = {};
  return {
    errors,
    check(field, ok, message) {
      if (!ok && !errors[field]) errors[field] = message;
      return ok;
    },
    throwIfAny(message = 'Periksa kembali isian Anda.') {
      if (Object.keys(errors).length) throw new HttpError(422, message, errors);
    }
  };
};
