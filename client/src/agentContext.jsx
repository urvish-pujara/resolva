import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getCurrentAgentId, setCurrentAgentId } from './api.js';

const AgentContext = createContext(null);

export function AgentProvider({ children }) {
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState(getCurrentAgentId());
  const agentsQ = useQuery({ queryKey: ['agents'], queryFn: api.agents.list });

  useEffect(() => {
    if (!agentId && agentsQ.data?.items?.length) {
      const admin = agentsQ.data.items.find(a => a.role === 'admin') || agentsQ.data.items[0];
      switchAgent(admin.id);
    }
  }, [agentId, agentsQ.data]);

  function switchAgent(id) {
    setCurrentAgentId(id);
    setAgentId(id);
    qc.invalidateQueries();
  }

  const current = agentsQ.data?.items?.find(a => a.id === agentId) || null;

  return (
    <AgentContext.Provider value={{ current, agents: agentsQ.data?.items || [], switchAgent }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used inside AgentProvider');
  return ctx;
}
