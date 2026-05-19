import { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../api.js';
import { useAgent } from '../agentContext.jsx';

export default function Settings() {
  const { current } = useAgent();
  if (current?.role !== 'admin') {
    return <div className="p-8 text-fg-muted">Admin only. Switch to an admin agent in the top bar.</div>;
  }
  const linkCls = ({ isActive }) => clsx('btn-ghost', isActive && 'bg-surface-muted text-fg');
  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-app">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-fg">Settings</h1>
        <nav className="flex gap-1 border-b border-line pb-2">
          <NavLink to="" end className={linkCls}>Macros</NavLink>
          <NavLink to="tags" className={linkCls}>Tags</NavLink>
          <NavLink to="agents" className={linkCls}>Agents</NavLink>
        </nav>
        <Routes>
          <Route index element={<MacrosTab />} />
          <Route path="tags" element={<TagsTab />} />
          <Route path="agents" element={<AgentsTab />} />
        </Routes>
      </div>
    </div>
  );
}

function MacrosTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['macros'], queryFn: api.macros.list });
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const create = useMutation({
    mutationFn: () => api.macros.create({ name, body }),
    onSuccess: () => { setName(''); setBody(''); qc.invalidateQueries({ queryKey: ['macros'] }); },
  });
  const remove = useMutation({
    mutationFn: (id) => api.macros.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['macros'] }),
  });

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-lg border border-line p-4 space-y-2">
        <div className="font-semibold text-fg">New macro</div>
        <input className="field" placeholder="Macro name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          rows={4}
          className="field"
          placeholder="Body — supports {{customer.name}}, {{customer.plan}}"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end">
          <button className="btn-primary" disabled={!name || !body || create.isPending} onClick={() => create.mutate()}>Save</button>
        </div>
      </div>
      <ul className="bg-surface rounded-lg border border-line divide-y divide-line-subtle">
        {(q.data?.items || []).map(m => (
          <li key={m.id} className="p-4 flex gap-3">
            <div className="flex-1">
              <div className="font-medium text-fg">{m.name}</div>
              <pre className="text-xs text-fg-muted whitespace-pre-wrap mt-1">{m.body}</pre>
            </div>
            <button className="btn" onClick={() => remove.mutate(m.id)}>Delete</button>
          </li>
        ))}
        {!q.data?.items?.length && <li className="p-6 text-sm text-fg-subtle">No macros yet.</li>}
      </ul>
    </div>
  );
}

function TagsTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['tags'], queryFn: api.tags.list });
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6b7280');
  const create = useMutation({
    mutationFn: () => api.tags.create({ name, color }),
    onSuccess: () => { setName(''); qc.invalidateQueries({ queryKey: ['tags'] }); },
  });
  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-lg border border-line p-4 flex gap-2">
        <input className="field flex-1" placeholder="tag-name" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded-md border border-line bg-surface" />
        <button className="btn-primary" disabled={!name} onClick={() => create.mutate()}>Add tag</button>
      </div>
      <div className="bg-surface rounded-lg border border-line p-4 flex flex-wrap gap-2">
        {(q.data?.items || []).map(t => (
          <span key={t.id} className="pill text-sm" style={{ background: t.color + '22', color: t.color }}>
            {t.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function AgentsTab() {
  const q = useQuery({ queryKey: ['agents'], queryFn: api.agents.list });
  return (
    <div className="bg-surface rounded-lg border border-line divide-y divide-line-subtle">
      {(q.data?.items || []).map(a => (
        <div key={a.id} className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-surface-muted grid place-items-center font-semibold text-fg-strong">
            {a.name.split(' ').map(x => x[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="font-medium text-fg">{a.name}</div>
            <div className="text-xs text-fg-muted">{a.email}</div>
          </div>
          <span className="pill pill-neutral capitalize">{a.role.replace('_', ' ')}</span>
        </div>
      ))}
    </div>
  );
}
