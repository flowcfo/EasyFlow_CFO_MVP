import { supabaseAdmin } from '../db/supabase.js';

export function partnerGuard(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.user_type !== 'partner') {
    return res.status(403).json({
      error: 'Partner access required',
      message: 'This feature is available to CFO Partners only.',
    });
  }

  next();
}

export async function loadPartnerProfile(req, res, next) {
  if (!req.user || req.user.user_type !== 'partner') {
    return next();
  }

  try {
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error || !partner) {
      return res.status(404).json({ error: 'Partner profile not found' });
    }

    req.partner = partner;
    next();
  } catch (err) {
    next(err);
  }
}

export async function partnerClientAccess(req, res, next) {
  if (!req.user || !req.partner) {
    return res.status(403).json({ error: 'Partner authentication required' });
  }

  const clientId = req.params.clientId || req.params.id;
  if (!clientId) {
    return next();
  }

  try {
    const { data: clientRecord, error } = await supabaseAdmin
      .from('partner_clients')
      .select('*')
      .eq('partner_id', req.partner.id)
      .eq('client_user_id', clientId)
      .single();

    if (error || !clientRecord) {
      return res.status(403).json({ error: 'You do not have access to this client' });
    }

    req.partnerClient = clientRecord;
    next();
  } catch (err) {
    next(err);
  }
}
