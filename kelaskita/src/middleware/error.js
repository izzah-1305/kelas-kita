import { ApiError } from '../utils.js';

export function notFound(_req, _res, next) {
  next(new ApiError(404, 'Endpoint tidak ditemukan'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON tidak valid' });
  }
  if (typeof err?.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ error: 'Data melanggar batasan database' });
  }
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
}
