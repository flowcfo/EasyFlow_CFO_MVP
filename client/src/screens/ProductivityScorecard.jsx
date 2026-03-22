import { useSnapshot } from '../hooks/useSnapshot.js';
import CircularGauge from '../components/CircularGauge.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Tooltip from '../components/Tooltip.jsx';
import { formatMultiplier } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';

const RATIO_CONFIG = [
  {
    key: 'direct_lpr',
    label: 'Direct LPR',
    formula: 'Gross Margin / Direct Labor',
    target: '2.5x to 3.5x',
    tooltip: 'Gross Margin divided by Direct Labor. Target 2.5x to 3.5x.',
    maxGauge: 5,
    actionTips: {
      red: 'You are working for free on most jobs. Raise prices or reduce direct labor immediately.',
      yellow: 'Close to target. Review pricing on your lowest-margin jobs.',
      green: 'On target. Maintain current pricing discipline.',
      blue: 'Above target. Possible pricing opportunity. Are you leaving money on the table?',
    },
  },
  {
    key: 'mpr',
    label: 'MPR',
    formula: 'Gross Margin / Marketing',
    target: '5.0x+',
    tooltip: 'Gross Margin divided by Marketing spend. Target 5x or higher.',
    maxGauge: 10,
    actionTips: {
      red: 'Marketing is a significant leak. Cut underperforming channels or redirect spend.',
      yellow: 'Marketing is working but not efficiently. Optimize your top channels.',
      green: 'Marketing is generating solid returns. Scale what works.',
    },
  },
  {
    key: 'manpr',
    label: 'ManPR',
    formula: 'Contribution Margin / Operating Expenses',
    target: '1.0x+',
    tooltip: 'Contribution Margin divided by Operating Expenses. Target 1.0x or higher.',
    maxGauge: 2,
    actionTips: {
      red: 'Overhead is crushing your margins. Cut non-essential expenses.',
      yellow: 'Overhead is close to your capacity. Review all recurring costs.',
      green: 'Overhead is covered by your contribution margin. Well managed.',
    },
  },
];

export default function ProductivityScorecard() {
  const { outputs, loading } = useSnapshot();

  if (loading || !outputs) return <SkeletonCard count={3} />;

  const r = outputs.ratios;

  return (
    <div className="space-y-6">
      <h1 className="font-sora text-2xl font-bold text-white">Productivity Ratio Scorecard</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {RATIO_CONFIG.map((config) => {
          const value = r[config.key];
          const status = r[`${config.key}_status`];
          const isZero = r[`${config.key}_is_zero_denom`];
          const tip = config.actionTips[status] || '';

          return (
            <div key={config.key} className="card-dark flex flex-col items-center text-center">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-sora text-lg font-semibold text-white">{config.label}</h3>
                <Tooltip content={config.tooltip}>
                  <span className="text-stone text-xs cursor-help">(?)</span>
                </Tooltip>
              </div>

              <CircularGauge
                value={isZero ? 0 : value}
                max={config.maxGauge}
                status={status}
                size={120}
              />

              <p className="font-mulish text-xs text-stone mt-3">{config.formula}</p>
              <p className="font-mulish text-xs text-stone">Target: {config.target}</p>

              <div className="mt-3">
                <StatusBadge status={status} />
              </div>

              <p className="font-mulish text-xs text-stone-light mt-3">{tip}</p>
            </div>
          );
        })}
      </div>

      <div className="card-dark text-center">
        <p className="font-mulish text-sm text-stone">Combined Productivity Score</p>
        <p className="font-sora text-3xl text-orange font-bold">
          {outputs.profitScore.components.direct_lpr.score +
            outputs.profitScore.components.mpr.score +
            outputs.profitScore.components.manpr.score}
          <span className="text-sm text-stone"> / 65</span>
        </p>
      </div>
    </div>
  );
}
