import { Router } from 'express';
import { authGuard, optionalAuth } from '../middleware/authGuard.js';
import { supabaseAdmin } from '../db/supabase.js';
import { runFullCalculation } from '../calculations/index.js';
import { validateInputs } from '../../shared/schema.js';
import { interpretScore } from '../ai/interpreter.js';
import { generateAIActionPlan } from '../ai/actionPlanGen.js';

const router = Router();

router.post('/snapshot', optionalAuth, async (req, res, next) => {
  try {
    const { inputs, label, period_type } = req.body;

    const validation = validateInputs(inputs);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid inputs', details: validation.errors });
    }

    const outputs = runFullCalculation(inputs);

    let interpretation = null;
    const userTier = req.user?.tier || 'free';
    const hasPaid = userTier !== 'free';
    if (hasPaid) {
      interpretation = await interpretScore(outputs, req.user?.user_type, req.brandName);
    } else {
      interpretation = {
        text: `Your Profit Score is ${outputs.profitScore.total_score} out of 100. Unlock the full AI interpretation with Clarity.`,
        source: 'teaser',
      };
    }

    let snapshotId = null;
    if (req.user) {
      const { data: snapshot } = await supabaseAdmin
        .from('snapshots')
        .insert({
          user_id: req.user.id,
          label: label || `Snapshot ${new Date().toLocaleDateString()}`,
          period_type: period_type || 'annual',
          inputs,
          outputs,
        })
        .select('id')
        .single();

      snapshotId = snapshot?.id;

      const scoreEntry = {
        date: new Date().toISOString(),
        score: outputs.profitScore.total_score,
        tier: outputs.profitTier.tier,
      };

      const { data: existingProgress } = await supabaseAdmin
        .from('game_progress')
        .select('score_history, profit_tier')
        .eq('user_id', req.user.id)
        .single();

      const previousTier = existingProgress?.profit_tier || 1;
      const newTier = outputs.profitTier.tier;
      const levelUp = newTier > previousTier;

      if (levelUp) {
        scoreEntry.level_up = true;
      }

      const history = existingProgress?.score_history || [];
      history.push(scoreEntry);

      let fixQueue = outputs.actionPlan.actions;
      const hasAIPlan = ['control', 'harvest', 'partner_starter', 'partner_growth', 'partner_scale'].includes(userTier);
      if (hasAIPlan) {
        const aiActions = await generateAIActionPlan(outputs, req.user?.user_type, req.brandName);
        if (aiActions) {
          fixQueue = aiActions;
        }
      }

      await supabaseAdmin
        .from('game_progress')
        .upsert({
          user_id: req.user.id,
          profit_score: outputs.profitScore.total_score,
          profit_tier: newTier,
          fix_queue: fixQueue,
          score_history: history,
        }, { onConflict: 'user_id' });
    }

    res.json({
      snapshot_id: snapshotId,
      outputs,
      interpretation,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/snapshots', authGuard, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('snapshots')
      .select('id, label, period_type, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ snapshots: data });
  } catch (err) {
    next(err);
  }
});

router.get('/snapshots/:id', authGuard, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('snapshots')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    res.json({ snapshot: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/snapshots/:id', authGuard, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('snapshots')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Snapshot deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
