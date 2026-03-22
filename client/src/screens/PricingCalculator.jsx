import { useState, useMemo } from 'react';
import InputField from '../components/InputField.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatCurrency, formatPercent } from '../utils/format.js';
import { PRICING_MULTIPLIERS } from '../../../shared/constants.js';

export default function PricingCalculator() {
  const [inputs, setInputs] = useState({
    labor_hours: 40,
    hourly_rate: 30,
    materials_cogs: 500,
    target_cm_pct: 0.40,
  });

  function update(name, value) {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }

  const calc = useMemo(() => {
    const dlc = inputs.labor_hours * inputs.hourly_rate;
    const tdc = dlc + inputs.materials_cogs;

    const table = PRICING_MULTIPLIERS.map((m) => {
      const price = tdc * m;
      const gm = price - inputs.materials_cogs;
      const gmPct = price > 0 ? gm / price : 0;
      const cm = price - tdc;
      const cmPct = price > 0 ? cm / price : 0;
      const cmPerHour = inputs.labor_hours > 0 ? cm / inputs.labor_hours : 0;
      return { multiplier: m, price, gm, gmPct, cm, cmPct, cmPerHour, atTarget: cmPct >= inputs.target_cm_pct };
    });

    const reqPrice = inputs.target_cm_pct < 1 ? tdc / (1 - inputs.target_cm_pct) : tdc;
    const impliedMult = tdc > 0 ? reqPrice / tdc : 0;

    return {
      dlc, tdc, table, reqPrice, impliedMult,
      breakeven: tdc,
      minViable: tdc / 0.80,
      targetPrice: tdc / 0.60,
    };
  }, [inputs]);

  return (
    <div className="space-y-6">
      <h1 className="font-sora text-2xl font-bold text-white">Pricing Calculator</h1>

      <div className="card-light">
        <div className="grid md:grid-cols-3 gap-4">
          <InputField label="Labor Hours" name="labor_hours" value={inputs.labor_hours} onChange={update} />
          <InputField label="Fully-Loaded Hourly Rate" name="hourly_rate" value={inputs.hourly_rate} onChange={update} />
          <InputField label="Materials / COGS" name="materials_cogs" value={inputs.materials_cogs} onChange={update} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 text-center">
          <div><p className="font-mulish text-xs text-stone">Direct Labor Cost</p><p className="font-sora text-navy font-bold">{formatCurrency(calc.dlc)}</p></div>
          <div><p className="font-mulish text-xs text-stone">Total Direct Cost</p><p className="font-sora text-navy font-bold">{formatCurrency(calc.tdc)}</p></div>
        </div>
      </div>

      <div className="card-dark overflow-x-auto">
        <h3 className="font-sora text-sm text-white font-semibold mb-3">Multiplier Table</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Mult', 'Price', 'GM', 'GM%', 'CM', 'CM%', 'CM/Hr', ''].map((h) => (
                <th key={h} className="text-right font-mulish text-stone pb-2 px-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calc.table.map((row) => (
              <tr key={row.multiplier} className={`border-b border-white/5 ${row.atTarget ? 'bg-status-green/5' : ''}`}>
                <td className="text-right font-sora text-white py-2 px-2">{row.multiplier}x</td>
                <td className="text-right font-sora text-white py-2 px-2">{formatCurrency(row.price)}</td>
                <td className="text-right font-sora text-white py-2 px-2">{formatCurrency(row.gm)}</td>
                <td className="text-right font-sora text-white py-2 px-2">{formatPercent(row.gmPct)}</td>
                <td className="text-right font-sora text-white py-2 px-2">{formatCurrency(row.cm)}</td>
                <td className="text-right font-sora text-white py-2 px-2">{formatPercent(row.cmPct)}</td>
                <td className="text-right font-sora text-white py-2 px-2">{formatCurrency(row.cmPerHour)}/hr</td>
                <td className="text-right py-2 px-2">
                  <StatusBadge status={row.atTarget ? 'green' : 'red'} label={row.atTarget ? 'TARGET' : 'BELOW'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card-dark">
          <h3 className="font-sora text-sm text-white font-semibold mb-3">Reverse Calculator</h3>
          <InputField label="Target CM%" name="target_cm_pct" value={inputs.target_cm_pct} onChange={update} type="percent" />
          <div className="mt-3 space-y-2">
            <p className="font-mulish text-sm text-stone-light">Required Price: <span className="font-sora text-orange">{formatCurrency(calc.reqPrice)}</span></p>
            <p className="font-mulish text-sm text-stone-light">Implied Multiplier: <span className="font-sora text-orange">{calc.impliedMult.toFixed(2)}x</span></p>
          </div>
        </div>

        <div className="card-dark">
          <h3 className="font-sora text-sm text-white font-semibold mb-3">Danger Zone</h3>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="font-mulish text-status-red text-sm">Breakeven Price</span><span className="font-sora text-white">{formatCurrency(calc.breakeven)}</span></div>
            <div className="flex justify-between"><span className="font-mulish text-status-yellow text-sm">Minimum Viable (20% CM)</span><span className="font-sora text-white">{formatCurrency(calc.minViable)}</span></div>
            <div className="flex justify-between"><span className="font-mulish text-status-green text-sm">Target (40% CM)</span><span className="font-sora text-white">{formatCurrency(calc.targetPrice)}</span></div>
          </div>
        </div>
      </div>

      <div className="card-dark border-l-4 border-orange">
        <p className="font-mulish text-sm text-stone-light">
          Charge at least 2.75x your direct costs. 3x+ is healthy. Under 2.5x means working for free.
        </p>
      </div>
    </div>
  );
}
