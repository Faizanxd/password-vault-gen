import express from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { User } from '../models/user';

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'pv_session';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const COOKIE_SAMESITE =
  (process.env.COOKIE_SAMESITE as 'none' | 'lax' | 'strict' | undefined) ||
  (COOKIE_SECURE ? 'none' : 'lax');
// cookie options used for setting & clearing the session cookie.
// In production we use SameSite=None and Secure so the cookie is accepted in cross-site contexts.
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAMESITE,
  maxAge: COOKIE_MAX_AGE,
  // domain: process.env.SESSION_COOKIE_DOMAIN || undefined, // optional
};

// helper to sign session token
function signSession(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

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

    const token = signSession(user._id.toString());
    // set cookie with shared cookieOptions
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/auth/login
// body: { email, password }
// If user has 2FA enabled (totpEnabled / totpSecretEncrypted present), return { requires2FA: true, loginToken }
// Otherwise set session cookie and return { encryptedVMK }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const valid = await argon2.verify((user as any).passwordHash, password);
    if (!valid) return res.status(401).json({ error: 'invalid_credentials' });

    // If user has 2FA enabled, return a short-lived loginToken for the next step
    if ((user as any).totpEnabled && (user as any).totpSecretEncrypted) {
      const loginToken = jwt.sign({ sub: (user as any)._id.toString(), twoFa: true }, JWT_SECRET, {
        expiresIn: '300s',
      });
      return res.json({ requires2FA: true, loginToken });
    }

    // No 2FA: finish login normally, set session cookie and return encryptedVMK
    const token = signSession((user as any)._id.toString());
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.json({ encryptedVMK: (user as any).encryptedVMK });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/auth/me
// return minimal authenticated information (encryptedVMK) if session cookie is present and valid
router.get('/me', async (req, res) => {
  try {
    // read cookie token
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const payload = jwt.verify(token, JWT_SECRET) as { sub: string } | null;
    if (!payload || !payload.sub) return res.status(401).json({ error: 'unauthenticated' });

    const user = await User.findById(payload.sub).lean();
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    return res.json({ encryptedVMK: (user as any).encryptedVMK });
  } catch (err) {
    console.error('me error', err);
    return res.status(401).json({ error: 'unauthenticated' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // clear cookie with the same options to ensure the browser removes it
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
});

export default router;
