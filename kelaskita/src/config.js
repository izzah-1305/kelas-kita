import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-ganti-di-produksi',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  dbPath: process.env.DB_PATH || './data/kelaskita.db',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
