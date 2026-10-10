import { Server } from 'socket.io';
import { config } from './config.js';
import { getUserFromToken } from './middleware/auth.js';
import { getClassAccess } from './middleware/classAccess.js';
import { saveMessage, messageSchema } from './services/chat.js';

let io = null;
export const getIo = () => io;

const room = (classId) => `class:${classId}`;

export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: config.corsOrigin } });

  // Autentikasi: io(url, { auth: { token } })
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = token && getUserFromToken(token);
    if (!user) return next(new Error('Unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    // client -> server: emit('class:join', classId, (res) => ...)
    socket.on('class:join', (classId, ack) => {
      const access = getClassAccess(Number(classId), user.id);
      if (!access?.isMember) return ack?.({ ok: false, error: 'Akses ditolak' });
      socket.join(room(access.cls.id));
      ack?.({ ok: true });
    });

    socket.on('class:leave', (classId) => socket.leave(room(Number(classId))));

    // client -> server: emit('message:send', { classId, content }, (res) => ...)
    socket.on('message:send', (payload, ack) => {
      const parsed = messageSchema.safeParse({ content: payload?.content });
      const classId = Number(payload?.classId);
      if (!parsed.success) return ack?.({ ok: false, error: 'Pesan tidak valid' });
      const access = getClassAccess(classId, user.id);
      if (!access?.isMember) return ack?.({ ok: false, error: 'Akses ditolak' });
      const message = saveMessage(classId, user.id, parsed.data.content);
      io.to(room(classId)).emit('message:new', message);
      ack?.({ ok: true, message });
    });

    // Indikator "sedang mengetik"
    socket.on('typing', ({ classId, isTyping }) => {
      if (!socket.rooms.has(room(Number(classId)))) return;
      socket
        .to(room(Number(classId)))
        .emit('typing', { userId: user.id, name: user.name, isTyping: !!isTyping });
    });
  });

  return io;
}
