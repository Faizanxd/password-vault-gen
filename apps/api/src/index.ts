import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth';
import vaultRoutes from './routes/vault';
import twoFaRoutes from './routes/2fa';

dotenv.config();

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://frontendpassgen.netlify.app';

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/auth/2fa', twoFaRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/password-vault';
const PORT = Number(process.env.PORT || 4000);

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
