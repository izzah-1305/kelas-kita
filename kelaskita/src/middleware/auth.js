import jwt from 'jsonwebtoken';
import db from '../db.js';
import { config } from '../config.js';
import { ApiError } from '../utils.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpires,
  });
}

// Dipakai juga oleh Socket.IO. Mengembalikan user atau null.
export function getUserFromToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return (
      db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.sub) || null
    );
  } catch {
    return null;
  }
}

export function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Token tidak ditemukan');
  const user = getUserFromToken(token);
  if (!user) throw new ApiError(401, 'Token tidak valid atau sudah kedaluwarsa');
  req.user = user;
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'Anda tidak memiliki akses untuk aksi ini');
    }
    next();
  };
