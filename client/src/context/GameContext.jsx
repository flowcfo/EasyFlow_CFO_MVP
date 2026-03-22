import { createContext, useState, useEffect } from 'react';
import { api } from '../utils/api.js';
import { useAuth } from '../hooks/useAuth.js';

export const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { user } = useAuth();
  const [gameProgress, setGameProgress] = useState(null);
  const [levelUpEvent, setLevelUpEvent] = useState(null);

  useEffect(() => {
    if (user) {
      loadProgress();
    } else {
      setGameProgress(null);
    }
  }, [user?.id]);

  async function loadProgress() {
    try {
      const data = await api.get('/game/progress');
      setGameProgress(data);
    } catch {
      // silent fail for unauthenticated
    }
  }

  async function completeAction(actionIndex) {
    try {
      const data = await api.post('/game/complete-action', { action_index: actionIndex });
      setGameProgress((prev) => ({
        ...prev,
        profit_score: data.new_score,
        fix_queue: data.remaining_queue,
        completed_actions: [...(prev?.completed_actions || []), data.completed_action],
      }));
      return data;
    } catch (err) {
      throw err;
    }
  }

  function triggerLevelUp(oldTier, newTier) {
    setLevelUpEvent({ oldTier, newTier });
  }

  function clearLevelUp() {
    setLevelUpEvent(null);
  }

  return (
    <GameContext.Provider
      value={{
        gameProgress,
        levelUpEvent,
        loadProgress,
        completeAction,
        triggerLevelUp,
        clearLevelUp,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
