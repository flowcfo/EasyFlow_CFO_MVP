import crypto from 'crypto';
import { supabaseAdmin, supabaseSignInClient } from '../db/supabase.js';

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
 * Nothing is emailed here: this is the copy-a-link fallback.
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
 * Email the client their set-password link through Supabase's mailer (Resend SMTP).
 * New people get the "Invite user" email (this also creates their login); people
 * who already have a login get the "Reset password" email. Both land on /set-password.
 * Returns { sent, userId, error }. Never throws for a mail failure: the caller
 * falls back to a copyable link.
 */
async function emailSetPasswordLink(email, metadata) {
  const redirectTo = `${portalUrl()}/set-password`;
  const { data: existingId } = await supabaseAdmin.rpc('auth_user_id_by_email', { p_email: email });

  if (!existingId) {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo, data: metadata });
    if (!error) return { sent: true, userId: data.user.id };
    // The login may have been created even though the email failed.
    const { data: afterId } = await supabaseAdmin.rpc('auth_user_id_by_email', { p_email: email });
    return { sent: false, userId: afterId || null, error: error.message };
  }

  const { error } = await supabaseSignInClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (!error) return { sent: true, userId: existingId };
  return { sent: false, userId: existingId, error: error.message };
}

/**
 * Get the client a way in: email first; if the email can't go out, a copyable
 * link instead. (Making a link replaces any link already emailed, so we only make
 * one when the email failed or when Nick asks for a link.)
 */
async function deliverSetPassword(email, metadata, mode = 'email') {
  if (mode === 'email') {
    const mail = await emailSetPasswordLink(email, metadata);
    if (mail.sent) return { userId: mail.userId, email_sent: true, invite_link: null, email_error: null };
    const { user, link } = await createSetPasswordLink(email, metadata);
    return { userId: user.id, email_sent: false, invite_link: link || null, email_error: mail.error || null };
  }
  const { user, link } = await createSetPasswordLink(email, metadata);
  return { userId: user.id, email_sent: false, invite_link: link || null, email_error: null };
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

  const delivery = await deliverSetPassword(email, { full_name: client_name, business_name }, inviteData.mode || 'email');
  const clientUserId = delivery.userId;

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
    invite_link: delivery.invite_link,
    email_sent: delivery.email_sent,
    email_error: delivery.email_error,
    email,
    client_user_id: clientUserId,
  };
}

/**
 * Send a client a fresh way in. mode 'email' (default) emails it and falls back
 * to a link; mode 'link' just returns a copyable link.
 */
export async function resendClientInvite(partnerId, clientRecordId, mode = 'email') {
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

  const delivery = await deliverSetPassword(profile.email, {
    full_name: record.client_name,
    business_name: record.business_name,
  }, mode === 'link' ? 'link' : 'email');

  return {
    email_sent: delivery.email_sent,
    invite_link: delivery.invite_link,
    email_error: delivery.email_error,
    email: profile.email,
    client_name: record.client_name,
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
