import db from '../db.js';
import { ApiError, parseId } from '../utils.js';

// Cek akses ke kelas tanpa Express (dipakai Socket.IO juga).
export function getClassAccess(classId, userId) {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
  if (!cls) return null;
  const isOwner = cls.teacher_id === userId;
  const isMember =
    isOwner ||
    !!db
      .prepare('SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ?')
      .get(classId, userId);
  return { cls, isOwner, isMember };
}

export function loadClass(req, _res, next) {
  const classId = parseId(req.params.classId, 'classId');
  const access = getClassAccess(classId, req.user.id);
  if (!access) throw new ApiError(404, 'Kelas tidak ditemukan');
  if (!access.isMember) throw new ApiError(403, 'Anda bukan anggota kelas ini');
  req.cls = access.cls;
  req.isOwner = access.isOwner;
  next();
}

export function requireOwner(req, _res, next) {
  if (!req.isOwner) throw new ApiError(403, 'Hanya guru pemilik kelas yang dapat melakukan ini');
  next();
}
