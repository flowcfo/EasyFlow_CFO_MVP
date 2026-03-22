import { statusColor } from '../utils/format.js';

export default function CircularGauge({ value, max, status, label, size = 100 }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const color = statusColor(status);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke="#162844" strokeWidth="6"
          />
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-sora font-bold text-white" style={{ fontSize: size * 0.2 }}>
            {value === 0 && status === 'none' ? '—' : `${value.toFixed(1)}x`}
          </span>
        </div>
      </div>
      {label && <span className="font-mulish text-xs text-stone">{label}</span>}
    </div>
  );
}
