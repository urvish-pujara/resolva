import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { formatDuration, STATUS_LABELS } from '../utils.js';
import clsx from 'clsx';

export default function DashboardPage() {
  const statsQ = useQuery({ queryKey: ['dashboard-stats'], queryFn: api.dashboard.stats, refetchInterval: 30_000 });
  const s = statsQ.data;
  if (!s) return <div className="p-8 text-fg-subtle">Loading…</div>;

  const statusMap = Object.fromEntries(s.by_status.map(x => [x.status, x.count]));
  const openTotal = (statusMap.open || 0) + (statusMap.pending_customer || 0) + (statusMap.pending_internal || 0);
  const maxPriority = Math.max(1, ...s.by_priority_open.map(x => x.count));
  const maxAssignee = Math.max(1, ...s.by_assignee.map(x => x.open_count));
  const totalActions = s.actions_7d.reduce((a, b) => a + b.count, 0);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-app">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-fg">Dashboard</h1>

        <section className="grid grid-cols-4 gap-4">
          <Stat label="Open" value={openTotal} highlight="text-emerald-700 dark:text-emerald-300" />
          <Stat label="Resolved" value={statusMap.resolved || 0} />
          <Stat label="Closed" value={statusMap.closed || 0} />
          <Stat label="Resolved today" value={s.today_resolved} highlight="text-fg" />
        </section>

        <section className="grid grid-cols-2 gap-6">
          <Panel title="Open conversations by priority">
            <ul className="space-y-2">
              {['urgent', 'high', 'normal', 'low'].map(p => {
                const row = s.by_priority_open.find(r => r.priority === p);
                const count = row?.count || 0;
                return (
                  <li key={p} className="grid grid-cols-[80px,1fr,40px] items-center gap-3 text-sm">
                    <span className="capitalize text-fg-muted">{p}</span>
                    <div className="h-2.5 bg-surface-muted rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full', p === 'urgent' ? 'bg-red-500' : p === 'high' ? 'bg-amber-500' : p === 'normal' ? 'bg-sky-500' : 'bg-line-strong')}
                        style={{ width: `${(count / maxPriority) * 100}%` }}
                      />
                    </div>
                    <span className="text-right text-fg-strong font-medium">{count}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Open conversations per agent">
            <ul className="space-y-2">
              {s.by_assignee.map(a => (
                <li key={a.id} className="grid grid-cols-[120px,1fr,40px] items-center gap-3 text-sm">
                  <span className="text-fg-strong truncate">{a.name}</span>
                  <div className="h-2.5 bg-surface-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${(a.open_count / maxAssignee) * 100}%` }} />
                  </div>
                  <span className="text-right text-fg-strong font-medium">{a.open_count}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section className="grid grid-cols-2 gap-6">
          <Panel title="Avg resolution time (last 7 days)">
            <div className="text-3xl font-bold text-fg">{formatDuration(s.avg_resolution_seconds_7d)}</div>
            <div className="text-sm text-fg-muted mt-1">Across resolved conversations in window.</div>
          </Panel>
          <Panel title={`Actions invoked (7d) · ${totalActions}`}>
            <ul className="space-y-2">
              {s.actions_7d.map(a => (
                <li key={a.action_type} className="flex items-center gap-3 text-sm">
                  <span className="text-fg-strong flex-1">{a.action_type}</span>
                  <span className="pill pill-neutral">{a.count}</span>
                </li>
              ))}
              {!s.actions_7d.length && <li className="text-sm text-fg-subtle">No actions in the last 7 days.</li>}
            </ul>
          </Panel>
        </section>

        <section>
          <Panel title="All statuses">
            <div className="grid grid-cols-5 gap-3">
              {['open','pending_customer','pending_internal','resolved','closed'].map(st => (
                <div key={st} className="bg-surface-muted rounded-md p-3">
                  <div className="text-xs text-fg-muted">{STATUS_LABELS[st]}</div>
                  <div className="text-xl font-semibold mt-1 text-fg">{statusMap[st] || 0}</div>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="bg-surface rounded-lg border border-line p-4">
      <div className="text-xs text-fg-muted uppercase tracking-wide">{label}</div>
      <div className={clsx('text-3xl font-bold mt-1 text-fg', highlight)}>{value}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-surface rounded-lg border border-line">
      <header className="px-4 py-3 border-b border-line text-sm font-semibold text-fg-strong">{title}</header>
      <div className="p-4">{children}</div>
    </div>
  );
}
