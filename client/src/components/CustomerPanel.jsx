import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDateTime, relativeTime, STATUS_LABELS, STATUS_COLORS } from '../utils.js';
import clsx from 'clsx';

export default function CustomerPanel({ customerId, onClose }) {
  const profileQ = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.customers.get(customerId),
    enabled: !!customerId,
  });
  const convQ = useQuery({
    queryKey: ['customer-conversations', customerId],
    queryFn: () => api.customers.conversations(customerId),
    enabled: !!customerId,
  });
  const actionsQ = useQuery({
    queryKey: ['customer-actions', customerId],
    queryFn: () => api.customers.actions(customerId),
    enabled: !!customerId,
  });

  const c = profileQ.data;
  if (!c) return <div className="h-full bg-surface border-l border-line p-4 text-sm text-fg-subtle">Loading customer…</div>;

  return (
    <div className="h-full bg-surface border-l border-line flex flex-col">
      <div className="px-4 py-3 border-b border-line flex items-center">
        <div className="font-semibold text-fg text-sm">Customer</div>
        <div className="flex-1" />
        <button className="btn-ghost" onClick={onClose} title="Collapse">›</button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <section className="p-4 border-b border-line-subtle">
          <div className="text-lg font-semibold text-fg">{c.name}</div>
          <div className="text-sm text-fg-muted">{c.email}</div>
          {c.phone && <div className="text-sm text-fg-muted">{c.phone}</div>}
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="label">Plan</div>
              <div className="font-medium text-fg-strong capitalize">{c.plan}</div>
            </div>
            <div>
              <div className="label">MRR</div>
              <div className="font-medium text-fg-strong">${c.mrr?.toLocaleString() || 0}</div>
            </div>
            <div>
              <div className="label">Signup</div>
              <div className="text-fg-strong">{formatDateTime(c.signup_date)}</div>
            </div>
            <div>
              <div className="label">Resyncs</div>
              <div className="text-fg-strong">{c.stats?.items_resynced || 0}</div>
            </div>
          </div>
          <Link to={`/customers/${c.id}`} className="btn mt-3 w-full">View full profile →</Link>
        </section>

        <section className="p-4 border-b border-line-subtle">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Conversations</div>
            <div className="text-xs text-fg-subtle">{c.stats?.open_conversations} open / {c.stats?.total_conversations} total</div>
          </div>
          <ul className="space-y-1">
            {(convQ.data?.items || []).slice(0, 5).map(cv => (
              <li key={cv.id}>
                <Link to={`/inbox/${cv.id}`} className="block px-2 py-1.5 rounded-md hover:bg-surface-muted">
                  <div className="text-sm font-medium text-fg-strong truncate">{cv.subject}</div>
                  <div className="flex items-center gap-1 text-xs text-fg-muted">
                    <span className={clsx('pill text-[10px]', STATUS_COLORS[cv.status])}>{STATUS_LABELS[cv.status]}</span>
                    <span>· {relativeTime(cv.updated_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
            {!(convQ.data?.items?.length) && <li className="text-xs text-fg-subtle px-2">No other conversations.</li>}
          </ul>
        </section>

        <section className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">Recent actions</div>
          <ul className="space-y-1.5">
            {(actionsQ.data?.items || []).slice(0, 5).map(a => {
              let inputs = {};
              try { inputs = JSON.parse(a.inputs_json || '{}'); } catch {}
              return (
                <li key={a.id} className="text-xs">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-fg-strong">{a.action_type}</span>
                    {inputs.amount && <span className="pill pill-neutral text-[10px]">${inputs.amount}</span>}
                    {inputs.days && <span className="pill pill-neutral text-[10px]">{inputs.days}d</span>}
                  </div>
                  <div className="text-fg-muted">{a.agent_name} · {relativeTime(a.created_at)}</div>
                </li>
              );
            })}
            {!(actionsQ.data?.items?.length) && <li className="text-xs text-fg-subtle">No actions yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
