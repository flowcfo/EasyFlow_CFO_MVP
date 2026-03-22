import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { useAuth } from '../hooks/useAuth.js';
import { formatCurrency, formatPercent } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';
import SnapshotEmptyState from '../components/SnapshotEmptyState.jsx';

export default function OwnerPayGap() {
  const navigate = useNavigate();
  const { outputs, loading, error, calculate, inputs } = useSnapshot();
  const { user } = useAuth();

  if (loading && !outputs) {
    return <SkeletonCard />;
  }

  if (!outputs) {
    return (
      <SnapshotEmptyState
        error={error}
        onRetry={() => calculate(inputs, 'Retry', 'annual')}
      />
    );
  }

  const gap = outputs.ownerPayGap;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="card-dark text-center py-10">
        <p className="font-mulish text-sm text-stone mb-4">You are leaving this amount per year on the table.</p>
        <motion.p
          className="font-sora text-5xl md:text-6xl font-bold text-status-red"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {formatCurrency(Math.abs(gap.owner_pay_gap))}
        </motion.p>
        <p className="font-mulish text-stone mt-3">
          That is {formatCurrency(Math.abs(gap.monthly_gap))} per month.
        </p>
      </div>

      <div className="card-dark">
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-white/10">
            <span className="font-mulish text-stone-light">Current Total Comp</span>
            <span className="font-sora text-white">{formatCurrency(gap.current_total_owner_pay)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-white/10">
            <span className="font-mulish text-stone-light">Market Rate Wage</span>
            <span className="font-sora text-white">{formatCurrency(gap.target_market_wage)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-white/10">
            <span className="font-mulish text-stone-light">10% Profit Share</span>
            <span className="font-sora text-white">{formatCurrency(gap.target_revenue_distribution)}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="font-mulish text-white font-semibold">Target Total Comp</span>
            <span className="font-sora text-orange font-bold text-lg">{formatCurrency(gap.target_total_owner_comp)}</span>
          </div>
        </div>
      </div>

      <div className="card-dark text-center py-4">
        <p className="font-mulish text-sm text-stone mb-1">Gap as percent of target</p>
        <p className="font-sora text-2xl text-status-red font-bold">{formatPercent(gap.gap_pct)}</p>
      </div>

      {user?.tier === 'free' ? (
        <div className="card-dark text-center py-8">
          <p className="font-mulish text-stone mb-4">See how to close this gap.</p>
          <button
            onClick={async () => {
              try {
                const { api } = await import('../utils/api.js');
                const data = await api.post('/stripe/checkout', { tier: 'clarity' });
                if (data.url) window.location.href = data.url;
              } catch {
                navigate('/app/dashboard');
              }
            }}
            className="btn-primary px-8 py-3"
          >
            Unlock Clarity. $19.99/month
          </button>
          <p className="font-mulish text-xs text-stone mt-3">
            90 days. A different story. Or your money back. No questions asked.
          </p>
        </div>
      ) : (
        <button
          onClick={() => navigate('/app/pay-roadmap')}
          className="btn-primary w-full py-3"
        >
          See Your Owner Pay Raise Roadmap
        </button>
      )}
    </div>
  );
}
