import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'pv_session';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const payload = jwt.verify(token, JWT_SECRET) as { sub: string } | null;
    if (!payload || !payload.sub) return res.status(401).json({ error: 'unauthenticated' });

    req.userId = payload.sub;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
}
