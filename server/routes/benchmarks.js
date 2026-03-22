import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { tierGuard } from '../middleware/tierGuard.js';
import { supabaseAdmin } from '../db/supabase.js';

const router = Router();

router.get('/:industry/:band', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const { industry, band } = req.params;

    const { data, error } = await supabaseAdmin
      .from('benchmarks')
      .select('*')
      .eq('industry', industry)
      .eq('revenue_band', band)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No benchmark data available for this industry and revenue band' });
    }

    res.json({ benchmark: data });
  } catch (err) {
    next(err);
  }
});

export default router;
