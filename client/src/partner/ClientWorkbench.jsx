import { useState } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ClientWorkbenchProvider } from '../context/ClientWorkbenchContext.jsx';
import { useClientWorkbench } from '../hooks/useClientWorkbench.js';
import PublishDraftModal from './PublishDraftModal.jsx';

/**
 * Layout wrapper mounted at /partner/client/:clientId. Provides the workbench
 * context to every child screen and renders the always-visible draft toolbar
 * with client name, draft state, Publish, and Reset.
 */
export default function ClientWorkbench() {
  const { clientId } = useParams();
  return (
    <ClientWorkbenchProvider clientId={clientId} key={clientId}>
      <WorkbenchInner />
    </ClientWorkbenchProvider>
  );
}

function WorkbenchInner() {
  const navigate = useNavigate();
  const {
    client,
    outputs,
    inputs,
    loading,
    error,
    hasUnpublishedChanges,
    lastPublishedAt,
    publishing,
    publishDraft,
    resetDraft,
    calculate,
  } = useClientWorkbench();

  const [showPublish, setShowPublish] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const heading = client?.business_name || client?.full_name || 'Client';
  const subhead = client?.full_name && client?.business_name
    ? client.full_name
    : client?.email || '';

  const lastPub = lastPublishedAt
    ? new Date(lastPublishedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Never published';

  async function handlePublish({ note }) {
    // Make sure outputs reflect the current inputs before we publish.
    if (!outputs) {
      await calculate(inputs);
    }
    await publishDraft({ note });
    setShowPublish(false);
    setToast('Published to client portal.');
    setTimeout(() => setToast(''), 3500);
  }

  async function handleReset() {
    setShowResetConfirm(false);
    await resetDraft();
    setToast('Draft reset to last published numbers.');
    setTimeout(() => setToast(''), 3500);
  }

  return (
    <div className="space-y-6">
      <div className="bg-navy-light border border-white/10 rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              onClick={() => navigate('/partner/dashboard')}
              className="font-mulish text-xs text-stone hover:text-white transition flex items-center gap-1"
            >
              &larr; Back to Client Book
            </button>
            <h1 className="font-sora text-xl md:text-2xl font-bold text-white mt-1 truncate">
              {heading}
            </h1>
            {subhead && (
              <p className="font-mulish text-xs text-stone truncate">{subhead}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DraftBadge hasChanges={hasUnpublishedChanges} lastPub={lastPub} />
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              disabled={loading || publishing}
              className="bg-white/5 text-stone hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg font-sora font-semibold text-xs transition disabled:opacity-40"
            >
              Reset draft
            </button>
            <button
              type="button"
              onClick={() => setShowPublish(true)}
              disabled={loading || publishing || !outputs}
              className="bg-orange hover:bg-orange/90 text-white px-4 py-2 rounded-lg font-sora font-semibold text-sm transition disabled:opacity-40"
            >
              Publish to client
            </button>
          </div>
        </div>

        {error && (
          <p className="font-mulish text-sm text-status-red mt-3">
            {error}
          </p>
        )}
      </div>

      {loading && !outputs ? (
        <div className="card-dark animate-pulse h-32" />
      ) : (
        <Outlet />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-4 right-4 bg-status-green/15 border border-status-green/40 text-status-green px-4 py-2 rounded-lg font-mulish text-sm z-40"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPublish && (
          <PublishDraftModal
            client={client}
            outputs={outputs}
            lastPublishedAt={lastPublishedAt}
            publishing={publishing}
            onConfirm={handlePublish}
            onClose={() => setShowPublish(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResetConfirm && (
          <ResetConfirmModal
            onCancel={() => setShowResetConfirm(false)}
            onConfirm={handleReset}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DraftBadge({ hasChanges, lastPub }) {
  if (hasChanges) {
    return (
      <div className="flex items-center gap-2 bg-orange/10 border border-orange/30 rounded-lg px-3 py-1.5">
        <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
        <div className="leading-tight">
          <p className="font-sora text-xs font-semibold text-orange">Unpublished draft</p>
          <p className="font-mulish text-[11px] text-stone">Last published: {lastPub}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
      <span className="w-2 h-2 rounded-full bg-status-green" />
      <div className="leading-tight">
        <p className="font-sora text-xs font-semibold text-white">Draft matches client portal</p>
        <p className="font-mulish text-[11px] text-stone">Last published: {lastPub}</p>
      </div>
    </div>
  );
}

function ResetConfirmModal({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-navy-light border border-white/10 rounded-xl p-6 w-full max-w-sm"
      >
        <h3 className="font-sora text-lg font-bold text-white">Reset this draft?</h3>
        <p className="font-mulish text-sm text-stone mt-2">
          The current draft will be replaced with the client's last published numbers. This cannot be undone.
        </p>
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-white/10 text-white px-4 py-2 rounded-lg font-sora font-semibold hover:bg-white/20 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-status-red/20 text-status-red px-4 py-2 rounded-lg font-sora font-semibold hover:bg-status-red/30 transition"
          >
            Reset draft
          </button>
        </div>
      </motion.div>
    </div>
  );
}
