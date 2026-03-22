import { useSnapshot } from '../hooks/useSnapshot.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatCurrency } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';

export default function ProfitLeaksFinder() {
  const { outputs, loading } = useSnapshot();

  if (loading || !outputs) return <SkeletonCard count={3} />;

  const r = outputs.ratios;
  const w = outputs.waterfall;

  const jobLeakActive = r.direct_lpr < 2.5 && !r.direct_lpr_is_zero_denom;
  const targetGmFromLabor = w.total_direct_labor * 2.5;
  const jobLeakDollars = jobLeakActive ? Math.max(0, targetGmFromLabor - w.gross_margin) : 0;

  const mktLeakActive = r.mpr < 5.0 && !r.mpr_is_zero_denom;
  const targetGmFromMarketing = w.total_marketing * 5.0;
  const mktLeakDollars = mktLeakActive ? Math.max(0, targetGmFromMarketing - w.gross_margin) : 0;

  const ohLeakActive = r.manpr < 1.0 && !r.manpr_is_zero_denom;
  const ohLeakDollars = ohLeakActive ? Math.max(0, w.total_opex - w.contribution_margin) : 0;

  const totalLeak = jobLeakDollars + mktLeakDollars + ohLeakDollars;

  const leaks = [
    {
      name: 'Job Leak',
      subtitle: 'Direct LPR below 2.5x',
      active: jobLeakActive,
      dollars: jobLeakDollars,
      action: `To fix the Job Leak, raise prices or reduce direct labor by ${formatCurrency(jobLeakDollars)}.`,
      status: r.direct_lpr_status,
    },
    {
      name: 'Marketing Leak',
      subtitle: 'MPR below 5.0x',
      active: mktLeakActive,
      dollars: mktLeakDollars,
      action: `To fix the Marketing Leak, cut underperforming spend or grow revenue by ${formatCurrency(mktLeakDollars)}.`,
      status: r.mpr_status,
    },
    {
      name: 'Overhead Leak',
      subtitle: 'ManPR below 1.0x',
      active: ohLeakActive,
      dollars: ohLeakDollars,
      action: `To fix the Overhead Leak, reduce operating expenses by ${formatCurrency(ohLeakDollars)}.`,
      status: r.manpr_status,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-sora text-2xl font-bold text-white">Profit Leaks Finder</h1>

      <div className="space-y-4">
        {leaks.map((leak) => (
          <div
            key={leak.name}
            className={`card-dark border-l-4 ${leak.active ? 'border-status-red' : 'border-status-green'}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-sora text-lg font-semibold text-white">{leak.name}</h3>
                <p className="font-mulish text-sm text-stone">{leak.subtitle}</p>
              </div>
              <StatusBadge status={leak.active ? 'red' : 'green'} label={leak.active ? 'LEAK' : 'OK'} />
            </div>

            {leak.active ? (
              <>
                <p className="font-sora text-2xl text-status-red font-bold mb-2">
                  {formatCurrency(leak.dollars)}
                </p>
                <p className="font-mulish text-sm text-stone-light">{leak.action}</p>
              </>
            ) : (
              <p className="font-mulish text-sm text-status-green">No leak detected. This ratio is on target.</p>
            )}
          </div>
        ))}
      </div>

      <div className="card-dark border-l-4 border-orange text-center py-6">
        <p className="font-mulish text-sm text-stone mb-1">Total estimated annual leak</p>
        <p className="font-sora text-3xl text-orange font-bold">{formatCurrency(totalLeak)}</p>
      </div>
    </div>
  );
}
