import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { ApiError, asyncHandler, parseId, randomCode } from '../utils.js';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import { loadClass, requireOwner } from '../middleware/classAccess.js';
import postsRouter from './posts.js';
import assignmentsRouter from './assignments.js';
import threadsRouter from './threads.js';
import messagesRouter from './messages.js';

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(3, 'Nama kelas minimal 3 karakter').max(100),
  description: z.string().trim().max(1000).default(''),
});
const updateSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Tidak ada data yang diubah',
});
const joinSchema = z.object({ code: z.string().trim().toUpperCase().length(6, 'Kode harus 6 karakter') });

const CLASS_LIST_SQL = `
  SELECT c.id, c.name, c.description, c.code, c.teacher_id, c.created_at,
         u.name AS teacher_name,
         (SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id) AS student_count
  FROM classes c
  JOIN users u ON u.id = c.teacher_id
`;

// Kode kelas hanya ditampilkan ke guru pemilik
const present = (cls, uid) => {
  const { code, ...rest } = cls;
  return cls.teacher_id === uid ? cls : rest;
};

router.post(
  '/',
  requireRole('teacher'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    let id;
    for (let attempt = 0; attempt < 5 && !id; attempt++) {
      try {
        id = db
          .prepare('INSERT INTO classes (name, description, code, teacher_id) VALUES (?, ?, ?, ?)')
          .run(req.body.name, req.body.description, randomCode(), req.user.id).lastInsertRowid;
      } catch (e) {
        if (!String(e.code).startsWith('SQLITE_CONSTRAINT')) throw e; // kode bentrok -> coba lagi
      }
    }
    if (!id) throw new ApiError(500, 'Gagal membuat kode kelas, coba lagi');
    const cls = db.prepare(`${CLASS_LIST_SQL} WHERE c.id = ?`).get(id);
    res.status(201).json({ class: cls });
  }),
);

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `${CLASS_LIST_SQL}
       WHERE c.teacher_id = @uid
          OR c.id IN (SELECT class_id FROM class_members WHERE user_id = @uid)
       ORDER BY c.created_at DESC`,
    )
    .all({ uid: req.user.id });
  res.json({ classes: rows.map((c) => present(c, req.user.id)) });
});

router.post(
  '/join',
  requireRole('student'),
  validate(joinSchema),
  (req, res) => {
    const cls = db.prepare('SELECT id FROM classes WHERE code = ?').get(req.body.code);
    if (!cls) throw new ApiError(404, 'Kode kelas tidak ditemukan');
    const info = db
      .prepare('INSERT OR IGNORE INTO class_members (class_id, user_id) VALUES (?, ?)')
      .run(cls.id, req.user.id);
    const detail = db.prepare(`${CLASS_LIST_SQL} WHERE c.id = ?`).get(cls.id);
    res
      .status(info.changes ? 201 : 200)
      .json({ class: present(detail, req.user.id), joined: info.changes === 1 });
  },
);

router.get('/:classId', loadClass, (req, res) => {
  const detail = db.prepare(`${CLASS_LIST_SQL} WHERE c.id = ?`).get(req.cls.id);
  res.json({ class: present(detail, req.user.id), is_owner: req.isOwner });
});

router.patch('/:classId', loadClass, requireOwner, validate(updateSchema), (req, res) => {
  const { name = req.cls.name, description = req.cls.description } = req.body;
  db.prepare('UPDATE classes SET name = ?, description = ? WHERE id = ?').run(
    name,
    description,
    req.cls.id,
  );
  res.json({ class: db.prepare(`${CLASS_LIST_SQL} WHERE c.id = ?`).get(req.cls.id) });
});

router.delete('/:classId', loadClass, requireOwner, (req, res) => {
  db.prepare('DELETE FROM classes WHERE id = ?').run(req.cls.id);
  res.status(204).end();
});

router.post('/:classId/regenerate-code', loadClass, requireOwner, (req, res) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      db.prepare('UPDATE classes SET code = ? WHERE id = ?').run(code, req.cls.id);
      return res.json({ code });
    } catch (e) {
      if (!String(e.code).startsWith('SQLITE_CONSTRAINT')) throw e;
    }
  }
  throw new ApiError(500, 'Gagal membuat kode baru, coba lagi');
});

router.get('/:classId/members', loadClass, (req, res) => {
  const teacher = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(req.cls.teacher_id);
  const students = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, m.joined_at
       FROM class_members m JOIN users u ON u.id = m.user_id
       WHERE m.class_id = ? ORDER BY u.name`,
    )
    .all(req.cls.id);
  res.json({ teacher, students });
});

// Guru mengeluarkan siswa, atau siswa keluar sendiri
router.delete('/:classId/members/:userId', loadClass, (req, res) => {
  const userId = parseId(req.params.userId, 'userId');
  if (!req.isOwner && userId !== req.user.id) {
    throw new ApiError(403, 'Anda hanya dapat keluar dari kelas atas nama sendiri');
  }
  const info = db
    .prepare('DELETE FROM class_members WHERE class_id = ? AND user_id = ?')
    .run(req.cls.id, userId);
  if (!info.changes) throw new ApiError(404, 'Anggota tidak ditemukan');
  res.status(204).end();
});

// Sub-resource per kelas
router.use('/:classId/posts', loadClass, postsRouter);
router.use('/:classId/assignments', loadClass, assignmentsRouter);
router.use('/:classId/threads', loadClass, threadsRouter);
router.use('/:classId/messages', loadClass, messagesRouter);

export default router;
