import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../utils/api.js';
import { TIER_LABELS, TIER_PRICES } from '../../../shared/constants.js';
import TierPresentationModal from './TierPresentationModal.jsx';

const TIER_UPGRADE_MAP = {
  clarity: { tier: 'clarity', tagline: 'Stop guessing. Start knowing.' },
  control: { tier: 'control', tagline: 'Know what to do next. Every time.' },
  harvest: { tier: 'harvest', tagline: 'Run the business. Build the wealth.' },
};

export default function LockedOverlay({ requiredTier, children }) {
  const { updateUser } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const upgrade = TIER_UPGRADE_MAP[requiredTier] || TIER_UPGRADE_MAP.clarity;
  const label = TIER_LABELS[upgrade.tier] || 'Clarity';
  const price = TIER_PRICES[upgrade.tier] || 19.99;

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const data = await api.post('/auth/demo-upgrade', { tier: upgrade.tier });
      updateUser({ tier: data.tier });
    } catch {
      try {
        const data = await api.post('/stripe/checkout', { tier: upgrade.tier });
        if (data.url) window.location.href = data.url;
      } catch {
        // no-op
      }
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none opacity-50">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-navy/80 backdrop-blur-sm rounded-xl">
        <div className="text-center max-w-md px-6">
          <h3 className="font-sora text-xl font-bold text-white mb-3">Unlock {label}</h3>
          <p className="font-mulish text-stone mb-2">{upgrade.tagline}</p>
          <p className="font-mulish text-stone mb-2">Starting at ${price}/month.</p>
          <p className="font-mulish text-stone-light text-sm mb-6">
            90 days. A different story. Or your money back. No questions asked.
          </p>
          <button onClick={handleUpgrade} disabled={upgrading} className="btn-primary w-full mb-3">
            {upgrading ? 'Upgrading...' : `Unlock ${label} Now`}
          </button>
          <button onClick={() => setShowGuide(true)} className="btn-ghost text-sm">
            See what is included
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && (
          <TierPresentationModal
            initialTier={upgrade.tier}
            onClose={() => setShowGuide(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
