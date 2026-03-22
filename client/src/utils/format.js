export function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return '$0';
  const abs = Math.abs(n);
  const formatted = abs >= 1000
    ? `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `-${formatted}` : formatted;
}

export function formatPercent(n) {
  if (n === null || n === undefined || isNaN(n)) return '0.0%';
  return `${(n * 100).toFixed(1)}%`;
}

export function formatMultiplier(n) {
  if (n === null || n === undefined || isNaN(n)) return '0.0x';
  return `${n.toFixed(2)}x`;
}

export function formatCompact(n) {
  if (n === null || n === undefined || isNaN(n)) return '$0';
  const abs = Math.abs(n);
  let formatted;
  if (abs >= 1000000) formatted = `$${(abs / 1000000).toFixed(1)}M`;
  else if (abs >= 1000) formatted = `$${(abs / 1000).toFixed(0)}K`;
  else formatted = `$${abs.toFixed(0)}`;
  return n < 0 ? `-${formatted}` : formatted;
}

export function tierColor(tier) {
  const colors = {
    1: '#dc2626',
    2: '#F05001',
    3: '#eab308',
    4: '#22c55e',
    5: '#f59e0b',
  };
  return colors[tier] || '#8A8278';
}

export function statusColor(status) {
  const colors = {
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
    blue: '#3b82f6',
    none: '#8A8278',
  };
  return colors[status] || '#8A8278';
}
