import Stripe from 'stripe';
import { supabaseAdmin } from '../db/supabase.js';
import { PARTNER_ADDONS } from '../../shared/constants.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_local_dev_only');

const ADDON_PRICE_ENV_MAP = {
  cfo_chat: 'STRIPE_ADDON_CFO_CHAT_PRICE_ID',
  briefing_gen: 'STRIPE_ADDON_BRIEFING_GEN_PRICE_ID',
  meeting_prep: 'STRIPE_ADDON_MEETING_PREP_PRICE_ID',
  portfolio_ai: 'STRIPE_ADDON_PORTFOLIO_AI_PRICE_ID',
};

function isAddonIncluded(addonId, partnerPlan) {
  const addon = PARTNER_ADDONS[addonId];
  if (!addon) return false;
  return addon.included_on.includes(partnerPlan);
}

function isAddonAvailable(addonId, partnerPlan) {
  const addon = PARTNER_ADDONS[addonId];
  if (!addon) return false;
  return addon.available_on.includes(partnerPlan) || addon.included_on.includes(partnerPlan);
}

export async function getPartnerAddons(partnerId) {
  const { data: partner, error } = await supabaseAdmin
    .from('partners')
    .select('plan, addon_cfo_chat, addon_briefing_gen, addon_meeting_prep, addon_portfolio_ai')
    .eq('id', partnerId)
    .single();

  if (error || !partner) throw new Error('Partner not found');

  const addons = Object.entries(PARTNER_ADDONS).map(([id, config]) => {
    const included = isAddonIncluded(id, partner.plan);
    const available = isAddonAvailable(id, partner.plan);
    const active = included || partner[config.key] === true;

    return {
      id,
      ...config,
      included,
      available,
      active,
      requires_purchase: available && !included && !partner[config.key],
    };
  });

  return { addons, plan: partner.plan };
}

export async function activateAddon(partnerId, addonId) {
  const addon = PARTNER_ADDONS[addonId];
  if (!addon) throw new Error('Unknown add-on');

  const { data: partner, error } = await supabaseAdmin
    .from('partners')
    .select('plan, stripe_customer_id, ' + addon.key)
    .eq('id', partnerId)
    .single();

  if (error || !partner) throw new Error('Partner not found');

  if (isAddonIncluded(addonId, partner.plan)) {
    return { message: 'Add-on already included in your plan', active: true };
  }

  if (!isAddonAvailable(addonId, partner.plan)) {
    throw new Error(`This add-on is not available on the ${partner.plan} plan`);
  }

  if (partner[addon.key]) {
    return { message: 'Add-on already active', active: true };
  }

  const priceEnvKey = ADDON_PRICE_ENV_MAP[addonId];
  const priceId = process.env[priceEnvKey];

  if (!priceId || !partner.stripe_customer_id) {
    await supabaseAdmin
      .from('partners')
      .update({ [addon.key]: true })
      .eq('id', partnerId);

    return { message: 'Add-on activated', active: true };
  }

  const subscription = await stripe.subscriptions.create({
    customer: partner.stripe_customer_id,
    items: [{ price: priceId }],
    metadata: {
      partner_id: partnerId,
      addon_id: addonId,
      addon_key: addon.key,
    },
  });

  await supabaseAdmin
    .from('partners')
    .update({ [addon.key]: true })
    .eq('id', partnerId);

  return {
    message: 'Add-on activated',
    active: true,
    subscription_id: subscription.id,
  };
}

export async function deactivateAddon(partnerId, addonId) {
  const addon = PARTNER_ADDONS[addonId];
  if (!addon) throw new Error('Unknown add-on');

  const { data: partner, error } = await supabaseAdmin
    .from('partners')
    .select('plan, stripe_customer_id, ' + addon.key)
    .eq('id', partnerId)
    .single();

  if (error || !partner) throw new Error('Partner not found');

  if (isAddonIncluded(addonId, partner.plan)) {
    throw new Error('Cannot deactivate an add-on that is included in your plan');
  }

  if (!partner[addon.key]) {
    return { message: 'Add-on already inactive', active: false };
  }

  if (partner.stripe_customer_id) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: partner.stripe_customer_id,
        status: 'active',
      });

      for (const sub of subscriptions.data) {
        if (sub.metadata?.addon_id === addonId && sub.metadata?.partner_id === partnerId) {
          await stripe.subscriptions.update(sub.id, {
            cancel_at_period_end: true,
          });
          break;
        }
      }
    } catch (err) {
      console.error('Failed to cancel Stripe addon subscription:', err.message);
    }
  }

  await supabaseAdmin
    .from('partners')
    .update({ [addon.key]: false })
    .eq('id', partnerId);

  return { message: 'Add-on will deactivate at end of billing period', active: false };
}

export function hasAddonAccess(partner, addonId) {
  const addon = PARTNER_ADDONS[addonId];
  if (!addon) return false;
  if (isAddonIncluded(addonId, partner.plan)) return true;
  return partner[addon.key] === true;
}
