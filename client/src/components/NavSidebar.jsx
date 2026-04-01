import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { useGame } from '../hooks/useGame.js';
import StreakDisplay from './StreakDisplay.jsx';
import TierPresentationModal from './TierPresentationModal.jsx';
import { SCREEN_NAMES, TIER_RANK, TIER_LABELS } from '../../../shared/constants.js';

const SCREEN_ROUTES = {
  1: 'input', 2: 'dashboard', 3: 'owner-pay-gap',
  4: 'breakeven', 5: 'productivity', 6: 'leaks',
  7: 'four-forces', 8: 'scenarios', 9: 'forecast',
  10: 'rolling12', 11: 'pricing', 12: 'hire',
  13: 'weekly', 14: 'pay-roadmap', 15: 'action-plan',
};

function getNextUpgrade(tier) {
  switch (tier) {
    case 'free':    return { tier: 'clarity', label: 'Clarity',  price: '$19.99/mo' };
    case 'clarity': return { tier: 'control', label: 'Control',  price: '$49.99/mo' };
    case 'control': return { tier: 'harvest', label: 'Harvest',  price: '$99.99/mo' };
    default: return null;
  }
}

export default function NavSidebar() {
  const { user, logout } = useAuth();
  const { gameProgress } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const [modalTier, setModalTier] = useState(null); // null = closed
  const userRank = TIER_RANK[user?.tier] || 0;
  const isPartner = user?.user_type === 'partner';
  const isOnPartnerPage = location.pathname.startsWith('/partner');

  const ownerScreens = SCREEN_NAMES.filter((s) => s.id <= 15);
  const tierLabel = TIER_LABELS[user?.tier] || user?.tier || 'Free';
  const nextUpgrade = getNextUpgrade(user?.tier);

  return (
    <aside className="w-64 bg-navy-light border-r border-white/10 h-screen sticky top-0 flex flex-col">
      {/* Brand */}
      <div className="p-4 border-b border-white/10">
        <h1 className="font-sora text-lg font-bold text-orange">Easy Numbers</h1>
        <p className="font-mulish text-xs text-stone">Your Numbers Made Easy.</p>
      </div>

      {/* User / tier */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="font-mulish text-sm text-white">{user?.business_name || user?.email}</p>
          <button
            onClick={() => setModalTier(user?.tier || 'free')}
            className="font-mulish text-xs text-stone hover:text-orange transition underline underline-offset-2 decoration-dotted text-left"
          >
            {tierLabel} {isPartner ? '(Partner)' : ''} tier — what's included?
          </button>
        </div>
        <StreakDisplay streak={gameProgress?.current_streak || 0} atRisk={gameProgress?.streak_at_risk} />
      </div>

      {/* Profit score */}
      {gameProgress?.profit_score !== undefined && (
        <div className="p-4 border-b border-white/10 text-center">
          <p className="font-sora text-2xl text-orange font-bold">{gameProgress.profit_score}</p>
          <p className="font-mulish text-xs text-stone">Profit Score</p>
        </div>
      )}

      {/* Partner nav */}
      {isPartner && (
        <div className="border-b border-white/10">
          <div className="px-4 pt-3 pb-1">
            <p className="font-mulish text-xs text-stone uppercase tracking-wide">Partner</p>
          </div>
          {[
            { to: '/partner/dashboard', icon: '📊', label: 'Client Book' },
            { to: '/partner/whitelabel', icon: '🎨', label: 'White-Label' },
            { to: '/partner/addons',    icon: '🤖', label: 'AI Add-Ons'  },
          ].map(({ to, icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-mulish transition-colors
                ${isActive ? 'bg-orange/10 text-orange border-r-2 border-orange' : 'text-stone hover:text-white hover:bg-white/5'}`
              }
            >
              <span className="w-5 text-center font-sora text-xs">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}

      {/* Owner screens */}
      <nav className="flex-1 overflow-y-auto py-2">
        {!isOnPartnerPage && (
          <div className="px-4 pt-1 pb-1">
            <p className="font-mulish text-xs text-stone uppercase tracking-wide">Screens</p>
          </div>
        )}
        {ownerScreens.map((screen) => {
          const locked = userRank < (TIER_RANK[screen.tier] || 0);
          return (
            <NavLink
              key={screen.id}
              to={`/app/${SCREEN_ROUTES[screen.id]}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-mulish transition-colors
                ${isActive ? 'bg-orange/10 text-orange border-r-2 border-orange' : 'text-stone hover:text-white hover:bg-white/5'}
                ${locked ? 'opacity-50' : ''}`
              }
            >
              <span className="w-5 text-center font-sora text-xs">{locked ? '🔒' : screen.id}</span>
              <span className="truncate">{screen.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Integrations */}
      <div className="border-t border-white/10 py-2">
        <NavLink to="/app/integrations"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 text-sm font-mulish transition-colors
            ${isActive ? 'bg-orange/10 text-orange border-r-2 border-orange' : 'text-stone hover:text-white hover:bg-white/5'}`
          }
        >
          <span className="w-5 text-center font-sora text-xs">🔗</span>
          <span>Integrations</span>
        </NavLink>
      </div>

      {/* Bottom CTAs */}
      <div className="p-4 border-t border-white/10 space-y-2">
        {nextUpgrade && !isPartner && (
          <button
            onClick={() => setModalTier(nextUpgrade.tier)}
            className="btn-primary w-full text-sm py-2"
          >
            Upgrade to {nextUpgrade.label} — {nextUpgrade.price}
          </button>
        )}
        {!isPartner && (
          <button
            onClick={() => setModalTier('partner_starter')}
            className="w-full text-xs font-mulish text-stone hover:text-white py-1.5 transition text-center"
          >
            🤝 Become a Fractional CFO
          </button>
        )}
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="btn-ghost text-xs w-full text-center"
        >
          Log out
        </button>
      </div>

      {/* Tier guide modal */}
      <AnimatePresence>
        {modalTier && (
          <TierPresentationModal
            initialTier={modalTier}
            onClose={() => setModalTier(null)}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}
