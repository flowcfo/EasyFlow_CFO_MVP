import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './brandInjector.js';
import { buildScoreInterpreterPrompt } from './systemPrompt.js';
import { AI_MODELS } from '../../shared/constants.js';
import { anonymizeOutputs, reconstructDollars } from './anonymizer.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function interpretScore(outputs, userType = 'owner', partnerBrandName = null) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return getFallbackInterpretation(outputs);
  }

  try {
    const safeOutputs = anonymizeOutputs(outputs);
    const systemPrompt = buildSystemPrompt(userType, partnerBrandName);
    const userPrompt = buildScoreInterpreterPrompt(safeOutputs);

    const message = await anthropic.messages.create({
      model: AI_MODELS.HAIKU,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = message.content[0].text.trim();

    let parsed;
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        text: reconstructDollars(rawText, outputs),
        panels: getFallbackPanels(outputs),
        source: 'ai',
      };
    }

    const plainText = reconstructDollars(parsed.plain_text || rawText, outputs);
    const panels = (parsed.panels || []).map((p) => ({
      ...p,
      caption: reconstructDollars(p.caption || '', outputs),
      subtext: reconstructDollars(p.subtext || '', outputs),
    }));

    return {
      text: plainText,
      panels: panels.length > 0 ? panels : getFallbackPanels(outputs),
      source: 'ai',
    };
  } catch (err) {
    console.error('AI interpretation failed:', err.message);
    return getFallbackInterpretation(outputs);
  }
}

function getFallbackPanels(outputs) {
  const score = outputs.profitScore?.total_score || 0;
  const tier = outputs.profitTier?.tier || 1;
  const pretaxPct = outputs.waterfall?.pretax_pct || 0;
  const directLpr = outputs.ratios?.direct_lpr || 0;

  return [
    {
      number: 1,
      type: 'situation',
      caption: `Your Profit Score is ${score} out of 100.`,
      subtext: `Pretax profit at ${(pretaxPct * 100).toFixed(1)}%. Level ${tier}.`,
      visual: 'gauge',
      value: score,
      target: 100,
      color: tier <= 2 ? 'red' : tier === 3 ? 'yellow' : 'green',
    },
    {
      number: 2,
      type: 'action',
      caption: directLpr < 2.5
        ? 'Your Direct LPR needs attention first. Raise prices or reduce labor costs.'
        : 'Focus on protecting your margins and building your score higher.',
      subtext: `Direct LPR: ${directLpr.toFixed(2)}x. Target: 2.5x to 3.5x.`,
      visual: 'action_arrow',
      cta_label: 'View Productivity Ratios',
      cta_screen: '/app/productivity-ratios',
      color: 'orange',
    },
  ];
}

function getFallbackInterpretation(outputs) {
  const { profitTier, waterfall, profitScore } = outputs;
  const tier = profitTier?.tier || 1;
  const score = profitScore?.total_score || 0;
  const pretaxPct = waterfall?.pretax_pct || 0;

  const messages = {
    1: `Your Profit Score is ${score} out of 100. Your business is currently losing money at ${(pretaxPct * 100).toFixed(1)}% pretax profit. The most urgent move is to stop the cash bleed by addressing your largest cost leak.`,
    2: `Your Profit Score is ${score} out of 100. You are covering costs but not building wealth at ${(pretaxPct * 100).toFixed(1)}% pretax profit. Focus on getting above the 10% profit floor.`,
    3: `Your Profit Score is ${score} out of 100. Your business is stable at ${(pretaxPct * 100).toFixed(1)}% pretax profit. The gap between stable and thriving is your next target.`,
    4: `Your Profit Score is ${score} out of 100. You are running a healthy business at ${(pretaxPct * 100).toFixed(1)}% pretax profit. Protect what is working and build on it.`,
    5: `Your Profit Score is ${score} out of 100. You are in Wealth Mode at ${(pretaxPct * 100).toFixed(1)}% pretax profit. Focus on making this compound.`,
  };

  return {
    text: messages[tier] || messages[1],
    panels: getFallbackPanels(outputs),
    source: 'fallback',
  };
}
