import { safeDivide, round2 } from './utils.js';

export function calculatePricing(pricingInputs) {
  // Workbook PRICING_CALC B6-B10
  const labor_hours = pricingInputs.labor_hours || 0;
  const hourly_rate = pricingInputs.hourly_rate || 0;
  const materials_cogs = pricingInputs.materials || 0;
  const total_direct_cost = (labor_hours * hourly_rate) + materials_cogs;

  // Price at different multipliers (workbook PRICING_CALC B15-B21)
  const multipliers = [2.0, 2.5, 2.75, 3.0, 3.5, 4.0, 5.0];
  const pricing_tiers = multipliers.map((multiplier) => {
    const price = total_direct_cost * multiplier;
    const gross_margin = price - materials_cogs;
    const gm_pct = safeDivide(gross_margin, price);
    const contribution_margin = price - total_direct_cost;
    const cm_pct = safeDivide(contribution_margin, price);
    const cm_per_hour = labor_hours > 0 ? contribution_margin / labor_hours : 0;
    const meets_target = cm_pct >= 0.40;

    return {
      multiplier,
      price: round2(price),
      gross_margin: round2(gross_margin),
      gm_pct,
      contribution_margin: round2(contribution_margin),
      cm_pct,
      cm_per_hour: round2(cm_per_hour),
      meets_target,
    };
  });

  // Reverse calculator (workbook PRICING_CALC B27-B28)
  const target_cm_pct = pricingInputs.target_cm_pct || 0.40;
  const required_price = target_cm_pct < 1 ? total_direct_cost / (1 - target_cm_pct) : 0;
  const implied_multiplier = safeDivide(required_price, total_direct_cost);

  // Break-even and minimum prices (workbook PRICING_CALC B45-B47)
  const breakeven_price = total_direct_cost;
  const minimum_viable_price = total_direct_cost > 0 ? total_direct_cost / 0.8 : 0;
  const target_price = total_direct_cost > 0 ? total_direct_cost / 0.6 : 0;

  return {
    labor_hours,
    hourly_rate,
    materials_cogs,
    total_direct_cost: round2(total_direct_cost),
    pricing_tiers,
    target_cm_pct,
    required_price: round2(required_price),
    implied_multiplier,
    breakeven_price: round2(breakeven_price),
    minimum_viable_price: round2(minimum_viable_price),
    target_price: round2(target_price),
  };
}
