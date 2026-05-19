import express from 'express';
import { query } from '../db.js';

export const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, role, avatar_url, active FROM agents WHERE active = 1 ORDER BY name',
  );
  res.json({ items: rows });
}));

router.get('/me', wrap(async (req, res) => {
  const id = req.header('x-agent-id');
  if (!id) {
    const { rows } = await query(
      "SELECT id, name, email, role FROM agents WHERE active = 1 ORDER BY role, name LIMIT 1",
    );
    return res.json(rows[0] || null);
  }
  const { rows } = await query(
    'SELECT id, name, email, role, avatar_url FROM agents WHERE id = $1',
    [id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
}));
