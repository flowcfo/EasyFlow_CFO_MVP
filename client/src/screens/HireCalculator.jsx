import { useState } from 'react';
import { useSnapshot } from '../hooks/useSnapshot.js';
import InputField from '../components/InputField.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatCurrency, formatPercent, formatMultiplier } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';
import { api } from '../utils/api.js';

export default function HireCalculator() {
  const { outputs, loading } = useSnapshot();
  const [hireInputs, setHireInputs] = useState({
    new_employee_annual_wage: 45000,
    benefits_pct: 0.15,
    is_direct_labor: true,
    expected_revenue_enabled: 0,
  });
  const [result, setResult] = useState(null);

  function updateHire(name, value) {
    setHireInputs((prev) => ({ ...prev, [name]: value }));
  }

  async function runCalc() {
    if (!outputs) return;
    // Local calculation matching server logic
    const w = outputs.waterfall;
    const r = outputs.ratios;
    const loaded = hireInputs.new_employee_annual_wage * (1 + hireInputs.benefits_pct);
    const newDL = hireInputs.is_direct_labor ? w.total_direct_labor + loaded : w.total_direct_labor;
    const newOpex = !hireInputs.is_direct_labor ? w.total_opex + loaded : w.total_opex;
    const newRev = w.total_revenue + hireInputs.expected_revenue_enabled;
    const newGM = newRev * w.gm_pct;
    const newLPR = newDL > 0 ? newGM / newDL : 0;
    const newCM = newGM - newDL;
    const newManpr = newOpex > 0 ? newCM / newOpex : 0;
    const newPretax = newCM - w.total_marketing - newOpex;
    const newPretaxPct = newRev > 0 ? newPretax / newRev : 0;

    const failures = [];
    if (newLPR < 2.5) failures.push('Direct LPR below 2.5x');
    if (newManpr < 1.0) failures.push('ManPR below 1.0x');
    if (newPretaxPct < 0.10) failures.push('Pretax profit below 10%');

    const verdict = failures.length === 0 ? 'PASS' : failures.length === 1 ? 'CAUTION' : 'NO';
    const revBE = w.cm_pct > 0 ? loaded / w.cm_pct : 0;
    const revGap = hireInputs.expected_revenue_enabled - revBE;

    setResult({
      loaded_cost: loaded,
      before: { revenue: w.total_revenue, gross_margin: w.gross_margin, direct_labor: w.total_direct_labor, direct_lpr: r.direct_lpr, contribution_margin: w.contribution_margin, opex: w.total_opex, manpr: r.manpr, pretax_profit: w.pretax_net_income, pretax_pct: w.pretax_pct },
      after: { revenue: newRev, gross_margin: newGM, direct_labor: newDL, direct_lpr: newLPR, contribution_margin: newCM, opex: newOpex, manpr: newManpr, pretax_profit: newPretax, pretax_pct: newPretaxPct },
      verdict,
      verdict_reason: failures.join('. ') || 'All metrics meet targets after this hire.',
      revenue_to_breakeven: revBE,
      revenue_gap: revGap,
    });
  }

  if (loading || !outputs) return <SkeletonCard />;

  const verdictColors = { PASS: 'green', CAUTION: 'yellow', NO: 'red' };

  return (
    <div className="space-y-6">
      <h1 className="font-sora text-2xl font-bold text-white">Hire Calculator</h1>

      <div className="card-light">
        <div className="grid md:grid-cols-2 gap-4">
          <InputField label="New Employee Annual Wage" name="new_employee_annual_wage" value={hireInputs.new_employee_annual_wage} onChange={updateHire} />
          <InputField label="Benefits %" name="benefits_pct" value={hireInputs.benefits_pct} onChange={updateHire} type="percent" />
          <div>
            <label className="font-mulish text-sm text-stone-light block mb-2">Role Type</label>
            <div className="flex gap-3">
              <button onClick={() => updateHire('is_direct_labor', true)} className={`flex-1 py-2 rounded-lg font-mulish text-sm ${hireInputs.is_direct_labor ? 'bg-orange text-white' : 'bg-stone/20 text-stone'}`}>
                Direct Labor
              </button>
              <button onClick={() => updateHire('is_direct_labor', false)} className={`flex-1 py-2 rounded-lg font-mulish text-sm ${!hireInputs.is_direct_labor ? 'bg-orange text-white' : 'bg-stone/20 text-stone'}`}>
                Overhead
              </button>
            </div>
          </div>
          <InputField label="Expected Revenue This Hire Enables" name="expected_revenue_enabled" value={hireInputs.expected_revenue_enabled} onChange={updateHire} />
        </div>
        <button onClick={runCalc} className="btn-primary w-full mt-4 py-3" style={{ backgroundColor: '#0E1B2E', color: '#F05001', border: '2px solid #F05001' }}>
          Analyze This Hire
        </button>
      </div>

      {result && (
        <>
          <div className="card-dark text-center py-6">
            <StatusBadge status={verdictColors[result.verdict]} label={result.verdict} />
            <p className="font-mulish text-sm text-stone-light mt-2">{result.verdict_reason}</p>
          </div>

          <div className="card-dark overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left font-mulish text-stone pb-2"></th>
                  <th className="text-right font-sora text-stone pb-2">Before</th>
                  <th className="text-right font-sora text-stone pb-2">After</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(result.before).map((key) => {
                  const isMult = key.includes('lpr') || key === 'manpr';
                  const isPct = key.includes('pct');
                  const fmt = isMult ? formatMultiplier : isPct ? formatPercent : formatCurrency;
                  return (
                    <tr key={key} className="border-b border-white/5">
                      <td className="font-mulish text-stone-light py-2 capitalize">{key.replace(/_/g, ' ')}</td>
                      <td className="text-right font-sora text-white py-2">{fmt(result.before[key])}</td>
                      <td className="text-right font-sora text-white py-2">{fmt(result.after[key])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card-dark text-center">
              <p className="font-mulish text-xs text-stone">Revenue to Breakeven on Hire</p>
              <p className="font-sora text-xl text-white font-bold">{formatCurrency(result.revenue_to_breakeven)}</p>
            </div>
            <div className={`card-dark text-center ${result.revenue_gap >= 0 ? 'border-status-green' : 'border-status-red'} border-l-4`}>
              <p className="font-mulish text-xs text-stone">Revenue Gap</p>
              <p className={`font-sora text-xl font-bold ${result.revenue_gap >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                {formatCurrency(result.revenue_gap)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
