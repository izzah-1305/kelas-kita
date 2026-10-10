import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db.js';
import { ApiError, asyncHandler } from '../utils.js';
import { validate } from '../middleware/validate.js';
import { authenticate, signToken } from '../middleware/auth.js';

const router = Router();

const email = z.string().trim().toLowerCase().email('Email tidak valid').max(200);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  email,
  password: z.string().min(8, 'Password minimal 8 karakter').max(100),
  role: z.enum(['teacher', 'student']),
});

const loginSchema = z.object({ email, password: z.string().min(1) });

const PUBLIC_FIELDS = 'id, name, email, role, created_at';

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new ApiError(409, 'Email sudah terdaftar');
    }
    const hash = await bcrypt.hash(password, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, email, hash, role);
    const user = db
      .prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`)
      .get(info.lastInsertRowid);
    res.status(201).json({ user, token: signToken(user) });
  }),
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email);
    const ok = row && (await bcrypt.compare(req.body.password, row.password_hash));
    if (!ok) throw new ApiError(401, 'Email atau password salah');
    const { password_hash, ...user } = row;
    res.json({ user, token: signToken(user) });
  }),
);

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
  res.json({ user });
});

export default router;
