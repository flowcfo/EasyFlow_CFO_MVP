import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './brandInjector.js';
import { AI_MODELS } from '../../shared/constants.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generatePricingRecommendation(pricingInputs, directLpr, userType = 'owner', partnerBrandName = null) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return getFallbackRecommendation(pricingInputs, directLpr);
  }

  try {
    const systemPrompt = buildSystemPrompt(userType, partnerBrandName);

    const prompt = `Here are this owner's pricing inputs: ${JSON.stringify(pricingInputs)}. Their current Direct LPR is ${directLpr}. Their target CM% is ${pricingInputs.target_cm_pct || 0.40}. Recommend the best multiplier for their situation. Explain in two sentences why. Name the danger zone price. Name the target price. No em dashes. No fluff. End with one sentence telling them what to do.`;

    const message = await anthropic.messages.create({
      model: AI_MODELS.HAIKU,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      recommendation: message.content[0].text.trim(),
      source: 'ai',
    };
  } catch (err) {
    console.error('Pricing AI failed:', err.message);
    return getFallbackRecommendation(pricingInputs, directLpr);
  }
}

function getFallbackRecommendation(inputs, directLpr) {
  const totalDirectCost = (inputs.labor_hours * inputs.hourly_rate) + inputs.materials_cogs;
  const targetPrice = totalDirectCost / (1 - (inputs.target_cm_pct || 0.40));
  const breakeven = totalDirectCost;
  const multiplier = directLpr < 2.5 ? 3.0 : 2.75;

  return {
    recommendation: `Based on your numbers, charge at least ${multiplier}x your direct costs ($${Math.round(totalDirectCost * multiplier).toLocaleString()}). Your breakeven is $${Math.round(breakeven).toLocaleString()} and your target price for 40% CM is $${Math.round(targetPrice).toLocaleString()}. Price below 2.5x and you are working for free.`,
    source: 'fallback',
  };
}
