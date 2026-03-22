import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { partnerGuard, loadPartnerProfile, partnerClientAccess } from '../middleware/partnerGuard.js';
import { getPartnerDashboard, getPartnerAlerts } from '../partner/dashboard.js';
import { getWhiteLabelConfig, updateWhiteLabelConfig } from '../partner/whitelabel.js';
import { generateClientAccessToken, inviteClient, removeClient } from '../partner/clientAccess.js';
import { generatePortfolioReport } from '../partner/portfolioReport.js';
import { getPartnerAddons, activateAddon, deactivateAddon } from '../partner/addons.js';
import { supabaseAdmin } from '../db/supabase.js';

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

export default router;
