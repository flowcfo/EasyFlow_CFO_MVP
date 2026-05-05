import { supabaseAdmin } from '../db/supabase.js';
import { runFullCalculation } from '../calculations/index.js';
import { validateInputs, getDefaultInputs } from '../../shared/schema.js';

/**
 * Partner CFO Workbench draft layer.
 *
 * One row per (partner_id, client_user_id) in `partner_drafts`. Mutable scratch
 * space the partner edits inside /partner/client/:id/*. Nothing the client sees
 * changes until publishDraft inserts a row into `snapshots` for the client.
 */

async function fetchClientLatestSnapshot(clientUserId) {
  const { data } = await supabaseAdmin
    .from('snapshots')
    .select('id, inputs, outputs, created_at')
    .eq('user_id', clientUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function fetchClientProfile(clientUserId) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, business_name, industry, revenue_band')
    .eq('id', clientUserId)
    .single();
  return data || null;
}

/**
 * Load the draft for this partner+client. If none exists, seed it from the
 * client's most recent published snapshot (so Nick walks into a workbench that
 * already reflects what the client sees today). If there is no snapshot
 * either, seed from the schema defaults.
 */
export async function loadOrSeedDraft(partnerId, clientUserId) {
  const { data: existing } = await supabaseAdmin
    .from('partner_drafts')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('client_user_id', clientUserId)
    .maybeSingle();

  const client = await fetchClientProfile(clientUserId);

  if (existing) {
    return { ...existing, client };
  }

  const latest = await fetchClientLatestSnapshot(clientUserId);
  const seedInputs = latest?.inputs || getDefaultInputs();
  const seedOutputs = latest?.outputs || null;

  const insertPayload = {
    partner_id: partnerId,
    client_user_id: clientUserId,
    inputs: seedInputs,
    outputs: seedOutputs,
    field_sources: {},
    has_unpublished_changes: false,
    last_published_snapshot_id: latest?.id || null,
    last_published_at: latest?.created_at || null,
  };

  const { data: created, error } = await supabaseAdmin
    .from('partner_drafts')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to seed draft: ${error.message}`);
  return { ...created, client };
}

/**
 * Partial save. Only writes fields actually present in `patch`. Always flips
 * has_unpublished_changes true.
 */
export async function saveDraft(partnerId, clientUserId, patch = {}) {
  await loadOrSeedDraft(partnerId, clientUserId);

  const update = { has_unpublished_changes: true };
  if (patch.inputs !== undefined) update.inputs = patch.inputs;
  if (patch.monthly_history !== undefined) update.monthly_history = patch.monthly_history;
  if (patch.field_sources !== undefined) update.field_sources = patch.field_sources;
  if (patch.outputs !== undefined) update.outputs = patch.outputs;
  if (patch.interpretation !== undefined) update.interpretation = patch.interpretation;

  const { data, error } = await supabaseAdmin
    .from('partner_drafts')
    .update(update)
    .eq('partner_id', partnerId)
    .eq('client_user_id', clientUserId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to save draft: ${error.message}`);

  const client = await fetchClientProfile(clientUserId);
  return { ...data, client };
}

/**
 * Run the calculation engine against the draft inputs and persist the outputs
 * back onto the draft. Does not write to the snapshots table.
 */
export async function calcDraft(partnerId, clientUserId, overrideInputs) {
  const draft = await loadOrSeedDraft(partnerId, clientUserId);
  const inputs = overrideInputs || draft.inputs || getDefaultInputs();

  const validation = validateInputs(inputs);
  if (!validation.valid) {
    const err = new Error('Invalid inputs');
    err.details = validation.errors;
    err.statusCode = 400;
    throw err;
  }

  const outputs = runFullCalculation(inputs);

  const update = {
    inputs,
    outputs,
    has_unpublished_changes: true,
  };

  const { data, error } = await supabaseAdmin
    .from('partner_drafts')
    .update(update)
    .eq('partner_id', partnerId)
    .eq('client_user_id', clientUserId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update draft outputs: ${error.message}`);

  const client = await fetchClientProfile(clientUserId);
  return { draft: { ...data, client }, outputs };
}

/**
 * Promote the draft into a real snapshot for the client. Also refreshes
 * game_progress so the client's portal score updates. After publish, the draft
 * keeps its values but flips has_unpublished_changes=false.
 */
export async function publishDraft(partnerId, clientUserId, opts = {}) {
  const draft = await loadOrSeedDraft(partnerId, clientUserId);

  if (!draft.outputs) {
    const recalculated = await calcDraft(partnerId, clientUserId, draft.inputs);
    draft.outputs = recalculated.outputs;
  }

  const validation = validateInputs(draft.inputs);
  if (!validation.valid) {
    const err = new Error('Cannot publish: draft inputs are invalid');
    err.details = validation.errors;
    err.statusCode = 400;
    throw err;
  }

  const note = opts.note || '';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const label = note
    ? `Published by CFO ${dateStr}. ${note}`
    : `Published by CFO ${dateStr}`;

  const { data: snapshot, error: snapErr } = await supabaseAdmin
    .from('snapshots')
    .insert({
      user_id: clientUserId,
      label,
      period_type: 'annual',
      inputs: draft.inputs,
      outputs: draft.outputs,
    })
    .select('id, created_at')
    .single();

  if (snapErr) throw new Error(`Failed to publish snapshot: ${snapErr.message}`);

  const score = draft.outputs?.profitScore?.total_score ?? 0;
  const tier = draft.outputs?.profitTier?.tier ?? 1;
  const fixQueue = draft.outputs?.actionPlan?.actions || [];

  const { data: existingProgress } = await supabaseAdmin
    .from('game_progress')
    .select('score_history')
    .eq('user_id', clientUserId)
    .maybeSingle();

  const history = existingProgress?.score_history || [];
  history.push({
    date: new Date().toISOString(),
    score,
    tier,
    published_by_partner_id: partnerId,
  });

  await supabaseAdmin
    .from('game_progress')
    .upsert({
      user_id: clientUserId,
      profit_score: score,
      profit_tier: tier,
      fix_queue: fixQueue,
      score_history: history,
    }, { onConflict: 'user_id' });

  const { data: updatedDraft, error: draftErr } = await supabaseAdmin
    .from('partner_drafts')
    .update({
      last_published_snapshot_id: snapshot.id,
      last_published_at: snapshot.created_at,
      has_unpublished_changes: false,
    })
    .eq('partner_id', partnerId)
    .eq('client_user_id', clientUserId)
    .select('*')
    .single();

  if (draftErr) throw new Error(`Published, but failed to update draft state: ${draftErr.message}`);

  const client = await fetchClientProfile(clientUserId);

  return {
    snapshot_id: snapshot.id,
    published_at: snapshot.created_at,
    draft: { ...updatedDraft, client },
  };
}

/**
 * Throw away the current draft and reseed from the client's latest published
 * snapshot. Useful when Nick wants to start over.
 */
export async function resetDraft(partnerId, clientUserId) {
  const latest = await fetchClientLatestSnapshot(clientUserId);
  const seedInputs = latest?.inputs || getDefaultInputs();
  const seedOutputs = latest?.outputs || null;

  const { data, error } = await supabaseAdmin
    .from('partner_drafts')
    .update({
      inputs: seedInputs,
      outputs: seedOutputs,
      monthly_history: null,
      field_sources: {},
      interpretation: null,
      has_unpublished_changes: false,
      last_published_snapshot_id: latest?.id || null,
      last_published_at: latest?.created_at || null,
    })
    .eq('partner_id', partnerId)
    .eq('client_user_id', clientUserId)
    .select('*')
    .single();

  if (error) {
    // No existing draft yet, just seed.
    return loadOrSeedDraft(partnerId, clientUserId);
  }

  const client = await fetchClientProfile(clientUserId);
  return { ...data, client };
}
