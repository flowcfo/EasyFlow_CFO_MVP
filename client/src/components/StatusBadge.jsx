import { statusColor } from '../utils/format.js';

export default function StatusBadge({ status, label }) {
  const color = statusColor(status);
  const displayLabel = label || status?.toUpperCase() || 'N/A';

  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-sora font-semibold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {displayLabel}
    </span>
  );
}
