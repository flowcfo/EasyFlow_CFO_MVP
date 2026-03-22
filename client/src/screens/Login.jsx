import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';

export default function Login() {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  if (user) {
    return (
      <Navigate
        to={user.user_type === 'partner' ? '/partner/dashboard' : '/app/dashboard'}
        replace
      />
    );
  }
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
    setLoading(true);
    setError('');
    try {
      const data = await login(email, password);
      if (data.user?.user_type === 'partner') {
        navigate('/partner/dashboard', { replace: true });
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password');
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
          Log in to your account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none
              border border-stone/30 focus:border-orange"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-offwhite text-navy font-mulish rounded-lg py-3 px-4 outline-none
              border border-stone/30 focus:border-orange"
            required
          />

          {error && <p className="text-status-red text-sm font-mulish">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="font-mulish text-sm text-stone">
            Don't have an account?{' '}
            <Link to="/signup" className="text-orange hover:underline font-semibold">
              Sign up
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
