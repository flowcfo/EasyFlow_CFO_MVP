import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';

export default function Signup() {
  const navigate = useNavigate();
  const { user, signup } = useAuth();

  if (user) {
    return (
      <Navigate
        to={user.user_type === 'partner' ? '/partner/dashboard' : '/app/input'}
        replace
      />
    );
  }
  const [firstName, setFirstName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signup({
        email,
        password,
        full_name: firstName,
        business_name: businessName,
      });
      navigate('/app/input', { replace: true });
    } catch (err) {
      setError(err.message || 'Signup failed');
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
        <h1 className="font-sora text-3xl font-bold text-orange text-center mb-1">Easy Numbers</h1>
        <p className="font-mulish text-sm text-stone text-center mb-8">
          Create your free account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none
              border border-stone/30 focus:border-orange"
          />
          <input
            type="text"
            placeholder="Business name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
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
            placeholder="Create a password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none
              border border-stone/30 focus:border-orange"
            required
          />

          {error && <p className="text-status-red text-sm font-mulish">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Creating account...' : 'Sign Up Free'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="font-mulish text-sm text-stone">
            Already have an account?{' '}
            <Link to="/login" className="text-orange hover:underline font-semibold">
              Log in
            </Link>
          </p>
          <Link to="/" className="font-mulish text-sm text-stone/60 hover:text-white block">
            &larr; Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
