import express from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../db.js';

export const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const { rows } = await query('SELECT * FROM tags ORDER BY name');
  res.json({ items: rows });
}));

router.post('/', wrap(async (req, res) => {
  const { name, color = '#6b7280' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuid();
  try {
    await query('INSERT INTO tags (id, name, color) VALUES ($1, $2, $3)', [id, name, color]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'tag already exists' });
    throw e;
  }
  const { rows } = await query('SELECT * FROM tags WHERE id = $1', [id]);
  res.status(201).json(rows[0]);
}));
