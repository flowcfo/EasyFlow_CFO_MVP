import { motion } from 'framer-motion';

export default function StreakDisplay({ streak = 0, atRisk = false }) {
  if (streak === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <motion.span
        className="text-lg"
        animate={atRisk ? { scale: [1, 1.2, 1] } : { scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: atRisk ? 0.8 : 2 }}
      >
        🔥
      </motion.span>
      <span className="font-sora text-sm font-bold text-orange">{streak}</span>
      {atRisk && (
        <span className="text-xs text-status-yellow font-mulish">at risk</span>
      )}
    </div>
  );
}
