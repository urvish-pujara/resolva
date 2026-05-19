import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../api.js';
import { useAgent } from '../agentContext.jsx';
import ConversationList from '../components/ConversationList.jsx';
import ConversationDetail from '../components/ConversationDetail.jsx';
import CustomerPanel from '../components/CustomerPanel.jsx';

const ASSIGNEE_TABS = [
  { key: 'me', label: 'Me' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'all', label: 'All' },
];
const STATUS_TABS = [
  { key: 'open', label: 'Open', statuses: ['open', 'pending_customer', 'pending_internal'] },
  { key: 'resolved', label: 'Resolved', statuses: ['resolved'] },
  { key: 'closed', label: 'Closed', statuses: ['closed'] },
  { key: 'all', label: 'All', statuses: null },
];

export default function Inbox() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { current } = useAgent();
  const [assigneeTab, setAssigneeTab] = useState('me');
  const [statusTab, setStatusTab] = useState('open');
  const [priority, setPriority] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('updated_desc');
  const [q, setQ] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const listRef = useRef(null);

  const tagsQ = useQuery({ queryKey: ['tags'], queryFn: api.tags.list });

  const filters = useMemo(() => {
    const tab = STATUS_TABS.find(t => t.key === statusTab);
    return {
      status: tab?.statuses || undefined,
      assignee_id: assigneeTab === 'me' ? current?.id : assigneeTab === 'unassigned' ? 'unassigned' : undefined,
      priority: priority || undefined,
      tag: tag || undefined,
      q: q || undefined,
      sort,
      limit: 100,
    };
  }, [statusTab, assigneeTab, priority, tag, q, sort, current?.id]);

  const listQ = useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => api.conversations.list(filters),
    enabled: !!current,
    refetchInterval: 10_000,
  });

  const items = listQ.data?.items || [];

  useEffect(() => {
    if (!conversationId && items.length && !listQ.isLoading) {
      // auto-select first on load
      // skipped to keep URL stable; user can click
    }
  }, [conversationId, items.length, listQ.isLoading]);

  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!items.length) return;
      const idx = items.findIndex(c => c.id === conversationId);
      if (e.key === 'j') {
        e.preventDefault();
        const next = items[Math.min(items.length - 1, idx + 1)] || items[0];
        navigate(`/inbox/${next.id}`);
        scrollToItem(next.id);
      } else if (e.key === 'k') {
        e.preventDefault();
        const prev = items[Math.max(0, idx - 1)] || items[0];
        navigate(`/inbox/${prev.id}`);
        scrollToItem(prev.id);
      } else if (e.key === 'Enter') {
        if (idx >= 0) navigate(`/inbox/${items[idx].id}`);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, conversationId, navigate]);

  function scrollToItem(id) {
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector(`[data-conversation-id="${id}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

  const selected = items.find(c => c.id === conversationId);
  const customerIdForPanel = selected?.customer?.id;

  return (
    <div className="h-full grid" style={{ gridTemplateColumns: panelOpen ? '380px 1fr 360px' : '380px 1fr' }}>
      <div className="border-r border-line bg-surface flex flex-col min-h-0">
        <div className="px-4 py-3.5 border-b border-line space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subjects & messages…"
            className="field"
          />
          <div className="flex gap-1.5">
            {ASSIGNEE_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setAssigneeTab(t.key)}
                className={clsx('flex-1 text-xs py-1.5 rounded-md font-medium', assigneeTab === t.key ? 'bg-accent text-on-accent' : 'bg-surface-muted text-fg-muted hover:bg-line')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setStatusTab(t.key)}
                className={clsx('flex-1 text-xs py-1.5 rounded-md font-medium', statusTab === t.key ? 'bg-line text-fg' : 'text-fg-muted hover:bg-surface-muted')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="field py-1.5">
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="field py-1.5">
              <option value="">All tags</option>
              {(tagsQ.data?.items || []).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="field py-1.5">
            <option value="updated_desc">Newest activity</option>
            <option value="updated_asc">Oldest activity</option>
            <option value="priority_desc">Priority</option>
            <option value="sla_due">SLA due</option>
            <option value="created_desc">Recently created</option>
            <option value="created_asc">Oldest created</option>
          </select>
          <div className="text-[10px] text-fg-subtle px-0.5 pt-0.5">{listQ.data?.total ?? 0} conversations · J/K to nav · Enter to open</div>
        </div>
        <ConversationList
          items={items}
          selectedId={conversationId}
          onSelect={(id) => navigate(`/inbox/${id}`)}
          listRef={listRef}
        />
      </div>

      <ConversationDetail
        conversationId={conversationId}
        customerPanelOpen={panelOpen}
        onToggleCustomerPanel={() => setPanelOpen(v => !v)}
      />

      {panelOpen && customerIdForPanel && (
        <CustomerPanel customerId={customerIdForPanel} onClose={() => setPanelOpen(false)} />
      )}
    </div>
  );
}
