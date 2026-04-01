import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../utils/api.js';
import { TIER_RANK } from '../../../shared/constants.js';
import { TIER_PRESENTATIONS } from '../../../shared/tierPresentations.js';

const OWNER_TIERS = ['free', 'clarity', 'control', 'harvest'];
const PARTNER_TIERS = ['partner_starter', 'partner_growth', 'partner_scale'];

function TierTab({ tierKey, pres, isActive, isCurrent, onClick }) {
  return (
    <button
      onClick={() => onClick(tierKey)}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
        isActive ? 'bg-white/10 text-white' : 'text-stone hover:text-white hover:bg-white/5'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{pres.icon}</span>
          <span className="font-sora text-sm font-semibold">{pres.label}</span>
        </div>
        {isCurrent && (
          <span className="text-xs font-mulish px-1.5 py-0.5 rounded bg-orange/20 text-orange">
            current
          </span>
        )}
      </div>
      {pres.price && (
        <p className="font-mulish text-xs text-stone/60 ml-7">${pres.price}/mo</p>
      )}
    </button>
  );
}

export default function TierPresentationModal({ initialTier, onClose }) {
  const { user, updateUser } = useAuth();
  const userRank = TIER_RANK[user?.tier] || 0;
  const userIsPartner = user?.user_type === 'partner';

  const [activeTier, setActiveTier] = useState(initialTier || user?.tier || 'free');
  const [slideIdx, setSlideIdx] = useState(0);
  const [slideDir, setSlideDir] = useState(1);
  const [upgrading, setUpgrading] = useState(false);

  const pres = TIER_PRESENTATIONS[activeTier];
  const slides = pres?.slides || [];
  const isCurrent = user?.tier === activeTier && (
    OWNER_TIERS.includes(activeTier) ? !userIsPartner : userIsPartner
  );
  const isPartnerTier = PARTNER_TIERS.includes(activeTier);
  const tierRank = TIER_RANK[activeTier] || 0;
  const canUpgrade = !isCurrent && (
    (OWNER_TIERS.includes(activeTier) && userRank < tierRank && !userIsPartner) ||
    (isPartnerTier && !userIsPartner)
  );

  function switchTier(tierKey) {
    setActiveTier(tierKey);
    setSlideIdx(0);
    setSlideDir(1);
  }

  function nextSlide() {
    if (slideIdx < slides.length - 1) { setSlideDir(1); setSlideIdx((i) => i + 1); }
  }
  function prevSlide() {
    if (slideIdx > 0) { setSlideDir(-1); setSlideIdx((i) => i - 1); }
  }

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      if (isPartnerTier) {
        await api.post('/auth/partner-upgrade', { tier: activeTier });
        // Hard reload so AuthContext re-fetches /auth/me with updated user_type
        window.location.replace('/partner/dashboard');
      } else {
        try {
          const data = await api.post('/auth/demo-upgrade', { tier: activeTier });
          updateUser({ tier: data.tier });
          onClose();
        } catch {
          const data = await api.post('/stripe/checkout', { tier: activeTier });
          if (data.url) window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error('Upgrade failed:', err);
      setUpgrading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl bg-[#0E1B2E] border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden"
        style={{ maxHeight: '90vh' }}
      >
        {/* Left tier list */}
        <div className="w-52 flex-shrink-0 bg-[#0a1422] border-r border-white/10 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-sora text-sm font-bold text-white">What's included</h2>
            <p className="font-mulish text-xs text-stone mt-0.5">Pick a tier to explore</p>
          </div>
          <div className="p-3 space-y-1">
            <p className="font-mulish text-xs text-stone/50 uppercase tracking-wide px-1 pt-1 pb-0.5">Owner</p>
            {OWNER_TIERS.map((k) => (
              <TierTab key={k} tierKey={k} pres={TIER_PRESENTATIONS[k]}
                isActive={activeTier === k}
                isCurrent={user?.tier === k && !userIsPartner}
                onClick={switchTier} />
            ))}
            <p className="font-mulish text-xs text-stone/50 uppercase tracking-wide px-1 pt-3 pb-0.5">CFO Partner</p>
            {PARTNER_TIERS.map((k) => (
              <TierTab key={k} tierKey={k} pres={TIER_PRESENTATIONS[k]}
                isActive={activeTier === k}
                isCurrent={user?.tier === k && userIsPartner}
                onClick={switchTier} />
            ))}
          </div>
        </div>

        {/* Right slide deck */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{pres?.icon}</span>
                <h3 className="font-sora text-lg font-bold text-white">{pres?.label}</h3>
                {pres?.price && <span className="font-mulish text-sm text-stone">${pres.price}/mo</span>}
              </div>
              <p className="font-mulish text-sm text-stone mt-0.5">{pres?.tagline}</p>
            </div>
            <button onClick={onClose} className="text-stone hover:text-white transition p-1 rounded-lg hover:bg-white/10">✕</button>
          </div>

          {/* What matters */}
          <div className="px-6 py-4 border-b border-white/10 flex-shrink-0">
            <p className="font-mulish text-xs text-stone/60 uppercase tracking-wide mb-2">What matters at this tier</p>
            <ul className="space-y-1">
              {pres?.whatMatters?.map((item, i) => (
                <li key={i} className="flex items-start gap-2 font-mulish text-sm text-white/80">
                  <span className="text-orange mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Slide */}
          <div className="flex-1 overflow-hidden relative px-6 py-5">
            <AnimatePresence mode="wait" custom={slideDir}>
              <motion.div
                key={`${activeTier}-${slideIdx}`}
                custom={slideDir}
                initial={{ opacity: 0, x: slideDir * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: slideDir * -40 }}
                transition={{ duration: 0.2 }}
              >
                <p className="font-mulish text-xs text-stone/50 uppercase tracking-wide mb-2">
                  Screen {slideIdx + 1} of {slides.length}
                </p>
                <h4 className="font-sora text-xl font-bold text-white mb-3">{slides[slideIdx]?.heading}</h4>
                <p className="font-mulish text-base text-stone leading-relaxed">{slides[slideIdx]?.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer: nav + CTA */}
          <div className="px-6 pb-5 flex-shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={prevSlide} disabled={slideIdx === 0}
                className="text-stone hover:text-white disabled:opacity-30 transition font-mulish text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 disabled:hover:bg-transparent">
                ← Prev
              </button>
              <div className="flex gap-1.5">
                {slides.map((_, i) => (
                  <button key={i}
                    onClick={() => { setSlideDir(i > slideIdx ? 1 : -1); setSlideIdx(i); }}
                    className={`h-1.5 rounded-full transition-all ${i === slideIdx ? 'bg-orange w-4' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
                  />
                ))}
              </div>
              <button onClick={nextSlide} disabled={slideIdx === slides.length - 1}
                className="text-stone hover:text-white disabled:opacity-30 transition font-mulish text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 disabled:hover:bg-transparent">
                Next →
              </button>
            </div>

            {canUpgrade && (
              <button onClick={handleUpgrade} disabled={upgrading}
                className="w-full py-3 rounded-xl font-sora font-bold text-white text-sm transition-all disabled:opacity-60"
                style={{ backgroundColor: pres?.color || '#F05001' }}>
                {upgrading
                  ? 'Setting up...'
                  : isPartnerTier
                    ? `Become a ${pres?.label} — $${pres?.price}/mo`
                    : `Upgrade to ${pres?.label} — $${pres?.price}/mo`}
              </button>
            )}
            {isCurrent && (
              <p className="text-center font-mulish text-sm text-stone/60">You are on this tier.</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
