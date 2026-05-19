import express from 'express';
import { v4 as uuid } from 'uuid';
import { query, nowSql } from '../db.js';
import { writeAudit } from '../lib/audit.js';

export const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const SLA_HOURS = { urgent: 1, high: 4, normal: 24, low: 72 };

function computeSlaDueAt(priority, createdAt = new Date()) {
  const hrs = SLA_HOURS[priority] ?? 24;
  return new Date(createdAt.getTime() + hrs * 3600000).toISOString().slice(0, 19).replace('T', ' ');
}

async function hydrateConversation(row) {
  if (!row) return null;
  const customerRes = await query(
    'SELECT id, name, email, plan, mrr FROM customers WHERE id = $1',
    [row.customer_id],
  );
  const assigneeRes = row.assignee_id
    ? await query('SELECT id, name, email, role FROM agents WHERE id = $1', [row.assignee_id])
    : { rows: [] };
  const tagsRes = await query(
    `SELECT t.id, t.name, t.color FROM tags t
     JOIN conversation_tags ct ON ct.tag_id = t.id
     WHERE ct.conversation_id = $1
     ORDER BY t.name`,
    [row.id],
  );
  const lastMsgRes = await query(
    `SELECT body, created_at, author_type, internal_note FROM messages
     WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [row.id],
  );
  return {
    ...row,
    customer: customerRes.rows[0] || null,
    assignee: assigneeRes.rows[0] || null,
    tags: tagsRes.rows,
    last_message: lastMsgRes.rows[0] || null,
  };
}

router.get('/', wrap(async (req, res) => {
  const { status, assignee_id, priority, tag, customer_id, q, limit = 50, offset = 0, sort = 'updated_desc' } = req.query;
  const params = [];
  const ph = (v) => { params.push(v); return `$${params.length}`; };
  const where = [];

  if (status) {
    if (Array.isArray(status)) {
      where.push(`c.status IN (${status.map(s => ph(s)).join(',')})`);
    } else {
      where.push(`c.status = ${ph(status)}`);
    }
  }
  if (assignee_id === 'unassigned') {
    where.push('c.assignee_id IS NULL');
  } else if (assignee_id) {
    where.push(`c.assignee_id = ${ph(assignee_id)}`);
  }
  if (priority) where.push(`c.priority = ${ph(priority)}`);
  if (customer_id) where.push(`c.customer_id = ${ph(customer_id)}`);
  if (tag) {
    where.push(`c.id IN (
      SELECT ct.conversation_id FROM conversation_tags ct
      JOIN tags t ON t.id = ct.tag_id WHERE t.name = ${ph(tag)}
    )`);
  }
  if (q) {
    const like = `%${q}%`;
    const a = ph(like);
    const b = ph(like);
    where.push(`(c.subject ILIKE ${a} OR c.id IN (
      SELECT m.conversation_id FROM messages m WHERE m.body ILIKE ${b}
    ))`);
  }

  const orderBy = {
    updated_desc: 'c.updated_at DESC',
    updated_asc: 'c.updated_at ASC',
    priority_desc: `CASE c.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END, c.updated_at DESC`,
    sla_due: 'c.sla_due_at ASC',
    created_desc: 'c.created_at DESC',
    created_asc: 'c.created_at ASC',
  }[sort] || 'c.updated_at DESC';

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const limitPh = ph(Number(limit));
  const offsetPh = ph(Number(offset));
  const sql = `
    SELECT c.* FROM conversations c
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ${limitPh} OFFSET ${offsetPh}
  `;
  const rowsRes = await query(sql, params);

  const countParams = params.slice(0, params.length - 2);
  const countSql = `SELECT COUNT(*)::int AS c FROM conversations c ${whereSql}`;
  const totalRes = await query(countSql, countParams);

  const items = [];
  for (const row of rowsRes.rows) items.push(await hydrateConversation(row));

  res.json({ total: totalRes.rows[0].c, items });
}));

router.get('/:id', wrap(async (req, res) => {
  const rowRes = await query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
  const row = rowRes.rows[0];
  if (!row) return res.status(404).json({ error: 'not_found' });
  const hydrated = await hydrateConversation(row);
  const messagesRes = await query(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [row.id],
  );
  const messages = [];
  for (const m of messagesRes.rows) {
    let author = null;
    if (m.author_type === 'agent' && m.author_id) {
      const r = await query('SELECT id, name, email, role FROM agents WHERE id = $1', [m.author_id]);
      author = r.rows[0] || null;
    } else if (m.author_type === 'customer' && m.author_id) {
      const r = await query('SELECT id, name, email FROM customers WHERE id = $1', [m.author_id]);
      author = r.rows[0] || null;
    }
    messages.push({ ...m, author });
  }
  const actionsRes = await query(
    `SELECT a.*, ag.name AS agent_name FROM actions a
     LEFT JOIN agents ag ON ag.id = a.invoked_by_agent_id
     WHERE a.conversation_id = $1
     ORDER BY a.created_at DESC`,
    [row.id],
  );
  res.json({ ...hydrated, messages, actions: actionsRes.rows });
}));

router.post('/', wrap(async (req, res) => {
  const { customer_id, subject, channel = 'email', priority = 'normal', initial_message } = req.body;
  if (!customer_id || !subject) return res.status(400).json({ error: 'customer_id and subject required' });
  const customerRes = await query('SELECT id FROM customers WHERE id = $1', [customer_id]);
  if (!customerRes.rows[0]) return res.status(400).json({ error: 'customer not found' });

  const id = uuid();
  const created_at = nowSql();
  const sla_due_at = computeSlaDueAt(priority, new Date());

  await query(
    `INSERT INTO conversations (id, customer_id, subject, status, priority, channel, sla_due_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'open', $4, $5, $6, $7, $8)`,
    [id, customer_id, subject, priority, channel, sla_due_at, created_at, created_at],
  );

  if (initial_message) {
    await query(
      `INSERT INTO messages (id, conversation_id, author_type, author_id, body, internal_note, created_at)
       VALUES ($1, $2, 'customer', $3, $4, 0, $5)`,
      [uuid(), id, customer_id, initial_message, created_at],
    );
  }

  await writeAudit({
    actor_type: 'system',
    actor_id: null,
    event_type: 'conversation.created',
    target_type: 'conversation',
    target_id: id,
    metadata: { subject, channel, priority, simulated_inbound: true },
  });

  const rowRes = await query('SELECT * FROM conversations WHERE id = $1', [id]);
  res.status(201).json(await hydrateConversation(rowRes.rows[0]));
}));

router.patch('/:id', wrap(async (req, res) => {
  const curRes = await query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
  const current = curRes.rows[0];
  if (!current) return res.status(404).json({ error: 'not_found' });
  const actorId = req.header('x-agent-id') || null;

  const allowed = ['status', 'priority', 'assignee_id', 'subject'];
  const updates = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

  if (updates.status && updates.status !== current.status) {
    if (updates.status === 'resolved' && !current.resolved_at) updates.resolved_at = nowSql();
    if (updates.status === 'closed' && !current.closed_at) updates.closed_at = nowSql();
    if (updates.status === 'open' && current.status === 'resolved') {
      updates.resolved_at = null;
      await writeAudit({
        actor_type: 'agent',
        actor_id: actorId,
        event_type: 'conversation.reopened',
        target_type: 'conversation',
        target_id: current.id,
        metadata: { from: current.status },
      });
    }
    await writeAudit({
      actor_type: 'agent',
      actor_id: actorId,
      event_type: 'conversation.status_changed',
      target_type: 'conversation',
      target_id: current.id,
      metadata: { from: current.status, to: updates.status },
    });
  }
  if ('assignee_id' in updates && updates.assignee_id !== current.assignee_id) {
    await writeAudit({
      actor_type: 'agent',
      actor_id: actorId,
      event_type: 'conversation.assigned',
      target_type: 'conversation',
      target_id: current.id,
      metadata: { from: current.assignee_id, to: updates.assignee_id },
    });
  }
  if (updates.priority && updates.priority !== current.priority) {
    await writeAudit({
      actor_type: 'agent',
      actor_id: actorId,
      event_type: 'conversation.priority_changed',
      target_type: 'conversation',
      target_id: current.id,
      metadata: { from: current.priority, to: updates.priority },
    });
  }

  if (Object.keys(updates).length) {
    const params = [];
    const sets = Object.entries(updates).map(([k, v]) => {
      params.push(v);
      return `${k} = $${params.length}`;
    });
    params.push(nowSql());
    const updatedAtPh = `$${params.length}`;
    params.push(current.id);
    const idPh = `$${params.length}`;
    await query(
      `UPDATE conversations SET ${sets.join(', ')}, updated_at = ${updatedAtPh} WHERE id = ${idPh}`,
      params,
    );
  }

  if (Array.isArray(req.body.tag_ids)) {
    await query('DELETE FROM conversation_tags WHERE conversation_id = $1', [current.id]);
    for (const tid of req.body.tag_ids) {
      await query(
        'INSERT INTO conversation_tags (conversation_id, tag_id) VALUES ($1, $2)',
        [current.id, tid],
      );
    }
  }

  const updatedRes = await query('SELECT * FROM conversations WHERE id = $1', [current.id]);
  res.json(await hydrateConversation(updatedRes.rows[0]));
}));

router.post('/:id/messages', wrap(async (req, res) => {
  const convRes = await query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
  const conv = convRes.rows[0];
  if (!conv) return res.status(404).json({ error: 'not_found' });
  const { body, internal_note = false, author_type = 'agent' } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'body required' });

  const actorId = req.header('x-agent-id') || null;
  const authorId = author_type === 'customer' ? conv.customer_id : actorId;
  const id = uuid();
  const created_at = nowSql();

  await query(
    `INSERT INTO messages (id, conversation_id, author_type, author_id, body, internal_note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, conv.id, author_type, authorId, body, internal_note ? 1 : 0, created_at],
  );

  let newStatus = conv.status;
  if (author_type === 'agent' && !internal_note && conv.status === 'open') {
    newStatus = 'pending_customer';
  } else if (author_type === 'customer') {
    if (conv.status === 'resolved' || conv.status === 'pending_customer' || conv.status === 'closed') {
      const fourteenDays = 14 * 86400000;
      const closedTime = conv.closed_at ? new Date(conv.closed_at).getTime() : Date.now();
      if (conv.status !== 'closed' || (Date.now() - closedTime) < fourteenDays) {
        newStatus = 'open';
        if (conv.resolved_at || conv.closed_at) {
          await writeAudit({
            actor_type: 'system',
            actor_id: null,
            event_type: 'conversation.reopened',
            target_type: 'conversation',
            target_id: conv.id,
            metadata: { from: conv.status, reason: 'customer_reply' },
          });
        }
      }
    }
  }

  if (newStatus !== conv.status) {
    await query(
      `UPDATE conversations SET status = $1, resolved_at = NULL, updated_at = $2 WHERE id = $3`,
      [newStatus, nowSql(), conv.id],
    );
    await writeAudit({
      actor_type: author_type === 'agent' ? 'agent' : 'system',
      actor_id: author_type === 'agent' ? actorId : null,
      event_type: 'conversation.status_changed',
      target_type: 'conversation',
      target_id: conv.id,
      metadata: { from: conv.status, to: newStatus },
    });
  } else {
    await query('UPDATE conversations SET updated_at = $1 WHERE id = $2', [nowSql(), conv.id]);
  }

  if (!internal_note && author_type === 'agent') {
    await writeAudit({
      actor_type: 'agent',
      actor_id: actorId,
      event_type: 'message.sent',
      target_type: 'conversation',
      target_id: conv.id,
      metadata: { message_id: id, length: body.length },
    });
  } else if (internal_note) {
    await writeAudit({
      actor_type: 'agent',
      actor_id: actorId,
      event_type: 'note.added',
      target_type: 'conversation',
      target_id: conv.id,
      metadata: { message_id: id },
    });
  }

  const msgRes = await query('SELECT * FROM messages WHERE id = $1', [id]);
  res.status(201).json(msgRes.rows[0]);
}));

router.post('/:id/actions', wrap(async (req, res) => {
  const convRes = await query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
  const conv = convRes.rows[0];
  if (!conv) return res.status(404).json({ error: 'not_found' });
  const { action_type, inputs = {} } = req.body;
  const validTypes = ['resync_inventory', 'regenerate_labels', 'reset_scanner_pairing', 'extend_trial', 'escalate'];
  if (!validTypes.includes(action_type)) return res.status(400).json({ error: 'invalid action_type' });

  const actorId = req.header('x-agent-id');
  if (!actorId) return res.status(400).json({ error: 'x-agent-id header required' });

  const id = uuid();
  const created_at = nowSql();
  await query(
    `INSERT INTO actions (id, conversation_id, invoked_by_agent_id, action_type, inputs_json, result, created_at)
     VALUES ($1, $2, $3, $4, $5, 'success', $6)`,
    [id, conv.id, actorId, action_type, JSON.stringify(inputs), created_at],
  );

  await writeAudit({
    actor_type: 'agent',
    actor_id: actorId,
    event_type: 'action.invoked',
    target_type: 'conversation',
    target_id: conv.id,
    metadata: { action_id: id, action_type, inputs },
  });

  const actionRes = await query('SELECT * FROM actions WHERE id = $1', [id]);
  res.status(201).json(actionRes.rows[0]);
}));
