import { useSnapshot } from '../hooks/useSnapshot.js';
import { formatCurrency, formatPercent } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';

const COLUMN_LABELS = ['Breakeven', '+3% Profit', '+5% Profit', '+10% Profit', '+15% Profit'];

export default function BreakevenCalculator() {
  const { outputs, loading } = useSnapshot();

  if (loading || !outputs) return <SkeletonCard count={2} />;

  const be = outputs.breakeven;

  return (
    <div className="space-y-6">
      <h1 className="font-sora text-2xl font-bold text-white">Breakeven Calculator</h1>

      <p className="font-mulish text-sm text-stone-light mb-4">
        Required monthly = required annual ÷{' '}
        <span className="text-white font-semibold">{be.operating_months_per_year ?? 12}</span> operating months
        (Input Engine → Assumptions). If you are closed part of the year, lower this from 12 so the monthly bar reflects real open months only.
      </p>

      <div className="card-dark overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left font-mulish text-stone pb-3 pr-4"></th>
              {COLUMN_LABELS.map((label, i) => (
                <th key={i} className={`text-right font-sora pb-3 px-2 ${i === 3 ? 'text-orange' : 'text-white'}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/10">
              <td className="font-mulish text-stone-light py-3 pr-4">Required Annual Revenue</td>
              {be.scenarios.map((s, i) => (
                <td key={i} className={`text-right font-sora py-3 px-2 ${i === 3 ? 'text-orange font-bold' : 'text-white'}`}>
                  {s.is_achievable ? formatCurrency(s.required_revenue) : 'N/A'}
                </td>
              ))}
            </tr>
            <tr className="border-t border-white/10">
              <td className="font-mulish text-stone-light py-3 pr-4">Required Monthly Revenue</td>
              {be.scenarios.map((s, i) => (
                <td key={i} className="text-right font-sora py-3 px-2 text-white">
                  {s.is_achievable ? formatCurrency(s.required_monthly) : 'N/A'}
                </td>
              ))}
            </tr>
            <tr className="border-t border-white/10">
              <td className="font-mulish text-stone-light py-3 pr-4">Pretax Profit at Target</td>
              {be.scenarios.map((s, i) => (
                <td key={i} className="text-right font-sora py-3 px-2 text-white">
                  {formatCurrency(s.pretax_profit_at_target)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-white/10">
              <td className="font-mulish text-stone-light py-3 pr-4">Owner Total Comp</td>
              {be.scenarios.map((s, i) => (
                <td key={i} className="text-right font-sora py-3 px-2 text-white">
                  {formatCurrency(s.total_owner_comp)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-white/10">
              <td className="font-mulish text-stone-light py-3 pr-4">Estimated Tax</td>
              {be.scenarios.map((s, i) => (
                <td key={i} className="text-right font-sora py-3 px-2 text-white">
                  {formatCurrency(s.estimated_tax)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-white/10">
              <td className="font-mulish text-white font-semibold py-3 pr-4">After-Tax Owner Cash</td>
              {be.scenarios.map((s, i) => (
                <td key={i} className={`text-right font-sora font-bold py-3 px-2 ${i === 3 ? 'text-orange' : 'text-white'}`}>
                  {formatCurrency(s.after_tax_owner_cash)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card-dark border-l-4 border-orange">
        <p className="font-sora text-sm text-orange font-semibold mb-1">The Breakeven Lie</p>
        <p className="font-mulish text-sm text-stone-light">
          Your CPA breakeven is {formatCurrency(be.cpa_breakeven.required_revenue)}.
          Your True Breakeven is {formatCurrency(be.true_breakeven.required_revenue)}.
          The gap is {formatCurrency(be.breakeven_lie_gap)}.
          Your CPA breakeven excludes your pay. Ours does not.
        </p>
      </div>

      <div className="card-dark">
        <div className="flex items-center gap-3">
          <div className="h-0.5 flex-1 bg-white/10 relative">
            {be.current_revenue > 0 && be.true_breakeven.required_revenue > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange rounded-full border-2 border-white"
                style={{
                  left: `${Math.min(100, (be.current_revenue / be.true_breakeven.required_revenue) * 100)}%`,
                }}
              />
            )}
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="font-mulish text-xs text-stone">$0</span>
          <span className="font-mulish text-xs text-orange">You Are Here: {formatCurrency(be.current_revenue)}</span>
          <span className="font-mulish text-xs text-stone">True BE: {formatCurrency(be.true_breakeven.required_revenue)}</span>
        </div>
      </div>
    </div>
  );
}
