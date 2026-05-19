export function relativeTime(iso) {
  if (!iso) return '';
  const date = typeof iso === 'string' ? new Date(iso.replace(' ', 'T') + 'Z') : iso;
  const diff = Date.now() - date.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const date = typeof iso === 'string' ? new Date(iso.replace(' ', 'T') + 'Z') : iso;
  return date.toLocaleString();
}

export function formatDuration(sec) {
  if (!sec) return '—';
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60 * 10) / 10;
  if (hr < 24) return `${hr}h`;
  const days = Math.round(hr / 24 * 10) / 10;
  return `${days}d`;
}

export function applyMacro(body, customer) {
  return body
    .replaceAll('{{customer.name}}', customer?.name || 'there')
    .replaceAll('{{customer.email}}', customer?.email || '')
    .replaceAll('{{customer.plan}}', customer?.plan || 'free');
}

export const STATUS_LABELS = {
  open: 'Open',
  pending_customer: 'Pending Customer',
  pending_internal: 'Pending Internal',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const STATUS_COLORS = {
  open: 'pill-status-open',
  pending_customer: 'pill-status-pending-customer',
  pending_internal: 'pill-status-pending-internal',
  resolved: 'pill-status-resolved',
  closed: 'pill-status-closed',
};

export const PRIORITY_COLORS = {
  low: 'text-fg-subtle',
  normal: 'text-sky-500',
  high: 'text-amber-500',
  urgent: 'text-red-500',
};

export const PRIORITY_DOT_BG = {
  low: 'bg-line-strong',
  normal: 'bg-sky-500',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
};

export function channelIcon(channel) {
  return channel === 'chat' ? '💬' : channel === 'in_app' ? '📱' : '✉️';
}

export function parseMentions(text) {
  return Array.from(text.matchAll(/@([a-zA-Z][a-zA-Z0-9_-]*)/g)).map(m => m[1]);
}
