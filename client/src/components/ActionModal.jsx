import { useEffect, useState } from 'react';

const ACTION_DEFS = {
  resync_inventory: {
    label: 'Resync Inventory',
    fields: [
      { name: 'scope', label: 'Scope', type: 'select', options: ['single_sku', 'warehouse', 'full'], default: 'warehouse' },
      { name: 'reason', label: 'Reason', type: 'text', default: 'sync drift' },
    ],
  },
  regenerate_labels: {
    label: 'Regenerate Labels',
    fields: [
      { name: 'format', label: 'Format', type: 'select', options: ['qr', 'barcode_128', 'barcode_ean'], default: 'qr' },
      { name: 'count', label: 'Count', type: 'number', required: true, default: 25 },
    ],
  },
  reset_scanner_pairing: {
    label: 'Reset Scanner Pairing',
    fields: [
      { name: 'device_id', label: 'Device ID', type: 'text', required: true, default: 'dev_' },
    ],
  },
  extend_trial: {
    label: 'Extend Trial',
    fields: [
      { name: 'days', label: 'Days to extend', type: 'number', required: true, default: 14 },
    ],
  },
  escalate: {
    label: 'Escalate',
    fields: [
      { name: 'reason', label: 'Reason', type: 'text', required: true, default: 'requires senior_agent' },
    ],
  },
};

export default function ActionModal({ actionType, onClose, onConfirm }) {
  const def = ACTION_DEFS[actionType];
  const [values, setValues] = useState({});

  useEffect(() => {
    if (!def) return;
    const initial = {};
    for (const f of def.fields) if (f.default !== undefined) initial[f.name] = f.default;
    setValues(initial);
  }, [actionType]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!def) return null;

  function submit(e) {
    e.preventDefault();
    onConfirm(values);
  }

  return (
    <div className="fixed inset-0 z-50 modal-scrim grid place-items-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-surface-raised rounded-lg shadow-xl w-full max-w-md border border-line"
      >
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="font-semibold text-fg">{def.label}</h3>
          <button type="button" onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-fg-muted">
            This is a <strong>prototype stub</strong>. The action is logged to <code className="text-[11px]">actions</code> and <code className="text-[11px]">audit_log</code> but no external system is contacted.
          </p>
          {def.fields.map(f => (
            <div key={f.name}>
              <label className="label mb-1">{f.label}</label>
              {f.type === 'select' ? (
                <select
                  className="field"
                  value={values[f.name] || ''}
                  onChange={(e) => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                  required={f.required}
                >
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type}
                  className="field"
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues(v => ({ ...v, [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  required={f.required}
                />
              )}
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-line flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="submit" className="btn-primary">Confirm</button>
        </div>
      </form>
    </div>
  );
}
