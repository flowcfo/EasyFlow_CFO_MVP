import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';

export default function EmailCapture() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const nextPath = searchParams.get('next') || '/onboard/reveal';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signup({ email, password, full_name: firstName });
      navigate(nextPath);
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
          Where should we send your Profit Score?
        </h2>
        <p className="font-mulish text-sm text-stone text-center mb-8">
          Create your free account to see your results.
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
            {loading ? 'Creating account...' : 'Continue'}
          </button>
        </form>

        <button onClick={() => navigate(-1)} className="btn-ghost w-full mt-3 text-sm text-stone/60 hover:text-white">
          &larr; Back
        </button>
      </motion.div>
    </div>
  );
}
