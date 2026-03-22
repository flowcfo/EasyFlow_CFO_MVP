export function safeDivide(numerator, denominator) {
  if (!denominator || denominator === 0 || !isFinite(denominator)) return 0;
  const result = numerator / denominator;
  return isFinite(result) ? result : 0;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
