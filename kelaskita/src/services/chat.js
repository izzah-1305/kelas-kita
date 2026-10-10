import { z } from 'zod';
import db from '../db.js';

export const messageSchema = z.object({ content: z.string().trim().min(1).max(2000) });

export function saveMessage(classId, userId, content) {
  const info = db
    .prepare('INSERT INTO messages (class_id, user_id, content) VALUES (?, ?, ?)')
    .run(classId, userId, content);
  return db
    .prepare(
      `SELECT m.id, m.class_id, m.user_id, u.name AS user_name, u.role AS user_role,
              m.content, m.created_at
       FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
    )
    .get(info.lastInsertRowid);
}

export function listMessages(classId, { before = null, limit = 50 } = {}) {
  const rows = db
    .prepare(
      `SELECT m.id, m.class_id, m.user_id, u.name AS user_name, u.role AS user_role,
              m.content, m.created_at
       FROM messages m JOIN users u ON u.id = m.user_id
       WHERE m.class_id = ? AND (? IS NULL OR m.id < ?)
       ORDER BY m.id DESC LIMIT ?`,
    )
    .all(classId, before, before, limit);
  return rows.reverse(); // urut dari lama ke baru
}
