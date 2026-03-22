import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { formatCurrency } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';

const COLORS = ['#eab308', '#3b82f6', '#22c55e', '#F05001'];

export default function FourForcesAllocator() {
  const { outputs, loading } = useSnapshot();

  if (loading || !outputs) return <SkeletonCard count={2} />;

  const ff = outputs.fourForces;

  const forces = [
    { name: 'Tax Reserve', value: Math.max(0, ff.force1_tax_reserve), monthly: ff.force1_monthly, color: COLORS[0] },
    { name: 'Debt Service', value: Math.max(0, ff.force2_debt_service), monthly: ff.force2_monthly, color: COLORS[1] },
    { name: 'Core Capital', value: Math.max(0, ff.force3_core_capital), monthly: ff.force3_monthly, color: COLORS[2] },
    { name: 'Distribution', value: Math.max(0, ff.force4_distribution), monthly: ff.force4_monthly, color: COLORS[3] },
  ];

  const pieData = forces.filter((f) => f.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="font-sora text-2xl font-bold text-white">Four Forces Cash Allocator</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card-dark flex items-center justify-center">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-mulish text-stone">No positive cash flow to allocate.</p>
          )}
        </div>

        <div className="space-y-3">
          {forces.map((force) => (
            <div
              key={force.name}
              className={`card-dark border-l-4 ${force.name === 'Distribution' && ff.distribution_negative ? 'border-status-red' : ''}`}
              style={{ borderLeftColor: force.name === 'Distribution' && ff.distribution_negative ? '#ef4444' : force.color }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-sora text-sm font-semibold text-white">{force.name}</h3>
                  <p className="font-sora text-xl text-white font-bold">{formatCurrency(force.value)}</p>
                  <p className="font-mulish text-xs text-stone">{formatCurrency(force.monthly)}/month</p>
                </div>
              </div>

              {force.name === 'Distribution' && ff.distribution_negative && (
                <p className="font-mulish text-xs text-status-red mt-2">
                  Cannot distribute. Build Tier first.
                </p>
              )}

              {force.name === 'Core Capital' && (
                <p className="font-mulish text-xs text-stone mt-2">
                  Covers {ff.core_capital_months_covered.toFixed(1)} months of operating expenses.
                  Target: {ff.core_capital_target_months} months minimum.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card-dark">
        <p className="font-mulish text-sm text-stone">Operating Cash Flow</p>
        <p className="font-sora text-2xl text-white font-bold">{formatCurrency(ff.operating_cash_flow)}</p>
      </div>
    </div>
  );
}
