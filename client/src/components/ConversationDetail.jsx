import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '../api.js';
import { STATUS_LABELS, formatDateTime } from '../utils.js';
import MessageThread from './MessageThread.jsx';
import ReplyComposer from './ReplyComposer.jsx';

const STATUS_OPTIONS = ['open', 'pending_customer', 'pending_internal', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];

export default function ConversationDetail({ conversationId, onToggleCustomerPanel, customerPanelOpen }) {
  const qc = useQueryClient();
  const conversationQ = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => api.conversations.get(conversationId),
    enabled: !!conversationId,
    refetchInterval: 10_000,
  });
  const agentsQ = useQuery({ queryKey: ['agents'], queryFn: api.agents.list });
  const tagsQ = useQuery({ queryKey: ['tags'], queryFn: api.tags.list });

  const updateMutation = useMutation({
    mutationFn: (body) => api.conversations.update(conversationId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['audit', conversationId] });
    },
  });

  if (!conversationId) {
    return <div className="h-full grid place-items-center text-fg-subtle text-sm">Select a conversation to view.</div>;
  }
  const c = conversationQ.data;
  if (!c) return <div className="h-full grid place-items-center text-fg-subtle text-sm">Loading conversation…</div>;

  function toggleTag(tagId) {
    const current = c.tags?.map(t => t.id) || [];
    const next = current.includes(tagId) ? current.filter(x => x !== tagId) : [...current, tagId];
    updateMutation.mutate({ tag_ids: next });
  }

  return (
    <div className="h-full flex flex-col bg-app">
      <header className="bg-surface border-b border-line px-6 py-4">
        <div className="flex items-center gap-2 text-xs text-fg-muted mb-1.5">
          <Link to={`/customers/${c.customer?.id}`} className="font-semibold text-fg-strong hover:underline">{c.customer?.name}</Link>
          <span>·</span>
          <span>{c.customer?.email}</span>
          <span>·</span>
          <span className="capitalize">{c.customer?.plan}</span>
          {c.customer?.mrr ? <><span>·</span><span>${c.customer.mrr} MRR</span></> : null}
          <div className="flex-1" />
          <span title={formatDateTime(c.created_at)}>Opened {formatDateTime(c.created_at)}</span>
          {!customerPanelOpen && <button className="btn-ghost" onClick={onToggleCustomerPanel}>‹</button>}
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-fg-strong truncate flex-1 leading-snug">{c.subject}</h1>
        </div>
        <div className="mt-3 flex items-center gap-x-4 gap-y-2 flex-wrap">
          <Field label="Status">
            <select
              value={c.status}
              onChange={(e) => updateMutation.mutate({ status: e.target.value })}
              className="field py-1 w-40"
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={c.priority}
              onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
              className="field py-1 w-28 capitalize"
            >
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Assignee">
            <select
              value={c.assignee_id || ''}
              onChange={(e) => updateMutation.mutate({ assignee_id: e.target.value || null })}
              className="field py-1 w-44"
            >
              <option value="">Unassigned</option>
              {(agentsQ.data?.items || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <TagEditor
            allTags={tagsQ.data?.items || []}
            selected={c.tags?.map(t => t.id) || []}
            onToggle={toggleTag}
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <MessageThread messages={c.messages} />
      </div>

      <ReplyComposer conversation={c} />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</span>
      {children}
    </div>
  );
}

function TagEditor({ allTags, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="btn" onClick={() => setOpen(v => !v)}>🏷️ Tags ({selected.length})</button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-56 rounded-md border border-line bg-surface-raised shadow-lg z-10">
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {allTags.map(t => (
              <button
                key={t.id}
                onClick={() => onToggle(t.id)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-muted flex items-center gap-2"
              >
                <span className={clsx('h-3 w-3 rounded-full border-2 border-line-strong grid place-items-center', selected.includes(t.id) && 'bg-accent border-accent')}>
                  {selected.includes(t.id) && <span className="text-on-accent text-[10px] leading-none">✓</span>}
                </span>
                <span className="pill text-[10px]" style={{ background: t.color + '22', color: t.color }}>{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
