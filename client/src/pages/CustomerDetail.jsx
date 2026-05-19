import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAgent } from '../agentContext.jsx';
import { STATUS_LABELS, STATUS_COLORS, formatDateTime, relativeTime } from '../utils.js';
import clsx from 'clsx';

export default function CustomerDetail() {
  const { id } = useParams();
  const { current } = useAgent();
  const qc = useQueryClient();
  const isAdmin = current?.role === 'admin';

  const profileQ = useQuery({ queryKey: ['customer', id], queryFn: () => api.customers.get(id) });
  const convQ = useQuery({ queryKey: ['customer-conversations', id], queryFn: () => api.customers.conversations(id) });
  const actionsQ = useQuery({ queryKey: ['customer-actions', id], queryFn: () => api.customers.actions(id) });

  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({});
  const updateMutation = useMutation({
    mutationFn: (body) => api.customers.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer', id] }); setEditing(false); },
  });

  const c = profileQ.data;
  if (!c) return <div className="p-8 text-fg-subtle">Loading…</div>;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/inbox" className="btn-ghost">← Inbox</Link>
          <h1 className="text-2xl font-semibold text-fg">{c.name}</h1>
          <span className="pill pill-neutral capitalize">{c.plan}</span>
          {isAdmin && (
            <button className="btn ml-auto" onClick={() => { setEdit({ name: c.name, email: c.email, plan: c.plan, mrr: c.mrr, phone: c.phone || '' }); setEditing(v => !v); }}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>

        <section className="bg-surface rounded-lg border border-line p-5">
          <div className="grid grid-cols-4 gap-4">
            {editing && isAdmin ? (
              <>
                <Field label="Name"><input className="field" value={edit.name} onChange={(e) => setEdit(x => ({ ...x, name: e.target.value }))} /></Field>
                <Field label="Email"><input className="field" value={edit.email} onChange={(e) => setEdit(x => ({ ...x, email: e.target.value }))} /></Field>
                <Field label="Plan">
                  <select className="field" value={edit.plan} onChange={(e) => setEdit(x => ({ ...x, plan: e.target.value }))}>
                    <option>free</option><option>pro</option><option>enterprise</option>
                  </select>
                </Field>
                <Field label="MRR"><input type="number" className="field" value={edit.mrr} onChange={(e) => setEdit(x => ({ ...x, mrr: Number(e.target.value) }))} /></Field>
                <Field label="Phone"><input className="field" value={edit.phone} onChange={(e) => setEdit(x => ({ ...x, phone: e.target.value }))} /></Field>
                <div className="col-span-4 flex justify-end">
                  <button className="btn-primary" onClick={() => updateMutation.mutate(edit)}>Save</button>
                </div>
              </>
            ) : (
              <>
                <Field label="Email">{c.email}</Field>
                <Field label="Phone">{c.phone || '—'}</Field>
                <Field label="MRR">${c.mrr?.toLocaleString() || 0}</Field>
                <Field label="Signup">{formatDateTime(c.signup_date)}</Field>
                <Field label="Open conv.">{c.stats?.open_conversations}</Field>
                <Field label="Lifetime conv.">{c.stats?.total_conversations}</Field>
                <Field label="Resyncs">{c.stats?.items_resynced || 0}</Field>
              </>
            )}
          </div>
        </section>

        <section className="bg-surface rounded-lg border border-line">
          <header className="px-5 py-3 border-b border-line flex items-center justify-between">
            <h2 className="font-semibold text-fg">Conversations</h2>
            <span className="text-xs text-fg-muted">{convQ.data?.items?.length || 0} total</span>
          </header>
          <ul className="divide-y divide-line-subtle">
            {(convQ.data?.items || []).map(cv => (
              <li key={cv.id}>
                <Link to={`/inbox/${cv.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted">
                  <span className={clsx('pill text-[10px]', STATUS_COLORS[cv.status])}>{STATUS_LABELS[cv.status]}</span>
                  <span className="text-sm font-medium text-fg flex-1 truncate">{cv.subject}</span>
                  <span className="text-xs text-fg-muted capitalize">{cv.priority}</span>
                  <span className="text-xs text-fg-muted">{relativeTime(cv.updated_at)}</span>
                </Link>
              </li>
            ))}
            {!convQ.data?.items?.length && <li className="px-5 py-6 text-sm text-fg-subtle">No conversations yet.</li>}
          </ul>
        </section>

        <section className="bg-surface rounded-lg border border-line">
          <header className="px-5 py-3 border-b border-line flex items-center justify-between">
            <h2 className="font-semibold text-fg">Actions invoked</h2>
            <span className="text-xs text-fg-muted">{actionsQ.data?.items?.length || 0} total</span>
          </header>
          <ul className="divide-y divide-line-subtle">
            {(actionsQ.data?.items || []).map(a => {
              let inputs = {};
              try { inputs = JSON.parse(a.inputs_json || '{}'); } catch {}
              return (
                <li key={a.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fg">{a.action_type}</span>
                    <span className="pill pill-success text-[10px]">{a.result}</span>
                    <span className="text-fg-muted text-xs ml-auto">{formatDateTime(a.created_at)}</span>
                  </div>
                  <div className="text-xs text-fg-muted">
                    By {a.agent_name} · <Link to={`/inbox/${a.conversation_id}`} className="hover:underline">{a.conversation_subject}</Link>
                  </div>
                  <pre className="mt-1 text-[11px] bg-surface-muted text-fg-strong rounded p-2 overflow-x-auto">{JSON.stringify(inputs, null, 2)}</pre>
                </li>
              );
            })}
            {!actionsQ.data?.items?.length && <li className="px-5 py-6 text-sm text-fg-subtle">No actions yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm text-fg mt-0.5">{children}</div>
    </div>
  );
}
