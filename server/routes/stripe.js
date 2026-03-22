import { Router } from 'express';
import Stripe from 'stripe';
import { authGuard } from '../middleware/authGuard.js';
import { supabaseAdmin } from '../db/supabase.js';
import { PARTNER_SEAT_LIMITS } from '../../shared/constants.js';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set. Stripe API calls will fail until configured.');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_local_dev_only');
const router = Router();

const PRICE_TO_TIER = {
  [process.env.STRIPE_CLARITY_PRICE_ID]: 'clarity',
  [process.env.STRIPE_CONTROL_PRICE_ID]: 'control',
  [process.env.STRIPE_HARVEST_PRICE_ID]: 'harvest',
  [process.env.STRIPE_PARTNER_STARTER_PRICE_ID]: 'partner_starter',
  [process.env.STRIPE_PARTNER_GROWTH_PRICE_ID]: 'partner_growth',
  [process.env.STRIPE_PARTNER_SCALE_PRICE_ID]: 'partner_scale',
};

const TIER_TO_PRICE_ENV = {
  clarity: 'STRIPE_CLARITY_PRICE_ID',
  control: 'STRIPE_CONTROL_PRICE_ID',
  harvest: 'STRIPE_HARVEST_PRICE_ID',
  partner_starter: 'STRIPE_PARTNER_STARTER_PRICE_ID',
  partner_growth: 'STRIPE_PARTNER_GROWTH_PRICE_ID',
  partner_scale: 'STRIPE_PARTNER_SCALE_PRICE_ID',
};

function getPriceId(tier) {
  const envKey = TIER_TO_PRICE_ENV[tier];
  return envKey ? process.env[envKey] : null;
}

function getTierFromPriceId(priceId) {
  return PRICE_TO_TIER[priceId] || 'clarity';
}

router.post('/checkout', authGuard, async (req, res, next) => {
  try {
    const { tier } = req.body;
    const priceId = getPriceId(tier);

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid tier selection' });
    }

    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { user_id: req.user.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', req.user.id);
    }

    const lineItems = [{ price: priceId, quantity: 1 }];

    // Add seat metering for partner tiers with extra seats
    const { extra_seats } = req.body;
    if (extra_seats > 0 && process.env.STRIPE_SEAT_PRICE_ID) {
      lineItems.push({
        price: process.env.STRIPE_SEAT_PRICE_ID,
        quantity: extra_seats,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      success_url: `${process.env.FRONTEND_URL}/app/dashboard?upgrade=success`,
      cancel_url: `${process.env.FRONTEND_URL}/app/dashboard?upgrade=cancelled`,
      metadata: { user_id: req.user.id, tier },
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

router.post('/portal', authGuard, async (req, res, next) => {
  try {
    if (!req.user.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: req.user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/app/dashboard`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.user_id;
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0].price.id;
        const tier = getTierFromPriceId(priceId);

        const updateData = { tier, stripe_customer_id: session.customer };

        // Set user_type for partner tiers
        if (tier.startsWith('partner_')) {
          updateData.user_type = 'partner';
        }

        await supabaseAdmin
          .from('users')
          .update(updateData)
          .eq('id', userId);

        // Create partner record if upgrading to partner tier
        if (tier.startsWith('partner_')) {
          const plan = tier.replace('partner_', '');
          const seatLimit = PARTNER_SEAT_LIMITS[tier] || 5;

          const { data: existing } = await supabaseAdmin
            .from('partners')
            .select('id')
            .eq('user_id', userId)
            .single();

          if (!existing) {
            const { data: user } = await supabaseAdmin
              .from('users')
              .select('business_name')
              .eq('id', userId)
              .single();

            await supabaseAdmin.from('partners').insert({
              user_id: userId,
              brand_name: user?.business_name || 'My CFO Practice',
              plan,
              client_seat_limit: seatLimit === Infinity ? 9999 : seatLimit,
              stripe_customer_id: session.customer,
            });
          } else {
            await supabaseAdmin
              .from('partners')
              .update({
                plan,
                client_seat_limit: seatLimit === Infinity ? 9999 : seatLimit,
                stripe_customer_id: session.customer,
              })
              .eq('id', existing.id);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', subscription.customer);

        if (users?.length) {
          const priceId = subscription.items.data[0].price.id;
          const tier = getTierFromPriceId(priceId);
          await supabaseAdmin
            .from('users')
            .update({ tier })
            .eq('id', users[0].id);

          if (tier.startsWith('partner_')) {
            const plan = tier.replace('partner_', '');
            const seatLimit = PARTNER_SEAT_LIMITS[tier] || 5;
            await supabaseAdmin
              .from('partners')
              .update({
                plan,
                client_seat_limit: seatLimit === Infinity ? 9999 : seatLimit,
              })
              .eq('user_id', users[0].id);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        // Handle add-on subscription cancellations
        if (subscription.metadata?.addon_key && subscription.metadata?.partner_id) {
          await supabaseAdmin
            .from('partners')
            .update({ [subscription.metadata.addon_key]: false })
            .eq('id', subscription.metadata.partner_id);
          break;
        }

        const { data: users } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', subscription.customer);

        if (users?.length) {
          await supabaseAdmin
            .from('users')
            .update({ tier: 'free' })
            .eq('id', users[0].id);
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }

  res.json({ received: true });
});

export default router;
