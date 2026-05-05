import path from 'path';
import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { partnerGuard, loadPartnerProfile, partnerClientAccess } from '../middleware/partnerGuard.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { getPartnerDashboard, getPartnerAlerts } from '../partner/dashboard.js';
import { getWhiteLabelConfig, updateWhiteLabelConfig } from '../partner/whitelabel.js';
import { generateClientAccessToken, inviteClient, removeClient } from '../partner/clientAccess.js';
import { generatePortfolioReport } from '../partner/portfolioReport.js';
import { getPartnerAddons, activateAddon, deactivateAddon } from '../partner/addons.js';
import {
  loadOrSeedDraft,
  saveDraft,
  calcDraft,
  publishDraft,
  resetDraft,
} from '../partner/drafts.js';
import { parseExcelFile } from '../integrations/excel/parser.js';
import { calculateWeeklyMetrics, calculateQTDSummary } from '../calculations/weeklyScorecard.js';
import { supabaseAdmin } from '../db/supabase.js';

const ALLOWED_UPLOAD_EXTS = new Set(['.xlsx', '.xls', '.csv']);

const router = Router();

router.use(authGuard);
router.use(partnerGuard);
router.use(loadPartnerProfile);

router.get('/dashboard', async (req, res, next) => {
  try {
    const { data: partner } = await supabaseAdmin
      .from('partners')
      .select('client_seat_limit, plan, addon_cfo_chat, addon_briefing_gen, addon_meeting_prep, addon_portfolio_ai')
      .eq('id', req.partner.id)
      .single();

    const dashboardData = await getPartnerDashboard(req.partner.id);
    const alerts = await getPartnerAlerts(req.partner.id);

    res.json({
      ...dashboardData,
      alerts,
      plan: partner?.plan,
      seats_used: dashboardData.total_clients,
      seat_limit: partner?.client_seat_limit,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/clients', async (req, res, next) => {
  try {
    const { data: clients, error } = await supabaseAdmin
      .from('partner_clients')
      .select('*')
      .eq('partner_id', req.partner.id)
      .order('added_at', { ascending: false });

    if (error) throw error;

    const enriched = [];
    for (const client of clients || []) {
      const { data: snapshot } = await supabaseAdmin
        .from('snapshots')
        .select('outputs, created_at')
        .eq('user_id', client.client_user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      enriched.push({
        ...client,
        latest_snapshot_date: snapshot?.created_at || null,
        latest_outputs_summary: snapshot?.outputs ? {
          profit_score: snapshot.outputs.profitScore?.total_score,
          profit_tier: snapshot.outputs.profitTier?.tier,
          pretax_pct: snapshot.outputs.waterfall?.pretax_pct,
        } : null,
      });
    }

    res.json({ clients: enriched });
  } catch (err) {
    next(err);
  }
});

router.post('/clients/invite', async (req, res, next) => {
  try {
    const { client_name, business_name, email } = req.body;

    if (!client_name || !email) {
      return res.status(400).json({ error: 'client_name and email are required' });
    }

    const { data: currentClients } = await supabaseAdmin
      .from('partner_clients')
      .select('id')
      .eq('partner_id', req.partner.id);

    if ((currentClients?.length || 0) >= req.partner.client_seat_limit) {
      return res.status(403).json({
        error: 'Seat limit reached',
        message: `Your ${req.partner.plan} plan allows ${req.partner.client_seat_limit} clients. Upgrade or add seats at $25/month each.`,
      });
    }

    const result = await inviteClient(req.partner.id, { client_name, business_name, email });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/clients/:id', async (req, res, next) => {
  try {
    const result = await removeClient(req.partner.id, req.params.id);
    res.json({ removed: result });
  } catch (err) {
    next(err);
  }
});

router.get('/clients/:clientId/access', partnerClientAccess, async (req, res, next) => {
  try {
    const token = await generateClientAccessToken(req.partner.id, req.params.clientId);
    res.json(token);
  } catch (err) {
    next(err);
  }
});

router.post('/clients/:clientId/note', partnerClientAccess, async (req, res, next) => {
  try {
    const { note, pinned } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'note is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('partner_notes')
      .insert({
        partner_id: req.partner.id,
        client_user_id: req.params.clientId,
        note,
        pinned: pinned || false,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/portfolio-report', async (req, res, next) => {
  try {
    if (!['growth', 'scale'].includes(req.partner.plan)) {
      return res.status(403).json({
        error: 'Portfolio report requires Growth or Scale plan',
      });
    }

    const pdfBuffer = await generatePortfolioReport(req.partner.id, {
      brand_name: req.partner.brand_name,
      primary_color: req.partner.primary_color,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=portfolio-report.pdf');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

router.post('/whitelabel', async (req, res, next) => {
  try {
    const config = await updateWhiteLabelConfig(req.partner.id, req.body);
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.get('/whitelabel', async (req, res, next) => {
  try {
    const config = await getWhiteLabelConfig(req.partner.id);
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.get('/addons', async (req, res, next) => {
  try {
    const result = await getPartnerAddons(req.partner.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/addons/activate', async (req, res, next) => {
  try {
    const { addon_id } = req.body;
    if (!addon_id) {
      return res.status(400).json({ error: 'addon_id is required' });
    }
    const result = await activateAddon(req.partner.id, addon_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/addons/:addon', async (req, res, next) => {
  try {
    const result = await deactivateAddon(req.partner.id, req.params.addon);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ==================== CLIENT DRAFT WORKBENCH ====================
// Draft layer for the per-client CFO workbench at /partner/client/:clientId/*.
// Mutations write to partner_drafts only. The client's `snapshots` table is
// only touched by POST /draft/publish.

router.get('/clients/:clientId/draft', partnerClientAccess, async (req, res, next) => {
  try {
    const draft = await loadOrSeedDraft(req.partner.id, req.params.clientId);
    res.json({ draft });
  } catch (err) {
    next(err);
  }
});

router.put('/clients/:clientId/draft', partnerClientAccess, async (req, res, next) => {
  try {
    const { inputs, monthly_history, field_sources } = req.body || {};
    const draft = await saveDraft(req.partner.id, req.params.clientId, {
      ...(inputs !== undefined ? { inputs } : {}),
      ...(monthly_history !== undefined ? { monthly_history } : {}),
      ...(field_sources !== undefined ? { field_sources } : {}),
    });
    res.json({ draft });
  } catch (err) {
    next(err);
  }
});

router.post('/clients/:clientId/draft/calc', partnerClientAccess, async (req, res, next) => {
  try {
    const overrideInputs = req.body?.inputs;
    const { draft, outputs } = await calcDraft(req.partner.id, req.params.clientId, overrideInputs);
    res.json({ draft, outputs });
  } catch (err) {
    if (err.statusCode === 400 && err.details) {
      return res.status(400).json({ error: err.message, details: err.details });
    }
    next(err);
  }
});

router.post(
  '/clients/:clientId/draft/import/excel',
  uploadLimiter,
  partnerClientAccess,
  async (req, res, next) => {
    try {
      if (!req.body || !Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: 'File upload required' });
      }

      const filename = String(req.headers['x-filename'] || 'upload.xlsx');
      const ext = path.extname(filename).toLowerCase();
      if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
        return res.status(400).json({ error: 'Unsupported file type. Allowed: .xlsx, .xls, .csv' });
      }

      const businessType = req.headers['x-business-type'] || '';
      const result = await parseExcelFile(req.body, filename, businessType);

      if (result.inputs) {
        const draft = await saveDraft(req.partner.id, req.params.clientId, {
          inputs: result.inputs,
          monthly_history: result.monthlyHistory || null,
          field_sources: result.sources || {},
        });
        const calc = await calcDraft(req.partner.id, req.params.clientId, result.inputs);
        return res.json({
          draft: calc.draft,
          outputs: calc.outputs,
          metadata: result.metadata,
        });
      }

      // No auto-mapped inputs (very low match rate); return the confirmation payload
      // so the partner UI can fall back to manual mapping.
      const fallbackDraft = await loadOrSeedDraft(req.partner.id, req.params.clientId);
      return res.json({
        draft: fallbackDraft,
        confirmation: result.confirmation,
        monthlyHistory: result.monthlyHistory || null,
        metadata: result.metadata,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/clients/:clientId/draft/publish', partnerClientAccess, async (req, res, next) => {
  try {
    const note = (req.body?.note || '').toString().slice(0, 280);
    const result = await publishDraft(req.partner.id, req.params.clientId, { note });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400 && err.details) {
      return res.status(400).json({ error: err.message, details: err.details });
    }
    next(err);
  }
});

router.post('/clients/:clientId/draft/reset', partnerClientAccess, async (req, res, next) => {
  try {
    const draft = await resetDraft(req.partner.id, req.params.clientId);
    res.json({ draft });
  } catch (err) {
    next(err);
  }
});

// ==================== CLIENT WEEKLY SCORECARD ====================
// Mirrors /weekly/* but scopes reads and writes to the partner's client.
// Service role bypasses the user-id RLS policy on weekly_entries; we enforce
// access via partnerClientAccess.

router.get('/clients/:clientId/weekly/entries', partnerClientAccess, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('weekly_entries')
      .select('*')
      .eq('user_id', req.params.clientId)
      .order('week_ending', { ascending: false })
      .limit(52);

    if (error) throw error;
    res.json({ entries: data });
  } catch (err) {
    next(err);
  }
});

router.get('/clients/:clientId/weekly/summary', partnerClientAccess, async (req, res, next) => {
  try {
    const clientId = req.params.clientId;
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const { data: entries } = await supabaseAdmin
      .from('weekly_entries')
      .select('*')
      .eq('user_id', clientId)
      .gte('week_ending', quarterStart.toISOString().split('T')[0])
      .order('week_ending', { ascending: false });

    // Targets come from the client's most recent published snapshot. The draft
    // workbench writes a snapshot at every Publish, so this stays in sync.
    const { data: latestSnapshot } = await supabaseAdmin
      .from('snapshots')
      .select('outputs')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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

router.post('/clients/:clientId/weekly/entry', partnerClientAccess, async (req, res, next) => {
  try {
    const clientId = req.params.clientId;
    const { week_ending, revenue, cogs, direct_labor, marketing, notes } = req.body;

    if (!week_ending || revenue === undefined) {
      return res.status(400).json({ error: 'week_ending and revenue are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('weekly_entries')
      .insert({
        user_id: clientId,
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
    res.json({ entry: data });
  } catch (err) {
    next(err);
  }
});

export default router;
