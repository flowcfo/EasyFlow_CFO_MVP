import { useState } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import AuthLayout, { SUPPORT_EMAIL } from '../components/AuthLayout.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, login } = useAuth();

  const next = searchParams.get('next');
  const showClosedBanner = searchParams.get('closed') === '1';

  if (user) {
    const dest =
      user.user_type === 'partner'
        ? '/partner/dashboard'
        : next || '/app/dashboard';
    return <Navigate to={dest} replace />;
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await login(email, password);
      if (data.user?.user_type === 'partner') {
        navigate('/partner/dashboard', { replace: true });
      } else {
        navigate(next || '/app/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="text-center mb-6">
        <h1 className="font-sora text-2xl font-bold text-navy tracking-tight">
          EasyFlow CFO
        </h1>
        <p className="font-mulish text-xs text-stone mt-1">
          Your Numbers Made Easy.
        </p>
      </div>

      {showClosedBanner && (
        <div className="mb-6 rounded-lg bg-navy/5 border border-navy/10 px-4 py-3">
          <p className="font-mulish text-sm text-navy font-semibold">
            EasyFlow CFO accounts are created by your CFO.
          </p>
          <p className="font-mulish text-xs text-stone mt-1">
            Contact us to get started.
          </p>
          <a
            href="https://calendly.com/easyflowcfo/intro"
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 font-mulish text-xs font-semibold text-navy underline underline-offset-2"
          >
            Book a call
          </a>
        </div>
      )}

      <div className="text-center mb-6">
        <h2 className="font-sora text-xl font-bold text-navy">Welcome back.</h2>
        <p className="font-mulish text-sm text-stone mt-1">
          Sign in to your client dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-mulish text-xs font-semibold text-navy mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
            className="w-full bg-white text-navy font-mulish rounded-lg py-2.5 px-3 outline-none border border-stone/40 focus:border-navy focus:ring-2 focus:ring-navy/10 transition"
            required
          />
        </div>

        <div>
          <label className="block font-mulish text-xs font-semibold text-navy mb-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-white text-navy font-mulish rounded-lg py-2.5 px-3 pr-16 outline-none border border-stone/40 focus:border-navy focus:ring-2 focus:ring-navy/10 transition"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 font-mulish text-xs font-semibold text-stone hover:text-navy px-2 py-1"
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <p className="font-mulish text-sm text-red-600 bg-red-50 border border-red-100 rounded-md py-2 px-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-navy hover:bg-[#1a2f4f] disabled:opacity-60 text-white font-sora font-semibold py-2.5 rounded-lg transition"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="text-center">
          <Link
            to="/forgot-password"
            className="font-mulish text-sm text-navy hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </form>

      <hr className="my-6 border-stone/20" />

      <p className="font-mulish text-xs text-stone text-center">
        Need access?{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=EasyFlow%20CFO%20account%20request`}
          className="text-navy font-semibold hover:underline"
        >
          Contact your CFO.
        </a>
      </p>
    </AuthLayout>
  );
}
