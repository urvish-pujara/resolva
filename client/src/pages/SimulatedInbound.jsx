import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function SimulatedInbound() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState('existing');
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', plan: 'free' });
  const [channel, setChannel] = useState('email');
  const [priority, setPriority] = useState('normal');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');

  const customersQ = useQuery({
    queryKey: ['customers-search', search],
    queryFn: () => api.customers.list({ q: search, limit: 50 }),
  });

  const createCustomer = useMutation({
    mutationFn: () => api.customers.create(newCustomer),
  });

  const createConv = useMutation({
    mutationFn: async () => {
      let cid = customerId;
      if (mode === 'new') {
        if (!newCustomer.name || !newCustomer.email) throw new Error('Customer name and email required');
        const created = await createCustomer.mutateAsync();
        cid = created.id;
      }
      if (!cid) throw new Error('Pick or create a customer');
      return api.conversations.create({
        customer_id: cid,
        subject,
        channel,
        priority,
        initial_message: body,
      });
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['customer', conv.customer?.id] });
      navigate(`/inbox/${conv.id}`);
    },
  });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-app">
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-fg">Simulated Inbound</h1>
        <p className="text-sm text-fg-muted">
          Create a fake inbound message as if a customer just emailed/chatted in. This is the only way new conversations enter the system in the prototype.
        </p>

        <section className="bg-surface rounded-lg border border-line p-5 space-y-4">
          <div className="flex gap-1">
            <button onClick={() => setMode('existing')} className={`flex-1 text-sm py-1.5 rounded-md ${mode === 'existing' ? 'bg-accent text-on-accent' : 'bg-surface-muted text-fg-muted'}`}>Existing customer</button>
            <button onClick={() => setMode('new')} className={`flex-1 text-sm py-1.5 rounded-md ${mode === 'new' ? 'bg-accent text-on-accent' : 'bg-surface-muted text-fg-muted'}`}>New customer</button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-2">
              <label className="label">Customer</label>
              <input className="field" placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-48 overflow-y-auto border border-line rounded-md scrollbar-thin">
                {(customersQ.data?.items || []).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCustomerId(c.id)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-surface-muted ${customerId === c.id ? 'bg-surface-muted' : ''}`}
                  >
                    <div className="text-sm text-fg">{c.name} <span className="text-fg-subtle">· {c.email}</span></div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input className="field" placeholder="Name" value={newCustomer.name} onChange={(e) => setNewCustomer(x => ({ ...x, name: e.target.value }))} />
              <input className="field" placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer(x => ({ ...x, email: e.target.value }))} />
              <select className="field" value={newCustomer.plan} onChange={(e) => setNewCustomer(x => ({ ...x, plan: e.target.value }))}>
                <option>free</option><option>pro</option><option>enterprise</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Channel</label>
              <select className="field" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="email">Email</option>
                <option value="chat">Chat</option>
                <option value="in_app">In-app</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="field" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Subject</label>
            <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" />
          </div>
          <div>
            <label className="label">Body</label>
            <textarea className="field" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Inbound message body…" />
          </div>

          {createConv.error && <div className="text-sm text-red-500 dark:text-red-300">{createConv.error.message}</div>}

          <div className="flex justify-end">
            <button
              className="btn-primary"
              disabled={!subject || !body || createConv.isPending}
              onClick={() => createConv.mutate()}
            >
              {createConv.isPending ? 'Creating…' : '📨 Send to Inbox'}
            </button>
          </div>
        </section>

        <div className="text-xs text-fg-subtle">
          Tip: to simulate a customer reply to an existing conversation, you can also POST to <code>/api/conversations/:id/messages</code> with <code>author_type=customer</code>.
        </div>

        <Link to="/inbox" className="btn-ghost">← Back to inbox</Link>
      </div>
    </div>
  );
}
