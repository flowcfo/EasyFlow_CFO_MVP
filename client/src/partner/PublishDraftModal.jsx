import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency, formatPercent } from '../utils/format.js';

/**
 * Confirmation gate before pushing a draft into the client's portal.
 * Shows the headline numbers about to land in the client's dashboard plus an
 * optional note that gets appended to the snapshot label for audit trail.
 */
export default function PublishDraftModal({
  client,
  outputs,
  lastPublishedAt,
  onConfirm,
  onClose,
  publishing,
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const w = outputs?.waterfall || {};
  const score = outputs?.profitScore?.total_score;
  const tier = outputs?.profitTier?.tier;

  async function handleConfirm() {
    setError('');
    try {
      await onConfirm({ note: note.trim() });
    } catch (err) {
      setError(err.message || 'Publish failed. Try again.');
    }
  }

  const headline = client?.business_name || client?.full_name || client?.email || 'this client';
  const lastPub = lastPublishedAt
    ? new Date(lastPublishedAt).toLocaleString()
    : 'never published';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-navy-light rounded-xl p-6 w-full max-w-lg border border-white/10"
      >
        <h2 className="font-sora text-xl font-bold text-white">Publish to client portal</h2>
        <p className="font-mulish text-sm text-stone mt-1">
          {headline} will see these numbers next time they log in. Last published: {lastPub}.
        </p>

        {outputs ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat label="Revenue" value={formatCurrency(w.total_revenue || 0)} />
            <Stat
              label="Pretax Profit"
              value={formatCurrency(w.pretax_net_income || 0)}
              tone={(w.pretax_net_income || 0) >= 0 ? 'good' : 'bad'}
            />
            <Stat label="Pretax %" value={formatPercent(w.pretax_pct || 0)} />
            <Stat label="Profit Score" value={score != null ? `${score} / 100` : '—'} />
            <Stat label="Profit Tier" value={tier != null ? `Tier ${tier}` : '—'} />
            <Stat label="Gross Margin" value={formatPercent(w.gm_pct || 0)} />
          </div>
        ) : (
          <div className="mt-5 bg-status-red/10 border border-status-red/30 rounded-lg p-3">
            <p className="font-mulish text-sm text-status-red">
              No calculated outputs in the draft yet. Click Calculate on the Input Engine first.
            </p>
          </div>
        )}

        <label className="block mt-5">
          <span className="font-mulish text-xs text-stone uppercase tracking-wide">
            Note (optional)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="What changed since last publish?"
            className="mt-1 w-full bg-navy border border-white/10 rounded-lg px-3 py-2 text-white font-mulish text-sm focus:border-orange focus:ring-1 focus:ring-orange outline-none resize-none"
          />
          <span className="font-mulish text-xs text-stone mt-1 block">
            Saved on the snapshot label. {280 - note.length} characters left.
          </span>
        </label>

        {error && (
          <p className="font-mulish text-sm text-status-red mt-3">{error}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="flex-1 bg-white/10 text-white px-4 py-2.5 rounded-lg font-sora font-semibold hover:bg-white/20 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={publishing || !outputs}
            className="flex-1 bg-orange text-white px-4 py-2.5 rounded-lg font-sora font-semibold hover:bg-orange/90 transition disabled:opacity-50"
          >
            {publishing ? 'Publishing...' : 'Publish to client'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const valueColor = tone === 'bad' ? 'text-status-red' : 'text-white';
  return (
    <div className="bg-navy rounded-lg p-3 border border-white/5">
      <p className="font-mulish text-xs text-stone uppercase tracking-wide">{label}</p>
      <p className={`font-sora text-base font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}
