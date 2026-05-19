import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import MacroPicker from './MacroPicker.jsx';
import ActionModal from './ActionModal.jsx';
import { applyMacro } from '../utils.js';

const ACTIONS = [
  { type: 'resync_inventory', label: '🔄 Resync' },
  { type: 'regenerate_labels', label: '🏷️ Regen Labels' },
  { type: 'reset_scanner_pairing', label: '📱 Reset Scanner' },
  { type: 'extend_trial', label: '⏱️ Extend Trial' },
  { type: 'escalate', label: '⬆️ Escalate' },
];

export default function ReplyComposer({ conversation }) {
  const [tab, setTab] = useState('reply');
  const [body, setBody] = useState('');
  const [activeAction, setActiveAction] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState(null);
  const suggestAbortRef = useRef(null);
  const textareaRef = useRef(null);
  const qc = useQueryClient();

  async function suggestReply() {
    if (suggesting) {
      suggestAbortRef.current?.abort();
      return;
    }
    setSuggestError(null);
    setSuggesting(true);
    setTab('reply');
    setBody('');
    const ctrl = new AbortController();
    suggestAbortRef.current = ctrl;
    try {
      await api.ai.suggestReply(conversation.id, {
        signal: ctrl.signal,
        onChunk: (_chunk, full) => setBody(full),
      });
    } catch (e) {
      if (e.name !== 'AbortError') setSuggestError(e.message || 'Failed to suggest reply');
    } finally {
      setSuggesting(false);
      suggestAbortRef.current = null;
    }
  }

  const sendMutation = useMutation({
    mutationFn: ({ body, internal_note }) => api.conversations.addMessage(conversation.id, { body, internal_note }),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['audit', conversation.id] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ action_type, inputs }) => api.conversations.invokeAction(conversation.id, { action_type, inputs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      qc.invalidateQueries({ queryKey: ['audit', conversation.id] });
      qc.invalidateQueries({ queryKey: ['customer', conversation.customer?.id] });
      setActiveAction(null);
    },
  });

  function send() {
    if (!body.trim() || sendMutation.isPending) return;
    sendMutation.mutate({ body, internal_note: tab === 'note' });
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        send();
      }
    }
    const el = textareaRef.current;
    if (!el) return;
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [body, tab, sendMutation.isPending]);

  return (
    <div className="border-t border-line bg-surface">
      <div className="flex items-center gap-1 px-4 pt-2">
        <button
          onClick={() => setTab('reply')}
          className={clsx('text-sm px-3 py-1.5 rounded-md font-medium', tab === 'reply' ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg')}
        >
          ↩️ Reply
        </button>
        <button
          onClick={() => setTab('note')}
          className={clsx('text-sm px-3 py-1.5 rounded-md font-medium', tab === 'note' ? 'note-tab-active' : 'text-fg-muted hover:text-fg')}
        >
          📝 Internal note
        </button>
        <div className="flex-1" />
        <div className="text-xs text-fg-subtle">⌘+Enter to send</div>
      </div>

      <div className="px-4 pt-2 pb-3">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder={tab === 'note' ? 'Add an internal note (use @name to mention)…' : `Reply to ${conversation.customer?.name || 'customer'}…`}
          className={clsx(
            'w-full resize-none rounded-md border border-line p-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent',
            tab === 'note' ? 'bg-amber-50 focus:bg-amber-50 dark:bg-amber-500/10 dark:focus:bg-amber-500/10' : 'bg-surface',
          )}
        />
      </div>

      {suggestError && (
        <div className="mx-4 mb-2 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs px-2.5 py-1.5 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {suggestError}
        </div>
      )}

      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={suggestReply}
            disabled={tab === 'note'}
            className={clsx('btn-ai', suggesting && 'is-loading')}
            title={tab === 'note' ? 'Switch to Reply to use AI suggestions' : 'Draft a reply with AI'}
          >
            {suggesting ? (
              <>
                <span className="ai-pulse" aria-hidden>✨</span>
                <span>Drafting… (click to stop)</span>
              </>
            ) : (
              <>
                <span aria-hidden>✨</span>
                <span>Suggest reply</span>
              </>
            )}
          </button>
          <MacroPicker
            customer={conversation.customer}
            onPick={(macro, customer) => setBody(b => (b ? b + '\n\n' : '') + applyMacro(macro.body, customer))}
          />
          <div className="flex-1" />
          <button
            onClick={send}
            disabled={!body.trim() || sendMutation.isPending}
            className="btn-primary"
          >
            {sendMutation.isPending ? 'Sending…' : tab === 'note' ? 'Save note' : 'Send reply'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap border-t border-line-subtle pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle pr-1">Quick actions</span>
          {ACTIONS.map(a => (
            <button key={a.type} className="btn text-xs py-1" onClick={() => setActiveAction(a.type)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {activeAction && (
        <ActionModal
          actionType={activeAction}
          onClose={() => setActiveAction(null)}
          onConfirm={(inputs) => actionMutation.mutate({ action_type: activeAction, inputs })}
        />
      )}
    </div>
  );
}
