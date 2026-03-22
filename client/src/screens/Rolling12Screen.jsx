import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area,
  XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { api } from '../utils/api.js';
import {
  sumCalendarTTM,
  countMonthsWithRevenueInTTM,
  calendarTTMKeysChronological,
  listTTMWindowMetas,
} from '../utils/calendarRolling12.js';
import { formatCurrency, formatCompact, formatPercent } from '../utils/format.js';
import { SkeletonCard } from '../components/SkeletonLoader.jsx';

// ── Formatting helpers ──────────────────────────────────────
function fmtDollar(n) {
  if (n == null || isNaN(n)) return '\u2014';
  if (n === 0) return '\u2014';
  const abs = Math.abs(n);
  const fmt = abs >= 1000
    ? `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return n < 0 ? `(${fmt})` : fmt;
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtRatio(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '\u2014';
  return `${n.toFixed(2)}x`;
}

function safeDivide(a, b) {
  return b && b !== 0 ? a / b : 0;
}

// ── Ratio badge colors ──────────────────────────────────────
function lprColor(v) {
  if (v >= 3.5) return 'blue';
  if (v >= 2.5) return 'green';
  if (v >= 2.0) return 'yellow';
  return 'red';
}
function mprColor(v) {
  if (v >= 5.0) return 'green';
  if (v >= 3.0) return 'yellow';
  return 'red';
}
function manprColor(v) {
  if (v >= 1.0) return 'green';
  if (v >= 0.75) return 'yellow';
  return 'red';
}

const COLOR_MAP = {
  green: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  yellow: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  red: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  gold: { bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'border-yellow-400/30' },
  orange: { bg: 'bg-orange/15', text: 'text-orange', border: 'border-orange/30' },
};

function RatioBadge({ value, colorFn, target, label }) {
  const color = colorFn(value);
  const c = COLOR_MAP[color];
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${c.bg} ${c.border}`}>
      <span className={`font-sora text-sm font-bold ${c.text}`}>{fmtRatio(value)}</span>
      {label && <span className="font-mulish text-xs text-stone">{label}</span>}
      {target && <span className="font-mulish text-[10px] text-stone/60">Target: {target}</span>}
    </div>
  );
}

function TierBadge({ tier }) {
  if (!tier) return null;
  const c = COLOR_MAP[tier.color] || COLOR_MAP.orange;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${c.bg} ${c.border}`}>
      <span className={`font-sora text-sm font-bold ${c.text}`}>Level {tier.level}</span>
      <span className="font-mulish text-xs text-stone">{tier.name}</span>
    </div>
  );
}

// ── Mini sparkline (80x30) ──────────────────────────────────
function Sparkline({ data, dataKey = 'value', height = 30 }) {
  if (!data || data.length === 0) return <div className="w-20 h-[30px]" />;
  return (
    <div className="w-20 hidden md:block">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <RTooltip
            contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10 }}
            labelStyle={{ color: '#fff', fontSize: 10 }}
            formatter={(v) => fmtDollar(v)}
          />
          <Bar dataKey={dataKey} fill="#F05001" radius={[1, 1, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Animated number ─────────────────────────────────────────
function AnimatedValue({ value, formatter = fmtDollar, className = '' }) {
  const ref = useRef(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === value || !ref.current) return;

    let start = null;
    const duration = 600;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = prev + (value - prev) * eased;
      if (ref.current) ref.current.textContent = formatter(current);
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, formatter]);

  return <span ref={ref} className={className}>{formatter(value)}</span>;
}

// ── Waterfall row component ─────────────────────────────────
function WRow({ label, value, revenue, sparkData, sparkKey, isNeg, isBold, compare, className = '' }) {
  const pct = revenue > 0 ? value / revenue : 0;
  const valColor = value < 0 ? 'text-red-400' : 'text-white';

  return (
    <div className={`grid grid-cols-12 gap-2 items-center py-2 px-3 ${className}`}>
      <div className={`col-span-5 font-mulish text-sm ${isBold ? 'font-semibold text-white' : 'text-stone-light'}`}>
        {label}
      </div>
      <div className={`col-span-3 text-right font-sora text-sm ${isBold ? 'font-bold' : ''} ${valColor}`}>
        <AnimatedValue value={value} formatter={isNeg ? (v) => fmtDollar(-Math.abs(v)) : fmtDollar} />
      </div>
      <div className="col-span-2 text-right font-sora text-xs text-stone hidden sm:block">
        {revenue > 0 ? fmtPct(pct) : '\u2014'}
      </div>
      <div className="col-span-2 flex justify-end">
        <Sparkline data={sparkData} dataKey={sparkKey || 'value'} />
      </div>
      {compare && (
        <div className="col-span-12 grid grid-cols-3 gap-2 mt-1 text-xs pl-4">
          <div className="text-right font-sora text-white/60">{fmtDollar(compare.v2)}</div>
          <div className={`text-right font-sora ${compare.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {compare.delta >= 0 ? '+' : ''}{fmtDollar(compare.delta)}
          </div>
          <div className={`text-right font-sora ${compare.deltaPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {compare.deltaPct >= 0 ? '+' : ''}{(compare.deltaPct * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <div className="border-t border-orange/40 pt-2">
        <span className="font-mulish text-[10px] uppercase tracking-widest text-stone">{label}</span>
      </div>
    </div>
  );
}

// ── Client-side Rolling 12 calculation (from monthlyHistory) ─
function clientCalcRolling12(monthlyHistory, endYear, endMonth) {
  if (!monthlyHistory) return null;

  const sums = sumCalendarTTM(monthlyHistory, endYear, endMonth);
  const windowKeys = calendarTTMKeysChronological(endYear, endMonth);

  const monthly = [];

  for (const k of windowKeys) {
    const m = monthlyHistory[k] || {};

    const rev = m.revenue || 0;
    const c = m.cogs || 0;
    const gm = rev - c;
    const dl = (m.owner_direct_labor || 0) + (m.employee_direct_labor || 0) + (m.subcontractors || 0);
    const cm = gm - dl;
    const mkt = m.marketing || 0;
    const opex = (m.owner_management_wage || 0) + (m.rent || 0) + (m.insurance || 0)
      + (m.software_subscriptions || 0) + (m.other_opex || 0);
    const pretax = cm - mkt - opex;
    const [y, mo] = k.split('-').map(Number);
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    monthly.push({
      year: y, month: mo, label: `${MONTH_NAMES[mo - 1]} ${y}`,
      revenue: rev, gross_margin: gm, contribution_margin: cm,
      total_dl: dl, total_marketing: mkt, total_opex: opex,
      pretax_net_income: pretax,
      direct_lpr: safeDivide(gm, dl),
      mpr: safeDivide(gm, mkt),
      manpr: safeDivide(cm, opex),
    });
  }

  const { revenue, cogs } = sums;
  const totalDl = sums.owner_direct_labor + sums.employee_direct_labor + sums.subcontractors;
  const gm = revenue - cogs;
  const cm = gm - totalDl;
  const totalMkt = sums.marketing;
  const totalOpex = sums.owner_management_wage + sums.rent + sums.insurance
    + sums.software_subscriptions + sums.other_opex;
  const pretax = cm - totalMkt - totalOpex;
  const pretaxPct = safeDivide(pretax, revenue);
  const ownerPay = sums.owner_direct_labor + sums.owner_management_wage;
  const truePretax = pretax + ownerPay;
  const taxRate = 0.40;
  const tax = truePretax > 0 ? truePretax * taxRate : 0;

  const directLpr = safeDivide(gm, totalDl);
  const mpr = safeDivide(gm, totalMkt);
  const manpr = safeDivide(cm, totalOpex);

  function lprScore(v) { return v >= 3.5 ? 25 : v >= 2.5 ? 20 : v >= 2.0 ? 12 : v >= 1.5 ? 6 : 0; }
  function mprSc(v) { return v >= 5.0 ? 20 : v >= 3.0 ? 12 : v >= 2.0 ? 6 : 0; }
  function manprSc(v) { return v >= 1.0 ? 20 : v >= 0.75 ? 12 : v >= 0.5 ? 6 : 0; }
  function ptSc(v) { return v >= 0.20 ? 25 : v >= 0.10 ? 20 : v >= 0.05 ? 12 : v >= 0.0 ? 6 : 0; }

  function tier(p) {
    if (p < 0) return { level: 1, name: 'Survival Mode', color: 'red' };
    if (p < 0.05) return { level: 2, name: 'Getting Traction', color: 'orange' };
    if (p < 0.10) return { level: 3, name: 'Stable Ground', color: 'yellow' };
    if (p < 0.20) return { level: 4, name: 'Profit Machine', color: 'green' };
    return { level: 5, name: 'Wealth Mode', color: 'gold' };
  }

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startParts = windowKeys[0].split('-').map(Number);

  return {
    window: {
      end_year: endYear, end_month: endMonth,
      end_label: `${MONTH_NAMES[endMonth - 1]} ${endYear}`,
      start_year: startParts[0], start_month: startParts[1],
      start_label: `${MONTH_NAMES[startParts[1] - 1]} ${startParts[0]}`,
      actual_months: 12,
      months_with_data: countMonthsWithRevenueInTTM(monthlyHistory, endYear, endMonth),
    },
    waterfall: {
      revenue, total_cogs: cogs, gross_margin: gm, gm_pct: safeDivide(gm, revenue),
      total_dl: totalDl, owner_dl: sums.owner_direct_labor, employee_dl: sums.employee_direct_labor + sums.subcontractors,
      direct_lpr: directLpr,
      contribution_margin: cm, cm_pct: safeDivide(cm, revenue),
      total_marketing: totalMkt, mpr,
      owner_mgmt: sums.owner_management_wage, total_rent: sums.rent,
      total_insurance: sums.insurance, total_software: sums.software_subscriptions,
      total_payroll_tax: 0, total_other_opex: sums.other_opex,
      total_opex: totalOpex, manpr,
      pretax_net_income: pretax, pretax_pct: pretaxPct,
      owner_pay_total: ownerPay, true_pretax_profit: truePretax,
      true_pretax_pct: safeDivide(truePretax, revenue),
      tax_rate: taxRate, estimated_tax: tax,
      post_tax_cash_flow: truePretax - tax, interest_income: 0,
    },
    scores: {
      direct_lpr_score: lprScore(directLpr), mpr_score: mprSc(mpr),
      manpr_score: manprSc(manpr), pretax_score: ptSc(pretaxPct),
      profit_score: lprScore(directLpr) + mprSc(mpr) + manprSc(manpr) + ptSc(pretaxPct),
      profit_tier: tier(pretaxPct),
    },
    monthly_breakdown: monthly,
    iferror_flags: {
      gm_pct: revenue === 0, cm_pct: revenue === 0,
      direct_lpr: totalDl === 0, mpr: totalMkt === 0,
      manpr: totalOpex === 0, pretax_pct: revenue === 0,
    },
  };
}

function getAvailableWindowsClient(monthlyHistory) {
  return listTTMWindowMetas(monthlyHistory || {});
}

// ── Calendar Year Aggregation ───────────────────────────────
function aggregateByYear(monthlyHistory) {
  if (!monthlyHistory) return [];
  const keys = Object.keys(monthlyHistory).sort();
  if (keys.length === 0) return [];

  const byYear = {};
  for (const k of keys) {
    const [y] = k.split('-').map(Number);
    if (!byYear[y]) {
      byYear[y] = {
        year: y, monthCount: 0,
        revenue: 0, cogs: 0, employee_direct_labor: 0, subcontractors: 0,
        marketing: 0, owner_management_wage: 0, rent: 0, insurance: 0,
        software_subscriptions: 0, other_opex: 0, owner_direct_labor: 0,
      };
    }
    const m = monthlyHistory[k];
    if (!m) continue;
    byYear[y].monthCount++;
    for (const f of Object.keys(byYear[y])) {
      if (f === 'year' || f === 'monthCount') continue;
      byYear[y][f] += m[f] || 0;
    }
  }

  return Object.values(byYear).sort((a, b) => a.year - b.year).map((yr) => {
    const dl = yr.owner_direct_labor + yr.employee_direct_labor + yr.subcontractors;
    const gm = yr.revenue - yr.cogs;
    const cm = gm - dl;
    const opex = yr.owner_management_wage + yr.rent + yr.insurance
      + yr.software_subscriptions + yr.other_opex;
    const pretax = cm - yr.marketing - opex;
    const ownerPay = yr.owner_direct_labor + yr.owner_management_wage;

    return {
      ...yr,
      gross_margin: gm,
      gm_pct: safeDivide(gm, yr.revenue),
      total_dl: dl,
      contribution_margin: cm,
      cm_pct: safeDivide(cm, yr.revenue),
      total_opex: opex,
      pretax,
      pretax_pct: safeDivide(pretax, yr.revenue),
      owner_pay_total: ownerPay,
      direct_lpr: safeDivide(gm, dl),
      mpr: safeDivide(gm, yr.marketing),
      manpr: safeDivide(cm, opex),
    };
  });
}

function YearlyComparison({ years }) {
  if (!years || years.length === 0) return null;

  const rows = [
    { label: 'Revenue', key: 'revenue', isBold: true },
    { label: 'COGS', key: 'cogs' },
    { label: 'Gross Margin', key: 'gross_margin', isBold: true },
    { label: 'GM %', key: 'gm_pct', isPct: true },
    { divider: 'Direct Labor' },
    { label: 'Owner Direct Labor', key: 'owner_direct_labor' },
    { label: 'Employee + Subs', key: 'total_dl_minus_owner', compute: (yr) => yr.employee_direct_labor + yr.subcontractors },
    { label: 'Total Direct Labor', key: 'total_dl', isBold: true },
    { label: 'Direct LPR', key: 'direct_lpr', isRatio: true },
    { divider: 'Contribution Margin' },
    { label: 'Contribution Margin', key: 'contribution_margin', isBold: true },
    { label: 'CM %', key: 'cm_pct', isPct: true },
    { divider: 'Marketing' },
    { label: 'Total Marketing', key: 'marketing', isBold: true },
    { label: 'MPR', key: 'mpr', isRatio: true },
    { divider: 'Operating Expenses' },
    { label: 'Owner Management', key: 'owner_management_wage' },
    { label: 'Rent', key: 'rent' },
    { label: 'Insurance', key: 'insurance' },
    { label: 'Software', key: 'software_subscriptions' },
    { label: 'Other OpEx', key: 'other_opex' },
    { label: 'Total OpEx', key: 'total_opex', isBold: true },
    { label: 'ManPR', key: 'manpr', isRatio: true },
    { divider: 'Bottom Line' },
    { label: 'Pretax Net Income', key: 'pretax', isBold: true, highlight: true },
    { label: 'Pretax %', key: 'pretax_pct', isPct: true, highlight: true },
  ];

  return (
    <div className="card-dark overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left font-mulish text-stone pb-3 pr-4 min-w-[180px]"></th>
            {years.map((yr) => (
              <th key={yr.year} className="text-right font-sora text-white pb-3 px-3 min-w-[110px]">
                {yr.year}
                <div className="font-mulish text-[10px] text-stone font-normal">{yr.monthCount} months</div>
              </th>
            ))}
            {years.length >= 2 && (
              <th className="text-right font-sora text-orange pb-3 px-3 min-w-[90px]">
                Change
                <div className="font-mulish text-[10px] text-stone font-normal">
                  {years[years.length - 2].year} to {years[years.length - 1].year}
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            if (row.divider) {
              return (
                <tr key={`div-${idx}`}>
                  <td colSpan={years.length + 2} className="pt-3 pb-1">
                    <div className="border-t border-orange/40 pt-1">
                      <span className="font-mulish text-[10px] uppercase tracking-widest text-stone">{row.divider}</span>
                    </div>
                  </td>
                </tr>
              );
            }

            const latest = years[years.length - 1];
            const prev = years.length >= 2 ? years[years.length - 2] : null;
            const lv = row.compute ? row.compute(latest) : latest[row.key];
            const pv = prev ? (row.compute ? row.compute(prev) : prev[row.key]) : null;
            const change = pv != null && pv !== 0 ? (lv - pv) / Math.abs(pv) : null;

            return (
              <tr key={row.key || idx} className="border-t border-white/5">
                <td className={`font-mulish py-2 pr-4 ${row.isBold ? 'font-semibold text-white' : 'text-stone-light'}`}>
                  {row.label}
                </td>
                {years.map((yr) => {
                  const val = row.compute ? row.compute(yr) : yr[row.key];
                  const isNeg = val < 0;
                  let display;
                  if (row.isPct) display = fmtPct(val);
                  else if (row.isRatio) display = fmtRatio(val);
                  else display = fmtDollar(val);

                  return (
                    <td key={yr.year} className={`text-right font-sora py-2 px-3 ${
                      row.isBold ? 'font-bold' : ''
                    } ${row.highlight && val >= 0 ? 'text-green-400' : isNeg ? 'text-red-400' : 'text-white'}`}>
                      {display}
                    </td>
                  );
                })}
                {years.length >= 2 && (
                  <td className={`text-right font-sora py-2 px-3 ${
                    change != null ? (change >= 0 ? 'text-green-400' : 'text-red-400') : 'text-stone'
                  }`}>
                    {change != null && !row.isPct && !row.isRatio
                      ? `${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}%`
                      : '\u2014'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function YearlyCharts({ years }) {
  if (!years || years.length < 2) return null;

  const COLORS = ['#F05001', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ec4899', '#8A8278'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card-dark">
        <h3 className="font-mulish text-xs uppercase tracking-wide text-stone mb-2">Revenue by Year</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={years}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke="#8A8278" fontSize={12} />
            <YAxis stroke="#8A8278" fontSize={10} tickFormatter={(v) => formatCompact(v)} />
            <RTooltip contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
              formatter={(v) => formatCurrency(v)} />
            <Bar dataKey="revenue" fill="#F05001" radius={[4, 4, 0, 0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-dark">
        <h3 className="font-mulish text-xs uppercase tracking-wide text-stone mb-2">Pretax Profit by Year</h3>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={years}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke="#8A8278" fontSize={12} />
            <YAxis stroke="#8A8278" fontSize={10} tickFormatter={(v) => formatCompact(v)} />
            <RTooltip contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
              formatter={(v, name) => [name === 'Pretax %' ? fmtPct(v) : formatCurrency(v), name]} />
            <Bar dataKey="pretax" fill="#22c55e40" name="Pretax $" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="pretax_pct" stroke="#22c55e" strokeWidth={2} name="Pretax %" yAxisId="right" dot={{ r: 3 }} />
            <YAxis yAxisId="right" orientation="right" stroke="#8A8278" fontSize={10} tickFormatter={(v) => fmtPct(v)} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="card-dark">
        <h3 className="font-mulish text-xs uppercase tracking-wide text-stone mb-2">Productivity Ratios by Year</h3>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={years}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke="#8A8278" fontSize={12} />
            <YAxis stroke="#8A8278" fontSize={10} />
            <RTooltip contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
              formatter={(v) => fmtRatio(v)} />
            <Legend />
            <ReferenceLine y={2.5} stroke="#8A8278" strokeDasharray="4 4" />
            <ReferenceLine y={5.0} stroke="#8A8278" strokeDasharray="4 4" />
            <ReferenceLine y={1.0} stroke="#8A8278" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="direct_lpr" stroke="#F05001" strokeWidth={2} name="Direct LPR" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="mpr" stroke="#3b82f6" strokeWidth={2} name="MPR" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="manpr" stroke="#22c55e" strokeWidth={2} name="ManPR" dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="card-dark">
        <h3 className="font-mulish text-xs uppercase tracking-wide text-stone mb-2">Easy Numbers P&L by Year</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={years}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke="#8A8278" fontSize={12} />
            <YAxis stroke="#8A8278" fontSize={10} tickFormatter={(v) => formatCompact(v)} />
            <RTooltip contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
              formatter={(v) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="gross_margin" fill="#F0500180" name="Gross Margin" stackId="a" />
            <Bar dataKey="total_dl" fill="#3b82f680" name="Direct Labor" stackId="b" />
            <Bar dataKey="marketing" fill="#eab30880" name="Marketing" stackId="b" />
            <Bar dataKey="total_opex" fill="#8A827880" name="OpEx" stackId="b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main Screen ─────────────────────────────────────────────
export default function Rolling12Screen() {
  const { monthlyHistory } = useSnapshot();

  const [windows, setWindows] = useState([]);
  const [selectedWindow, setSelectedWindow] = useState(null);
  const [compareWindow, setCompareWindow] = useState(null);
  const [result, setResult] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [allWindowsData, setAllWindowsData] = useState(null);
  const [yearLimit, setYearLimit] = useState('all');
  const [mode, setMode] = useState('single');
  const [viewTab, setViewTab] = useState('rolling');
  const [loading, setLoading] = useState(true);

  // Load windows and initial calculation
  useEffect(() => {
    async function init() {
      setLoading(true);

      // Try template-based API first
      try {
        const wd = await api.get('/rolling12/windows');
        if (wd.windows?.length > 0) {
          setWindows(wd.windows);
          const def = wd.default_window || wd.windows[0];
          setSelectedWindow(def);
          const r = await api.get(`/rolling12/calculate?end_year=${def.end_year}&end_month=${def.end_month}`);
          setResult(r);
          setLoading(false);
          // Load all-windows in background
          api.get('/rolling12/all-windows').then(setAllWindowsData).catch(() => {});
          return;
        }
      } catch { /* template not available */ }

      // Fall back to client-side calculation from monthlyHistory
      if (monthlyHistory && Object.keys(monthlyHistory).length > 0) {
        const ws = getAvailableWindowsClient(monthlyHistory);
        setWindows(ws);
        if (ws.length > 0) {
          const def = ws[0];
          setSelectedWindow(def);
          const r = clientCalcRolling12(monthlyHistory, def.end_year, def.end_month);
          setResult(r);

          // Build all-windows trend data
          const allResults = [];
          const trend = { labels: [], profit_scores: [], direct_lpr: [], mpr: [], manpr: [], pretax_pct: [], revenue: [] };
          for (const w of [...ws].reverse()) {
            const wr = clientCalcRolling12(monthlyHistory, w.end_year, w.end_month);
            if (wr) {
              allResults.push(wr);
              trend.labels.push(wr.window.end_label);
              trend.profit_scores.push(wr.scores.profit_score);
              trend.direct_lpr.push(wr.waterfall.direct_lpr);
              trend.mpr.push(wr.waterfall.mpr);
              trend.manpr.push(wr.waterfall.manpr);
              trend.pretax_pct.push(wr.waterfall.pretax_pct);
              trend.revenue.push(wr.waterfall.revenue);
            }
          }
          setAllWindowsData({ results: allResults, trend });
        }
      }
      setLoading(false);
    }
    init();
  }, [monthlyHistory]);

  // Recalculate when window changes
  const handleWindowChange = useCallback(async (w) => {
    setSelectedWindow(w);
    try {
      const r = await api.get(`/rolling12/calculate?end_year=${w.end_year}&end_month=${w.end_month}`);
      setResult(r);
    } catch {
      if (monthlyHistory) {
        setResult(clientCalcRolling12(monthlyHistory, w.end_year, w.end_month));
      }
    }
  }, [monthlyHistory]);

  const handleCompareChange = useCallback(async (w) => {
    setCompareWindow(w);
    try {
      const r = await api.get(`/rolling12/calculate?end_year=${w.end_year}&end_month=${w.end_month}`);
      setCompareResult(r);
    } catch {
      if (monthlyHistory) {
        setCompareResult(clientCalcRolling12(monthlyHistory, w.end_year, w.end_month));
      }
    }
  }, [monthlyHistory]);

  // Filter windows by year limit
  const filteredWindows = useMemo(() => {
    if (yearLimit === 'all') return windows;
    const limit = parseInt(yearLimit);
    if (!windows.length) return [];
    const latest = windows[0];
    const cutoffYear = latest.end_year - limit;
    const cutoffMonth = latest.end_month;
    return windows.filter((w) =>
      w.end_year > cutoffYear || (w.end_year === cutoffYear && w.end_month >= cutoffMonth)
    );
  }, [windows, yearLimit]);

  // Calendar year aggregation
  const yearlyData = useMemo(() => aggregateByYear(monthlyHistory), [monthlyHistory]);

  // Sparkline data from monthly breakdown
  const sparkData = useMemo(() => {
    if (!result?.monthly_breakdown) return {};
    const mb = result.monthly_breakdown;
    return {
      revenue: mb.map((m) => ({ label: m.label, value: m.revenue })),
      gross_margin: mb.map((m) => ({ label: m.label, value: m.gross_margin })),
      cogs: mb.map((m) => ({ label: m.label, value: Math.abs(m.revenue - m.gross_margin) })),
      total_dl: mb.map((m) => ({ label: m.label, value: m.total_dl })),
      cm: mb.map((m) => ({ label: m.label, value: m.contribution_margin })),
      marketing: mb.map((m) => ({ label: m.label, value: m.total_marketing })),
      opex: mb.map((m) => ({ label: m.label, value: m.total_opex })),
      pretax: mb.map((m) => ({ label: m.label, value: m.pretax_net_income })),
    };
  }, [result]);

  if (loading) return <SkeletonCard count={3} />;

  const hasRolling = result && windows.length > 0;
  const hasYearly = yearlyData.length > 0;

  if (!hasRolling && !hasYearly) {
    return (
      <div className="space-y-6">
        <h1 className="font-sora text-2xl font-bold text-white">Rolling 12-Month P&L</h1>
        <div className="card-dark text-center py-12">
          <p className="font-mulish text-stone text-lg mb-2">No data available yet</p>
          <p className="font-mulish text-stone/60 text-sm">
            Import an Excel file or connect QuickBooks to see your Rolling 12 analysis.
          </p>
        </div>
      </div>
    );
  }

  const w = result.waterfall;
  const s = result.scores;
  const cw = compareResult?.waterfall;
  const isCompare = mode === 'compare' && cw;

  function cmpData(field) {
    if (!isCompare) return null;
    const v1 = w[field] || 0;
    const v2 = cw[field] || 0;
    return { v2, delta: v1 - v2, deltaPct: v2 !== 0 ? (v1 - v2) / Math.abs(v2) : 0 };
  }

  return (
    <div className="space-y-6">
      {/* ── VIEW TABS ──────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-navy/95 backdrop-blur-sm pb-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-sora text-2xl font-bold text-white">Rolling 12-Month P&L</h1>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
              <button onClick={() => setViewTab('rolling')}
                className={`px-4 py-1.5 rounded-md text-xs font-mulish transition-colors ${viewTab === 'rolling' ? 'bg-orange text-white' : 'text-stone hover:text-white'}`}
              >Rolling 12</button>
              {hasYearly && (
                <button onClick={() => setViewTab('yearly')}
                  className={`px-4 py-1.5 rounded-md text-xs font-mulish transition-colors ${viewTab === 'yearly' ? 'bg-orange text-white' : 'text-stone hover:text-white'}`}
                >By Year ({yearlyData.length})</button>
              )}
            </div>
          </div>
        </div>

        {viewTab === 'rolling' && hasRolling && (<>
        <div className="flex items-center justify-between mb-3">
          <div />
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            {['all', '1', '2', '3'].map((v) => (
              <button
                key={v}
                onClick={() => setYearLimit(v)}
                className={`px-3 py-1 rounded-md text-xs font-mulish transition-colors ${
                  yearLimit === v ? 'bg-orange text-white' : 'text-stone hover:text-white'
                }`}
              >
                {v === 'all' ? 'All' : `${v}Y`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Window selector */}
          <select
            value={selectedWindow ? `${selectedWindow.end_year}-${selectedWindow.end_month}` : ''}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number);
              const w = filteredWindows.find((fw) => fw.end_year === y && fw.end_month === m);
              if (w) handleWindowChange(w);
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mulish text-sm text-white focus:border-orange focus:outline-none"
          >
            {filteredWindows.map((fw) => (
              <option key={`${fw.end_year}-${fw.end_month}`} value={`${fw.end_year}-${fw.end_month}`}>
                {fw.start_label} \u2013 {fw.end_label} | {fw.months_with_data}/12 months
              </option>
            ))}
          </select>

          {/* Compare toggle */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1 rounded-md text-xs font-mulish transition-colors ${
                mode === 'single' ? 'bg-orange text-white' : 'text-stone hover:text-white'
              }`}
            >Single</button>
            <button
              onClick={() => {
                setMode('compare');
                if (!compareWindow && filteredWindows.length > 1) {
                  const yearAgo = filteredWindows.find((fw) =>
                    fw.end_year === (selectedWindow.end_year - 1) && fw.end_month === selectedWindow.end_month
                  ) || filteredWindows[1];
                  if (yearAgo) handleCompareChange(yearAgo);
                }
              }}
              className={`px-3 py-1 rounded-md text-xs font-mulish transition-colors ${
                mode === 'compare' ? 'bg-orange text-white' : 'text-stone hover:text-white'
              }`}
            >Compare</button>
          </div>

          {mode === 'compare' && (
            <select
              value={compareWindow ? `${compareWindow.end_year}-${compareWindow.end_month}` : ''}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                const cw = filteredWindows.find((fw) => fw.end_year === y && fw.end_month === m);
                if (cw) handleCompareChange(cw);
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mulish text-sm text-white focus:border-orange focus:outline-none"
            >
              {filteredWindows.map((fw) => (
                <option key={`c-${fw.end_year}-${fw.end_month}`} value={`${fw.end_year}-${fw.end_month}`}>
                  {fw.start_label} \u2013 {fw.end_label}
                </option>
              ))}
            </select>
          )}

          {/* Coverage */}
          <div className="ml-auto flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${result.window.months_with_data >= 12 ? 'bg-green-400' : 'bg-orange'}`} />
            <span className="font-mulish text-xs text-stone">
              {result.window.months_with_data} of {result.window.actual_months} months have data
            </span>
          </div>
        </div>

        {isCompare && (
          <div className="mt-2 font-mulish text-xs text-stone">
            Comparing to: {compareResult.window.start_label} \u2013 {compareResult.window.end_label}
          </div>
        )}
        </>)}
      </div>

      {/* ── BY YEAR VIEW ────────────────────────────────────── */}
      {viewTab === 'yearly' && hasYearly && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="font-mulish text-xs text-stone bg-white/5 px-3 py-1 rounded-full">
              {yearlyData.length} calendar years | {yearlyData.reduce((s, y) => s + y.monthCount, 0)} total months of data
            </span>
          </div>
          <YearlyComparison years={yearlyData} />
          <YearlyCharts years={yearlyData} />
        </div>
      )}

      {/* ── SECTION 2: WATERFALL ────────────────────────────── */}
      {viewTab === 'rolling' && hasRolling && (<>

      <div className="card-dark">
        {/* Compare header */}
        {isCompare && (
          <div className="grid grid-cols-12 gap-2 px-3 pb-2 border-b border-white/10 mb-2">
            <div className="col-span-5 font-mulish text-xs text-stone"></div>
            <div className="col-span-3 text-right font-mulish text-xs text-orange">{result.window.end_label}</div>
            <div className="col-span-2 text-right font-mulish text-xs text-stone hidden sm:block">% Rev</div>
            <div className="col-span-2"></div>
            <div className="col-span-12 grid grid-cols-3 gap-2 pl-4 text-[10px] font-mulish text-stone">
              <div className="text-right">{compareResult.window.end_label}</div>
              <div className="text-right">\u0394 $</div>
              <div className="text-right">\u0394 %</div>
            </div>
          </div>
        )}

        <SectionHeader label="Revenue" />
        <WRow label="Total Revenue" value={w.revenue} revenue={w.revenue} isBold sparkData={sparkData.revenue} compare={cmpData('revenue')} />

        <SectionHeader label="Cost of Goods Sold" />
        <WRow label="Total COGS" value={w.total_cogs} revenue={w.revenue} sparkData={sparkData.cogs} compare={cmpData('total_cogs')} />

        <SectionHeader label="Gross Margin" />
        <WRow label="Gross Margin" value={w.gross_margin} revenue={w.revenue} isBold sparkData={sparkData.gross_margin} compare={cmpData('gross_margin')} />
        <div className="px-3 pb-2">
          <RatioBadge value={w.direct_lpr} colorFn={lprColor} label="Direct LPR" target="2.5x\u20133.5x" />
        </div>

        <SectionHeader label="Direct Labor" />
        <WRow label="Owner Direct Labor" value={w.owner_dl} revenue={w.revenue} compare={cmpData('owner_dl')} />
        <WRow label="Employee Direct Labor" value={w.employee_dl} revenue={w.revenue} compare={cmpData('employee_dl')} />
        <WRow label="Total Direct Labor" value={w.total_dl} revenue={w.revenue} isBold sparkData={sparkData.total_dl} compare={cmpData('total_dl')} />

        <SectionHeader label="Contribution Margin" />
        <WRow label="Contribution Margin" value={w.contribution_margin} revenue={w.revenue} isBold sparkData={sparkData.cm} compare={cmpData('contribution_margin')} />
        <div className="px-3 pb-2">
          <span className="font-sora text-xs text-stone">CM%: <span className="text-white font-bold">{fmtPct(w.cm_pct)}</span></span>
        </div>

        <SectionHeader label="Marketing" />
        <WRow label="Total Marketing" value={w.total_marketing} revenue={w.revenue} isBold sparkData={sparkData.marketing} compare={cmpData('total_marketing')} />
        <div className="px-3 pb-2">
          <RatioBadge value={w.mpr} colorFn={mprColor} label="MPR" target="5.0x+" />
        </div>

        <SectionHeader label="Operating Expenses" />
        <WRow label="Owner Management Wage" value={w.owner_mgmt} revenue={w.revenue} compare={cmpData('owner_mgmt')} />
        <WRow label="Rent & Facilities" value={w.total_rent} revenue={w.revenue} compare={cmpData('total_rent')} />
        <WRow label="Insurance" value={w.total_insurance} revenue={w.revenue} compare={cmpData('total_insurance')} />
        <WRow label="Software & Subscriptions" value={w.total_software} revenue={w.revenue} compare={cmpData('total_software')} />
        <WRow label="Payroll Taxes & Benefits" value={w.total_payroll_tax} revenue={w.revenue} compare={cmpData('total_payroll_tax')} />
        <WRow label="Other Operating Expenses" value={w.total_other_opex} revenue={w.revenue} compare={cmpData('total_other_opex')} />
        <WRow label="Total OpEx" value={w.total_opex} revenue={w.revenue} isBold sparkData={sparkData.opex} compare={cmpData('total_opex')} />
        <div className="px-3 pb-2">
          <RatioBadge value={w.manpr} colorFn={manprColor} label="ManPR" target="1.0x+" />
        </div>

        <SectionHeader label="Pretax Net Income" />
        <WRow label="Pretax Net Income" value={w.pretax_net_income} revenue={w.revenue} isBold sparkData={sparkData.pretax} compare={cmpData('pretax_net_income')} />
        <div className="px-3 pb-2">
          <TierBadge tier={s.profit_tier} />
          <span className="ml-3 font-sora text-sm text-white">Profit Score: <span className="text-orange font-bold">{s.profit_score}</span>/90</span>
        </div>

        <SectionHeader label="True Pretax (Diagnostic)" />
        <WRow label="Owner Pay Add-Back" value={w.owner_pay_total} revenue={w.revenue} />
        <WRow label="True Pretax Profit" value={w.true_pretax_profit} revenue={w.revenue} isBold />
        <WRow label={`Estimated Tax (${(w.tax_rate * 100).toFixed(0)}%)`} value={w.estimated_tax} revenue={w.revenue} isNeg />
        <WRow label="Post-Tax Cash Flow" value={w.post_tax_cash_flow} revenue={w.revenue} isBold />

        {w.interest_income > 0 && (
          <>
            <SectionHeader label="Non-Operating (Reference Only)" />
            <WRow label="Interest Income" value={w.interest_income} revenue={w.revenue} />
            <p className="px-3 pb-2 font-mulish text-[10px] text-stone/50">Excluded from ratio calculations</p>
          </>
        )}
      </div>

      {/* ── SECTION 3: TREND PANEL ──────────────────────────── */}
      {allWindowsData?.trend && allWindowsData.trend.labels.length > 1 && (
        <div className="space-y-4">
          <h2 className="font-sora text-lg font-bold text-white">Trend Over Time</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profit Score trend */}
            <div className="card-dark">
              <h3 className="font-mulish text-xs uppercase tracking-wide text-stone mb-2">Profit Score</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={allWindowsData.trend.labels.map((l, i) => ({
                  label: l, score: allWindowsData.trend.profit_scores[i],
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#8A8278" fontSize={9} angle={-45} textAnchor="end" height={50}
                    interval={allWindowsData.trend.labels.length > 12 ? 2 : 0} />
                  <YAxis domain={[0, 100]} stroke="#8A8278" fontSize={10} />
                  <RTooltip contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
                    formatter={(v) => [v, 'Score']} />
                  <Line type="monotone" dataKey="score" stroke="#F05001" strokeWidth={2} dot={{ r: 2, fill: '#F05001' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Three Ratios trend */}
            <div className="card-dark">
              <h3 className="font-mulish text-xs uppercase tracking-wide text-stone mb-2">Productivity Ratios</h3>
              <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={allWindowsData.trend.labels.map((l, i) => ({
                  label: l,
                  lpr: allWindowsData.trend.direct_lpr[i],
                  mpr: allWindowsData.trend.mpr[i],
                  manpr: allWindowsData.trend.manpr[i],
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#8A8278" fontSize={9} angle={-45} textAnchor="end" height={50}
                    interval={allWindowsData.trend.labels.length > 12 ? 2 : 0} />
                  <YAxis stroke="#8A8278" fontSize={10} />
                  <RTooltip contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
                    formatter={(v, name) => [fmtRatio(v), name]} />
                  <Legend />
                  <ReferenceLine y={2.5} stroke="#8A8278" strokeDasharray="4 4" />
                  <ReferenceLine y={5.0} stroke="#8A8278" strokeDasharray="4 4" />
                  <ReferenceLine y={1.0} stroke="#8A8278" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="lpr" stroke="#F05001" strokeWidth={2} name="Direct LPR" dot={false} />
                  <Line type="monotone" dataKey="mpr" stroke="#3b82f6" strokeWidth={2} name="MPR" dot={false} />
                  <Line type="monotone" dataKey="manpr" stroke="#22c55e" strokeWidth={2} name="ManPR" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue trend */}
          <div className="card-dark">
            <h3 className="font-mulish text-xs uppercase tracking-wide text-stone mb-2">Rolling 12 Revenue</h3>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={allWindowsData.trend.labels.map((l, i) => ({
                label: l, revenue: allWindowsData.trend.revenue[i],
              }))}>
                <XAxis dataKey="label" stroke="#8A8278" fontSize={8} angle={-45} textAnchor="end" height={40}
                  interval={allWindowsData.trend.labels.length > 12 ? 2 : 0} />
                <YAxis stroke="#8A8278" fontSize={9} tickFormatter={(v) => formatCompact(v)} />
                <RTooltip contentStyle={{ backgroundColor: '#162844', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
                  formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#F05001" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
