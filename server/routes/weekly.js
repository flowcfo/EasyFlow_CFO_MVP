import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { tierGuard } from '../middleware/tierGuard.js';
import { supabaseAdmin } from '../db/supabase.js';
import { calculateWeeklyMetrics, calculateQTDSummary } from '../calculations/weeklyScorecard.js';

const router = Router();

router.post('/entry', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const { week_ending, revenue, cogs, direct_labor, marketing, notes } = req.body;

    if (!week_ending || revenue === undefined) {
      return res.status(400).json({ error: 'week_ending and revenue are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('weekly_entries')
      .insert({
        user_id: req.user.id,
        week_ending,
        revenue: revenue || 0,
        cogs: cogs || 0,
        direct_labor: direct_labor || 0,
        marketing: marketing || 0,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    const today = new Date();
    const { data: gameProgress } = await supabaseAdmin
      .from('game_progress')
      .select('current_streak, longest_streak, last_checkin_date')
      .eq('user_id', req.user.id)
      .single();

    let newStreak = 1;
    if (gameProgress?.last_checkin_date) {
      const lastDate = new Date(gameProgress.last_checkin_date);
      const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 10) {
        newStreak = (gameProgress.current_streak || 0) + 1;
      }
    }

    const longestStreak = Math.max(newStreak, gameProgress?.longest_streak || 0);

    await supabaseAdmin
      .from('game_progress')
      .update({
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_checkin_date: today.toISOString().split('T')[0],
      })
      .eq('user_id', req.user.id);

    res.json({ entry: data, streak: newStreak });
  } catch (err) {
    next(err);
  }
});

router.get('/entries', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('weekly_entries')
      .select('*')
      .eq('user_id', req.user.id)
      .order('week_ending', { ascending: false })
      .limit(52);

    if (error) throw error;
    res.json({ entries: data });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const { data: entries } = await supabaseAdmin
      .from('weekly_entries')
      .select('*')
      .eq('user_id', req.user.id)
      .gte('week_ending', quarterStart.toISOString().split('T')[0])
      .order('week_ending', { ascending: false });

    const { data: latestSnapshot } = await supabaseAdmin
      .from('snapshots')
      .select('outputs')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const annualTarget = latestSnapshot?.outputs?.waterfall?.total_revenue || 0;
    const targetCmPct = latestSnapshot?.outputs?.waterfall?.cm_pct || 0.30;

    const targets = {
      annual_revenue_target: annualTarget,
      target_cm_pct: targetCmPct,
    };

    const weeklyMetrics = (entries || []).map((e) => ({
      ...calculateWeeklyMetrics(e, targets),
      week_ending: e.week_ending,
      notes: e.notes,
    }));

    const summary = calculateQTDSummary(entries || [], targets);

    res.json({ weeks: weeklyMetrics, summary });
  } catch (err) {
    next(err);
  }
});

export default router;
