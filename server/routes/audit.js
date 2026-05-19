import express from 'express';
import { query } from '../db.js';

export const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const { conversation_id, target_type, target_id, event_type, limit = 100, offset = 0 } = req.query;
  const where = [];
  const params = [];
  const ph = (v) => { params.push(v); return `$${params.length}`; };

  if (conversation_id) {
    where.push(`target_type = ${ph('conversation')} AND target_id = ${ph(conversation_id)}`);
  }
  if (target_type && !conversation_id) where.push(`target_type = ${ph(target_type)}`);
  if (target_id && !conversation_id) where.push(`target_id = ${ph(target_id)}`);
  if (event_type) where.push(`event_type = ${ph(event_type)}`);

  const sql = `
    SELECT * FROM audit_log
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
    LIMIT ${ph(Number(limit))} OFFSET ${ph(Number(offset))}
  `;
  const { rows } = await query(sql, params);
  res.json({
    items: rows.map(r => ({
      ...r,
      metadata: r.metadata_json ? JSON.parse(r.metadata_json) : null,
    })),
  });
}));
