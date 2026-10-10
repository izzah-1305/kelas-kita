import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { ApiError, httpUrl, parseId } from '../utils.js';
import { validate } from '../middleware/validate.js';
import { requireOwner } from '../middleware/classAccess.js';
import { requireRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(10000).default(''),
  due_date: z.string().datetime({ offset: true }).optional(),
  max_score: z.number().int().min(1).max(1000).default(100),
});

const submitSchema = z
  .object({
    content: z.string().trim().max(10000).default(''),
    link_url: httpUrl.optional(),
  })
  .refine((v) => v.content || v.link_url, { message: 'Isi jawaban atau tautan wajib diisi' });

const gradeSchema = z.object({
  score: z.number().int().min(0),
  feedback: z.string().trim().max(2000).default(''),
});

function getAssignment(req) {
  const a = db
    .prepare('SELECT * FROM assignments WHERE id = ? AND class_id = ?')
    .get(parseId(req.params.assignmentId, 'assignmentId'), req.cls.id);
  if (!a) throw new ApiError(404, 'Tugas tidak ditemukan');
  return a;
}

const isLate = (a, submittedAt) => !!a.due_date && new Date(submittedAt) > new Date(a.due_date);

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*,
         (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count,
         (SELECT s.score FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = @uid) AS my_score,
         (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = @uid) AS my_submitted
       FROM assignments a WHERE a.class_id = @cid ORDER BY a.id DESC`,
    )
    .all({ cid: req.cls.id, uid: req.user.id });
  res.json({
    assignments: rows.map((a) => ({
      ...a,
      my_submitted: !!a.my_submitted,
      // siswa tidak perlu melihat jumlah pengumpulan seluruh kelas
      submission_count: req.isOwner ? a.submission_count : undefined,
    })),
  });
});

router.post('/', requireOwner, validate(createSchema), (req, res) => {
  const { title, description, due_date, max_score } = req.body;
  const info = db
    .prepare(
      'INSERT INTO assignments (class_id, title, description, due_date, max_score) VALUES (?, ?, ?, ?, ?)',
    )
    .run(req.cls.id, title, description, due_date ?? null, max_score);
  res
    .status(201)
    .json({ assignment: db.prepare('SELECT * FROM assignments WHERE id = ?').get(info.lastInsertRowid) });
});

router.get('/:assignmentId', (req, res) => {
  const assignment = getAssignment(req);
  const out = { assignment };
  if (req.isOwner) {
    out.submission_count = db
      .prepare('SELECT COUNT(*) AS n FROM submissions WHERE assignment_id = ?')
      .get(assignment.id).n;
  } else {
    out.my_submission =
      db
        .prepare('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?')
        .get(assignment.id, req.user.id) || null;
  }
  res.json(out);
});

router.delete('/:assignmentId', requireOwner, (req, res) => {
  const a = getAssignment(req);
  db.prepare('DELETE FROM assignments WHERE id = ?').run(a.id);
  res.status(204).end();
});

// Siswa mengumpulkan / memperbarui jawaban (selama belum dinilai)
router.post(
  '/:assignmentId/submissions',
  requireRole('student'),
  validate(submitSchema),
  (req, res) => {
    if (req.isOwner) throw new ApiError(403, 'Tidak diizinkan');
    const a = getAssignment(req);
    const { content, link_url } = req.body;
    const info = db
      .prepare(
        `INSERT INTO submissions (assignment_id, student_id, content, link_url)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(assignment_id, student_id) DO UPDATE SET
           content = excluded.content,
           link_url = excluded.link_url,
           submitted_at = excluded.submitted_at
         WHERE submissions.graded_at IS NULL`,
      )
      .run(a.id, req.user.id, content, link_url ?? null);
    if (!info.changes) throw new ApiError(409, 'Jawaban sudah dinilai dan tidak dapat diubah');
    const sub = db
      .prepare('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?')
      .get(a.id, req.user.id);
    res.status(201).json({ submission: { ...sub, is_late: isLate(a, sub.submitted_at) } });
  },
);

// Guru melihat semua pengumpulan
router.get('/:assignmentId/submissions', requireOwner, (req, res) => {
  const a = getAssignment(req);
  const rows = db
    .prepare(
      `SELECT s.*, u.name AS student_name, u.email AS student_email
       FROM submissions s JOIN users u ON u.id = s.student_id
       WHERE s.assignment_id = ? ORDER BY s.submitted_at`,
    )
    .all(a.id);
  res.json({ submissions: rows.map((s) => ({ ...s, is_late: isLate(a, s.submitted_at) })) });
});

router.patch(
  '/:assignmentId/submissions/:submissionId/grade',
  requireOwner,
  validate(gradeSchema),
  (req, res) => {
    const a = getAssignment(req);
    if (req.body.score > a.max_score) {
      throw new ApiError(422, `Nilai maksimal untuk tugas ini adalah ${a.max_score}`);
    }
    const info = db
      .prepare(
        `UPDATE submissions
         SET score = ?, feedback = ?, graded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ? AND assignment_id = ?`,
      )
      .run(req.body.score, req.body.feedback, parseId(req.params.submissionId, 'submissionId'), a.id);
    if (!info.changes) throw new ApiError(404, 'Pengumpulan tidak ditemukan');
    res.json({
      submission: db
        .prepare('SELECT * FROM submissions WHERE id = ?')
        .get(Number(req.params.submissionId)),
    });
  },
);

export default router;
