import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { authGuard } from '../middleware/authGuard.js';
import { tierGuard } from '../middleware/tierGuard.js';
import { supabaseAdmin } from '../db/supabase.js';

const router = Router();

const NAVY = '#0E1B2E';
const ORANGE = '#F05001';
const OFFWHITE = '#F5F3F0';
const STONE = '#8A8278';

function createBasePDF(res, title, businessName) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s/g, '_')}.pdf"`);
  doc.pipe(res);

  doc.rect(0, 0, 612, 80).fill(NAVY);
  doc.fontSize(20).fill('#FFFFFF').text('EasyFlow CFO', 50, 25);
  doc.fontSize(10).fill(ORANGE).text('Your Numbers Made Easy.', 50, 50);

  if (businessName) {
    doc.fontSize(10).fill('#FFFFFF').text(businessName, 350, 25, { align: 'right', width: 212 });
  }
  doc.fontSize(8).fill('#FFFFFF').text(new Date().toLocaleDateString(), 350, 42, { align: 'right', width: 212 });

  doc.moveDown(3);
  doc.fill(NAVY);

  return doc;
}

function addFooter(doc) {
  const y = doc.page.height - 40;
  doc.fontSize(8).fill(STONE).text('Your Numbers Made Easy. easyflowcfo.com', 50, y, { align: 'center', width: 512 });
}

async function getLatestSnapshot(userId) {
  const { data } = await supabaseAdmin
    .from('snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

router.post('/score-card', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const snapshot = await getLatestSnapshot(req.user.id);
    if (!snapshot) return res.status(404).json({ error: 'No snapshot found' });

    const { outputs } = snapshot;
    const doc = createBasePDF(res, 'Profit Score Card', req.user.business_name);

    doc.fontSize(24).fill(NAVY).text('Profit Score Card', { align: 'center' });
    doc.moveDown();

    doc.fontSize(60).fill(ORANGE).text(`${outputs.profitScore.total_score}`, { align: 'center' });
    doc.fontSize(14).fill(STONE).text('out of 100', { align: 'center' });
    doc.moveDown();

    const tier = outputs.profitTier;
    doc.fontSize(18).fill(tier.color).text(`Level ${tier.tier}: ${tier.label}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).fill(NAVY);
    const components = outputs.profitScore.components;
    const rows = [
      ['Direct LPR', `${components.direct_lpr.score}/${components.direct_lpr.max}`, `${components.direct_lpr.value.toFixed(2)}x`],
      ['MPR', `${components.mpr.score}/${components.mpr.max}`, `${components.mpr.value.toFixed(2)}x`],
      ['ManPR', `${components.manpr.score}/${components.manpr.max}`, `${components.manpr.value.toFixed(2)}x`],
      ['Pretax Profit', `${components.pretax_profit.score}/${components.pretax_profit.max}`, `${(components.pretax_profit.value * 100).toFixed(1)}%`],
      ['Owner Pay Gap', `${components.owner_pay_gap.score}/${components.owner_pay_gap.max}`, `${(components.owner_pay_gap.value * 100).toFixed(1)}%`],
    ];

    rows.forEach(([label, score, value]) => {
      doc.text(`${label}: ${score} points (${value})`);
    });

    doc.moveDown(2);
    doc.fontSize(14).fill(NAVY);
    doc.text(`Revenue: $${outputs.waterfall.total_revenue.toLocaleString()}`);
    doc.text(`Pretax Profit: ${(outputs.waterfall.pretax_pct * 100).toFixed(1)}%`);
    doc.text(`Owner Pay Gap: $${outputs.ownerPayGap.owner_pay_gap.toLocaleString()}`);

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});

router.post('/owner-pay-gap', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const snapshot = await getLatestSnapshot(req.user.id);
    if (!snapshot) return res.status(404).json({ error: 'No snapshot found' });

    const { outputs } = snapshot;
    const doc = createBasePDF(res, 'Owner Pay Gap Report', req.user.business_name);

    doc.fontSize(24).fill(NAVY).text('Owner Pay Gap Report', { align: 'center' });
    doc.moveDown();

    const gap = outputs.ownerPayGap;
    doc.fontSize(36).fill('#ef4444').text(`$${Math.abs(gap.owner_pay_gap).toLocaleString()}`, { align: 'center' });
    doc.fontSize(12).fill(STONE).text('You are leaving this amount per year on the table.', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).fill(NAVY);
    doc.text(`Current Total Comp: $${gap.current_total_owner_pay.toLocaleString()}`);
    doc.text(`Market Rate Wage: $${gap.owner_market_wage_annual.toLocaleString()}`);
    doc.text(`Target Total Comp: $${gap.target_total_owner_comp.toLocaleString()}`);
    doc.text(`Monthly Gap: $${Math.abs(gap.monthly_gap).toLocaleString()}`);

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});

router.post('/breakeven-sheet', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const snapshot = await getLatestSnapshot(req.user.id);
    if (!snapshot) return res.status(404).json({ error: 'No snapshot found' });

    const { outputs } = snapshot;
    const doc = createBasePDF(res, 'Breakeven Truth Sheet', req.user.business_name);

    doc.fontSize(24).fill(NAVY).text('Breakeven Truth Sheet', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(10).fill(NAVY);
    const labels = ['Breakeven', '+3%', '+5%', '+10%', '+15%'];
    outputs.breakeven.scenarios.forEach((s, i) => {
      doc.text(`${labels[i]}: Revenue $${Math.round(s.required_revenue).toLocaleString()} | Monthly $${Math.round(s.required_monthly).toLocaleString()} | After-Tax Owner Cash $${Math.round(s.after_tax_owner_cash).toLocaleString()}`);
    });

    doc.moveDown(2);
    doc.fontSize(12).fill(ORANGE);
    doc.text(`The Breakeven Lie: Your CPA breakeven is $${Math.round(outputs.breakeven.cpa_breakeven.required_revenue).toLocaleString()}. Your True Breakeven is $${Math.round(outputs.breakeven.true_breakeven.required_revenue).toLocaleString()}. The gap is $${Math.round(outputs.breakeven.breakeven_lie_gap).toLocaleString()}.`);

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});

router.post('/decision-report', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const { title, scenario_data } = req.body;
    const doc = createBasePDF(res, 'Decision Report', req.user.business_name);

    doc.fontSize(24).fill(NAVY).text(title || 'Decision Report', { align: 'center' });
    doc.moveDown(2);

    if (scenario_data) {
      doc.fontSize(12).fill(NAVY);
      doc.text('Baseline vs. Scenario:');
      doc.moveDown();
      const b = scenario_data.baseline;
      const s = scenario_data.scenario;
      doc.text(`Revenue: $${Math.round(b.revenue).toLocaleString()} -> $${Math.round(s.revenue).toLocaleString()}`);
      doc.text(`Pretax Profit: $${Math.round(b.pretax_profit).toLocaleString()} -> $${Math.round(s.pretax_profit).toLocaleString()}`);
      doc.text(`Pretax %: ${(b.pretax_pct * 100).toFixed(1)}% -> ${(s.pretax_pct * 100).toFixed(1)}%`);
    }

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});

router.post('/annual-snapshot', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const snapshot = await getLatestSnapshot(req.user.id);
    if (!snapshot) return res.status(404).json({ error: 'No snapshot found' });

    const { outputs } = snapshot;
    const doc = createBasePDF(res, 'Annual Snapshot', req.user.business_name);

    doc.fontSize(24).fill(NAVY).text('Annual Financial Snapshot', { align: 'center' });
    doc.moveDown(2);

    const w = outputs.waterfall;
    doc.fontSize(11).fill(NAVY);
    const lines = [
      ['Revenue', w.total_revenue],
      ['COGS', w.total_cogs],
      ['Gross Margin', w.gross_margin],
      ['Direct Labor', w.total_direct_labor],
      ['Contribution Margin', w.contribution_margin],
      ['Marketing', w.total_marketing],
      ['Operating Expenses', w.total_opex],
      ['Pretax Net Income', w.pretax_net_income],
    ];
    lines.forEach(([label, val]) => {
      doc.text(`${label}: $${Math.round(val).toLocaleString()}`);
    });

    doc.moveDown();
    doc.text(`Direct LPR: ${outputs.ratios.direct_lpr.toFixed(2)}x`);
    doc.text(`MPR: ${outputs.ratios.mpr.toFixed(2)}x`);
    doc.text(`ManPR: ${outputs.ratios.manpr.toFixed(2)}x`);
    doc.text(`Profit Score: ${outputs.profitScore.total_score}/100`);

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});

router.post('/action-plan', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const { data: progress } = await supabaseAdmin
      .from('game_progress')
      .select('fix_queue')
      .eq('user_id', req.user.id)
      .single();

    const doc = createBasePDF(res, 'Action Plan', req.user.business_name);

    doc.fontSize(24).fill(NAVY).text('Action Plan', { align: 'center' });
    doc.moveDown(2);

    const actions = progress?.fix_queue || [];
    actions.forEach((action, i) => {
      doc.fontSize(14).fill(ORANGE).text(`Priority ${i + 1}: ${action.category}`);
      doc.fontSize(12).fill(NAVY).text(action.title);
      if (action.specific_instruction) {
        doc.fontSize(10).fill(STONE).text(action.specific_instruction);
      }
      doc.text(`Dollar Impact: $${(action.dollar_impact || 0).toLocaleString()} | Timeline: ${action.timeline || 'TBD'}`);
      doc.moveDown();
    });

    doc.moveDown(2);
    doc.fontSize(10).fill(STONE).text('Ready to install the full system? Let\'s see the numbers play out. Book a free 15-minute call at easyflowcfo.com');

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});

router.post('/weekly-briefing/:id', authGuard, tierGuard('harvest'), async (req, res, next) => {
  try {
    const { data: briefing } = await supabaseAdmin
      .from('weekly_briefings')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!briefing) return res.status(404).json({ error: 'Briefing not found' });

    const doc = createBasePDF(res, 'Weekly Briefing', req.user.business_name);

    doc.fontSize(24).fill(NAVY).text('Weekly Briefing', { align: 'center' });
    doc.fontSize(12).fill(STONE).text(`Week ending ${briefing.week_ending}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).fill(NAVY).text(briefing.briefing_text);

    addFooter(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
});

export default router;
