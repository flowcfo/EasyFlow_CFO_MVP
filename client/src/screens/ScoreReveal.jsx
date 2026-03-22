import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ProfitGauge from '../components/ProfitGauge.jsx';
import TierBadge from '../components/TierBadge.jsx';
import UnlockMap from '../components/UnlockMap.jsx';
import { ComicPanelStrip } from '../components/ComicPanel.jsx';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { useAuth } from '../hooks/useAuth.js';
import { formatCurrency } from '../utils/format.js';

export default function ScoreReveal() {
  const navigate = useNavigate();
  const { outputs, interpretation, inputs, calculate, loading } = useSnapshot();
  const { user } = useAuth();
  const [phase, setPhase] = useState('black');

  useEffect(() => {
    if (!outputs && !loading) {
      calculate(inputs, 'Initial Score', 'annual').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!outputs) return;

    const timers = [
      setTimeout(() => setPhase('score'), 500),
      setTimeout(() => setPhase('gap'), 4000),
      setTimeout(() => setPhase('upgrade'), 7000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [outputs]);

  if (loading || !outputs) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="skeleton w-60 h-60 rounded-full" />
      </div>
    );
  }

  const score = outputs.profitScore.total_score;
  const tier = outputs.profitTier;
  const gap = outputs.ownerPayGap;

  return (
    <div className="min-h-screen bg-navy relative">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 z-50 text-stone/50 hover:text-white text-sm font-mulish transition"
      >
        &larr; Back
      </button>
      <AnimatePresence mode="wait">
        {phase === 'black' && (
          <motion.div key="black" className="min-h-screen bg-black" exit={{ opacity: 0 }} />
        )}

        {phase === 'score' && (
          <motion.div
            key="score"
            className="min-h-screen bg-navy flex flex-col items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
          >
            <ProfitGauge score={score} size={280} animated />
            <div className="mt-6">
              <TierBadge tier={tier.tier} large animated />
            </div>
            {interpretation && (
              <motion.div
                className="max-w-lg mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
              >
                {user?.response_mode !== 'classic' && interpretation.panels?.length > 0 ? (
                  <ComicPanelStrip panels={interpretation.panels} />
                ) : (
                  <p className="font-mulish text-stone-light text-center">{interpretation.text}</p>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {phase === 'gap' && (
          <motion.div
            key="gap"
            className="min-h-screen bg-navy flex flex-col items-center justify-center px-4"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <motion.p
              className="font-sora text-5xl md:text-6xl font-bold text-status-red mb-4"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {formatCurrency(Math.abs(gap.owner_pay_gap))}
            </motion.p>
            <p className="font-mulish text-xl text-white text-center">
              You are leaving this amount per year on the table.
            </p>
            <p className="font-mulish text-stone mt-3">
              That is {formatCurrency(Math.abs(gap.monthly_gap))} per month.
            </p>
          </motion.div>
        )}

        {phase === 'upgrade' && (
          <motion.div
            key="upgrade"
            className="min-h-screen bg-navy flex flex-col items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <h2 className="font-sora text-2xl font-bold text-white text-center mb-4">
              You have 11 more screens waiting.
            </h2>
            <p className="font-mulish text-stone text-center max-w-md mb-6">
              Everything you need to fix what you just saw.
              Start with Clarity for $19.99/month. 90 days. A different story.
              Or your money back. No questions asked.
            </p>

            <div className="mb-8 w-full max-w-2xl">
              <UnlockMap />
            </div>

            <div className="space-y-3 w-full max-w-sm">
              <button
                onClick={async () => {
                  try {
                    const { api } = await import('../utils/api.js');
                    const data = await api.post('/stripe/checkout', { tier: 'clarity' });
                    if (data.url) window.location.href = data.url;
                  } catch {
                    navigate('/app/dashboard');
                  }
                }}
                className="btn-primary w-full py-4 text-lg"
              >
                Unlock Clarity. $19.99/month
              </button>
              <button
                onClick={() => navigate('/app/dashboard')}
                className="btn-ghost w-full text-center text-sm"
              >
                Explore free version
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
