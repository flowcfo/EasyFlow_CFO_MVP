import { safeDivide } from './utils.js';

export function calculateWeeklyMetrics(entry, targets) {
  const { revenue, cogs, direct_labor, marketing } = entry;
  const { annual_revenue_target, target_cm_pct = 0.30 } = targets;

  const weekly_revenue_target = annual_revenue_target / 52;
  const weekly_cm = revenue - cogs - direct_labor;
  const weekly_cm_pct = safeDivide(weekly_cm, revenue);
  const weekly_gm = revenue - cogs;
  const weekly_direct_lpr = safeDivide(weekly_gm, direct_labor);

  let status;
  if (revenue >= weekly_revenue_target && weekly_cm_pct >= target_cm_pct) {
    status = 'green';
  } else if (revenue >= weekly_revenue_target * 0.80 || weekly_cm_pct >= target_cm_pct * 0.80) {
    status = 'yellow';
  } else {
    status = 'red';
  }

  return {
    weekly_revenue_target,
    revenue,
    weekly_cm,
    weekly_cm_pct,
    weekly_direct_lpr,
    status,
  };
}

export function calculateQTDSummary(entries, targets) {
  if (!entries || entries.length === 0) {
    return {
      total_revenue: 0,
      total_cm: 0,
      avg_weekly_revenue: 0,
      avg_cm_pct: 0,
      green_weeks: 0,
      red_weeks: 0,
      yellow_weeks: 0,
      weeks_count: 0,
    };
  }

  const metrics = entries.map((e) => calculateWeeklyMetrics(e, targets));

  const total_revenue = entries.reduce((s, e) => s + e.revenue, 0);
  const total_cm = metrics.reduce((s, m) => s + m.weekly_cm, 0);
  const avg_weekly_revenue = total_revenue / entries.length;
  const avg_cm_pct = safeDivide(total_cm, total_revenue);
  const green_weeks = metrics.filter((m) => m.status === 'green').length;
  const yellow_weeks = metrics.filter((m) => m.status === 'yellow').length;
  const red_weeks = metrics.filter((m) => m.status === 'red').length;

  return {
    total_revenue,
    total_cm,
    avg_weekly_revenue,
    avg_cm_pct,
    green_weeks,
    yellow_weeks,
    red_weeks,
    weeks_count: entries.length,
  };
}
