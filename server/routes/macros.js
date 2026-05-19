import express from 'express';
import { v4 as uuid } from 'uuid';
import { query } from '../db.js';

export const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const { rows } = await query('SELECT * FROM macros ORDER BY name');
  res.json({ items: rows });
}));

router.post('/', wrap(async (req, res) => {
  const { name, body } = req.body;
  if (!name || !body) return res.status(400).json({ error: 'name and body required' });
  const id = uuid();
  const createdBy = req.header('x-agent-id') || null;
  await query(
    'INSERT INTO macros (id, name, body, created_by_agent_id) VALUES ($1, $2, $3, $4)',
    [id, name, body, createdBy],
  );
  const { rows } = await query('SELECT * FROM macros WHERE id = $1', [id]);
  res.status(201).json(rows[0]);
}));

router.delete('/:id', wrap(async (req, res) => {
  const result = await query('DELETE FROM macros WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
}));
