import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDateTime } from '../utils.js';

const EVENT_TYPES = [
  '', 'conversation.created', 'conversation.status_changed', 'conversation.assigned',
  'conversation.priority_changed', 'conversation.reopened',
  'message.sent', 'note.added', 'action.invoked',
];

export default function AuditPage() {
  const [eventType, setEventType] = useState('');
  const [targetId, setTargetId] = useState('');
  const q = useQuery({
    queryKey: ['audit', eventType, targetId],
    queryFn: () => api.audit.list({ event_type: eventType || undefined, target_id: targetId || undefined, limit: 200 }),
    refetchInterval: 15_000,
  });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-app">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-fg">Audit Log</h1>
        <div className="bg-surface border border-line rounded-lg p-3 flex gap-2 items-end">
          <div>
            <label className="label">Event type</label>
            <select className="field" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t || 'All events'}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Target ID</label>
            <input className="field" placeholder="conversation id, agent id…" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          </div>
        </div>

        <div className="bg-surface border border-line rounded-lg divide-y divide-line-subtle">
          {(q.data?.items || []).map(row => (
            <div key={row.id} className="p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="pill pill-neutral text-[10px]">{row.event_type}</span>
                <span className="text-xs text-fg-muted">{row.actor_type}:{row.actor_id?.slice(0, 8) || 'system'}</span>
                <span className="text-xs text-fg-muted">→</span>
                {row.target_type === 'conversation' ? (
                  <Link to={`/inbox/${row.target_id}`} className="text-xs font-mono text-link hover:underline">{row.target_type}:{row.target_id.slice(0, 8)}</Link>
                ) : (
                  <span className="text-xs font-mono text-fg-muted">{row.target_type}:{row.target_id?.slice(0, 8)}</span>
                )}
                <span className="ml-auto text-xs text-fg-subtle">{formatDateTime(row.created_at)}</span>
              </div>
              {row.metadata && (
                <pre className="mt-1 text-[11px] bg-surface-muted text-fg-strong rounded p-2 overflow-x-auto">{JSON.stringify(row.metadata, null, 2)}</pre>
              )}
            </div>
          ))}
          {!q.data?.items?.length && <div className="p-8 text-sm text-fg-subtle text-center">No matching audit entries.</div>}
        </div>
      </div>
    </div>
  );
}
