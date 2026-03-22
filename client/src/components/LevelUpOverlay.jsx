import { motion, AnimatePresence } from 'framer-motion';
import { tierColor } from '../utils/format.js';
import TierBadge from './TierBadge.jsx';
import { useGame } from '../hooks/useGame.js';

export default function LevelUpOverlay() {
  const { levelUpEvent, clearLevelUp } = useGame();

  if (!levelUpEvent) return null;

  const color = tierColor(levelUpEvent.newTier);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={clearLevelUp}
      >
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.4 }}
          style={{ backgroundColor: color }}
        />

        <div className="absolute inset-0 bg-navy/90" />

        <motion.div
          className="relative z-10 text-center"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <motion.p
            className="font-sora text-2xl text-white mb-6"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Level Up!
          </motion.p>

          <TierBadge tier={levelUpEvent.newTier} large animated />

          <motion.p
            className="font-mulish text-stone mt-6 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Tap anywhere to continue
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
