import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      // We always show a neutral confirmation to avoid leaking which emails exist.
      if (resetErr) console.warn('resetPasswordForEmail error:', resetErr.message);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
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

      {submitted ? (
        <>
          <div className="text-center mb-4">
            <h2 className="font-sora text-xl font-bold text-navy">Check your email.</h2>
          </div>
          <p className="font-mulish text-sm text-stone text-center">
            If an account exists for that email, a reset link has been sent.
          </p>
          <Link
            to="/login"
            className="block mt-6 text-center font-mulish text-sm text-navy hover:underline"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <div className="text-center mb-6">
            <h2 className="font-sora text-xl font-bold text-navy">
              Reset your password.
            </h2>
            <p className="font-mulish text-sm text-stone mt-1">
              Enter your email and we'll send you a reset link.
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
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="font-mulish text-sm text-navy hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
