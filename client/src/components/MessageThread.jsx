import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { formatDateTime, relativeTime } from '../utils.js';

export default function MessageThread({ messages }) {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages?.length]);

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      {messages?.map((m) => {
        const isCustomer = m.author_type === 'customer';
        const isSystem = m.author_type === 'system';
        const isInternal = m.internal_note === 1 || m.internal_note === true;
        if (isSystem) {
          return (
            <div key={m.id} className="text-center text-xs text-fg-subtle my-1">
              {m.body} · {relativeTime(m.created_at)}
            </div>
          );
        }
        return (
          <div key={m.id} className={clsx('flex', isCustomer ? 'justify-start' : 'justify-end')}>
            <div className={clsx('max-w-2xl rounded-lg px-4 py-3 text-sm shadow-sm', {
              'bg-surface border border-line': isCustomer && !isInternal,
              'bg-accent text-on-accent': !isCustomer && !isInternal,
              'note-surface': isInternal,
            })}>
              <div className={clsx('text-xs mb-1.5 flex items-center gap-2', isCustomer || isInternal ? 'text-fg-muted' : 'text-on-accent/70')}>
                <span className="font-medium">{m.author?.name || (isCustomer ? 'Customer' : 'Agent')}</span>
                {isInternal && <span className="pill note-pill text-[10px]">Internal note</span>}
                <span title={formatDateTime(m.created_at)}>· {relativeTime(m.created_at)}</span>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
