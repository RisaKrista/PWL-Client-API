import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { HttpError } from '../utils/errors.js';

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB, sama dengan validasi frontend
const ANY_DOC = { ext: /\.(jpe?g|png|pdf)$/i, mime: /^(image\/jpeg|image\/png|application\/pdf)$/, msg: 'Format file harus JPG, PNG, atau PDF.' };
const PDF_ONLY = { ext: /\.pdf$/i, mime: /^application\/pdf$/, msg: 'CV harus berformat PDF.' };
const RULES = { cv: PDF_ONLY };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, file.fieldname);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const fileFilter = (req, file, cb) => {
  const rule = RULES[file.fieldname] || ANY_DOC;
  if (!rule.ext.test(file.originalname) || !rule.mime.test(file.mimetype)) {
    return cb(new HttpError(422, rule.msg, { [file.fieldname]: rule.msg }));
  }
  cb(null, true);
};

// fields: daftar nama field file, mis. ['ktm', 'bukti']
export const uploadFiles = (...fields) =>
  multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } }).fields(fields.map((name) => ({ name, maxCount: 1 })));

export const fileOf = (req, field) => req.files?.[field]?.[0] || null;

// Hapus file yang sudah terunggah bila request gagal divalidasi
export const cleanupFiles = (req) => {
  Object.values(req.files || {}).flat().forEach((f) => fs.unlink(f.path, () => {}));
};

// Path relatif terhadap UPLOAD_DIR untuk disimpan di DB
export const relPath = (file) => path.relative(UPLOAD_DIR, file.path).split(path.sep).join('/');
export const absPath = (rel) => path.join(UPLOAD_DIR, rel);
