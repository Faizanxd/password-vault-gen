/* eslint-disable @typescript-eslint/no-require-imports */
// apps/api/src/index.ts
import express, { Request, Response, RequestHandler } from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors, { CorsOptions } from 'cors';

dotenv.config();

const app = express();

// normalize allowed origins from env (comma-separated) and strip trailing slash
const raw = process.env.FRONTEND_ORIGIN || 'https://frontendpassgen.netlify.app';
const allowedOrigins = raw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => s.replace(/\/+$/, ''));

// Build a CorsOptions where `origin` is a delegate (origin, callback) => void
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (e.g. server-to-server/curl)
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalized)) return callback(null, true);

    // explicit rejection - browser will block
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// apply CORS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight

app.use(express.json());
// cookieParser() has a middleware type; cast to RequestHandler to satisfy overload resolution
app.use(cookieParser() as unknown as RequestHandler);

/**
 * Use require() to import route modules (returns `any`) to avoid TypeScript overload
 * issues we've hit previously. If you later make each route file export a typed
 * `express.Router`, you can switch back to static imports without require().
 */
const authRoutes: any = require('./routes/auth').default ?? require('./routes/auth');
const vaultRoutes: any = require('./routes/vault').default ?? require('./routes/vault');
const twoFaRoutes: any = require('./routes/2fa').default ?? require('./routes/2fa');

app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/auth/2fa', twoFaRoutes);

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/password-vault';
const PORT = Number(process.env.PORT || 4000);

// connect to MongoDB then start the server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });

export default app;
