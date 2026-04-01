import { useState, useMemo } from 'react';
import {
  ComposedChart, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, ReferenceArea, Legend,
} from 'recharts';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { runForecast } from '../utils/ForecastEngine.js';
import { formatCurrency, formatCompact, formatPercent } from '../utils/format.js';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  navy:   '#0E1B2E',
  orange: '#F05001',
  orangeLight: '#F5813F',
  offWhite: '#F5F3F0',
  stone:  '#8A8278',
  green:  '#2ECC71',
  red:    '#E74C3C',
  yellow: '#F1C40F',
  panel:  '#162236',
  border: '#1E2D42',
};

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtK(n) {
  if (n == null || !isFinite(n)) return '—';
  return formatCompact(n);
}
function fmtPct(n) {
  if (n == null || !isFinite(n)) return '—';
  return formatPercent(n);
}
function fmtX(n) {
  if (n == null || !isFinite(n)) return '—';
  return `${n.toFixed(2)}x`;
}

function statusColor(s) {
  return s === 'healthy' ? C.green : s === 'warning' ? C.yellow : C.red;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const color = statusColor(status);
  return (
    <span style={{ background: color, color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {status}
    </span>
  );
}

// ─── Ratio badge ──────────────────────────────────────────────────────────────
function RatioBadge({ label, value, target, fmt = fmtX }) {
  const ok = target ? value >= target : true;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 64 }}>
      <span style={{ fontSize: 10, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: ok ? C.green : C.red, fontFamily: 'Sora, sans-serif' }}>
        {fmt(value)}
      </span>
    </div>
  );
}

// ─── Month Card (View 2 scroll) ───────────────────────────────────────────────
function MonthCard({ m, reqRev }) {
  const gap = isFinite(reqRev) ? reqRev - m.revenue : 0;
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${statusColor(m.status)}`,
      borderRadius: 8, padding: '12px 16px', minWidth: 200, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 13, color: C.offWhite }}>{m.month}</span>
        <StatusBadge status={m.status} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.offWhite, fontFamily: 'Sora, sans-serif', marginBottom: 6 }}>
        {fmtK(m.revenue)}
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <RatioBadge label="LPR"  value={m.directLPR} target={2.5} />
        <RatioBadge label="MPR"  value={m.mpr}        target={5}   />
        <RatioBadge label="ManPR" value={m.manPR}     target={1.0} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: C.stone }}>Pretax</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: m.pretaxPct >= 0.10 ? C.green : m.pretaxPct >= 0.05 ? C.yellow : C.red }}>
          {fmtPct(m.pretaxPct)}
        </span>
      </div>
      {isFinite(reqRev) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: C.stone }}>Rev needed</span>
          <span style={{ fontSize: 11, color: gap > 0 ? C.red : C.green }}>
            {gap > 0 ? `+${fmtK(gap)} shortfall` : `${fmtK(Math.abs(gap))} surplus`}
          </span>
        </div>
      )}
      {m.actionTrigger && (
        <div style={{ marginTop: 6, padding: '4px 8px', background: `${C.orange}22`, borderRadius: 4, fontSize: 11, color: C.orange, fontStyle: 'italic' }}>
          {m.actionTrigger}
        </div>
      )}
    </div>
  );
}

// ─── Custom tooltip (charts) ──────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 12, color: C.offWhite, minWidth: 160 }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>{label}</p>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function RatioTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 12, color: C.offWhite }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>{label}</p>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{fmtX(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.stone }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, position: 'relative', transition: 'background 0.2s',
          background: checked ? C.orange : C.border, cursor: 'pointer',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: 8, background: '#fff',
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          transition: 'left 0.2s',
        }} />
      </div>
      {label}
    </label>
  );
}

// ─── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.stone, fontFamily: 'Mulish, sans-serif' }}>
      {children}
    </span>
  );
}

// ─── VIEW 1: Annual Summary Table ─────────────────────────────────────────────
function AnnualTable({ summaryByYear, showRequired }) {
  const cols = [
    { key: 'yearLabel',          label: 'Year',        fmt: v => v },
    { key: 'revenue',            label: 'Revenue',     fmt: fmtK },
    { key: 'grossMargin',        label: 'GM',          fmt: fmtK },
    { key: 'gmPct',              label: 'GM%',         fmt: fmtPct },
    { key: 'contributionMargin', label: 'CM',          fmt: fmtK },
    { key: 'cmPct',              label: 'CM%',         fmt: fmtPct },
    { key: 'pretaxIncome',       label: 'Pretax',      fmt: fmtK },
    { key: 'pretaxPct',          label: 'Pretax%',     fmt: fmtPct },
    { key: 'directLPR',          label: 'LPR',         fmt: fmtX },
    { key: 'mpr',                label: 'MPR',         fmt: fmtX },
    { key: 'manPR',              label: 'ManPR',       fmt: fmtX },
    { key: 'status',             label: 'Status',      fmt: v => <StatusBadge status={v} /> },
  ];

  const cellStyle = { padding: '10px 14px', textAlign: 'right', fontSize: 13, color: C.offWhite, borderBottom: `1px solid ${C.border}` };
  const headStyle = { ...cellStyle, color: C.stone, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: C.navy };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Mulish, sans-serif' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} style={{ ...headStyle, textAlign: c.key === 'yearLabel' ? 'left' : 'right' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summaryByYear.map(row => (
            <>
              <tr
                key={row.year}
                style={{ background: row.status === 'critical' ? `${C.red}18` : row.status === 'warning' ? `${C.yellow}10` : `${C.green}08` }}
              >
                {cols.map(c => (
                  <td
                    key={c.key}
                    style={{
                      ...cellStyle,
                      textAlign: c.key === 'yearLabel' ? 'left' : 'right',
                      fontWeight: c.key === 'yearLabel' || c.key === 'revenue' ? 700 : 400,
                      fontFamily: c.key === 'yearLabel' ? 'Sora, sans-serif' : 'Mulish, sans-serif',
                      color: c.key === 'pretaxPct'
                        ? row.pretaxPct >= 0.10 ? C.green : row.pretaxPct >= 0.05 ? C.yellow : C.red
                        : C.offWhite,
                    }}
                  >
                    {c.fmt(row[c.key])}
                  </td>
                ))}
              </tr>
              {showRequired && (
                <tr key={`req-${row.year}`} style={{ background: C.navy, opacity: 0.85 }}>
                  <td style={{ ...cellStyle, textAlign: 'left', color: C.stone, fontSize: 11, paddingLeft: 24, fontStyle: 'italic' }}>
                    Required Revenue
                  </td>
                  <td style={{ ...cellStyle, color: isFinite(row.requiredRevenue) ? C.orangeLight : C.stone }}>
                    {isFinite(row.requiredRevenue) ? fmtK(row.requiredRevenue) : '—'}
                  </td>
                  <td colSpan={cols.length - 2} style={{ ...cellStyle, textAlign: 'left', fontSize: 12 }}>
                    {isFinite(row.revenueGap) && (
                      <span style={{ color: row.revenueGap >= 0 ? C.green : C.red }}>
                        {row.revenueGap >= 0 ? `+${fmtK(row.revenueGap)} surplus` : `${fmtK(Math.abs(row.revenueGap))} shortfall`}
                      </span>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── VIEW 2: Monthly Detail + Breakeven Overlay ───────────────────────────────
function MonthlyView({ forecastData, historyChartData, requiredRevenueByMonth, showBreakeven, showRequired }) {
  const boundaryMonth = forecastData[0]?.month;

  // Build unified chart dataset: last 12 actuals + 60 forecast months
  const chartData = useMemo(() => {
    const hist = historyChartData.map(h => ({
      month:    h.month,
      actual:   h.revenue,
      forecast: null,
      breakeven: null,
      required: null,
    }));
    const fcast = forecastData.map((fd, i) => ({
      month:     fd.month,
      actual:    null,
      forecast:  fd.revenue,
      breakeven: showBreakeven ? (isFinite(fd.breakeven) ? fd.breakeven : null) : null,
      required:  showRequired  ? (isFinite(requiredRevenueByMonth[i]) ? requiredRevenueByMonth[i] : null) : null,
    }));
    return [...hist, ...fcast];
  }, [forecastData, historyChartData, requiredRevenueByMonth, showBreakeven, showRequired]);

  // Critical ranges for red shading
  const criticalRanges = useMemo(() => {
    const ranges = [];
    let start = null;
    forecastData.forEach((fd, i) => {
      if (fd.status === 'critical' && start === null) start = fd.month;
      if (fd.status !== 'critical' && start !== null) {
        ranges.push({ x1: start, x2: forecastData[i - 1].month });
        start = null;
      }
    });
    if (start !== null) ranges.push({ x1: start, x2: forecastData[forecastData.length - 1].month });
    return ranges;
  }, [forecastData]);

  // Every 6th label on x-axis to avoid crowding
  const tickEvery = 6;

  return (
    <div>
      {/* Area + Breakeven chart */}
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.stone}  stopOpacity={0.4} />
                <stop offset="95%" stopColor={C.stone}  stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: C.stone }}
              tickLine={false}
              axisLine={{ stroke: C.border }}
              interval={tickEvery - 1}
            />
            <YAxis
              tick={{ fontSize: 10, fill: C.stone }}
              tickFormatter={v => `$${Math.round(v / 1000)}K`}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <ReTooltip content={<ChartTooltip />} />

            {/* Critical month shading */}
            {criticalRanges.map((r, i) => (
              <ReferenceArea key={i} x1={r.x1} x2={r.x2} fill={C.red} fillOpacity={0.12} />
            ))}

            {/* Actual/forecast boundary */}
            {boundaryMonth && (
              <ReferenceLine x={boundaryMonth} stroke={C.stone} strokeDasharray="4 4" strokeWidth={1}
                label={{ value: 'Forecast →', position: 'insideTopRight', fill: C.stone, fontSize: 10 }} />
            )}

            <Area dataKey="actual"   name="Actual Revenue"   type="monotone" fill="url(#actualGrad)"   stroke={C.stone}    strokeWidth={1.5} dot={false} connectNulls={false} />
            <Area dataKey="forecast" name="Forecast Revenue" type="monotone" fill="url(#forecastGrad)" stroke="#3B82F6"    strokeWidth={2}   dot={false} connectNulls={false} />

            {showBreakeven && (
              <Line dataKey="breakeven" name="True Breakeven" type="monotone" stroke={C.orange}     strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
            )}
            {showRequired && (
              <Line dataKey="required"  name="Required Revenue" type="monotone" stroke={C.orangeLight} strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Scrollable month cards — only forecast */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12, paddingTop: 16,
        scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>
        {forecastData.map((m, i) => (
          <MonthCard key={m.monthKey} m={m} reqRev={requiredRevenueByMonth[i]} />
        ))}
      </div>
    </div>
  );
}

// ─── VIEW 3: Ratio Trend Chart ────────────────────────────────────────────────
function RatioView({ forecastData, historyChartData }) {
  const boundaryMonth = forecastData[0]?.month;

  const chartData = useMemo(() => {
    const hist = historyChartData.map(h => ({
      month:      h.month,
      lpr_actual: h.directLPR,
      mpr_actual: h.mpr,
      man_actual: h.manPR,
      lpr:  null, mpr:  null, man: null,
    }));
    const fcast = forecastData.map(fd => ({
      month:      fd.month,
      lpr_actual: null,
      mpr_actual: null,
      man_actual: null,
      lpr:  fd.directLPR,
      mpr:  fd.mpr,
      man:  fd.manPR,
    }));
    return [...hist, ...fcast];
  }, [forecastData, historyChartData]);

  // Custom dot: red if below target
  const DotLPR = ({ cx, cy, value }) => {
    if (value == null) return null;
    const below = value < 2.5;
    return <circle cx={cx} cy={cy} r={below ? 5 : 0} fill={C.red} stroke="none" />;
  };
  const DotMPR = ({ cx, cy, value }) => {
    if (value == null) return null;
    return <circle cx={cx} cy={cy} r={value < 5 ? 5 : 0} fill={C.red} stroke="none" />;
  };
  const DotMan = ({ cx, cy, value }) => {
    if (value == null) return null;
    return <circle cx={cx} cy={cy} r={value < 1.0 ? 5 : 0} fill={C.red} stroke="none" />;
  };

  return (
    <div>
      {/* Target band legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'LPR target: 2.5x – 3.5x', color: '#3B82F6' },
          { label: 'MPR target: 5x+',          color: C.green },
          { label: 'ManPR target: 1.0x+',      color: C.orange },
        ].map(b => (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 3, background: b.color, borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: C.stone }}>{b.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.red }} />
          <span style={{ fontSize: 11, color: C.stone }}>Below target</span>
        </div>
      </div>

      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.stone }} tickLine={false} axisLine={{ stroke: C.border }} interval={5} />
            <YAxis tick={{ fontSize: 10, fill: C.stone }} tickFormatter={v => `${v.toFixed(1)}x`} tickLine={false} axisLine={false} width={44} />
            <ReTooltip content={<RatioTooltip />} />

            {/* Target band shading */}
            <ReferenceArea y1={2.5} y2={3.5} fill="#3B82F6" fillOpacity={0.06} />
            <ReferenceArea y1={5}   y2={100} fill={C.green}   fillOpacity={0.04} />
            <ReferenceArea y1={1.0} y2={100} fill={C.orange}  fillOpacity={0.03} />

            {/* Threshold lines */}
            <ReferenceLine y={2.5} stroke="#3B82F6" strokeDasharray="4 4" strokeWidth={1} opacity={0.5} />
            <ReferenceLine y={5.0} stroke={C.green}   strokeDasharray="4 4" strokeWidth={1} opacity={0.5} />
            <ReferenceLine y={1.0} stroke={C.orange}  strokeDasharray="4 4" strokeWidth={1} opacity={0.5} />

            {/* Actual/forecast boundary */}
            {boundaryMonth && (
              <ReferenceLine x={boundaryMonth} stroke={C.stone} strokeDasharray="4 4" strokeWidth={1} />
            )}

            {/* Actual (history) lines */}
            <Line dataKey="lpr_actual" name="LPR (actual)"   type="monotone" stroke="#3B82F6" strokeWidth={1.5} dot={false} connectNulls={false} strokeDasharray="none" opacity={0.6} />
            <Line dataKey="mpr_actual" name="MPR (actual)"   type="monotone" stroke={C.green}   strokeWidth={1.5} dot={false} connectNulls={false} opacity={0.6} />
            <Line dataKey="man_actual" name="ManPR (actual)" type="monotone" stroke={C.orange}  strokeWidth={1.5} dot={false} connectNulls={false} opacity={0.6} />

            {/* Forecast lines */}
            <Line dataKey="lpr" name="LPR"   type="monotone" stroke="#3B82F6" strokeWidth={2} dot={<DotLPR />} connectNulls={false} />
            <Line dataKey="mpr" name="MPR"   type="monotone" stroke={C.green}   strokeWidth={2} dot={<DotMPR />} connectNulls={false} />
            <Line dataKey="man" name="ManPR" type="monotone" stroke={C.orange}  strokeWidth={2} dot={<DotMan />} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Ratio reference card */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Direct LPR',   description: 'Gross Margin ÷ Direct Labor. Target 2.5×–3.5×. Below 2.5× = job leak.', color: '#3B82F6' },
          { label: 'MPR',          description: 'Gross Margin ÷ Marketing Spend. Target 5×+. Below 5× = marketing leak.', color: C.green },
          { label: 'ManPR',        description: 'Contribution Margin ÷ Mgmt Wages. Target 1.0×+. Below 1× = overhead leak.', color: C.orange },
        ].map(r => (
          <div key={r.label} style={{ flex: '1 1 200px', background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${r.color}`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 13, color: C.offWhite, marginBottom: 4 }}>{r.label}</div>
            <div style={{ fontSize: 12, color: C.stone, lineHeight: 1.5 }}>{r.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Owner Controls ───────────────────────────────────────────────────────────
function Controls({ targetProfit, setTargetProfit, growthRate, setGrowthRate, ownerPay, setOwnerPay, showBreakeven, setShowBreakeven, showRequired, setShowRequired, result }) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '16px 20px', marginBottom: 20,
      display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end',
    }}>
      {/* Target Pretax % */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
        <SectionLabel>Target Pretax %</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            min={0} max={40} step={1}
            value={targetProfit}
            onChange={e => setTargetProfit(Math.min(40, Math.max(0, Number(e.target.value))))}
            style={{ width: 64, background: C.navy, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', color: C.offWhite, fontSize: 14, fontFamily: 'Sora, sans-serif', fontWeight: 700, textAlign: 'center' }}
          />
          <span style={{ color: C.stone, fontSize: 13 }}>%</span>
        </div>
      </div>

      {/* Revenue Growth slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
        <SectionLabel>Revenue Growth Assumption</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="range"
            min={0} max={30} step={1}
            value={growthRate}
            onChange={e => setGrowthRate(Number(e.target.value))}
            style={{ flex: 1, accentColor: C.orange }}
          />
          <span style={{ color: C.offWhite, fontSize: 14, fontWeight: 700, fontFamily: 'Sora, sans-serif', minWidth: 36, textAlign: 'right' }}>
            {growthRate}%
          </span>
        </div>
        {result?.hasSeasonality && (
          <span style={{ fontSize: 10, color: C.stone }}>Seasonal patterns active</span>
        )}
      </div>

      {/* Owner Pay */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
        <SectionLabel>Owner Pay (annual total)</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.stone, fontSize: 13 }}>$</span>
          <input
            type="number"
            min={0} step={1000}
            value={ownerPay}
            onChange={e => setOwnerPay(Math.max(0, Number(e.target.value)))}
            style={{ width: 120, background: C.navy, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', color: C.offWhite, fontSize: 13, fontFamily: 'Mulish, sans-serif' }}
          />
          <span style={{ fontSize: 10, color: C.stone }}>/yr</span>
        </div>
        <span style={{ fontSize: 10, color: C.stone }}>Split 50/50 Row 23 + Row 42</span>
      </div>

      {/* Overlay toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Toggle checked={showBreakeven} onChange={setShowBreakeven} label="Show Breakeven Overlay" />
        <Toggle checked={showRequired}  onChange={setShowRequired}  label="Show Required Revenue"  />
      </div>

      {/* Volatile warning */}
      {result?.volatileLines?.length > 0 && (
        <div style={{ fontSize: 11, color: C.yellow, background: `${C.yellow}15`, borderRadius: 6, padding: '6px 12px', alignSelf: 'center' }}>
          ⚠ High variance detected: {result.volatileLines.join(', ')}
        </div>
      )}
    </div>
  );
}

// ─── Baseline Ratios Banner ───────────────────────────────────────────────────
function BaselineBanner({ baselineRatios, hasHistory }) {
  const items = [
    { label: 'TTM Revenue',   value: fmtK(baselineRatios.revenue) },
    { label: 'GM%',           value: fmtPct(baselineRatios.gmPct) },
    { label: 'CM%',           value: fmtPct(baselineRatios.cmPct) },
    { label: 'Pretax%',       value: fmtPct(baselineRatios.pretaxPct) },
    { label: 'LPR',           value: fmtX(baselineRatios.directLPR) },
    { label: 'MPR',           value: fmtX(baselineRatios.mpr) },
    { label: 'ManPR',         value: fmtX(baselineRatios.manPR) },
  ];
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20, padding: '12px 20px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80 }}>
        <SectionLabel>Data Source</SectionLabel>
        <span style={{ fontSize: 12, color: hasHistory ? C.green : C.yellow, fontWeight: 600 }}>
          {hasHistory ? 'Actual History' : 'Input Estimates'}
        </span>
      </div>
      {items.map(it => (
        <div key={it.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80 }}>
          <SectionLabel>{it.label}</SectionLabel>
          <span style={{ fontSize: 13, color: C.offWhite, fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ForecastView() {
  const { inputs, monthlyHistory } = useSnapshot();

  const [activeView,     setActiveView]     = useState(1);
  const [targetProfit,   setTargetProfit]   = useState(10);      // display as integer %
  const [growthRate,     setGrowthRate]     = useState(null);    // null = use YoY
  const [ownerPay,       setOwnerPay]       = useState(null);    // null = use TTM
  const [showBreakeven,  setShowBreakeven]  = useState(true);
  const [showRequired,   setShowRequired]   = useState(false);

  // Run forecast — recompute whenever controls change
  const result = useMemo(() => {
    return runForecast(
      inputs || {},
      monthlyHistory || {},
      {
        targetProfit:  targetProfit / 100,
        revenueGrowth: growthRate !== null ? growthRate / 100 : null,
        ownerPayAnnual: ownerPay,
      },
    );
  }, [inputs, monthlyHistory, targetProfit, growthRate, ownerPay]);

  // Initialize slider/input defaults from first result
  const displayGrowth  = growthRate  !== null ? growthRate  : Math.round((result.defaultGrowthRate || 0) * 100);
  const displayOwnerPay = ownerPay   !== null ? ownerPay    : (result.defaultOwnerPayAnnual || 0);

  // Sync controlled values once defaults are available
  const syncedGrowth  = growthRate  !== null ? growthRate  : displayGrowth;
  const syncedOwnerPay = ownerPay   !== null ? ownerPay    : displayOwnerPay;

  // Historical actuals for chart overlay (last 12 months)
  const historyChartData = useMemo(() => {
    if (!result.historyKeys?.length || !monthlyHistory) return [];
    return result.historyKeys.slice(-12).map(k => {
      const row = monthlyHistory[k] || {};
      const [y, mo] = k.split('-').map(Number);
      const rev   = row.revenue || 0;
      const cogs  = row.cogs || 0;
      const gm    = rev - cogs;
      const dl    = (row.owner_direct_labor || 0) + (row.employee_direct_labor || 0) + (row.subcontractors || 0);
      const cm    = gm - dl;
      const mkt   = row.marketing || 0;
      const omgmt = row.owner_management_wage || 0;
      return {
        month:    `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo - 1]} ${y}`,
        revenue:  rev,
        directLPR: dl > 0 ? gm / dl : 0,
        mpr:       mkt > 0 ? gm / mkt : 0,
        manPR:     omgmt > 0 ? cm / omgmt : 0,
      };
    });
  }, [result.historyKeys, monthlyHistory]);

  const TABS = [
    { id: 1, label: '5-Year Summary' },
    { id: 2, label: 'Monthly Detail' },
    { id: 3, label: 'Ratio Trends' },
  ];

  return (
    <div style={{ background: C.navy, minHeight: '100vh', padding: '24px 28px', fontFamily: 'Mulish, sans-serif', color: C.offWhite }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 26, margin: 0, color: C.offWhite }}>
          5-Year Profit Forecast
        </h1>
        <p style={{ color: C.stone, margin: '4px 0 0', fontSize: 14 }}>
          Built on your trailing 12-month baseline. Owner pay is never excluded from breakeven.
        </p>
      </div>

      {/* Baseline ratios */}
      <BaselineBanner baselineRatios={result.baselineRatios} hasHistory={result.hasHistory} />

      {/* Controls */}
      <Controls
        targetProfit={targetProfit}   setTargetProfit={setTargetProfit}
        growthRate={syncedGrowth}     setGrowthRate={v => setGrowthRate(v)}
        ownerPay={syncedOwnerPay}     setOwnerPay={v => setOwnerPay(v)}
        showBreakeven={showBreakeven} setShowBreakeven={setShowBreakeven}
        showRequired={showRequired}   setShowRequired={setShowRequired}
        result={result}
      />

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.panel, padding: 4, borderRadius: 8, width: 'fit-content', border: `1px solid ${C.border}` }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            style={{
              padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: 13,
              background: activeView === tab.id ? C.orange : 'transparent',
              color:      activeView === tab.id ? '#fff' : C.stone,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* View content */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
        {activeView === 1 && (
          <AnnualTable
            summaryByYear={result.summaryByYear}
            showRequired={showRequired}
          />
        )}
        {activeView === 2 && (
          <MonthlyView
            forecastData={result.forecastData}
            historyChartData={historyChartData}
            requiredRevenueByMonth={result.requiredRevenueByMonth}
            showBreakeven={showBreakeven}
            showRequired={showRequired}
          />
        )}
        {activeView === 3 && (
          <RatioView
            forecastData={result.forecastData}
            historyChartData={historyChartData}
          />
        )}
      </div>

      {/* Breakeven summary footer */}
      {showBreakeven && result.breakevenByMonth.some(v => isFinite(v)) && (
        <div style={{ marginTop: 16, padding: '12px 20px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <SectionLabel>Seasonal Breakeven Range (True — includes full owner pay)</SectionLabel>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((mo, i) => {
              const be = result.breakevenByMonth[i];
              return (
                <div key={mo} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, color: C.stone }}>{mo}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.orange, fontFamily: 'Sora, sans-serif' }}>
                    {isFinite(be) ? fmtK(be) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
