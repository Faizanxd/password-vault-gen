// apps/api/src/index.ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth';
import vaultRoutes from './routes/vault';
import twoFaRoutes from './routes/2fa';

dotenv.config();

const app = express();

// Allow multiple origins (comma-separated) or a single origin string
const FRONTEND_ORIGIN_RAW = process.env.FRONTEND_ORIGIN || 'https://frontendpassgen.netlify.app';
const FRONTEND_ORIGINS = FRONTEND_ORIGIN_RAW.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: FRONTEND_ORIGINS.length === 1 ? FRONTEND_ORIGINS[0] : FRONTEND_ORIGINS,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Cast routers to express.Router to make TypeScript select the correct overload
app.use('/api/auth', authRoutes as unknown as express.Router);
app.use('/api/vault', vaultRoutes as unknown as express.Router);
app.use('/api/auth/2fa', twoFaRoutes as unknown as express.Router);

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
