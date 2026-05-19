import express from 'express';
import { v4 as uuid } from 'uuid';
import { query, nowSql } from '../db.js';

export const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const { q, limit = 50, offset = 0 } = req.query;
  const params = [];
  const ph = (v) => { params.push(v); return `$${params.length}`; };

  let sql = 'SELECT * FROM customers';
  if (q) {
    const like = `%${q}%`;
    sql += ` WHERE name ILIKE ${ph(like)} OR email ILIKE ${ph(like)}`;
  }
  sql += ` ORDER BY name ASC LIMIT ${ph(Number(limit))} OFFSET ${ph(Number(offset))}`;
  const { rows } = await query(sql, params);
  res.json({ items: rows });
}));

router.get('/:id', wrap(async (req, res) => {
  const customerRes = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
  const customer = customerRes.rows[0];
  if (!customer) return res.status(404).json({ error: 'not_found' });

  const openCountRes = await query(
    `SELECT COUNT(*)::int AS c FROM conversations
     WHERE customer_id = $1 AND status IN ('open', 'pending_customer', 'pending_internal')`,
    [req.params.id],
  );
  const totalCountRes = await query(
    'SELECT COUNT(*)::int AS c FROM conversations WHERE customer_id = $1',
    [req.params.id],
  );
  const itemsResyncedRes = await query(
    `SELECT COUNT(*)::int AS c FROM actions a
     JOIN conversations c ON c.id = a.conversation_id
     WHERE c.customer_id = $1 AND a.action_type = 'resync_inventory' AND a.result = 'success'`,
    [req.params.id],
  );

  res.json({
    ...customer,
    metadata: customer.metadata_json ? JSON.parse(customer.metadata_json) : null,
    stats: {
      open_conversations: openCountRes.rows[0].c,
      total_conversations: totalCountRes.rows[0].c,
      items_resynced: itemsResyncedRes.rows[0].c,
    },
  });
}));

router.get('/:id/conversations', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM conversations WHERE customer_id = $1
     ORDER BY updated_at DESC LIMIT 100`,
    [req.params.id],
  );
  res.json({ items: rows });
}));

router.get('/:id/actions', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, c.subject AS conversation_subject, ag.name AS agent_name FROM actions a
     JOIN conversations c ON c.id = a.conversation_id
     LEFT JOIN agents ag ON ag.id = a.invoked_by_agent_id
     WHERE c.customer_id = $1
     ORDER BY a.created_at DESC`,
    [req.params.id],
  );
  res.json({ items: rows });
}));

router.post('/', wrap(async (req, res) => {
  const { name, email, plan = 'free', phone, mrr } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  const existing = await query('SELECT id FROM customers WHERE email = $1', [email]);
  if (existing.rows[0]) return res.status(409).json({ error: 'email already exists', id: existing.rows[0].id });
  const id = uuid();
  const now = nowSql();
  await query(
    `INSERT INTO customers (id, name, email, phone, plan, mrr, signup_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, name, email, phone || null, plan, mrr || 0, now, now, now],
  );
  const { rows } = await query('SELECT * FROM customers WHERE id = $1', [id]);
  res.status(201).json(rows[0]);
}));

router.patch('/:id', wrap(async (req, res) => {
  const curRes = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
  const cur = curRes.rows[0];
  if (!cur) return res.status(404).json({ error: 'not_found' });
  const allowed = ['name', 'email', 'phone', 'plan', 'mrr'];
  const updates = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
  if (!Object.keys(updates).length) return res.json(cur);

  const params = [];
  const sets = Object.entries(updates).map(([k, v]) => {
    params.push(v);
    return `${k} = $${params.length}`;
  });
  params.push(nowSql());
  const updatedAtPh = `$${params.length}`;
  params.push(cur.id);
  const idPh = `$${params.length}`;

  await query(
    `UPDATE customers SET ${sets.join(', ')}, updated_at = ${updatedAtPh} WHERE id = ${idPh}`,
    params,
  );
  const { rows } = await query('SELECT * FROM customers WHERE id = $1', [cur.id]);
  res.json(rows[0]);
}));
