import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

function initials(user) {
  const source = user?.full_name || user?.business_name || user?.email || '';
  const parts = source.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase();
}

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const isPartner = user?.user_type === 'partner';
  const home = isPartner ? '/partner/dashboard' : '/app/game-plan';

  useEffect(() => {
    if (!open) return undefined;
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = isPartner
    ? (user?.full_name || 'EasyFlow CFO')
    : (user?.business_name || user?.full_name || user?.email);
  const subline = isPartner ? 'CFO view' : (user?.business_name ? user?.email : null);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-white px-4 shadow-hairline md:h-[76px] md:px-6">
      <Link to={home} className="flex-none" aria-label="EasyFlow CFO home">
        <img src="/easyflow-cfo-logo.png" alt="EasyFlow CFO" className="h-9 w-auto md:h-[46px]" />
      </Link>

      <div className="ml-auto flex items-center gap-4" ref={menuRef}>
        <div className="hidden text-right leading-tight sm:block">
          <p className="font-body font-bold text-navy">{name}</p>
          {subline && <p className="text-sm text-slate">{subline}</p>}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Account menu"
            className="grid h-10 w-10 place-items-center rounded-full bg-ink font-body text-[15px] font-bold text-white
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-2"
          >
            {initials(user)}
          </button>
          {open && (
            <div role="menu" className="absolute right-0 mt-2 w-60 rounded-xl bg-white p-2 shadow-card ring-1 ring-line">
              <p className="truncate px-3 py-2 text-sm text-slate">{user?.email}</p>
              <button
                role="menuitem"
                type="button"
                onClick={() => { logout(); navigate('/login'); }}
                className="w-full rounded-lg px-3 py-2 text-left font-semibold text-navy hover:bg-offwhite"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
