/* eslint-disable @typescript-eslint/no-require-imports */
// apps/api/src/index.ts
import express, { Request, Response, RequestHandler } from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';

dotenv.config();

const app = express();

// Accept a comma-separated FRONTEND_ORIGIN env var or a single origin
const FRONTEND_ORIGIN_RAW = process.env.FRONTEND_ORIGIN || 'https://frontendpassgen.netlify.app';
const FRONTEND_ORIGINS = FRONTEND_ORIGIN_RAW.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: FRONTEND_ORIGINS.length === 1 ? FRONTEND_ORIGINS[0] : FRONTEND_ORIGINS,
    credentials: true,
  }) as unknown as RequestHandler
);

app.use(express.json());
// <-- explicit cast so TypeScript doesn't try to match ambiguous app.use overloads
app.use(cookieParser() as unknown as RequestHandler);

/**
 * Route imports via require() (returns `any`) to avoid TypeScript overload ambiguity.
 * If you later make each route file explicitly export `Router` typed objects, you can
 * switch back to `import authRoutes from './routes/auth'` without casting.
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
