import { PROFIT_TIER_THRESHOLDS, TIER_MESSAGES, TIER_COLORS } from '../../shared/constants.js';

// V4: Tier scoring based on pretax_pct (pretax_net_income / revenue), not true_pretax_pct
export function calculateProfitTier(pretax_pct) {
  for (let i = PROFIT_TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    const t = PROFIT_TIER_THRESHOLDS[i];
    if (pretax_pct >= t.min) {
      return {
        tier: t.tier,
        label: t.label,
        message: TIER_MESSAGES[t.tier],
        color: TIER_COLORS[t.tier],
        pretax_pct,
      };
    }
  }

  return {
    tier: 1,
    label: 'Crisis',
    message: TIER_MESSAGES[1],
    color: TIER_COLORS[1],
    pretax_pct,
  };
}
