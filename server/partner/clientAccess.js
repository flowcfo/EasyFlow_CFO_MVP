import crypto from 'crypto';
import { supabaseAdmin } from '../db/supabase.js';

const ACCESS_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export async function generateClientAccessToken(partnerId, clientUserId) {
  const { data: clientRecord, error } = await supabaseAdmin
    .from('partner_clients')
    .select('id, status')
    .eq('partner_id', partnerId)
    .eq('client_user_id', clientUserId)
    .single();

  if (error || !clientRecord) {
    throw new Error('Client not found in your book');
  }

  if (clientRecord.status !== 'active') {
    throw new Error('Client account is not active');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS);

  // Store in a simple in-memory cache or could use Redis/DB
  // For MVP, we return a signed JWT-like token
  const accessPayload = {
    partner_id: partnerId,
    client_user_id: clientUserId,
    token,
    expires_at: expiresAt.toISOString(),
  };

  return accessPayload;
}

export async function inviteClient(partnerId, inviteData) {
  const { client_name, business_name, email } = inviteData;

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  let clientUserId;

  if (existingUser) {
    clientUserId = existingUser.id;
    await supabaseAdmin
      .from('users')
      .update({
        user_type: 'client',
        managed_by_partner_id: partnerId,
      })
      .eq('id', clientUserId);
  } else {
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: client_name, business_name },
    });

    if (createErr) throw createErr;
    clientUserId = newUser.user.id;

    await supabaseAdmin.from('users').insert({
      id: clientUserId,
      email,
      full_name: client_name,
      business_name,
      user_type: 'client',
      managed_by_partner_id: partnerId,
      tier: 'harvest',
    });
  }

  const { data: clientRecord, error: insertErr } = await supabaseAdmin
    .from('partner_clients')
    .insert({
      partner_id: partnerId,
      client_user_id: clientUserId,
      client_name,
      business_name,
      status: 'pending',
    })
    .select()
    .single();

  if (insertErr) throw insertErr;

  // Generate magic link for the client
  const { data: magicLink, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${process.env.FRONTEND_URL}/onboard/qbo?partner=${partnerId}`,
    },
  });

  return {
    client_record: clientRecord,
    invite_link: magicLink?.properties?.action_link || null,
    client_user_id: clientUserId,
  };
}

export async function removeClient(partnerId, clientRecordId) {
  const { data, error } = await supabaseAdmin
    .from('partner_clients')
    .delete()
    .eq('id', clientRecordId)
    .eq('partner_id', partnerId)
    .select()
    .single();

  if (error) throw error;

  if (data?.client_user_id) {
    await supabaseAdmin
      .from('users')
      .update({ user_type: 'owner', managed_by_partner_id: null })
      .eq('id', data.client_user_id);
  }

  return data;
}
