import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const publicDir = path.resolve(process.cwd(), 'public');

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'wheelwash_super_secret_jwt_key_2026_mcd_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  publicDir: publicDir,
  excelDbPath: process.env.EXCEL_DB_PATH || path.join(publicDir, 'database.xlsx'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  demoMode: process.env.DEMO_MODE !== 'false',
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
};
