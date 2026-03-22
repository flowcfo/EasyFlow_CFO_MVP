import { useState, useCallback } from 'react';
import { useSnapshot } from '../hooks/useSnapshot.js';
import SliderInput from '../components/SliderInput.jsx';
import TierBadge from '../components/TierBadge.jsx';
import { formatCurrency, formatPercent } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';
import { api } from '../utils/api.js';

const PRESETS = [
  { label: '10% Price Increase', values: { price_increase_pct: 0.10 } },
  { label: '20% Revenue Growth', values: { revenue_change_pct: 0.20 } },
  { label: 'Add One Team Member', values: { direct_labor_change: 55000 } },
  { label: 'Cut COGS 5%', values: { cogs_reduction_pct: 0.05 } },
];

export default function ScenarioModeler() {
  const { outputs, loading } = useSnapshot();
  const [levers, setLevers] = useState({
    revenue_change_pct: 0,
    price_increase_pct: 0,
    cogs_reduction_pct: 0,
    direct_labor_change: 0,
    marketing_change: 0,
    opex_change: 0,
  });
  const [scenarioResult, setScenarioResult] = useState(null);
  const [computing, setComputing] = useState(false);

  const compute = useCallback(async (newLevers) => {
    if (!outputs) return;
    setComputing(true);
    try {
      const data = await api.post('/calc/snapshot', {
        inputs: { ...outputs.waterfall, scenario: newLevers },
      });
      setScenarioResult(data.outputs);
    } catch {
      // fallback: compute locally from waterfall
    }
    setComputing(false);
  }, [outputs]);

  function updateLever(key, value) {
    const updated = { ...levers, [key]: value };
    setLevers(updated);
  }

  function applyPreset(preset) {
    const updated = { ...levers, ...preset.values };
    setLevers(updated);
  }

  if (loading || !outputs) return <SkeletonCard count={2} />;

  const w = outputs.waterfall;

  const sRevenue = w.total_revenue * (1 + levers.revenue_change_pct) * (1 + levers.price_increase_pct);
  const sCogs = sRevenue * (w.cogs_pct * (1 - levers.cogs_reduction_pct));
  const sGM = sRevenue - sCogs;
  const sDL = w.total_direct_labor + levers.direct_labor_change;
  const sCM = sGM - sDL;
  const sMkt = w.total_marketing + levers.marketing_change;
  const sOpex = w.total_opex + levers.opex_change;
  const sPretax = sCM - sMkt - sOpex;
  const sPretaxPct = sRevenue > 0 ? sPretax / sRevenue : 0;

  const scenarioTier = sPretaxPct >= 0.20 ? 5 : sPretaxPct >= 0.10 ? 4 : sPretaxPct >= 0.05 ? 3 : sPretaxPct >= 0 ? 2 : 1;

  const rows = [
    { label: 'Revenue', base: w.total_revenue, scenario: sRevenue },
    { label: 'COGS', base: w.total_cogs, scenario: sCogs },
    { label: 'Gross Margin', base: w.gross_margin, scenario: sGM, bold: true },
    { label: 'Direct Labor', base: w.total_direct_labor, scenario: sDL },
    { label: 'Contribution Margin', base: w.contribution_margin, scenario: sCM, bold: true },
    { label: 'Marketing', base: w.total_marketing, scenario: sMkt },
    { label: 'Operating Expenses', base: w.total_opex, scenario: sOpex },
    { label: 'Pretax Profit', base: w.pretax_net_income, scenario: sPretax, bold: true, highlight: true },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-sora text-2xl font-bold text-white">Scenario Modeler</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)} className="btn-secondary text-xs py-1.5 px-3">
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card-dark space-y-4">
          <h3 className="font-sora text-sm text-white font-semibold">Adjust Levers</h3>
          <SliderInput label="Revenue Change" value={levers.revenue_change_pct} onChange={(v) => updateLever('revenue_change_pct', v)} min={-0.5} max={0.5} step={0.01} formatValue={(v) => `${(v * 100).toFixed(0)}%`} />
          <SliderInput label="Price Increase" value={levers.price_increase_pct} onChange={(v) => updateLever('price_increase_pct', v)} min={0} max={0.5} step={0.01} formatValue={(v) => `${(v * 100).toFixed(0)}%`} />
          <SliderInput label="COGS Reduction" value={levers.cogs_reduction_pct} onChange={(v) => updateLever('cogs_reduction_pct', v)} min={0} max={0.3} step={0.01} formatValue={(v) => `${(v * 100).toFixed(0)}%`} />
          <SliderInput label="Direct Labor Change" value={levers.direct_labor_change} onChange={(v) => updateLever('direct_labor_change', v)} min={-100000} max={200000} step={5000} formatValue={(v) => formatCurrency(v)} />
          <SliderInput label="Marketing Change" value={levers.marketing_change} onChange={(v) => updateLever('marketing_change', v)} min={-50000} max={100000} step={1000} formatValue={(v) => formatCurrency(v)} />
          <SliderInput label="OpEx Change" value={levers.opex_change} onChange={(v) => updateLever('opex_change', v)} min={-100000} max={100000} step={2000} formatValue={(v) => formatCurrency(v)} />
        </div>

        <div className="card-dark">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sora text-sm text-white font-semibold">Baseline vs. Scenario</h3>
            <TierBadge tier={scenarioTier} animated={false} />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left font-mulish text-stone pb-2"></th>
                <th className="text-right font-mulish text-stone pb-2">Baseline</th>
                <th className="text-right font-mulish text-stone pb-2">Scenario</th>
                <th className="text-right font-mulish text-stone pb-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const delta = row.scenario - row.base;
                return (
                  <tr key={row.label} className="border-b border-white/5">
                    <td className={`py-2 font-mulish ${row.bold ? 'text-white font-semibold' : 'text-stone-light'}`}>
                      {row.label}
                    </td>
                    <td className="text-right font-sora text-white py-2">{formatCurrency(row.base)}</td>
                    <td className={`text-right font-sora py-2 ${row.highlight ? 'text-orange' : 'text-white'}`}>
                      {formatCurrency(row.scenario)}
                    </td>
                    <td className={`text-right font-sora py-2 ${delta >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                      {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 text-center">
            <p className="font-mulish text-xs text-stone">Pretax Profit %</p>
            <p className="font-sora text-xl text-orange font-bold">{formatPercent(sPretaxPct)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
