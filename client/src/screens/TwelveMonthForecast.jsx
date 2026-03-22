import { useState, useMemo } from 'react';
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, CartesianGrid, ReferenceLine,
} from 'recharts';
import { useSnapshot } from '../hooks/useSnapshot.js';
import SliderInput from '../components/SliderInput.jsx';
import { formatCurrency, formatCompact, formatPercent } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { buildCalendarRollingPeriods, priorYearEndKey } from '../utils/calendarRolling12.js';

const FIELDS = ['revenue', 'gross_margin', 'contribution_margin', 'pretax'];
const FIELD_LABELS = {
  revenue: 'Revenue',
  gross_margin: 'Gross Margin',
  contribution_margin: 'Contribution Margin',
  pretax: 'Pretax Profit',
};

function safeDivide(a, b) {
  return b && b !== 0 ? a / b : 0;
}

/** Calendar TTM: 12 consecutive months; gaps count as $0. YoY = same calendar month-end, prior year. */
function buildRolling12(history) {
  return buildCalendarRollingPeriods(history);
}

function buildTrendForecast(history, waterfall, inputs, growthOverride) {
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hasHistory = history && Object.keys(history).length >= 3;

  if (!hasHistory) {
    return buildFlatForecast(waterfall, inputs, growthOverride || 0);
  }

  const keys = Object.keys(history).sort();

  // Trends: average month-over-month growth rate per field
  const fields = ['revenue', 'cogs', 'employee_direct_labor', 'subcontractors',
    'marketing', 'owner_management_wage', 'rent', 'insurance',
    'software_subscriptions', 'other_opex'];
  const trends = {};
  const recentKeys = keys.slice(-12);

  for (const f of fields) {
    const vals = recentKeys.map((k) => history[k]?.[f] || 0);
    let totalGrowth = 0;
    let count = 0;
    for (let i = 1; i < vals.length; i++) {
      const prevRev = history[recentKeys[i - 1]]?.revenue ?? 0;
      if (prevRev <= 0) continue;
      if (vals[i - 1] > 0) {
        totalGrowth += (vals[i] - vals[i - 1]) / vals[i - 1];
        count++;
      }
    }
    trends[f] = count > 0 ? totalGrowth / count : 0;
  }

  // Seasonality (needs 24+ months)
  let seasonality = null;
  if (keys.length >= 24) {
    const byMonth = Array.from({ length: 12 }, () => []);
    for (const k of keys) {
      const mo = parseInt(k.split('-')[1]) - 1;
      const val = history[k]?.revenue || 0;
      if (val > 0) byMonth[mo].push(val);
    }
    const monthAvgs = byMonth.map((arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const overallAvg = monthAvgs.reduce((a, b) => a + b, 0) / 12;
    if (overallAvg > 0) {
      seasonality = monthAvgs.map((avg) => avg > 0 ? avg / overallAvg : 1.0);
    }
  }

  // Baseline: last 3 months; prefer months with revenue > 0 (seasonal / closed months)
  const last3 = keys.slice(-3);
  const activeMonths = last3.filter((k) => (history[k]?.revenue ?? 0) > 0);
  const baseKeys = activeMonths.length > 0 ? activeMonths : last3;
  const baseline = {};
  for (const f of fields) {
    baseline[f] = baseKeys.reduce((sum, k) => sum + (history[k]?.[f] || 0), 0) / baseKeys.length;
  }
  baseline.owner_direct_labor = (inputs.owner_direct_labor || 0) / 12;

  // Start month: month after last data
  const lastKey = keys[keys.length - 1];
  let [startYear, startMonth] = lastKey.split('-').map(Number);
  startMonth++;
  if (startMonth > 12) { startMonth = 1; startYear++; }

  const months = [];
  const totals = { revenue: 0, gm: 0, cm: 0, pretax: 0, postTax: 0 };

  for (let i = 0; i < 12; i++) {
    const calMonth = (startMonth - 1 + i) % 12;
    const calYear = startYear + Math.floor((startMonth - 1 + i) / 12);
    const monthLabel = `${MONTH_NAMES[calMonth]} ${calYear}`;

    const gf = (field) => {
      const rate = growthOverride !== null ? growthOverride : (trends[field] || 0);
      return Math.pow(1 + rate, i);
    };
    const sf = seasonality ? seasonality[calMonth] : 1.0;

    const rev = baseline.revenue * gf('revenue') * sf;
    const cogs = baseline.cogs * gf('cogs') * sf;
    const gm = rev - cogs;
    const dl = (baseline.employee_direct_labor * gf('employee_direct_labor')
      + baseline.subcontractors * gf('subcontractors')
      + baseline.owner_direct_labor) * sf;
    const cm = gm - dl;
    const mkt = baseline.marketing * gf('marketing') * sf;
    const opex = (baseline.owner_management_wage + baseline.rent + baseline.insurance
      + baseline.software_subscriptions + baseline.other_opex) * sf;
    const pretax = cm - mkt - opex;

    totals.revenue += rev;
    totals.gm += gm;
    totals.cm += cm;
    totals.pretax += pretax;
    totals.postTax += pretax - (pretax > 0 ? pretax * (inputs.tax_rate || 0.40) : 0);

    months.push({
      month: monthLabel,
      month_num: i + 1,
      revenue: Math.round(rev),
      gross_margin: Math.round(gm),
      contribution_margin: Math.round(cm),
      pretax: Math.round(pretax),
      pretax_pct: safeDivide(pretax, rev),
      type: 'forecast',
    });
  }

  // Historical months for chart overlay
  const historicalMonths = keys.slice(-24).map((k) => {
    const m = history[k];
    const [y, mo] = k.split('-').map(Number);
    const rev = m?.revenue || 0;
    const c = m?.cogs || 0;
    const gm = rev - c;
    const dl = (m?.employee_direct_labor || 0) + (m?.subcontractors || 0) + (m?.owner_direct_labor || 0);
    const cm = gm - dl;
    const mkt = m?.marketing || 0;
    const opx = (m?.owner_management_wage || 0) + (m?.rent || 0) + (m?.insurance || 0)
      + (m?.software_subscriptions || 0) + (m?.other_opex || 0);
    const pretax = cm - mkt - opx;
    return {
      month: `${MONTH_NAMES[mo - 1]} ${y}`,
      revenue: Math.round(rev),
      gross_margin: Math.round(gm),
      contribution_margin: Math.round(cm),
      pretax: Math.round(pretax),
      pretax_pct: safeDivide(pretax, rev),
      type: 'actual',
    };
  });

  const be = months.findIndex((m) => m.pretax_pct >= 0.10);

  return {
    months,
    historicalMonths,
    totals,
    trends,
    seasonality,
    breakeven_month: be >= 0 ? be + 1 : null,
    dataMonths: keys.length,
    forecastStart: `${MONTH_NAMES[startMonth - 1]} ${startYear}`,
  };
}

function buildFlatForecast(waterfall, inputs, growthRate) {
  const cogs_pct = waterfall.cogs_pct;
  const laborRatio = safeDivide(waterfall.total_direct_labor, waterfall.gross_margin);
  const mkt = waterfall.total_marketing / 12;
  const opex = waterfall.total_opex / 12;
  const months = [];
  const totals = { revenue: 0, gm: 0, cm: 0, pretax: 0, postTax: 0 };

  for (let i = 0; i < 12; i++) {
    const gf = Math.pow(1 + growthRate, i);
    const rev = (waterfall.total_revenue / 12) * gf;
    const c = rev * cogs_pct;
    const gm = rev - c;
    const dl = gm * laborRatio;
    const cm = gm - dl;
    const pretax = cm - mkt - opex;

    totals.revenue += rev;
    totals.gm += gm;
    totals.cm += cm;
    totals.pretax += pretax;
    totals.postTax += pretax - (pretax > 0 ? pretax * (inputs.tax_rate || 0.40) : 0);

    months.push({
      month: `M${i + 1}`,
      month_num: i + 1,
      revenue: Math.round(rev),
      gross_margin: Math.round(gm),
      contribution_margin: Math.round(cm),
      pretax: Math.round(pretax),
      pretax_pct: safeDivide(pretax, rev),
      type: 'forecast',
    });
  }

  const be = months.findIndex((m) => m.pretax_pct >= 0.10);

  return {
    months,
    historicalMonths: [],
    totals,
    trends: null,
    seasonality: null,
    breakeven_month: be >= 0 ? be + 1 : null,
    dataMonths: 0,
    forecastStart: null,
  };
}

function TrendBadge({ value, label }) {
  const isPositive = value > 0;
  const color = isPositive ? 'text-status-green' : value < 0 ? 'text-red-400' : 'text-stone';
  const arrow = isPositive ? '\u2191' : value < 0 ? '\u2193' : '\u2192';
  return (
    <div className="flex items-center gap-1">
      <span className={`font-sora text-sm font-bold ${color}`}>
        {arrow} {(Math.abs(value) * 100).toFixed(1)}%
      </span>
      <span className="text-stone text-xs font-mulish">{label}</span>
    </div>
  );
}

function Rolling12Table({ periods }) {
  if (!periods || periods.length < 2) return null;

  const latest = periods[periods.length - 1];
  const prev = periods[periods.length - 2];

  const yoyPeriod = periods.find((p) => p.end === priorYearEndKey(latest.end)) ?? null;

  const rows = [
    { label: 'Revenue', field: 'revenue' },
    { label: 'Gross Margin', field: 'gross_margin' },
    { label: 'Contribution Margin', field: 'contribution_margin' },
    { label: 'Marketing', field: 'marketing' },
    { label: 'OpEx', field: 'opex' },
    { label: 'Pretax Profit', field: 'pretax' },
    { label: 'Pretax Margin', field: 'pretax_pct', isPercent: true },
  ];

  return (
    <div className="card-dark">
      <h3 className="font-sora text-lg font-bold text-white mb-1">Rolling 12-Month Comparison</h3>
      <p className="font-mulish text-xs text-stone mb-4">
        TTM uses 12 consecutive calendar months (missing months count as $0). YoY compares to the same month-end one year earlier.
        {latest.months_with_revenue != null && (
          <span> Active revenue months in latest TTM: {latest.months_with_revenue}/12.</span>
        )}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left font-mulish text-stone pb-2"></th>
              {yoyPeriod && (
                <th className="text-right font-mulish text-stone pb-2 px-2">{yoyPeriod.label}</th>
              )}
              <th className="text-right font-mulish text-stone pb-2 px-2">{prev.label}</th>
              <th className="text-right font-sora text-orange pb-2 px-2">{latest.label}</th>
              <th className="text-right font-mulish text-stone pb-2 px-2">Change</th>
              {yoyPeriod && (
                <th className="text-right font-mulish text-stone pb-2 px-2">YoY</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, field, isPercent }) => {
              const latestVal = latest[field];
              const prevVal = prev[field];
              const yoyVal = yoyPeriod?.[field];
              const change = prevVal ? (latestVal - prevVal) / Math.abs(prevVal) : 0;
              const yoyChange = yoyVal ? (latestVal - yoyVal) / Math.abs(yoyVal) : 0;
              const changeColor = change > 0.01 ? 'text-status-green' : change < -0.01 ? 'text-red-400' : 'text-stone';
              const yoyColor = yoyChange > 0.01 ? 'text-status-green' : yoyChange < -0.01 ? 'text-red-400' : 'text-stone';
              const fmt = isPercent ? formatPercent : formatCompact;

              return (
                <tr key={field} className="border-t border-white/5">
                  <td className="font-mulish text-stone-light py-2">{label}</td>
                  {yoyPeriod && (
                    <td className="text-right font-sora text-white/60 py-2 px-2">{fmt(yoyVal)}</td>
                  )}
                  <td className="text-right font-sora text-white/80 py-2 px-2">{fmt(prevVal)}</td>
                  <td className="text-right font-sora text-white font-bold py-2 px-2">{fmt(latestVal)}</td>
                  <td className={`text-right font-sora py-2 px-2 ${changeColor}`}>
                    {!isPercent && (change > 0 ? '+' : '')}{(change * 100).toFixed(1)}%
                  </td>
                  {yoyPeriod && (
                    <td className={`text-right font-sora py-2 px-2 ${yoyColor}`}>
                      {!isPercent && (yoyChange > 0 ? '+' : '')}{(yoyChange * 100).toFixed(1)}%
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TwelveMonthForecast() {
  const { outputs, loading, inputs, monthlyHistory } = useSnapshot();
  const [growthRate, setGrowthRate] = useState(null);
  const [useManualGrowth, setUseManualGrowth] = useState(false);
  const [activeTab, setActiveTab] = useState('forecast');

  const hasHistory = monthlyHistory && Object.keys(monthlyHistory).length >= 3;

  const forecast = useMemo(() => {
    if (!outputs) return null;
    const override = useManualGrowth ? growthRate : null;
    return buildTrendForecast(monthlyHistory, outputs.waterfall, inputs, override);
  }, [outputs, inputs, monthlyHistory, growthRate, useManualGrowth]);

  const rolling12 = useMemo(() => {
    return buildRolling12(monthlyHistory);
  }, [monthlyHistory]);

  if (loading || !outputs || !forecast) return <SkeletonCard count={2} />;

  const chartData = [...forecast.historicalMonths, ...forecast.months];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-sora text-2xl font-bold text-white">12-Month Forecast</h1>
        {hasHistory && (
          <span className="font-mulish text-xs text-stone bg-white/5 px-3 py-1 rounded-full">
            {forecast.dataMonths} months of history
            {forecast.seasonality ? ' (seasonal)' : ''}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-4 py-2 rounded-lg font-mulish text-sm transition-colors ${
            activeTab === 'forecast' ? 'bg-orange text-white' : 'bg-white/5 text-stone hover:text-white'
          }`}
        >
          Forecast
        </button>
        {rolling12.length >= 2 && (
          <button
            onClick={() => setActiveTab('rolling')}
            className={`px-4 py-2 rounded-lg font-mulish text-sm transition-colors ${
              activeTab === 'rolling' ? 'bg-orange text-white' : 'bg-white/5 text-stone hover:text-white'
            }`}
          >
            Rolling 12 Comparison
          </button>
        )}
        {hasHistory && (
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-2 rounded-lg font-mulish text-sm transition-colors ${
              activeTab === 'trends' ? 'bg-orange text-white' : 'bg-white/5 text-stone hover:text-white'
            }`}
          >
            Trend Analysis
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'forecast' && (
          <motion.div
            key="forecast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Growth controls */}
            <div className="card-dark space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-sora text-sm font-bold text-white">Growth Assumption</h3>
                {hasHistory && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useManualGrowth}
                      onChange={(e) => {
                        setUseManualGrowth(e.target.checked);
                        if (e.target.checked && growthRate === null) setGrowthRate(0);
                      }}
                      className="accent-orange"
                    />
                    <span className="font-mulish text-xs text-stone">Override trend with manual rate</span>
                  </label>
                )}
              </div>

              {hasHistory && !useManualGrowth && forecast.trends && (
                <div className="flex flex-wrap gap-4">
                  <TrendBadge value={forecast.trends.revenue || 0} label="Revenue trend/mo" />
                  <TrendBadge value={forecast.trends.cogs || 0} label="COGS trend/mo" />
                  <TrendBadge value={forecast.trends.marketing || 0} label="Marketing trend/mo" />
                </div>
              )}

              {(!hasHistory || useManualGrowth) && (
                <SliderInput
                  label="Monthly Growth Rate"
                  value={growthRate || 0}
                  onChange={(v) => setGrowthRate(v)}
                  min={-0.20}
                  max={0.50}
                  step={0.01}
                  formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                />
              )}

              {hasHistory && forecast.forecastStart && (
                <p className="font-mulish text-xs text-stone">
                  Forecast starts {forecast.forecastStart}, based on {forecast.dataMonths} months of historical data.
                  {forecast.seasonality ? ' Seasonal patterns detected and applied.' : ''}
                </p>
              )}
            </div>

            {/* Chart: Historical + Forecast */}
            <div className="card-dark">
              <h3 className="font-sora text-sm font-bold text-white mb-3">
                {hasHistory ? 'Actual vs Forecast' : 'Projected Revenue & Profit'}
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="month"
                    stroke="#8A8278"
                    fontSize={10}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={chartData.length > 24 ? 2 : 0}
                  />
                  <YAxis stroke="#8A8278" fontSize={10} tickFormatter={(v) => formatCompact(v)} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#162844',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: '#fff', fontFamily: 'Sora' }}
                    formatter={(v, name) => [formatCurrency(v), name]}
                  />
                  <Legend />
                  {hasHistory && (
                    <ReferenceLine
                      x={forecast.months[0]?.month}
                      stroke="#F05001"
                      strokeDasharray="4 4"
                      label={{ value: 'Forecast', fill: '#F05001', fontSize: 10 }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#F05001"
                    fill="#F0500120"
                    name="Revenue"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="pretax"
                    stroke="#22c55e"
                    fill="#22c55e20"
                    name="Pretax Profit"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast table */}
            <div className="card-dark overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left font-mulish text-stone pb-2"></th>
                    {forecast.months.map((m) => (
                      <th
                        key={m.month}
                        className={`text-right font-sora pb-2 px-1 ${
                          forecast.breakeven_month === m.month_num ? 'text-orange' : 'text-white'
                        }`}
                      >
                        {m.month}
                      </th>
                    ))}
                    <th className="text-right font-sora text-orange pb-2 px-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((key) => (
                    <tr key={key} className="border-t border-white/5">
                      <td className="font-mulish text-stone-light py-1.5 whitespace-nowrap">
                        {FIELD_LABELS[key]}
                      </td>
                      {forecast.months.map((m) => (
                        <td key={m.month} className="text-right font-sora text-white py-1.5 px-1">
                          {formatCompact(m[key])}
                        </td>
                      ))}
                      <td className="text-right font-sora text-orange font-bold py-1.5 px-1">
                        {formatCompact(
                          forecast.totals[key === 'pretax' ? 'pretax' : key === 'gross_margin' ? 'gm' : key === 'contribution_margin' ? 'cm' : 'revenue']
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/10">
                    <td className="font-mulish text-stone-light py-1.5">Pretax %</td>
                    {forecast.months.map((m) => {
                      const pct = m.pretax_pct;
                      const color = pct >= 0.10 ? 'text-status-green' : pct >= 0 ? 'text-yellow-400' : 'text-red-400';
                      return (
                        <td key={m.month} className={`text-right font-sora py-1.5 px-1 ${color}`}>
                          {formatPercent(pct)}
                        </td>
                      );
                    })}
                    <td className="text-right font-sora text-orange font-bold py-1.5 px-1">
                      {formatPercent(safeDivide(forecast.totals.pretax, forecast.totals.revenue))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="Forecast Revenue"
                value={formatCompact(forecast.totals.revenue)}
                sub="Next 12 months"
              />
              <SummaryCard
                label="Forecast Profit"
                value={formatCompact(forecast.totals.pretax)}
                sub={formatPercent(safeDivide(forecast.totals.pretax, forecast.totals.revenue))}
                isGood={forecast.totals.pretax > 0}
              />
              {forecast.breakeven_month && (
                <SummaryCard
                  label="10% Profit Target"
                  value={`Month ${forecast.breakeven_month}`}
                  sub={forecast.months[forecast.breakeven_month - 1]?.month || ''}
                  isGood
                />
              )}
              {hasHistory && (
                <SummaryCard
                  label="Data Basis"
                  value={`${forecast.dataMonths} months`}
                  sub={forecast.seasonality ? 'Seasonal patterns applied' : 'Trend-based projection'}
                />
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'rolling' && rolling12.length >= 2 && (
          <motion.div
            key="rolling"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <Rolling12Table periods={rolling12} />

            {/* Rolling 12 chart */}
            <div className="card-dark">
              <h3 className="font-sora text-sm font-bold text-white mb-3">Rolling 12-Month Revenue Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={rolling12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#8A8278" fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="#8A8278" fontSize={10} tickFormatter={(v) => formatCompact(v)} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(v) => formatCurrency(v)}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#F0500140" name="Revenue" />
                  <Line type="monotone" dataKey="pretax" stroke="#22c55e" strokeWidth={2} name="Pretax Profit" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Period-by-period table */}
            <div className="card-dark overflow-x-auto">
              <h3 className="font-sora text-sm font-bold text-white mb-3">All Rolling 12-Month Periods</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left font-mulish text-stone pb-2">Period Ending</th>
                    <th className="text-right font-mulish text-stone pb-2 px-2">Revenue</th>
                    <th className="text-right font-mulish text-stone pb-2 px-2">Gross Margin</th>
                    <th className="text-right font-mulish text-stone pb-2 px-2">Pretax Profit</th>
                    <th className="text-right font-mulish text-stone pb-2 px-2">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {rolling12.map((p, idx) => {
                    const prevP = idx > 0 ? rolling12[idx - 1] : null;
                    const revChange = prevP ? (p.revenue - prevP.revenue) / Math.abs(prevP.revenue) : 0;
                    const profitColor = p.pretax_pct >= 0.10 ? 'text-status-green' : p.pretax_pct >= 0 ? 'text-yellow-400' : 'text-red-400';
                    return (
                      <tr key={p.end} className="border-t border-white/5">
                        <td className="font-mulish text-stone-light py-1.5">{p.label}</td>
                        <td className="text-right font-sora text-white py-1.5 px-2">
                          {formatCompact(p.revenue)}
                          {prevP && (
                            <span className={`ml-1 text-[10px] ${revChange >= 0 ? 'text-status-green' : 'text-red-400'}`}>
                              {revChange >= 0 ? '+' : ''}{(revChange * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="text-right font-sora text-white py-1.5 px-2">{formatCompact(p.gross_margin)}</td>
                        <td className={`text-right font-sora py-1.5 px-2 ${profitColor}`}>{formatCompact(p.pretax)}</td>
                        <td className={`text-right font-sora py-1.5 px-2 ${profitColor}`}>{formatPercent(p.pretax_pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'trends' && hasHistory && (
          <motion.div
            key="trends"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <TrendAnalysis history={monthlyHistory} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({ label, value, sub, isGood }) {
  return (
    <div className="card-dark text-center p-4">
      <p className="font-mulish text-xs text-stone mb-1">{label}</p>
      <p className={`font-sora text-xl font-bold ${isGood ? 'text-status-green' : 'text-white'}`}>{value}</p>
      {sub && <p className="font-mulish text-xs text-stone mt-1">{sub}</p>}
    </div>
  );
}

function TrendAnalysis({ history }) {
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const keys = Object.keys(history).sort();

  // Monthly revenue chart
  const monthlyData = keys.map((k) => {
    const [y, mo] = k.split('-').map(Number);
    const m = history[k];
    return {
      month: `${MONTH_NAMES[mo - 1]} ${y}`,
      revenue: Math.round(m?.revenue || 0),
      pretax: Math.round(
        (m?.revenue || 0) - (m?.cogs || 0)
        - (m?.employee_direct_labor || 0) - (m?.subcontractors || 0) - (m?.owner_direct_labor || 0)
        - (m?.marketing || 0)
        - (m?.owner_management_wage || 0) - (m?.rent || 0) - (m?.insurance || 0)
        - (m?.software_subscriptions || 0) - (m?.other_opex || 0)
      ),
    };
  });

  // Seasonality by calendar month
  const byCalMonth = Array.from({ length: 12 }, () => []);
  for (const k of keys) {
    const mo = parseInt(k.split('-')[1]) - 1;
    byCalMonth[mo].push(history[k]?.revenue || 0);
  }
  const seasonData = MONTH_NAMES.map((name, i) => {
    const vals = byCalMonth[i];
    return {
      month: name,
      avg: vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
      count: vals.length,
    };
  });

  // Year-over-year by calendar month
  const years = [...new Set(keys.map((k) => k.split('-')[0]))].sort();
  const yoyData = MONTH_NAMES.map((name, mo) => {
    const point = { month: name };
    for (const y of years) {
      const key = `${y}-${String(mo + 1).padStart(2, '0')}`;
      point[y] = Math.round(history[key]?.revenue || 0);
    }
    return point;
  });
  const yoyColors = ['#F05001', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Monthly history */}
      <div className="card-dark">
        <h3 className="font-sora text-sm font-bold text-white mb-3">Monthly Revenue History</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" stroke="#8A8278" fontSize={9} angle={-45} textAnchor="end" height={60}
              interval={monthlyData.length > 24 ? 2 : 0} />
            <YAxis stroke="#8A8278" fontSize={10} tickFormatter={(v) => formatCompact(v)} />
            <RechartsTooltip
              contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: '#fff' }}
              formatter={(v) => formatCurrency(v)}
            />
            <Bar dataKey="revenue" fill="#F0500160" name="Revenue" />
            <Line type="monotone" dataKey="pretax" stroke="#22c55e" strokeWidth={2} name="Pretax" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Year-over-year comparison */}
      {years.length >= 2 && (
        <div className="card-dark">
          <h3 className="font-sora text-sm font-bold text-white mb-3">Revenue by Year (Calendar Month)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={yoyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="#8A8278" fontSize={11} />
              <YAxis stroke="#8A8278" fontSize={10} tickFormatter={(v) => formatCompact(v)} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
                formatter={(v) => formatCurrency(v)}
              />
              <Legend />
              {years.map((y, idx) => (
                <Line
                  key={y}
                  type="monotone"
                  dataKey={y}
                  stroke={yoyColors[idx % yoyColors.length]}
                  strokeWidth={idx === years.length - 1 ? 3 : 1.5}
                  name={y}
                  dot={false}
                  opacity={idx === years.length - 1 ? 1 : 0.6}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Seasonality */}
      {keys.length >= 12 && (
        <div className="card-dark">
          <h3 className="font-sora text-sm font-bold text-white mb-3">Seasonal Pattern (Average Revenue by Month)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={seasonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="#8A8278" fontSize={11} />
              <YAxis stroke="#8A8278" fontSize={10} tickFormatter={(v) => formatCompact(v)} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                formatter={(v) => formatCurrency(v)}
              />
              <Bar dataKey="avg" fill="#F05001" name="Avg Revenue" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="font-mulish text-xs text-stone mt-2 text-center">
            Based on {keys.length} months of data across {years.length} year{years.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
