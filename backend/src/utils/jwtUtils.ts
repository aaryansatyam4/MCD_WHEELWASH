import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import type { UserRole } from '../models/types.js';

export interface TokenPayload {
  userId: number;
  username: string;
  role: UserRole;
  assignedLocationId: number | null;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch (err) {
    return null;
  }
}
