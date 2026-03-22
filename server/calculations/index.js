import { calculateWaterfall } from './waterfall.js';
import { calculateRatios } from './ratios.js';
import { calculateOwnerPayGap } from './ownerPayGap.js';
import { calculateBreakeven } from './breakeven.js';
import { calculateProfitTier } from './profitTier.js';
import { calculateFourForces } from './fourForces.js';
import { calculateProfitScore } from './profitScore.js';
import { generateStaticActionPlan } from './actionPlan.js';
import { calculateForecast } from './forecast.js';
import { calculateOwnerPayRoadmap } from './ownerPayRoadmap.js';

export function runFullCalculation(inputs) {
  const waterfall = calculateWaterfall(inputs);
  const ratios = calculateRatios(waterfall);
  const ownerPayGap = calculateOwnerPayGap(waterfall, inputs);
  const breakeven = calculateBreakeven(waterfall, inputs);
  // V4: Tier based on pretax_pct, not true_pretax_pct
  const profitTier = calculateProfitTier(waterfall.pretax_pct);
  const fourForces = calculateFourForces(waterfall, inputs);
  const profitScore = calculateProfitScore(ratios, waterfall, ownerPayGap);
  const actionPlan = generateStaticActionPlan(waterfall, ratios, ownerPayGap, profitTier);
  const forecast = calculateForecast(waterfall, inputs, 0);
  const ownerPayRoadmap = calculateOwnerPayRoadmap(ownerPayGap, waterfall, inputs);

  return {
    waterfall,
    ratios,
    ownerPayGap,
    breakeven,
    profitTier,
    fourForces,
    profitScore,
    actionPlan,
    forecast,
    ownerPayRoadmap,
  };
}

export { calculateWaterfall } from './waterfall.js';
export { calculateRatios } from './ratios.js';
export { calculateOwnerPayGap } from './ownerPayGap.js';
export { calculateBreakeven } from './breakeven.js';
export { calculateProfitTier } from './profitTier.js';
export { calculateFourForces } from './fourForces.js';
export { calculateHireImpact } from './hireCalc.js';
export { calculatePricing } from './pricingCalc.js';
export { calculateOwnerPayRoadmap } from './ownerPayRoadmap.js';
export { calculateScenario } from './scenarioModeler.js';
export { calculateForecast } from './forecast.js';
export { calculateWeeklyMetrics, calculateQTDSummary } from './weeklyScorecard.js';
export { calculateProfitScore } from './profitScore.js';
export { generateStaticActionPlan } from './actionPlan.js';
