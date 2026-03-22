import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './brandInjector.js';
import { buildWeeklyBriefPrompt } from './systemPrompt.js';
import { supabaseAdmin } from '../db/supabase.js';
import { AI_MODELS } from '../../shared/constants.js';
import { anonymizeWeeklyEntry, reconstructDollars } from './anonymizer.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateWeeklyBrief(userId) {
  const { data: entries } = await supabaseAdmin
    .from('weekly_entries')
    .select('*')
    .eq('user_id', userId)
    .order('week_ending', { ascending: false })
    .limit(5);

  if (!entries || entries.length < 2) {
    return null;
  }

  const thisWeek = entries[0];
  const trailing = entries.slice(1);

  const { data: latestSnapshot } = await supabaseAdmin
    .from('snapshots')
    .select('outputs')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const annualRevenue = latestSnapshot?.outputs?.waterfall?.total_revenue || 0;

  const safeThisWeek = anonymizeWeeklyEntry(thisWeek, annualRevenue);

  const trailingAvgRev = trailing.reduce((s, e) => s + Number(e.revenue), 0) / trailing.length;
  const trailingAvgCogs = trailing.reduce((s, e) => s + Number(e.cogs), 0) / trailing.length;
  const trailingAvgLabor = trailing.reduce((s, e) => s + Number(e.direct_labor), 0) / trailing.length;

  const safeTrailing = {
    avg_revenue_index: trailingAvgRev / 100000,
    avg_cm_pct: trailingAvgRev > 0
      ? (trailingAvgRev - trailingAvgCogs - trailingAvgLabor) / trailingAvgRev
      : 0,
    avg_direct_lpr: trailingAvgLabor > 0
      ? (trailingAvgRev - trailingAvgCogs) / trailingAvgLabor
      : 0,
  };

  const { data: gameProgress } = await supabaseAdmin
    .from('game_progress')
    .select('profit_score, fix_queue')
    .eq('user_id', userId)
    .single();

  const currentScore = gameProgress?.profit_score || 0;
  const topAction = gameProgress?.fix_queue?.[0]?.title || 'No active actions';

  try {
    const systemPrompt = buildSystemPrompt('owner');
    const prompt = buildWeeklyBriefPrompt(safeThisWeek, safeTrailing, currentScore, topAction);

    const message = await anthropic.messages.create({
      model: AI_MODELS.HAIKU,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].text.trim();
    const fakeOutputs = { waterfall: { total_revenue: annualRevenue } };
    const briefingText = reconstructDollars(rawText, fakeOutputs);

    const { data: briefing } = await supabaseAdmin
      .from('weekly_briefings')
      .insert({
        user_id: userId,
        week_ending: thisWeek.week_ending,
        briefing_text: briefingText,
      })
      .select()
      .single();

    return briefing;
  } catch (err) {
    console.error('Weekly brief generation failed:', err.message);
    return null;
  }
}

export async function runWeeklyBriefCron() {
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id')
    .in('tier', ['harvest', 'partner_starter', 'partner_growth', 'partner_scale']);

  if (!users) return;

  const results = [];
  for (const user of users) {
    const brief = await generateWeeklyBrief(user.id);
    if (brief) {
      results.push({ userId: user.id, briefId: brief.id });
    }
  }

  console.log(`Weekly briefs generated: ${results.length}`);
  return results;
}
