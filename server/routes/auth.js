import { Router } from 'express';
import { supabaseAdmin } from '../db/supabase.js';
import { authGuard } from '../middleware/authGuard.js';

const router = Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, full_name, business_name, revenue_band, industry, partner_id } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Determine user_type and tier based on partner invite
    const isPartnerClient = !!partner_id;
    const user_type = isPartnerClient ? 'client' : 'owner';
    const tier = isPartnerClient ? 'harvest' : 'free';

    await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      full_name,
      business_name,
      revenue_band,
      industry,
      user_type,
      managed_by_partner_id: partner_id || null,
      tier,
    });

    await supabaseAdmin.from('game_progress').insert({
      user_id: authData.user.id,
      profit_score: 0,
      profit_tier: 1,
      current_streak: 0,
      longest_streak: 0,
    });

    // If this is a partner-invited client, update the pending partner_clients record
    if (partner_id) {
      await supabaseAdmin
        .from('partner_clients')
        .update({ status: 'active', client_user_id: authData.user.id })
        .eq('partner_id', partner_id)
        .eq('status', 'pending')
        .is('client_user_id', null);
    }

    const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return res.status(400).json({ error: signInError.message });
    }

    res.json({
      user: { id: authData.user.id, email, full_name, business_name, tier, user_type },
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If user is a partner-managed client, include brand config
    let brand_config = null;
    if (profile?.managed_by_partner_id) {
      const { data: partner } = await supabaseAdmin
        .from('partners')
        .select('brand_name, logo_url, primary_color')
        .eq('id', profile.managed_by_partner_id)
        .single();
      brand_config = partner;
    }

    res.json({
      user: profile,
      brand_config,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/partner-brand/:partnerId', async (req, res, next) => {
  try {
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .select('brand_name, logo_url, primary_color')
      .eq('id', req.params.partnerId)
      .single();

    if (error || !partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(partner);
  } catch (err) {
    next(err);
  }
});

router.post('/demo-upgrade', authGuard, async (req, res, next) => {
  try {
    const { tier } = req.body;
    const validTiers = ['free', 'clarity', 'control', 'harvest'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` });
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ tier })
      .eq('id', req.user.id);

    if (error) throw new Error(error.message);

    res.json({ tier, message: `Upgraded to ${tier}` });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authGuard, async (req, res) => {
  res.json({ message: 'Logged out' });
});

router.get('/me', authGuard, async (req, res, next) => {
  try {
    let brand_config = null;
    if (req.user?.managed_by_partner_id) {
      const { data: partner } = await supabaseAdmin
        .from('partners')
        .select('brand_name, logo_url, primary_color')
        .eq('id', req.user.managed_by_partner_id)
        .single();
      brand_config = partner;
    }

    res.json({ user: req.user, brand_config });
  } catch (err) {
    next(err);
  }
});

export default router;
