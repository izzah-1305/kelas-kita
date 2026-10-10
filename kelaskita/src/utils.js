import crypto from 'node:crypto';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Tanpa karakter yang mudah tertukar (0/O, 1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

export function parseId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, `${name} tidak valid`);
  return n;
}

export const httpUrl = z
  .string()
  .trim()
  .url('URL tidak valid')
  .max(500)
  .refine((u) => /^https?:\/\//i.test(u), 'URL harus diawali http:// atau https://');
