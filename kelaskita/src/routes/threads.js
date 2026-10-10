import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { ApiError, parseId } from '../utils.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const threadSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(10000),
});
const replySchema = z.object({ content: z.string().trim().min(1).max(5000) });

function getThread(req) {
  const t = db
    .prepare(
      `SELECT t.*, u.name AS author_name, u.role AS author_role
       FROM threads t JOIN users u ON u.id = t.author_id
       WHERE t.id = ? AND t.class_id = ?`,
    )
    .get(parseId(req.params.threadId, 'threadId'), req.cls.id);
  if (!t) throw new ApiError(404, 'Diskusi tidak ditemukan');
  return t;
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.content, t.author_id, t.created_at,
              u.name AS author_name, u.role AS author_role,
              (SELECT COUNT(*) FROM replies r WHERE r.thread_id = t.id) AS reply_count
       FROM threads t JOIN users u ON u.id = t.author_id
       WHERE t.class_id = ? ORDER BY t.id DESC`,
    )
    .all(req.cls.id);
  res.json({ threads: rows });
});

router.post('/', validate(threadSchema), (req, res) => {
  const info = db
    .prepare('INSERT INTO threads (class_id, author_id, title, content) VALUES (?, ?, ?, ?)')
    .run(req.cls.id, req.user.id, req.body.title, req.body.content);
  const thread = db.prepare('SELECT * FROM threads WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ thread });
});

router.get('/:threadId', (req, res) => {
  const thread = getThread(req);
  const replies = db
    .prepare(
      `SELECT r.*, u.name AS author_name, u.role AS author_role
       FROM replies r JOIN users u ON u.id = r.author_id
       WHERE r.thread_id = ? ORDER BY r.id`,
    )
    .all(thread.id);
  res.json({ thread, replies });
});

router.post('/:threadId/replies', validate(replySchema), (req, res) => {
  const thread = getThread(req);
  const info = db
    .prepare('INSERT INTO replies (thread_id, author_id, content) VALUES (?, ?, ?)')
    .run(thread.id, req.user.id, req.body.content);
  const reply = db
    .prepare(
      `SELECT r.*, u.name AS author_name, u.role AS author_role
       FROM replies r JOIN users u ON u.id = r.author_id WHERE r.id = ?`,
    )
    .get(info.lastInsertRowid);
  res.status(201).json({ reply });
});

// Penulis atau guru pemilik kelas boleh menghapus
router.delete('/:threadId', (req, res) => {
  const thread = getThread(req);
  if (!req.isOwner && thread.author_id !== req.user.id) {
    throw new ApiError(403, 'Anda tidak dapat menghapus diskusi ini');
  }
  db.prepare('DELETE FROM threads WHERE id = ?').run(thread.id);
  res.status(204).end();
});

router.delete('/:threadId/replies/:replyId', (req, res) => {
  const thread = getThread(req);
  const reply = db
    .prepare('SELECT * FROM replies WHERE id = ? AND thread_id = ?')
    .get(parseId(req.params.replyId, 'replyId'), thread.id);
  if (!reply) throw new ApiError(404, 'Balasan tidak ditemukan');
  if (!req.isOwner && reply.author_id !== req.user.id) {
    throw new ApiError(403, 'Anda tidak dapat menghapus balasan ini');
  }
  db.prepare('DELETE FROM replies WHERE id = ?').run(reply.id);
  res.status(204).end();
});

export default router;
