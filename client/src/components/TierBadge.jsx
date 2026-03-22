import { motion } from 'framer-motion';
import { tierColor } from '../utils/format.js';

const TIER_LABELS = {
  1: 'Survival Mode',
  2: 'Getting Traction',
  3: 'Stable Ground',
  4: 'Profit Machine',
  5: 'Wealth Mode',
};

export default function TierBadge({ tier, large = false, animated = true }) {
  const color = tierColor(tier);
  const label = TIER_LABELS[tier] || 'Unknown';
  const isGold = tier === 5;

  const badge = (
    <div
      className={`inline-flex items-center gap-2 rounded-full font-sora font-semibold
        ${large ? 'px-6 py-3 text-lg' : 'px-4 py-1.5 text-sm'}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `2px solid ${color}`,
        boxShadow: isGold ? `0 0 20px ${color}40` : 'none',
      }}
    >
      <span className="font-bold">Level {tier}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );

  if (!animated) return badge;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
    >
      {badge}
    </motion.div>
  );
}
