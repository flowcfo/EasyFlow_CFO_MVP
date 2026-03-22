import { motion } from 'framer-motion';
import { SCREEN_NAMES, TIER_RANK } from '../../../shared/constants.js';
import { useAuth } from '../hooks/useAuth.js';

export default function UnlockMap({ onScreenClick }) {
  const { user } = useAuth();
  const userRank = TIER_RANK[user?.tier] || 0;

  return (
    <div className="w-full overflow-x-auto py-4">
      <div className="flex items-center gap-1 min-w-max px-4">
        {SCREEN_NAMES.map((screen, i) => {
          const requiredRank = TIER_RANK[screen.tier] || 0;
          const unlocked = userRank >= requiredRank;

          return (
            <div key={screen.id} className="flex items-center">
              <motion.button
                onClick={() => onScreenClick?.(screen)}
                className={`relative flex flex-col items-center gap-1 group ${!unlocked ? 'cursor-pointer' : ''}`}
                whileHover={{ scale: 1.1 }}
                initial={false}
                animate={unlocked ? { opacity: 1 } : { opacity: 0.6 }}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-sora font-bold
                    ${unlocked
                      ? 'bg-orange text-white'
                      : 'border-2 border-stone text-stone'
                    }`}
                >
                  {unlocked ? screen.id : '🔒'}
                </div>
                <span className={`text-[10px] font-mulish whitespace-nowrap ${unlocked ? 'text-white' : 'text-stone'}`}>
                  {screen.name}
                </span>
              </motion.button>

              {i < SCREEN_NAMES.length - 1 && (
                <div className={`w-4 h-0.5 mx-0.5 ${unlocked ? 'bg-orange' : 'bg-stone/30'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
