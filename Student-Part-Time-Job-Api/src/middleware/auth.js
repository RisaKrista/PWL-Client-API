import jwt from 'jsonwebtoken';
import { JWT_SECRET, loadUser } from '../services/account.js';

// Memastikan header Authorization: Bearer <token> valid; mengisi req.user
export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Silakan masuk terlebih dahulu.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await loadUser(payload.sub, payload.role);
    if (!user) return res.status(401).json({ message: 'Akun tidak ditemukan. Silakan masuk kembali.' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Sesi berakhir. Silakan masuk kembali.' });
    }
    next(err);
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Anda tidak memiliki akses ke fitur ini.' });
  }
  next();
};
