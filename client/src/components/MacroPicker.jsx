import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

export default function MacroPicker({ onPick, customer }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const macrosQ = useQuery({ queryKey: ['macros'], queryFn: api.macros.list });
  const items = (macrosQ.data?.items || []).filter(m =>
    !filter || m.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="relative">
      <button type="button" className="btn" onClick={() => setOpen(v => !v)}>
        📋 Macros
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-80 rounded-md border border-line bg-surface-raised shadow-lg z-10">
          <div className="p-2 border-b border-line-subtle">
            <input
              autoFocus
              className="field"
              placeholder="Filter macros…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {items.length === 0 && <div className="p-3 text-xs text-fg-subtle">No macros match.</div>}
            {items.map(m => (
              <button
                key={m.id}
                className="w-full text-left px-3 py-2 hover:bg-surface-muted border-b border-line-subtle"
                onClick={() => { onPick(m, customer); setOpen(false); setFilter(''); }}
              >
                <div className="text-sm font-medium text-fg-strong">{m.name}</div>
                <div className="text-xs text-fg-muted truncate">{m.body.replace(/\s+/g, ' ').slice(0, 80)}…</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
