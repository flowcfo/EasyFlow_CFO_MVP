import { PROFIT_SCORE_WEIGHTS } from '../../shared/constants.js';

function scoreFromThresholds(value, thresholds) {
  for (const t of thresholds) {
    if (value >= t.min) return t.pts;
  }
  return 0;
}

// V4: Profit Score uses pretax_pct (not true_pretax_pct)
export function calculateProfitScore(ratios, waterfall, ownerPayGapData) {
  const direct_lpr_score = scoreFromThresholds(
    ratios.direct_lpr,
    PROFIT_SCORE_WEIGHTS.direct_lpr.thresholds
  );

  const mpr_score = scoreFromThresholds(
    ratios.mpr,
    PROFIT_SCORE_WEIGHTS.mpr.thresholds
  );

  const manpr_score = scoreFromThresholds(
    ratios.manpr,
    PROFIT_SCORE_WEIGHTS.manpr.thresholds
  );

  const pretax_pct_score = scoreFromThresholds(
    waterfall.pretax_pct,
    PROFIT_SCORE_WEIGHTS.pretax_pct.thresholds
  );

  const gap_pct = ownerPayGapData.gap_pct;
  let owner_pay_gap_score = 0;
  if (gap_pct <= 0) {
    owner_pay_gap_score = 10;
  } else if (gap_pct <= 0.20) {
    owner_pay_gap_score = 7;
  } else if (gap_pct <= 0.50) {
    owner_pay_gap_score = 4;
  }

  const total_score = direct_lpr_score + mpr_score + manpr_score + pretax_pct_score + owner_pay_gap_score;

  return {
    total_score,
    components: {
      direct_lpr: { score: direct_lpr_score, max: 25, value: ratios.direct_lpr },
      mpr: { score: mpr_score, max: 20, value: ratios.mpr },
      manpr: { score: manpr_score, max: 20, value: ratios.manpr },
      pretax_profit: { score: pretax_pct_score, max: 25, value: waterfall.pretax_pct },
      owner_pay_gap: { score: owner_pay_gap_score, max: 10, value: gap_pct },
    },
  };
}
