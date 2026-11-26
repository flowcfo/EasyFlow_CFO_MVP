import crypto from 'crypto';
import { supabaseAdmin } from '../db/supabase.js';

const ACCESS_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a single-use partner→client access token.
 * The raw token is returned to the partner; only its sha256 hash is stored.
 * verifyClientAccessToken consumes the token (delete on use) and returns the bound IDs.
 */
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
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS);

  const { error: insertErr } = await supabaseAdmin
    .from('partner_access_tokens')
    .insert({
      token_hash: tokenHash,
      partner_id: partnerId,
      client_user_id: clientUserId,
      expires_at: expiresAt.toISOString(),
    });

  if (insertErr) throw new Error(`Failed to issue access token: ${insertErr.message}`);

  return {
    token,
    expires_at: expiresAt.toISOString(),
  };
}

/**
 * Verify and consume a partner→client access token.
 * Single use: deletes the row on successful verification.
 */
export async function verifyClientAccessToken(token) {
  if (!token || typeof token !== 'string') throw new Error('Invalid access token');

  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from('partner_access_tokens')
    .select('partner_id, client_user_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !data) throw new Error('Invalid or expired access token');

  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('partner_access_tokens').delete().eq('token_hash', tokenHash);
    throw new Error('Access token expired');
  }

  await supabaseAdmin.from('partner_access_tokens').delete().eq('token_hash', tokenHash);

  return {
    partner_id: data.partner_id,
    client_user_id: data.client_user_id,
  };
}

// Tables whose rows belong to a user profile. Used when an old profile has to be
// moved onto the id of the client's real login (see relinkProfile).
const USER_ID_TABLES = [
  ['snapshots', 'user_id'],
  ['weekly_entries', 'user_id'],
  ['game_progress', 'user_id'],
  ['ai_conversations', 'user_id'],
  ['weekly_briefings', 'user_id'],
  ['integrations', 'user_id'],
  ['ai_sessions', 'user_id'],
  ['partner_clients', 'client_user_id'],
  ['partner_notes', 'client_user_id'],
  ['partner_drafts', 'client_user_id'],
];

function portalUrl() {
  return (process.env.FRONTEND_URL || 'https://easyflowcfoapp.netlify.app').split(',')[0].trim().replace(/\/+$/, '');
}

/**
 * Build a one-time link that signs the client in and lands them on Set Password.
 * New people get an "invite" link (this also creates their login). People who
 * already have a login get a "recovery" link, which lands on the same page.
 * Nothing is emailed here: Nick sends the link from his own Outlook.
 */
async function createSetPasswordLink(email, metadata) {
  const redirectTo = `${portalUrl()}/set-password`;

  const invite = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: metadata },
  });
  if (!invite.error) return { user: invite.data.user, link: invite.data.properties?.action_link };

  const alreadyExists = /already been registered|already registered|already exists/i.test(invite.error.message || '');
  if (!alreadyExists) throw invite.error;

  const recovery = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });
  if (recovery.error) throw recovery.error;
  return { user: recovery.data.user, link: recovery.data.properties?.action_link };
}

/**
 * Move an old profile (same email, different id) onto the client's real login id,
 * keeping its history. Old test profiles were created before logins were linked.
 */
async function relinkProfile(oldId, newId, email) {
  const { data: oldRow } = await supabaseAdmin.from('users').select('*').eq('id', oldId).single();
  if (!oldRow) return;
  await supabaseAdmin.from('users').update({ email: `relinked+${oldId}@invalid.local` }).eq('id', oldId);
  const { id: _old, email: _e, ...rest } = oldRow;
  const { error: insErr } = await supabaseAdmin.from('users').insert({ ...rest, id: newId, email });
  if (insErr) {
    await supabaseAdmin.from('users').update({ email }).eq('id', oldId);
    throw insErr;
  }
  for (const [table, column] of USER_ID_TABLES) {
    await supabaseAdmin.from(table).update({ [column]: newId }).eq(column, oldId);
  }
  await supabaseAdmin.from('users').delete().eq('id', oldId);
}

export async function inviteClient(partnerId, inviteData) {
  const client_name = String(inviteData.client_name || '').trim();
  const business_name = String(inviteData.business_name || '').trim() || null;
  const email = String(inviteData.email || '').trim().toLowerCase();

  const { user: authUser, link } = await createSetPasswordLink(email, { full_name: client_name, business_name });
  const clientUserId = authUser.id;

  // Make sure the profile row uses the same id as the login.
  const { data: profileById } = await supabaseAdmin.from('users').select('id').eq('id', clientUserId).maybeSingle();
  if (!profileById) {
    const { data: profileByEmail } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
    if (profileByEmail) {
      await relinkProfile(profileByEmail.id, clientUserId, email);
    } else {
      const { error: profileErr } = await supabaseAdmin.from('users').insert({
        id: clientUserId,
        email,
        full_name: client_name,
        business_name,
        user_type: 'client',
        tier: 'harvest',
        has_completed_onboarding: false,
      });
      if (profileErr) throw profileErr;
    }
  }

  await supabaseAdmin
    .from('users')
    .update({
      user_type: 'client',
      managed_by_partner_id: partnerId,
      full_name: client_name,
      ...(business_name ? { business_name } : {}),
    })
    .eq('id', clientUserId);

  // One client-book row per partner and client.
  const { data: existingRecord } = await supabaseAdmin
    .from('partner_clients')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('client_user_id', clientUserId)
    .maybeSingle();

  let clientRecord = existingRecord;
  if (!clientRecord) {
    const { data, error: insertErr } = await supabaseAdmin
      .from('partner_clients')
      .insert({ partner_id: partnerId, client_user_id: clientUserId, client_name, business_name, status: 'pending' })
      .select()
      .single();
    if (insertErr) throw insertErr;
    clientRecord = data;
  }

  return {
    client_record: clientRecord,
    invite_link: link || null,
    email_sent: false,
    client_user_id: clientUserId,
  };
}

/** A fresh set-password link for a client already in the partner's book. */
export async function createClientInviteLink(partnerId, clientRecordId) {
  const { data: record } = await supabaseAdmin
    .from('partner_clients')
    .select('id, client_user_id, client_name, business_name')
    .eq('id', clientRecordId)
    .eq('partner_id', partnerId)
    .maybeSingle();
  if (!record) throw Object.assign(new Error('Client not found'), { status: 404 });

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', record.client_user_id)
    .single();

  const { link } = await createSetPasswordLink(profile.email, {
    full_name: record.client_name,
    business_name: record.business_name,
  });
  return { invite_link: link || null, email: profile.email, client_name: record.client_name };
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
