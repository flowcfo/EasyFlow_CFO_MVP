import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { supabase } from '../lib/supabaseClient.js';

const CALENDLY_URL = 'https://calendly.com/easyflowcfo/monthly-review';

/**
 * First-time dashboard welcome.
 * Renders only when user.has_completed_onboarding is false.
 * Dismissal flips the flag in users via Supabase JS (RLS allows owner update).
 */
export default function WelcomeCard() {
  const { user, updateUser } = useAuth();
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState('');

  const firstName =
    (user?.full_name || '').split(' ')[0] || 'there';

  async function handleDismiss() {
    if (!user?.id) return;
    setDismissing(true);
    setError('');
    try {
      const { error: updErr } = await supabase
        .from('users')
        .update({ has_completed_onboarding: true })
        .eq('id', user.id);
      if (updErr) throw new Error(updErr.message);
      updateUser({ has_completed_onboarding: true });
    } catch (err) {
      setError(err.message || 'Could not save. Try again.');
      setDismissing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-dark border-white/15"
    >
      <h2 className="font-sora text-xl font-bold text-white">
        Welcome, {firstName}.
      </h2>
      <p className="font-mulish text-sm text-stone-light mt-1">
        Your CFO has set up your dashboard. Here's what to expect.
      </p>

      <ul className="mt-5 space-y-4">
        <li>
          <p className="font-sora text-sm font-semibold text-white">
            Your numbers, updated.
          </p>
          <p className="font-mulish text-sm text-stone-light mt-0.5">
            Your CFO updates your financials inside this portal. You'll always see the latest view.
          </p>
        </li>
        <li>
          <p className="font-sora text-sm font-semibold text-white">
            Read-only by design.
          </p>
          <p className="font-mulish text-sm text-stone-light mt-0.5">
            You don't need to enter anything. If something looks off, message your CFO.
          </p>
        </li>
        <li>
          <p className="font-sora text-sm font-semibold text-white">
            Your monthly review.
          </p>
          <p className="font-mulish text-sm text-stone-light mt-0.5">
            We'll meet monthly to walk through your numbers and your next moves.
          </p>
        </li>
      </ul>

      {error && (
        <p className="font-mulish text-sm text-status-red bg-status-red/10 rounded-md py-2 px-3 mt-4">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="bg-white text-navy hover:bg-stone-light/30 disabled:opacity-60 font-sora font-semibold py-2.5 px-5 rounded-lg transition"
        >
          {dismissing ? 'One moment...' : 'Take me to my dashboard'}
        </button>
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noreferrer"
          className="font-mulish text-sm text-stone-light hover:text-white underline underline-offset-2"
        >
          Schedule my next review
        </a>
      </div>
    </motion.div>
  );
}
