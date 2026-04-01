import { useState } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../utils/api.js';

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signup } = useAuth();

  // Role can come from URL (?role=partner) or from the in-page toggle
  const [role, setRole] = useState(searchParams.get('role') === 'partner' ? 'partner' : 'owner');
  const isPartnerSignup = role === 'partner';

  if (user) {
    return (
      <Navigate
        to={user.user_type === 'partner' ? '/partner/dashboard' : '/app/dashboard'}
        replace
      />
    );
  }

  const [firstName, setFirstName] = useState('');
  const [practiceName, setPracticeName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    try {
      await signup({ email, password, full_name: firstName, business_name: practiceName });

      if (isPartnerSignup) {
        // Upgrade to partner_starter, then hard-reload so AuthContext re-fetches
        // /auth/me with the updated user_type before PartnerRoute guards render.
        await api.post('/auth/partner-upgrade', { tier: 'partner_starter' });
        window.location.replace('/partner/dashboard');
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Signup failed');
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
        <h1 className="font-sora text-3xl font-bold text-orange text-center mb-6">Easy Numbers</h1>

        {/* Role toggle */}
        <div className="flex rounded-xl border border-white/10 p-1 mb-6 bg-white/5">
          <button
            type="button"
            onClick={() => { setRole('owner'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg font-sora text-sm font-semibold transition-all ${
              !isPartnerSignup
                ? 'bg-orange text-white shadow'
                : 'text-stone hover:text-white'
            }`}
          >
            Business Owner
          </button>
          <button
            type="button"
            onClick={() => { setRole('partner'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg font-sora text-sm font-semibold transition-all ${
              isPartnerSignup
                ? 'bg-[#10B981] text-white shadow'
                : 'text-stone hover:text-white'
            }`}
          >
            Fractional CFO
          </button>
        </div>

        {isPartnerSignup && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30">
            <p className="font-mulish text-sm text-[#10B981] font-semibold">Fractional CFO account</p>
            <p className="font-mulish text-xs text-stone mt-0.5">
              Client Book, white-label branding, and up to 5 client seats.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Your first name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none border border-stone/30 focus:border-orange"
          />
          <input
            type="text"
            placeholder={isPartnerSignup ? 'Practice or firm name' : 'Business name'}
            value={practiceName}
            onChange={(e) => setPracticeName(e.target.value)}
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none border border-stone/30 focus:border-orange"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none border border-stone/30 focus:border-orange"
            required
          />
          <input
            type="password"
            placeholder="Create a password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none border border-stone/30 focus:border-orange"
            required
          />

          {error && <p className="text-status-red text-sm font-mulish">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading
              ? (isPartnerSignup ? 'Setting up your account...' : 'Creating account...')
              : (isPartnerSignup ? 'Create CFO Account' : 'Sign Up Free')}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="font-mulish text-sm text-stone">
            Already have an account?{' '}
            <Link to="/login" className="text-orange hover:underline font-semibold">Log in</Link>
          </p>
          <Link to="/" className="font-mulish text-sm text-stone/60 hover:text-white block">← Back</Link>
        </div>
      </motion.div>
    </div>
  );
}
