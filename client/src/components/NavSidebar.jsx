import { NavLink, useNavigate, useLocation, matchPath } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import {
  GamePlanIcon, CashIcon, ToolsIcon, HomeIcon, TargetIcon, PencilIcon,
  ClientsIcon, BrushIcon, ArrowLeftIcon,
} from './Icons.jsx';

// The six client sections, in Nick's menu order (decided Nov 24, 2026).
export const CLIENT_SECTIONS = [
  { path: 'game-plan', label: 'Game Plan', Icon: GamePlanIcon },
  { path: 'cash', label: 'Cash', Icon: CashIcon },
  { path: 'tools', label: 'Tools', Icon: ToolsIcon },
  { path: 'dashboard', label: 'Home', Icon: HomeIcon },
  { path: 'target-vs-actual', label: 'Target vs. Actual', Icon: TargetIcon },
  { path: 'input', label: 'Enter this month', Icon: PencilIcon },
];

const PARTNER_LINKS = [
  { to: '/partner/dashboard', label: 'Clients', Icon: ClientsIcon },
  { to: '/partner/whitelabel', label: 'Brand settings', Icon: BrushIcon },
];

const SUPPORT_EMAIL = 'nick@easyflowcfo.com';

function itemClass({ isActive }) {
  return [
    'flex items-center gap-3 rounded-[10px] px-3.5 py-3 font-body font-semibold whitespace-nowrap transition-colors',
    isActive ? 'bg-cream text-ink' : 'text-navy hover:bg-offwhite',
  ].join(' ');
}

function iconClass(isActive) {
  return `h-5 w-5 flex-none hidden md:block ${isActive ? 'text-flame' : 'text-slate'}`;
}

export default function NavSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isPartner = user?.user_type === 'partner';

  // /partner/client/:clientId/* is Nick's per-client workbench: same six sections, scoped to that client.
  const workbenchMatch = matchPath({ path: '/partner/client/:clientId/*' }, location.pathname);
  const workbenchClientId = workbenchMatch?.params?.clientId || null;
  const screenBase = workbenchClientId ? `/partner/client/${workbenchClientId}` : '/app';
  const showClientSections = !isPartner || Boolean(workbenchClientId) || location.pathname.startsWith('/app');

  return (
    <nav
      aria-label="Main"
      className="sticky top-16 z-20 flex gap-1 overflow-x-auto border-b border-line bg-white px-4 py-2
                 md:top-[76px] md:h-[calc(100vh-76px)] md:w-60 md:flex-none md:flex-col md:overflow-visible
                 md:border-b-0 md:border-r md:px-3 md:py-6"
    >
      {isPartner && !workbenchClientId && PARTNER_LINKS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={itemClass}>
          {({ isActive }) => (<><Icon className={iconClass(isActive)} />{label}</>)}
        </NavLink>
      ))}

      {workbenchClientId && (
        <button
          type="button"
          onClick={() => navigate('/partner/dashboard')}
          className="flex items-center gap-3 rounded-[10px] px-3.5 py-3 font-body font-semibold text-cobalt whitespace-nowrap hover:bg-offwhite"
        >
          <ArrowLeftIcon className="hidden h-5 w-5 flex-none md:block" />
          All clients
        </button>
      )}

      {showClientSections && (
        <>
          {workbenchClientId && (
            <p className="eyebrow hidden px-3.5 pb-1 pt-4 text-ember md:block">Client workbench</p>
          )}
          {CLIENT_SECTIONS.map(({ path, label, Icon }) => (
            <NavLink key={path} to={`${screenBase}/${path}`} className={itemClass}>
              {({ isActive }) => (<><Icon className={iconClass(isActive)} />{label}</>)}
            </NavLink>
          ))}
        </>
      )}

      <div className="hidden flex-1 md:block" />

      {!isPartner && (
        <p className="hidden px-3.5 py-3 text-sm leading-snug text-slate md:block">
          Questions about your numbers?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-cobalt hover:underline">
            Message Nick
          </a>
        </p>
      )}
    </nav>
  );
}
