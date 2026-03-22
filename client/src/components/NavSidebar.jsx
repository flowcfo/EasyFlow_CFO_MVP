import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useGame } from '../hooks/useGame.js';
import StreakDisplay from './StreakDisplay.jsx';
import { SCREEN_NAMES, TIER_RANK, TIER_LABELS } from '../../../shared/constants.js';

const SCREEN_ROUTES = {
  1: 'input',
  2: 'dashboard',
  3: 'owner-pay-gap',
  4: 'breakeven',
  5: 'productivity',
  6: 'leaks',
  7: 'four-forces',
  8: 'scenarios',
  9: 'forecast',
  10: 'rolling12',
  11: 'pricing',
  12: 'hire',
  13: 'weekly',
  14: 'pay-roadmap',
  15: 'action-plan',
};

function getNextUpgrade(tier) {
  switch (tier) {
    case 'free': return { tier: 'clarity', label: 'Clarity', price: '$19.99/mo', tagline: 'Stop guessing. Start knowing.' };
    case 'clarity': return { tier: 'control', label: 'Control', price: '$49.99/mo', tagline: 'Know what to do next.' };
    case 'control': return { tier: 'harvest', label: 'Harvest', price: '$99.99/mo', tagline: 'Run the business. Build the wealth.' };
    default: return null;
  }
}

export default function NavSidebar() {
  const { user, logout } = useAuth();
  const { gameProgress } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const userRank = TIER_RANK[user?.tier] || 0;
  const isPartner = user?.user_type === 'partner';
  const isOnPartnerPage = location.pathname.startsWith('/partner');

  const ownerScreens = SCREEN_NAMES.filter((s) => s.id <= 15);
  const tierLabel = TIER_LABELS[user?.tier] || user?.tier || 'Free';
  const nextUpgrade = getNextUpgrade(user?.tier);

  return (
    <aside className="w-64 bg-navy-light border-r border-white/10 h-screen sticky top-0 flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h1 className="font-sora text-lg font-bold text-orange">Easy Numbers</h1>
        <p className="font-mulish text-xs text-stone">Your Numbers Made Easy.</p>
      </div>

      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="font-mulish text-sm text-white">{user?.business_name || user?.email}</p>
          <p className="font-mulish text-xs text-stone">
            {tierLabel} {isPartner ? '(Partner)' : ''} tier
          </p>
        </div>
        <StreakDisplay
          streak={gameProgress?.current_streak || 0}
          atRisk={gameProgress?.streak_at_risk}
        />
      </div>

      {gameProgress?.profit_score !== undefined && (
        <div className="p-4 border-b border-white/10 text-center">
          <p className="font-sora text-2xl text-orange font-bold">{gameProgress.profit_score}</p>
          <p className="font-mulish text-xs text-stone">Profit Score</p>
        </div>
      )}

      {isPartner && (
        <div className="border-b border-white/10">
          <div className="px-4 pt-3 pb-1">
            <p className="font-mulish text-xs text-stone uppercase tracking-wide">Partner</p>
          </div>
          <NavLink
            to="/partner/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-mulish transition-colors
              ${isActive ? 'bg-orange/10 text-orange border-r-2 border-orange' : 'text-stone hover:text-white hover:bg-white/5'}`
            }
          >
            <span className="w-5 text-center font-sora text-xs">📊</span>
            <span>Client Book</span>
          </NavLink>
          <NavLink
            to="/partner/whitelabel"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-mulish transition-colors
              ${isActive ? 'bg-orange/10 text-orange border-r-2 border-orange' : 'text-stone hover:text-white hover:bg-white/5'}`
            }
          >
            <span className="w-5 text-center font-sora text-xs">🎨</span>
            <span>White-Label</span>
          </NavLink>
          <NavLink
            to="/partner/addons"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-mulish transition-colors
              ${isActive ? 'bg-orange/10 text-orange border-r-2 border-orange' : 'text-stone hover:text-white hover:bg-white/5'}`
            }
          >
            <span className="w-5 text-center font-sora text-xs">🤖</span>
            <span>AI Add-Ons</span>
          </NavLink>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2">
        {!isOnPartnerPage && (
          <div className="px-4 pt-1 pb-1">
            <p className="font-mulish text-xs text-stone uppercase tracking-wide">Screens</p>
          </div>
        )}
        {ownerScreens.map((screen) => {
          const requiredRank = TIER_RANK[screen.tier] || 0;
          const locked = userRank < requiredRank;
          const route = SCREEN_ROUTES[screen.id];

          return (
            <NavLink
              key={screen.id}
              to={`/app/${route}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-mulish transition-colors
                ${isActive
                  ? 'bg-orange/10 text-orange border-r-2 border-orange'
                  : 'text-stone hover:text-white hover:bg-white/5'
                }
                ${locked ? 'opacity-50' : ''}`
              }
            >
              <span className="w-5 text-center font-sora text-xs">{locked ? '🔒' : screen.id}</span>
              <span className="truncate">{screen.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 py-2">
        <NavLink
          to="/app/integrations"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 text-sm font-mulish transition-colors
            ${isActive ? 'bg-orange/10 text-orange border-r-2 border-orange' : 'text-stone hover:text-white hover:bg-white/5'}`
          }
        >
          <span className="w-5 text-center font-sora text-xs">🔗</span>
          <span>Integrations</span>
        </NavLink>
      </div>

      <div className="p-4 border-t border-white/10 space-y-2">
        {nextUpgrade && !isPartner && (
          <button
            onClick={async () => {
              try {
                const { api } = await import('../utils/api.js');
                const data = await api.post('/auth/demo-upgrade', { tier: nextUpgrade.tier });
                const { useAuth } = await import('../hooks/useAuth.js');
                window.location.reload();
              } catch {
                // fallback to stripe
              }
            }}
            className="btn-primary w-full text-sm py-2"
          >
            Upgrade to {nextUpgrade.label}. {nextUpgrade.price}
          </button>
        )}
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="btn-ghost text-xs w-full text-center"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
