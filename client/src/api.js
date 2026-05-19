const AGENT_KEY = 'resolvr.currentAgentId';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export function getCurrentAgentId() {
  return localStorage.getItem(AGENT_KEY) || '';
}
export function setCurrentAgentId(id) {
  if (id) localStorage.setItem(AGENT_KEY, id);
  else localStorage.removeItem(AGENT_KEY);
}

async function request(path, { method = 'GET', body, query } = {}) {
  let url = apiUrl(path);
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) v.forEach(x => qs.append(k, x));
      else qs.set(k, v);
    }
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }
  const headers = { 'content-type': 'application/json' };
  const aid = getCurrentAgentId();
  if (aid) headers['x-agent-id'] = aid;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = {};
    try { detail = await res.json(); } catch {}
    const err = new Error(detail.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  conversations: {
    list: (query) => request('/api/conversations', { query }),
    get: (id) => request(`/api/conversations/${id}`),
    create: (body) => request('/api/conversations', { method: 'POST', body }),
    update: (id, body) => request(`/api/conversations/${id}`, { method: 'PATCH', body }),
    addMessage: (id, body) => request(`/api/conversations/${id}/messages`, { method: 'POST', body }),
    invokeAction: (id, body) => request(`/api/conversations/${id}/actions`, { method: 'POST', body }),
  },
  customers: {
    list: (query) => request('/api/customers', { query }),
    get: (id) => request(`/api/customers/${id}`),
    conversations: (id) => request(`/api/customers/${id}/conversations`),
    actions: (id) => request(`/api/customers/${id}/actions`),
    create: (body) => request('/api/customers', { method: 'POST', body }),
    update: (id, body) => request(`/api/customers/${id}`, { method: 'PATCH', body }),
  },
  agents: {
    list: () => request('/api/agents'),
    me: () => request('/api/agents/me'),
  },
  macros: {
    list: () => request('/api/macros'),
    create: (body) => request('/api/macros', { method: 'POST', body }),
    remove: (id) => request(`/api/macros/${id}`, { method: 'DELETE' }),
  },
  tags: {
    list: () => request('/api/tags'),
    create: (body) => request('/api/tags', { method: 'POST', body }),
  },
  audit: {
    list: (query) => request('/api/audit', { query }),
  },
  dashboard: {
    stats: () => request('/api/dashboard/stats'),
  },
  ai: {
    suggestReply: async (conversationId, { onChunk, signal } = {}) => {
      const headers = { 'content-type': 'application/json' };
      const aid = getCurrentAgentId();
      if (aid) headers['x-agent-id'] = aid;
      const res = await fetch(apiUrl(`/api/ai/conversations/${conversationId}/suggest-reply`), {
        method: 'POST',
        headers,
        signal,
      });
      if (!res.ok) {
        let detail = {};
        try { detail = await res.json(); } catch {}
        const err = new Error(detail.message || detail.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.detail = detail;
        throw err;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          full += chunk;
          onChunk?.(chunk, full);
        }
      }
      return full;
    },
  },
};
