import express from 'express';
import cors from 'cors';
import { query, initSchema, nowSql } from './db.js';
import { seedAll } from './lib/seed.js';
import { writeAudit } from './lib/audit.js';
import { router as conversationsRouter } from './routes/conversations.js';
import { router as customersRouter } from './routes/customers.js';
import { router as agentsRouter } from './routes/agents.js';
import { router as macrosRouter } from './routes/macros.js';
import { router as tagsRouter } from './routes/tags.js';
import { router as auditRouter } from './routes/audit.js';
import { router as dashboardRouter } from './routes/dashboard.js';
import { router as aiRouter } from './routes/ai.js';

const PORT = Number(process.env.PORT || 4000);

const app = express();
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map(s => s.trim()) } : undefined));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/conversations', conversationsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/macros', macrosRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai', aiRouter);

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'internal_error', message: err.message });
});

async function autoCloseStaleConversations() {
  try {
    const cutoff = new Date(Date.now() - 72 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    const { rows } = await query(
      `SELECT id, status FROM conversations
       WHERE status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at <= $1`,
      [cutoff],
    );
    if (!rows.length) return;
    for (const row of rows) {
      const now = nowSql();
      await query(
        `UPDATE conversations SET status = 'closed', closed_at = $1, updated_at = $2 WHERE id = $3`,
        [now, now, row.id],
      );
      await writeAudit({
        actor_type: 'system',
        actor_id: null,
        event_type: 'conversation.status_changed',
        target_type: 'conversation',
        target_id: row.id,
        metadata: { from: 'resolved', to: 'closed', reason: 'auto_close_72h' },
      });
    }
    console.log(`[auto-close] closed ${rows.length} stale resolved conversations`);
  } catch (err) {
    console.error('[auto-close] failed', err);
  }
}

async function main() {
  await initSchema();
  const seedResult = await seedAll();
  console.log(seedResult.skipped ? '[db] already seeded' : '[db] seeded fresh database');

  setInterval(autoCloseStaleConversations, 60 * 60 * 1000);
  setTimeout(autoCloseStaleConversations, 5000);

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
