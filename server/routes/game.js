import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { supabaseAdmin } from '../db/supabase.js';

const router = Router();

router.get('/progress', authGuard, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('game_progress')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.json({
        profit_score: 0,
        profit_tier: 1,
        current_streak: 0,
        longest_streak: 0,
        fix_queue: [],
        score_history: [],
      });
    }

    let streakMessage = null;
    const streakMilestones = {
      4: 'You are building a habit.',
      8: 'Two months of clarity.',
      12: 'This is what financial control looks like.',
      52: 'One full year. You own your numbers.',
    };
    if (streakMilestones[data.current_streak]) {
      streakMessage = streakMilestones[data.current_streak];
    }

    let streakAtRisk = false;
    if (data.last_checkin_date) {
      const daysSince = Math.floor(
        (new Date() - new Date(data.last_checkin_date)) / (1000 * 60 * 60 * 24)
      );
      streakAtRisk = daysSince >= 6 && daysSince <= 10;
    }

    res.json({
      ...data,
      streak_message: streakMessage,
      streak_at_risk: streakAtRisk,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/complete-action', authGuard, async (req, res, next) => {
  try {
    const { action_index } = req.body;

    const { data: progress } = await supabaseAdmin
      .from('game_progress')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (!progress) {
      return res.status(404).json({ error: 'No game progress found' });
    }

    const fixQueue = progress.fix_queue || [];
    if (action_index < 0 || action_index >= fixQueue.length) {
      return res.status(400).json({ error: 'Invalid action index' });
    }

    const completedAction = {
      ...fixQueue[action_index],
      completed_at: new Date().toISOString(),
    };

    const completedActions = [...(progress.completed_actions || []), completedAction];
    const newQueue = fixQueue.filter((_, i) => i !== action_index);

    const scoreBoost = completedAction.score_impact || 0;
    const newScore = Math.min(100, (progress.profit_score || 0) + scoreBoost);

    await supabaseAdmin
      .from('game_progress')
      .update({
        fix_queue: newQueue,
        completed_actions: completedActions,
        profit_score: newScore,
      })
      .eq('user_id', req.user.id);

    res.json({
      completed_action: completedAction,
      new_score: newScore,
      remaining_queue: newQueue,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/checkin', authGuard, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: progress } = await supabaseAdmin
      .from('game_progress')
      .select('current_streak, longest_streak, last_checkin_date')
      .eq('user_id', req.user.id)
      .single();

    let newStreak = 1;
    if (progress?.last_checkin_date) {
      const daysDiff = Math.floor(
        (new Date() - new Date(progress.last_checkin_date)) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff <= 10) {
        newStreak = (progress.current_streak || 0) + 1;
      }
    }

    const longestStreak = Math.max(newStreak, progress?.longest_streak || 0);

    await supabaseAdmin
      .from('game_progress')
      .update({
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_checkin_date: today,
      })
      .eq('user_id', req.user.id);

    res.json({ streak: newStreak, longest: longestStreak });
  } catch (err) {
    next(err);
  }
});

export default router;
