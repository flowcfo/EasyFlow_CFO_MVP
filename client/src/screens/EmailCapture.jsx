import { useState } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';

export default function EmailCapture() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signup } = useAuth();

  const rawNext = searchParams.get('next') || '/onboard/reveal';
  const isOnboardingPath = rawNext.startsWith('/onboard/');

  // Already logged in — skip this screen
  if (!authLoading && user) {
    const dest = user.user_type === 'partner'
      ? '/partner/dashboard'
      : (isOnboardingPath ? '/app/dashboard' : rawNext);
    return <Navigate to={dest} replace />;
  }

  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await signup({ email, password, full_name: firstName });
      // New signups go to dashboard — uploaded inputs are already in sessionStorage
      // and the auto-calculate will fire once authenticated.
      const dest = data?.user?.user_type === 'partner'
        ? '/partner/dashboard'
        : '/app/dashboard';
      navigate(dest);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="font-sora text-2xl font-bold text-white text-center mb-2">
          Save your Profit Score
        </h2>
        <p className="font-mulish text-sm text-stone text-center mb-8">
          Create a free account to see your results and keep your data.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none
              border border-stone/30 focus:border-orange"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none
              border border-stone/30 focus:border-orange"
            required
          />
          <input
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none
              border border-stone/30 focus:border-orange"
            required
          />

          {error && <p className="text-status-red text-sm font-mulish">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Creating account...' : 'Create free account'}
          </button>
        </form>

        {/* Returning user path — data is preserved in sessionStorage, so login works too */}
        <div className="mt-5 text-center space-y-2">
          <p className="font-mulish text-sm text-stone">
            Already have an account?{' '}
            <Link
              to={`/login?next=/app/dashboard`}
              className="text-orange hover:underline font-semibold"
            >
              Log in instead →
            </Link>
          </p>
          <button
            onClick={() => navigate(-1)}
            className="font-mulish text-sm text-stone/60 hover:text-white transition"
          >
            ← Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}
