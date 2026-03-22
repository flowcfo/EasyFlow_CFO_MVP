import { safeDivide } from './utils.js';
import { LPR_THRESHOLDS } from '../../shared/constants.js';

function getDirectLprStatus(value) {
  if (value === 0) return 'none';
  if (value > LPR_THRESHOLDS.direct_lpr.blue) return 'blue';
  if (value >= LPR_THRESHOLDS.direct_lpr.green) return 'green';
  if (value >= LPR_THRESHOLDS.direct_lpr.yellow) return 'yellow';
  return 'red';
}

function getMprStatus(value) {
  if (value === 0) return 'none';
  if (value >= LPR_THRESHOLDS.mpr.green) return 'green';
  if (value >= LPR_THRESHOLDS.mpr.yellow) return 'yellow';
  return 'red';
}

function getManprStatus(value) {
  if (value === 0) return 'none';
  if (value >= LPR_THRESHOLDS.manpr.green) return 'green';
  if (value >= LPR_THRESHOLDS.manpr.yellow) return 'yellow';
  return 'red';
}

export function calculateRatios(waterfall) {
  // V4: Direct LPR = Gross Margin / Direct Labor (target 2.5x-3.5x)
  const direct_lpr = safeDivide(waterfall.gross_margin, waterfall.total_direct_labor);

  // V4: MPR = Gross Margin / Marketing (target 5x)
  const mpr = safeDivide(waterfall.gross_margin, waterfall.total_marketing);

  // V4: ManPR = Contribution Margin / total_opex (target 1.0x)
  const manpr = safeDivide(waterfall.contribution_margin, waterfall.total_opex);

  return {
    direct_lpr,
    direct_lpr_status: getDirectLprStatus(direct_lpr),
    direct_lpr_target_low: LPR_THRESHOLDS.direct_lpr.target_low,
    direct_lpr_target_high: LPR_THRESHOLDS.direct_lpr.target_high,
    direct_lpr_is_zero_denom: waterfall.total_direct_labor === 0,

    mpr,
    mpr_status: getMprStatus(mpr),
    mpr_target: LPR_THRESHOLDS.mpr.target,
    mpr_is_zero_denom: waterfall.total_marketing === 0,

    manpr,
    manpr_status: getManprStatus(manpr),
    manpr_target: LPR_THRESHOLDS.manpr.target,
    manpr_is_zero_denom: waterfall.total_opex === 0,
  };
}
