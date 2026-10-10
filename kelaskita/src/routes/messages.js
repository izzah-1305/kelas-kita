import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { listMessages, saveMessage, messageSchema } from '../services/chat.js';
import { getIo } from '../socket.js';

const router = Router({ mergeParams: true });

const querySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Riwayat chat (paginasi mundur dengan ?before=<id pesan terlama>)
router.get('/', validate(querySchema, 'query'), (req, res) => {
  const messages = listMessages(req.cls.id, {
    before: req.query.before ?? null,
    limit: req.query.limit,
  });
  res.json({ messages, has_more: messages.length === req.query.limit });
});

// Alternatif kirim via REST; tetap di-broadcast ke semua klien yang terhubung
router.post('/', validate(messageSchema), (req, res) => {
  const message = saveMessage(req.cls.id, req.user.id, req.body.content);
  getIo()?.to(`class:${req.cls.id}`).emit('message:new', message);
  res.status(201).json({ message });
});

export default router;
