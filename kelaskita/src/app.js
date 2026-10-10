import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import classRoutes from './routes/classes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'connect-src': ["'self'", 'ws:', 'wss:'], // Socket.IO
        'upgrade-insecure-requests': null, // supaya jalan di http://localhost
      },
    },
  }),
);
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'KelasKita' }));

// Batasi percobaan login (anti brute-force)
app.use(
  '/api/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }),
);
app.use('/api/auth', authRoutes);
app.use('/api/classes', authenticate, classRoutes);
app.use('/api', notFound);

// Front-end (SPA statis)
app.use(express.static(publicDir));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use(errorHandler);

export default app;
