import clsx from 'clsx';
import { relativeTime, STATUS_LABELS, STATUS_COLORS, PRIORITY_DOT_BG, channelIcon } from '../utils.js';

export default function ConversationList({ items, selectedId, onSelect, listRef }) {
  return (
    <div ref={listRef} className="h-full overflow-y-auto scrollbar-thin">
      {items.length === 0 && (
        <div className="p-6 text-center text-sm text-fg-subtle">No conversations match these filters.</div>
      )}
      {items.map((c) => {
        const isSelected = c.id === selectedId;
        const last = c.last_message;
        const snippet = last?.body?.replace(/\s+/g, ' ').slice(0, 120) || '';
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={clsx(
              'w-full text-left px-4 py-3 border-b border-line-subtle transition flex flex-col gap-1.5',
              isSelected ? 'bg-surface-muted border-l-2 border-l-accent' : 'hover:bg-surface-muted border-l-2 border-l-transparent',
            )}
            data-conversation-id={c.id}
          >
            <div className="flex items-center gap-2">
              <span className={clsx('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT_BG[c.priority])} title={`Priority: ${c.priority}`} />
              <span className="text-sm font-semibold text-fg truncate">{c.customer?.name || 'Unknown'}</span>
              <span className="text-xs text-fg-subtle ml-auto shrink-0">{relativeTime(c.updated_at)}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs shrink-0 mt-0.5" title={`Channel: ${c.channel}`}>{channelIcon(c.channel)}</span>
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm text-fg-strong truncate">{c.subject}</div>
                <div className="text-xs text-fg-muted truncate">{snippet}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap pl-6">
              <span className={clsx('pill text-[10px]', STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status]}</span>
              {c.tags?.map(t => (
                <span key={t.id} className="pill text-[10px]" style={{ background: t.color + '22', color: t.color }}>
                  {t.name}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
