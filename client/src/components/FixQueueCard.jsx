import { motion } from 'framer-motion';
import { formatCurrency } from '../utils/format.js';

const DIFFICULTY_COLORS = {
  Easy: '#22c55e',
  Medium: '#eab308',
  Hard: '#ef4444',
};

export default function FixQueueCard({ action, index, onComplete, compact = false }) {
  const diffColor = DIFFICULTY_COLORS[action.difficulty] || '#8A8278';

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-sora text-sm text-orange">{formatCurrency(action.dollar_impact)}</span>
          <span className="text-xs text-stone font-mulish truncate">{action.timeline}</span>
        </div>
        {onComplete && (
          <button
            onClick={() => onComplete(index)}
            className="shrink-0 px-2 py-1 text-xs font-sora bg-orange/10 text-orange rounded-lg
              hover:bg-orange/20 transition-colors"
          >
            Done
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="bg-navy-light border-l-4 border-orange rounded-lg p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-sora text-orange">#{index + 1}</span>
            <span className="text-xs font-mulish px-2 py-0.5 rounded-full bg-white/5 text-stone">
              {action.category}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: diffColor }} />
              <span className="text-xs font-mulish text-stone">{action.difficulty}</span>
            </span>
          </div>
          <p className="font-mulish text-sm text-white mb-2">{action.title}</p>
          <div className="flex items-center gap-4">
            <span className="font-sora text-lg text-orange">{formatCurrency(action.dollar_impact)}</span>
            <span className="text-xs text-stone font-mulish">{action.timeline}</span>
          </div>
        </div>
        {onComplete && (
          <button
            onClick={() => onComplete(index)}
            className="shrink-0 px-3 py-1.5 text-xs font-sora bg-orange/10 text-orange rounded-lg
              hover:bg-orange/20 transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </motion.div>
  );
}
