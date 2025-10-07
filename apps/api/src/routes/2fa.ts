// apps/api/src/routes/2fa.ts
import express from 'express';
import dotenv from 'dotenv';
import { authenticator } from 'otplib';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/user';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { encryptServer, decryptServer } from '../lib/cryptoServer';

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const ISSUER = process.env.TOTP_ISSUER || 'PasswordVault';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'pv_session';
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

/**
 * PUBLIC: POST /api/auth/2fa/login-verify
 * Body: { loginToken, code }
 * Verifies the short-lived loginToken (issued by /auth/login) and the TOTP code.
 * On success: sets the normal session cookie and returns { ok: true }.
 *
 * This route must be public because the user does not yet have a session cookie.
 */
router.post('/login-verify', async (req, res) => {
  try {
    const { loginToken, code } = req.body;
    if (!loginToken || !code) return res.status(400).json({ error: 'missing' });

    // verify the loginToken (short-lived JWT created at login time)
    let payload: any;
    try {
      payload = jwt.verify(loginToken, JWT_SECRET) as any;
    } catch (err) {
      console.warn('login-verify: loginToken invalid/expired', err);
      return res.status(401).json({ error: 'invalid_or_expired_token' });
    }

    if (!payload || !payload.sub) {
      return res.status(400).json({ error: 'invalid_token_payload' });
    }

    const user = await User.findById(payload.sub).exec();
    if (!user || !user.totpSecretEncrypted) {
      return res.status(400).json({ error: '2fa_not_enabled' });
    }

    const secret = decryptServer(user.totpSecretEncrypted);
    const ok = authenticator.check(code, secret);
    if (!ok) {
      return res.status(401).json({ error: 'invalid_code' });
    }

    // Success: issue the normal session cookie
    const sessionToken = jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: COOKIE_SECURE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('2fa login-verify error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

/**
 * From here on, protect routes with authMiddleware (user must already be logged in).
 * These routes assume an authenticated user (has a valid session cookie).
 */
router.use(authMiddleware);

/**
 * POST /api/auth/2fa/setup
 * Generates a temporary secret and returns otpauthUrl + tempToken.
 */
router.post('/setup', async (req: AuthRequest, res) => {
  try {
    const uid = req.userId!;
    const user = await User.findById(uid).exec();
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const secret = authenticator.generateSecret(); // base32
    const otpauth = authenticator.keyuri(user.email, ISSUER, secret);
    const tempToken = jwt.sign({ sub: uid, tempTotp: secret }, JWT_SECRET, { expiresIn: '300s' });

    return res.json({ otpauthUrl: otpauth, tempToken });
  } catch (err) {
    console.error('2fa setup error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/auth/2fa/confirm
 * Body: { tempToken, code }
 * Finalizes setup by verifying code and storing encrypted secret on the user record.
 */
router.post('/confirm', async (req: AuthRequest, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return res.status(400).json({ error: 'missing' });

    let payload: any;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET) as any;
    } catch (err) {
      console.warn('2fa confirm: tempToken invalid/expired', err);
      return res.status(400).json({ error: 'invalid_or_expired' });
    }

    if (!payload || !payload.sub || !payload.tempTotp)
      return res.status(400).json({ error: 'invalid_token' });

    const ok = authenticator.check(code, payload.tempTotp);
    if (!ok) return res.status(400).json({ error: 'invalid_code' });

    const encrypted = encryptServer(payload.tempTotp);
    await User.findByIdAndUpdate(payload.sub, {
      totpSecretEncrypted: encrypted,
      totpEnabled: true,
    }).exec();

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('2fa confirm error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/auth/2fa/disable
 * Body: { code } -- disables 2FA if code is valid for stored secret
 */
router.post('/disable', async (req: AuthRequest, res) => {
  try {
    const uid = req.userId!;
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'missing_code' });

    const user = await User.findById(uid).exec();
    if (!user || !user.totpSecretEncrypted) return res.status(400).json({ error: 'not_enabled' });

    const secret = decryptServer(user.totpSecretEncrypted);
    const ok = authenticator.check(code, secret);
    if (!ok) return res.status(400).json({ error: 'invalid_code' });

    await User.findByIdAndUpdate(uid, {
      $unset: { totpSecretEncrypted: '', totpEnabled: '' },
    }).exec();
    return res.json({ ok: true });
  } catch (err) {
    console.error('2fa disable error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
