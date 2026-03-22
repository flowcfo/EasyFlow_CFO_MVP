import { useSnapshot } from '../hooks/useSnapshot.js';
import { formatCurrency, formatPercent } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';

export default function OwnerPayRoadmap() {
  const { outputs, loading } = useSnapshot();

  if (loading || !outputs) return <SkeletonCard count={2} />;

  const road = outputs.ownerPayRoadmap;

  return (
    <div className="space-y-6">
      <h1 className="font-sora text-2xl font-bold text-white">Owner Pay Raise Roadmap</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card-dark text-center">
          <p className="font-mulish text-xs text-stone">Current Total Comp</p>
          <p className="font-sora text-xl text-white">{formatCurrency(road.current_total_owner_pay)}</p>
        </div>
        <div className="card-dark text-center">
          <p className="font-mulish text-xs text-stone">Target Total Comp</p>
          <p className="font-sora text-xl text-orange">{formatCurrency(road.target_total_owner_comp)}</p>
        </div>
        <div className="card-dark text-center border-l-4 border-status-red">
          <p className="font-mulish text-xs text-stone">Annual Gap</p>
          <p className="font-sora text-xl text-status-red">{formatCurrency(road.owner_pay_gap)}</p>
        </div>
      </div>

      <div className="card-dark overflow-x-auto">
        <h3 className="font-sora text-sm text-white font-semibold mb-3">12-Month Step Ladder</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Month', 'Cumulative Raise', 'New Monthly Comp', '% of Target', 'Revenue Required'].map((h) => (
                <th key={h} className="text-right font-mulish text-stone pb-2 px-2 first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {road.months.map((m) => (
              <tr key={m.month} className="border-b border-white/5">
                <td className="font-sora text-white py-2 px-2">{m.month}</td>
                <td className="text-right font-sora text-white py-2 px-2">{formatCurrency(m.cumulative_raise)}</td>
                <td className="text-right font-sora text-white py-2 px-2">{formatCurrency(m.new_monthly_comp)}</td>
                <td className="text-right py-2 px-2">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 h-2 bg-navy rounded-full overflow-hidden">
                      <div className="h-full bg-orange rounded-full" style={{ width: `${Math.min(100, m.pct_of_target * 100)}%` }} />
                    </div>
                    <span className="font-sora text-white text-xs">{formatPercent(m.pct_of_target)}</span>
                  </div>
                </td>
                <td className="text-right font-sora text-white py-2 px-2">{formatCurrency(m.revenue_required)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-dark">
        <h3 className="font-sora text-sm text-white font-semibold mb-3">Four Ways to Close the Gap</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-navy rounded-lg p-4">
            <p className="font-mulish text-xs text-stone mb-1">Option 1: Raise Prices</p>
            <p className="font-sora text-lg text-orange">{formatPercent(road.gap_closure_options.price_increase_pct)}</p>
            <p className="font-mulish text-xs text-stone">increase needed</p>
          </div>
          <div className="bg-navy rounded-lg p-4">
            <p className="font-mulish text-xs text-stone mb-1">Option 2: Grow Revenue</p>
            <p className="font-sora text-lg text-orange">{formatCurrency(road.gap_closure_options.additional_revenue)}</p>
            <p className="font-mulish text-xs text-stone">additional revenue needed</p>
          </div>
          <div className="bg-navy rounded-lg p-4">
            <p className="font-mulish text-xs text-stone mb-1">Option 3: Cut Direct Labor</p>
            <p className="font-sora text-lg text-orange">{formatCurrency(road.gap_closure_options.cut_direct_labor)}</p>
            <p className="font-mulish text-xs text-stone">dollar for dollar</p>
          </div>
          <div className="bg-navy rounded-lg p-4">
            <p className="font-mulish text-xs text-stone mb-1">Option 4: Cut Overhead</p>
            <p className="font-sora text-lg text-orange">{formatCurrency(road.gap_closure_options.cut_overhead)}</p>
            <p className="font-mulish text-xs text-stone">dollar for dollar</p>
          </div>
        </div>
      </div>

      <div className="card-dark border-l-4 border-orange">
        <p className="font-mulish text-sm text-stone-light">
          If you hit 10% profit on current revenue, your annual profit would be{' '}
          <span className="text-orange font-sora">{formatCurrency(road.reality_check.annual_profit_at_10pct)}</span>.
          Combined with market wage:{' '}
          <span className="text-orange font-sora">{formatCurrency(road.reality_check.total_owner_value)}</span> total owner value.
          That is{' '}
          <span className="text-orange font-sora">{formatCurrency(road.reality_check.monthly_owner_value)}</span> per month.
        </p>
      </div>
    </div>
  );
}
