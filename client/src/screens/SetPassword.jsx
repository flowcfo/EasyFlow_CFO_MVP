import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import { supabase, syncSupabaseSessionToLocalStorage } from '../lib/supabaseClient.js';

const PASSWORD_RULES = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

export default function SetPassword() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    let mounted = true;

    function readFirstName(session) {
      if (!session) return '';
      const meta = session.user?.user_metadata || {};
      const fromMeta =
        meta.first_name ||
        (typeof meta.full_name === 'string' ? meta.full_name.split(' ')[0] : '') ||
        (typeof meta.name === 'string' ? meta.name.split(' ')[0] : '');
      return fromMeta || '';
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setSessionReady(true);
        setFirstName(readFirstName(data.session));
      } else {
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (!mounted) return;
            if (d2.session) {
              setSessionReady(true);
              setFirstName(readFirstName(d2.session));
            } else {
              setSessionMissing(true);
            }
          });
        }, 600);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
        setSessionMissing(false);
        setFirstName(readFirstName(session));
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (pw1 !== pw2) {
      setError('Passwords do not match.');
      return;
    }
    if (!PASSWORD_RULES.test(pw1)) {
      setError('Password must be at least 10 characters with one number and one symbol.');
      return;
    }
    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: pw1 });
      if (updErr) throw new Error(updErr.message);

      const { data: sess } = await supabase.auth.getSession();
      syncSupabaseSessionToLocalStorage(sess.session);

      // First-time clients land on dashboard so they see the WelcomeCard.
      window.location.replace('/app/game-plan');
    } catch (err) {
      setError(err.message || 'Could not set password.');
      setLoading(false);
    }
  }

  const heading = `Welcome to EasyFlow CFO${firstName ? ', ' + firstName : ''}.`;

  return (
    <AuthLayout>
      <div className="mb-8 flex flex-col items-center">
        <img src="/easyflow-cfo-logo.png" alt="EasyFlow CFO" className="h-14 w-auto" />
        <p className="mt-2 text-sm font-semibold text-slate">Your Numbers Made Easy.</p>
      </div>

      <div className="text-center mb-6">
        <h2 className="font-sora text-xl font-bold text-navy leading-snug">
          {heading}
        </h2>
        <p className="font-mulish text-sm text-slate mt-2">
          Set your password to access your dashboard.
        </p>
      </div>

      {sessionMissing ? (
        <>
          <p className="font-mulish text-sm text-slate text-center">
            This invite link is invalid or has expired. Ask your CFO to resend it.
          </p>
          <Link
            to="/login"
            className="block mt-6 text-center font-mulish text-sm text-navy hover:underline"
          >
            Back to sign in
          </Link>
        </>
      ) : !sessionReady ? (
        <p className="font-mulish text-sm text-slate text-center">
          Verifying invite link...
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField label="Create password" value={pw1} onChange={setPw1} show={show} />
          <PasswordField label="Confirm password" value={pw2} onChange={setPw2} show={show} />

          <div className="flex items-center justify-between">
            <p className="font-mulish text-xs text-slate">
              At least 10 characters, one number, one symbol.
            </p>
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="font-mulish text-xs font-semibold text-slate hover:text-navy"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && (
            <p className="font-mulish text-sm text-red-600 bg-red-50 border border-red-100 rounded-md py-2 px-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Setting password...' : 'Set password & sign in'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

function PasswordField({ label, value, onChange, show }) {
  return (
    <div>
      <label className="block font-mulish text-xs font-semibold text-navy mb-1">
        {label}
      </label>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        className="w-full bg-white text-navy font-mulish rounded-lg py-2.5 px-3 outline-none border border-stone/40 focus:border-navy focus:ring-2 focus:ring-navy/10 transition"
        required
      />
    </div>
  );
}
