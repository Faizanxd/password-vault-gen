import express from 'express';
import { VaultItem } from '../models/vaultItem';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

const router = express.Router();

// Protect all routes with authMiddleware
router.use(authMiddleware);

// GET /api/vault
router.get('/', async (req: AuthRequest, res) => {
  try {
    const uid = req.userId!;
    const items = await VaultItem.find({ userId: new mongoose.Types.ObjectId(uid) })
      .select('_id encryptedBlob createdAt updatedAt')
      .lean();
    // normalize id to string
    const out = items.map((it) => ({
      id: it._id.toString(),
      encryptedBlob: it.encryptedBlob,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }));
    return res.json(out);
  } catch (err) {
    console.error('vault GET error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/vault { encryptedBlob }
router.post('/', async (req: AuthRequest, res) => {
  try {
    const uid = req.userId!;
    const { encryptedBlob } = req.body;
    if (!encryptedBlob) return res.status(400).json({ error: 'missing_encryptedBlob' });

    const created = await VaultItem.create({ userId: uid, encryptedBlob });
    return res.status(201).json({
      id: created._id.toString(),
      encryptedBlob: created.encryptedBlob,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  } catch (err) {
    console.error('vault POST error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// PUT /api/vault/:id { encryptedBlob }
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const uid = req.userId!;
    const { id } = req.params;
    const { encryptedBlob } = req.body;
    if (!encryptedBlob) return res.status(400).json({ error: 'missing_encryptedBlob' });

    const item = await VaultItem.findById(id);
    if (!item) return res.status(404).json({ error: 'not_found' });
    if (item.userId.toString() !== uid) return res.status(403).json({ error: 'forbidden' });

    item.encryptedBlob = encryptedBlob;
    await item.save();
    return res.json({
      id: item._id.toString(),
      encryptedBlob: item.encryptedBlob,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  } catch (err) {
    console.error('vault PUT error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/vault/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const uid = req.userId!;
    const { id } = req.params;
    const item = await VaultItem.findById(id);
    if (!item) return res.status(404).json({ error: 'not_found' });
    if (item.userId.toString() !== uid) return res.status(403).json({ error: 'forbidden' });

    await item.deleteOne();
    return res.status(204).send(null);
  } catch (err) {
    console.error('vault DELETE error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
