import express from 'express';
import { query } from '../db.js';

export const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/stats', wrap(async (req, res) => {
  const byStatus = await query(
    'SELECT status, COUNT(*)::int AS count FROM conversations GROUP BY status',
  );

  const byPriorityOpen = await query(
    `SELECT priority, COUNT(*)::int AS count FROM conversations
     WHERE status IN ('open', 'pending_customer', 'pending_internal')
     GROUP BY priority`,
  );

  const byAssignee = await query(
    `SELECT a.id, a.name, COUNT(c.id)::int AS open_count FROM agents a
     LEFT JOIN conversations c ON c.assignee_id = a.id AND c.status IN ('open', 'pending_customer', 'pending_internal')
     WHERE a.active = 1
     GROUP BY a.id, a.name ORDER BY open_count DESC`,
  );

  const todayResolved = await query(
    `SELECT COUNT(*)::int AS count FROM conversations
     WHERE substring(resolved_at, 1, 10) = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD')`,
  );

  const last7DaysResolved = await query(
    `SELECT created_at, resolved_at FROM conversations
     WHERE resolved_at IS NOT NULL
       AND resolved_at >= to_char(now() AT TIME ZONE 'utc' - interval '7 days', 'YYYY-MM-DD HH24:MI:SS')`,
  );
  let totalSec = 0;
  for (const r of last7DaysResolved.rows) {
    const diff = (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 1000;
    if (diff > 0) totalSec += diff;
  }
  const avgResolutionSec = last7DaysResolved.rows.length ? Math.round(totalSec / last7DaysResolved.rows.length) : 0;

  const actionsLast7 = await query(
    `SELECT action_type, COUNT(*)::int AS count FROM actions
     WHERE created_at >= to_char(now() AT TIME ZONE 'utc' - interval '7 days', 'YYYY-MM-DD HH24:MI:SS')
     GROUP BY action_type`,
  );

  res.json({
    by_status: byStatus.rows,
    by_priority_open: byPriorityOpen.rows,
    by_assignee: byAssignee.rows,
    today_resolved: todayResolved.rows[0].count,
    avg_resolution_seconds_7d: avgResolutionSec,
    actions_7d: actionsLast7.rows,
  });
}));
