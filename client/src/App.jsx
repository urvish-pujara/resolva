import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { AgentProvider, useAgent } from './agentContext.jsx';
import { useTheme } from './themeContext.jsx';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import clsx from 'clsx';

import Inbox from './pages/Inbox.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import Settings from './pages/Settings.jsx';
import SimulatedInbound from './pages/SimulatedInbound.jsx';
import AuditPage from './pages/AuditPage.jsx';

export default function App() {
  return (
    <AgentProvider>
      <div className="flex h-full bg-app">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          <TopBar />
          <div className="flex-1 min-h-0 overflow-hidden">
            <Routes>
              <Route path="/" element={<Inbox />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/inbox/:conversationId" element={<Inbox />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings/*" element={<Settings />} />
              <Route path="/inbound" element={<SimulatedInbound />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="*" element={<div className="p-8 text-fg-subtle">Not found.</div>} />
            </Routes>
          </div>
        </main>
      </div>
    </AgentProvider>
  );
}

function Sidebar() {
  const { current } = useAgent();
  const linkCls = ({ isActive }) => clsx(
    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition',
    isActive ? 'bg-sidebar-active text-on-sidebar' : 'text-on-sidebar-muted hover:bg-sidebar-hover hover:text-on-sidebar',
  );
  const sectionCls = 'px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400';
  const isAdmin = current?.role === 'admin';
  return (
    <aside className="w-56 shrink-0 bg-sidebar text-on-sidebar flex flex-col">
      <div className="p-3 border-b border-ink-800 flex items-center gap-2">
        <div className="h-7 w-7 rounded bg-on-sidebar text-sidebar grid place-items-center font-bold">R</div>
        <div className="font-semibold tracking-tight">Resolvr</div>
      </div>
      <nav className="p-2 flex-1 overflow-y-auto scrollbar-thin">
        <div className={sectionCls}>Workspace</div>
        <NavLink to="/inbox" className={linkCls}>📥 Inbox</NavLink>
        <NavLink to="/dashboard" className={linkCls}>📊 Dashboard</NavLink>
        <div className={sectionCls}>Admin</div>
        <NavLink to="/inbound" className={linkCls}>📨 Simulated Inbound</NavLink>
        <NavLink to="/audit" className={linkCls}>🧾 Audit Log</NavLink>
        {isAdmin && <NavLink to="/settings" className={linkCls}>⚙️ Settings</NavLink>}
      </nav>
      <div className="p-3 border-t border-ink-800 text-xs text-ink-400">
        Prototype v0 · No AI yet
      </div>
    </aside>
  );
}

const THEME_OPTIONS = [
  { value: 'light', label: '☀️', title: 'Light' },
  { value: 'system', label: '🖥️', title: 'System' },
  { value: 'dark', label: '🌙', title: 'Dark' },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="inline-flex items-center rounded-md border border-line bg-surface p-0.5" role="group" aria-label="Theme">
      {THEME_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          title={opt.title}
          aria-pressed={theme === opt.value}
          className={clsx(
            'h-6 w-7 grid place-items-center rounded text-xs transition',
            theme === opt.value ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg',
          )}
        >
          <span aria-hidden>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

function TopBar() {
  const { current, agents, switchAgent } = useAgent();
  const navigate = useNavigate();
  const mentionsQ = useQuery({
    queryKey: ['mentions', current?.id],
    queryFn: () => api.audit.list({ event_type: 'note.added', limit: 50 }),
    enabled: !!current,
    refetchInterval: 30_000,
  });
  const mentionCount = (mentionsQ.data?.items || []).filter(item => {
    const body = item.metadata?.message_id;
    return body && item.actor_id !== current?.id;
  }).length;

  return (
    <header className="h-12 shrink-0 border-b border-line bg-surface flex items-center px-4 gap-4">
      <div className="text-sm font-semibold text-fg-strong">Workspace</div>
      <div className="flex-1" />
      <ThemeToggle />
      <button className="btn-ghost relative" onClick={() => navigate('/audit')}>
        🔔
        {mentionCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-red-500 text-[10px] text-white">{mentionCount}</span>
        )}
      </button>
      <div className="flex items-center gap-2">
        <span className="text-xs text-fg-muted">Acting as</span>
        <select
          value={current?.id || ''}
          onChange={(e) => switchAgent(e.target.value)}
          className="field py-1"
        >
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
          ))}
        </select>
      </div>
    </header>
  );
}
