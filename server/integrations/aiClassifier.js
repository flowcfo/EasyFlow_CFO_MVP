/**
 * AI Account Classifier
 * Sends unmatched accounts to Claude Haiku for classification.
 * Batches all unmatched accounts into a single API call.
 * Only runs on accounts the ruleMapper could not match.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are mapping financial account names to fields in the Easy Numbers Profit System.

Easy Numbers fields and what belongs there:
- revenue: All income from selling products or services
- cogs: Materials and supplies only. No labor. No overhead.
- owner_direct_labor: Owner's pay for time doing billable work (50% of total owner pay)
- employee_direct_labor: W-2 employee wages for billable work, payroll taxes, benefits
- subcontractors: 1099 subcontractors doing billable work
- marketing: All advertising and marketing spend
- owner_management_wage: Owner's pay for managing the business (50% of total owner pay)
- rent: Facilities costs, leases, storage
- insurance: Business insurance of any kind
- software_subscriptions: Software and subscription services, IT, hosting
- other_opex: All other overhead not listed above (office, utilities, travel, fees, etc.)

For each account, return the best matching Easy Numbers field and a confidence score from 0.0 to 1.0.
Return ONLY a valid JSON array. No explanation. No markdown.

Return format: [{"name":"account name","suggested_field":"field_name","confidence":0.85}]`;

/**
 * Classify unmatched accounts using Claude Haiku.
 * @param {Array<{name: string, amount: number, section?: string}>} accounts
 * @param {string} businessType - e.g. "construction", "professional-services"
 * @returns {Array<{name: string, suggested_field: string, confidence: number}>}
 */
export async function classifyAccounts(accounts, businessType) {
  if (!accounts || accounts.length === 0) return [];

  // If no API key configured, fall back to section-based defaults
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return fallbackClassify(accounts);
  }

  const accountList = accounts.map((a) => ({
    name: a.name,
    type: a.section || 'unknown',
    amount: a.amount,
  }));

  const userMessage = businessType
    ? `Business type: ${businessType}\n\nAccounts to classify:\n${JSON.stringify(accountList)}`
    : `Accounts to classify:\n${JSON.stringify(accountList)}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallbackClassify(accounts);

    const classifications = JSON.parse(jsonMatch[0]);
    return classifications.map((c) => ({
      ...c,
      source: 'ai',
      confidence: Math.min(c.confidence || 0.5, 0.95),
    }));
  } catch (err) {
    console.warn('AI classification failed, using fallback:', err.message);
    return fallbackClassify(accounts);
  }
}

/**
 * Fallback when no AI API key is available.
 * Uses section context to make reasonable guesses.
 */
function fallbackClassify(accounts) {
  return accounts.map((a) => {
    let field = 'other_opex';
    let confidence = 0.3;

    const section = (a.section || '').toLowerCase();
    if (section === 'income') {
      field = 'revenue';
      confidence = 0.6;
    } else if (section === 'cogs') {
      field = 'cogs';
      confidence = 0.6;
    }

    return {
      name: a.name,
      suggested_field: field,
      confidence,
      source: 'fallback',
    };
  });
}
