const BASE_UNIT = 100000;

export function anonymizeOutputs(outputs) {
  if (!outputs) return {};

  const w = outputs.waterfall || {};
  const revenue = w.total_revenue || 0;

  const safe = {
    revenue_index: revenue / BASE_UNIT,
    gm_pct: w.gm_pct || 0,
    cm_pct: w.cm_pct || 0,
    pretax_pct: w.pretax_pct || 0,
    true_pretax_pct: w.true_pretax_pct || 0,
    cogs_pct: revenue > 0 ? (w.total_cogs || 0) / revenue : 0,
    direct_labor_pct: revenue > 0 ? (w.total_direct_labor || 0) / revenue : 0,
    marketing_pct: revenue > 0 ? (w.total_marketing || 0) / revenue : 0,
    opex_pct: revenue > 0 ? (w.total_opex || 0) / revenue : 0,
    owner_direct_labor_pct: revenue > 0 ? (w.owner_direct_labor || 0) / revenue : 0,
    owner_mgmt_wage_pct: revenue > 0 ? (w.owner_management_wage || 0) / revenue : 0,
  };

  if (outputs.ratios) {
    safe.direct_lpr = outputs.ratios.direct_lpr || 0;
    safe.mpr = outputs.ratios.mpr || 0;
    safe.manpr = outputs.ratios.manpr || 0;
    safe.direct_lpr_status = outputs.ratios.direct_lpr_status;
    safe.mpr_status = outputs.ratios.mpr_status;
    safe.manpr_status = outputs.ratios.manpr_status;
  }

  if (outputs.profitTier) {
    safe.profit_tier = outputs.profitTier.tier;
    safe.profit_tier_label = outputs.profitTier.label;
  }

  if (outputs.profitScore) {
    safe.profit_score = outputs.profitScore.total_score;
    if (outputs.profitScore.components) {
      safe.score_components = {};
      for (const [k, v] of Object.entries(outputs.profitScore.components)) {
        safe.score_components[k] = { score: v.score, max: v.max };
      }
    }
  }

  if (outputs.ownerPayGap) {
    safe.gap_pct = outputs.ownerPayGap.gap_pct || 0;
    safe.gap_as_revenue_pct = revenue > 0
      ? (outputs.ownerPayGap.owner_pay_gap || 0) / revenue
      : 0;
  }

  if (outputs.breakeven) {
    safe.breakeven_scenarios = (outputs.breakeven.scenarios || []).map((s) => ({
      target_profit_pct: s.target_profit_pct,
      required_revenue_index: (s.required_revenue || 0) / BASE_UNIT,
    }));
  }

  if (outputs.fourForces) {
    const ocf = outputs.fourForces.operating_cash_flow || 0;
    safe.four_forces = {
      tax_reserve_pct: ocf > 0 ? (outputs.fourForces.force1_tax_reserve || 0) / ocf : 0,
      debt_service_pct: ocf > 0 ? (outputs.fourForces.force2_debt_service || 0) / ocf : 0,
      core_capital_pct: ocf > 0 ? (outputs.fourForces.force3_core_capital || 0) / ocf : 0,
      distribution_pct: ocf > 0 ? (outputs.fourForces.force4_distribution || 0) / ocf : 0,
      distribution_positive: (outputs.fourForces.force4_distribution || 0) >= 0,
    };
  }

  return safe;
}

export function anonymizeWeeklyEntry(entry, annualRevenue) {
  if (!entry) return {};
  const weeklyRev = Number(entry.revenue) || 0;
  return {
    revenue_index: weeklyRev / BASE_UNIT,
    revenue_vs_target: annualRevenue > 0 ? weeklyRev / (annualRevenue / 52) : 0,
    cm_pct: weeklyRev > 0
      ? (weeklyRev - (Number(entry.cogs) || 0) - (Number(entry.direct_labor) || 0)) / weeklyRev
      : 0,
    direct_lpr: (Number(entry.direct_labor) || 0) > 0
      ? (weeklyRev - (Number(entry.cogs) || 0)) / (Number(entry.direct_labor) || 0)
      : 0,
  };
}

export function reconstructDollars(aiText, outputs) {
  if (!aiText || !outputs) return aiText;

  const w = outputs.waterfall || {};
  const revenue = w.total_revenue || 0;

  let text = aiText;

  text = text.replace(/revenue_index[:\s]+(\d+\.?\d*)/gi, (_, val) => {
    const dollars = parseFloat(val) * BASE_UNIT;
    return `$${Math.round(dollars).toLocaleString()}`;
  });

  text = text.replace(/(\d+\.?\d*)%\s*of\s*revenue/gi, (match, pct) => {
    const dollars = revenue * (parseFloat(pct) / 100);
    return `$${Math.round(dollars).toLocaleString()} (${match})`;
  });

  text = text.replace(/impact_pct[:\s]+(\d+\.?\d*)%?/gi, (_, pct) => {
    const dollars = revenue * (parseFloat(pct) / 100);
    return `$${Math.round(dollars).toLocaleString()} annual impact`;
  });

  return text;
}

export function reconstructActionPlan(actions, outputs) {
  if (!actions || !outputs) return actions;
  const revenue = outputs.waterfall?.total_revenue || 0;

  return actions.map((action) => {
    const impactPct = action.impact_pct || 0;
    return {
      ...action,
      dollar_impact: Math.round(revenue * (impactPct / 100)),
      specific_instruction: reconstructDollars(action.specific_instruction || '', outputs),
    };
  });
}
