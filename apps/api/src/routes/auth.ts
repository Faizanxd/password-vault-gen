import express from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { User } from '../models/user';

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'pv_session';
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

// POST /api/auth/signup
// body: { email, password, encryptedVMK }
router.post('/signup', async (req, res) => {
  try {
    const { email, password, encryptedVMK } = req.body;
    if (!email || !password || !encryptedVMK)
      return res.status(400).json({ error: 'missing_fields' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'user_exists' });

    const passwordHash = await argon2.hash(password);
    const user = new User({ email, passwordHash, encryptedVMK });
    await user.save();

    const token = jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: COOKIE_SECURE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/auth/login
// body: { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return res.status(401).json({ error: 'invalid_credentials' });

    const token = jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: COOKIE_SECURE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return encryptedVMK for client to decrypt locally
    return res.json({ encryptedVMK: (user as any).encryptedVMK });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

export default router;
