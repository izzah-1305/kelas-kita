import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { ApiError, httpUrl, parseId } from '../utils.js';
import { validate } from '../middleware/validate.js';
import { requireOwner } from '../middleware/classAccess.js';

const router = Router({ mergeParams: true });

const createSchema = z.object({
  type: z.enum(['announcement', 'material']),
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().max(10000).default(''),
  link_url: httpUrl.optional(),
});

const SELECT = `
  SELECT p.*, u.name AS author_name
  FROM posts p JOIN users u ON u.id = p.author_id
`;

router.get('/', (req, res) => {
  const type = ['announcement', 'material'].includes(req.query.type) ? req.query.type : null;
  const rows = db
    .prepare(`${SELECT} WHERE p.class_id = ? AND (? IS NULL OR p.type = ?) ORDER BY p.id DESC`)
    .all(req.cls.id, type, type);
  res.json({ posts: rows });
});

router.post('/', requireOwner, validate(createSchema), (req, res) => {
  const { type, title, content, link_url } = req.body;
  const info = db
    .prepare(
      'INSERT INTO posts (class_id, author_id, type, title, content, link_url) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(req.cls.id, req.user.id, type, title, content, link_url ?? null);
  res.status(201).json({ post: db.prepare(`${SELECT} WHERE p.id = ?`).get(info.lastInsertRowid) });
});

router.delete('/:postId', requireOwner, (req, res) => {
  const info = db
    .prepare('DELETE FROM posts WHERE id = ? AND class_id = ?')
    .run(parseId(req.params.postId, 'postId'), req.cls.id);
  if (!info.changes) throw new ApiError(404, 'Postingan tidak ditemukan');
  res.status(204).end();
});

export default router;
