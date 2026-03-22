import { motion } from 'framer-motion';

export default function ProfitGauge({ score = 0, size = 240, animated = true, pulsing = false }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const fillLength = (score / 100) * arcLength;
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#162844"
          strokeWidth="12"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135 ${center} ${center})`}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#F05001"
          strokeWidth="12"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(135 ${center} ${center})`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: arcLength - fillLength }}
          transition={animated ? { duration: 1.5, ease: 'easeOut' } : { duration: 0 }}
          className={pulsing ? 'animate-pulse-slow' : ''}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score > 0 ? (
          <>
            <span className="font-sora text-5xl font-bold text-white">{Math.round(score)}</span>
            <span className="font-mulish text-sm text-stone mt-1">out of 100</span>
          </>
        ) : pulsing ? (
          <span className="font-sora text-lg text-stone">?</span>
        ) : (
          <span className="font-sora text-3xl font-bold text-stone">0</span>
        )}
      </div>
    </div>
  );
}
