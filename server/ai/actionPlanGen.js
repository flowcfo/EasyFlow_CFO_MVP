import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './brandInjector.js';
import { buildActionPlanPrompt } from './systemPrompt.js';
import { AI_MODELS } from '../../shared/constants.js';
import { anonymizeOutputs, reconstructActionPlan } from './anonymizer.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateAIActionPlan(outputs, userType = 'owner', partnerBrandName = null) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const safeOutputs = anonymizeOutputs(outputs);
    const systemPrompt = buildSystemPrompt(userType, partnerBrandName);
    const prompt = buildActionPlanPrompt(safeOutputs, safeOutputs.score_components || {});

    const message = await anthropic.messages.create({
      model: AI_MODELS.SONNET,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].text.trim();
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const actions = JSON.parse(jsonStr);

    if (!Array.isArray(actions) || actions.length === 0) {
      return null;
    }

    const rawActions = actions.slice(0, 3).map((action, i) => ({
      priority: i + 1,
      title: action.title,
      category: action.category,
      difficulty: action.difficulty,
      impact_pct: action.impact_pct || 0,
      score_impact: action.score_impact,
      timeline: action.timeline,
      specific_instruction: action.specific_instruction,
    }));

    return reconstructActionPlan(rawActions, outputs);
  } catch (err) {
    console.error('AI Action Plan generation failed:', err.message);
    return null;
  }
}
