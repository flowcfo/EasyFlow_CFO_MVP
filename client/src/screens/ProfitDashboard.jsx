import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { useGame } from '../hooks/useGame.js';
import { useAuth } from '../hooks/useAuth.js';
import ProfitGauge from '../components/ProfitGauge.jsx';
import TierBadge from '../components/TierBadge.jsx';
import AnimatedCounter from '../components/AnimatedCounter.jsx';
import CircularGauge from '../components/CircularGauge.jsx';
import WaterfallRow from '../components/WaterfallRow.jsx';
import FixQueueCard from '../components/FixQueueCard.jsx';
import UnlockMap from '../components/UnlockMap.jsx';
import AIChatPanel from '../components/AIChatPanel.jsx';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';
import SnapshotEmptyState from '../components/SnapshotEmptyState.jsx';
import { formatCurrency, formatPercent } from '../utils/format.js';

export default function ProfitDashboard() {
  const { outputs, interpretation, loading, error, calculate, inputs } = useSnapshot();
  const { gameProgress, completeAction } = useGame();
  const { user } = useAuth();

  if (loading && !outputs) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!outputs) {
    return (
      <SnapshotEmptyState
        error={error}
        onRetry={() => calculate(inputs, 'Retry', 'annual')}
      />
    );
  }

  const w = outputs.waterfall;
  const r = outputs.ratios;
  const tier = outputs.profitTier;
  const score = outputs.profitScore;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Revenue', value: w.total_revenue },
          { label: 'Gross Margin', value: w.gross_margin },
          { label: 'Contribution Margin', value: w.contribution_margin },
          { label: 'Pretax Profit', value: w.pretax_net_income, highlight: true },
        ].map((item) => (
          <motion.div
            key={item.label}
            className={`card-dark text-center ${item.highlight ? 'border-orange/30' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="font-mulish text-xs text-stone mb-1">{item.label}</p>
            <AnimatedCounter
              value={item.value}
              prefix="$"
              className={`font-sora text-xl font-bold ${item.value >= 0 ? 'text-white' : 'text-status-red'}`}
            />
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <div className="card-dark flex flex-col items-center py-8">
            <ProfitGauge score={score.total_score} animated />
            <div className="mt-4">
              <TierBadge tier={tier.tier} large animated />
            </div>
            {interpretation && (
              <motion.p
                className="font-mulish text-sm text-stone-light text-center max-w-md mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
              >
                {interpretation.text}
              </motion.p>
            )}
          </div>

          <div className="card-dark">
            <h3 className="font-sora text-lg font-semibold text-white mb-4">P&L Waterfall</h3>
            <div className="space-y-1">
              <WaterfallRow label="Revenue" value={w.total_revenue} percent={1} bold />
              <WaterfallRow label="Cost of Goods Sold" value={-w.total_cogs} percent={w.cogs_pct} indent={1} />
              <WaterfallRow label="Gross Margin" value={w.gross_margin} percent={w.gm_pct} bold highlight />
              <WaterfallRow label="Owner Direct Labor" value={-w.owner_direct_labor} indent={1} />
              <WaterfallRow label="Employee Direct Labor" value={-w.employee_direct_labor} indent={1} />
              <WaterfallRow label="Subcontractors" value={-w.subcontractors} indent={1} />
              <WaterfallRow label="Contribution Margin" value={w.contribution_margin} percent={w.cm_pct} bold highlight />
              <WaterfallRow label="Marketing" value={-w.total_marketing} indent={1} />
              <WaterfallRow label="Owner Management Wage" value={-w.owner_management_wage} indent={1} />
              <WaterfallRow label="Operating Expenses" value={-w.total_opex} indent={1} />
              <WaterfallRow label="Pretax Net Income" value={w.pretax_net_income} percent={w.pretax_pct} bold highlight />
              <WaterfallRow label="Estimated Tax" value={-w.estimated_tax} indent={1} />
              <WaterfallRow label="Post-Tax Cash Flow" value={w.post_tax_cash_flow} bold />
            </div>
          </div>

          <div className="card-dark">
            <h3 className="font-sora text-lg font-semibold text-white mb-4">Productivity Ratios</h3>
            <div className="flex justify-around">
              <CircularGauge value={r.direct_lpr} max={5} status={r.direct_lpr_status} label="Direct LPR" />
              <CircularGauge value={r.mpr} max={10} status={r.mpr_status} label="MPR" />
              <CircularGauge value={r.manpr} max={2} status={r.manpr_status} label="ManPR" />
            </div>
          </div>

          <div className="card-dark">
            <h3 className="font-sora text-sm font-semibold text-white mb-2">Profit Score</h3>
            <p className="font-sora text-3xl text-orange font-bold">{score.total_score}<span className="text-sm text-stone"> / 100</span></p>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-4">
          {gameProgress?.fix_queue?.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-sora text-sm font-semibold text-white">Fix Queue</h3>
              {gameProgress.fix_queue.map((action, i) => (
                <FixQueueCard key={i} action={action} index={i} onComplete={completeAction} />
              ))}
            </div>
          )}

          {user?.tier === 'free' && (
            <div className="card-dark">
              <h3 className="font-sora text-sm text-white mb-3">Unlock all 14 screens</h3>
              <UnlockMap />
            </div>
          )}
        </div>
      </div>

      {(['control', 'harvest', 'partner_starter', 'partner_growth', 'partner_scale'].includes(user?.tier)) && (
        <AIChatPanel snapshotId={null} snapshotOutputs={outputs} />
      )}
    </div>
  );
}
