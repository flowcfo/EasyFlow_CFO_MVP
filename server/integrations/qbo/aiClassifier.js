/**
 * QBO AI Classifier
 *
 * Sends unmatched accounts (Income and CostOfGoodsSold sections only)
 * to Claude Haiku in a single batched API call.
 *
 * Never called for Expense/OtherExpense accounts.
 * Those default to other_opex in ruleMapper.
 */

import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are mapping QuickBooks account names to Easy Numbers Profit System fields.
The Easy Numbers system has strict rules. Follow them exactly.

Easy Numbers fields:
  revenue              — All income from selling products or services to customers
  cogs                 — Materials and physical supplies ONLY. No labor. No overhead. No fees.
  employee_direct_labor — W-2 employee wages for people doing the actual billable work
  subcontractors       — 1099 contractors doing the actual billable work
  marketing            — Advertising and marketing spend only
  owner_pay_detected   — Owner compensation in any form
  other_opex           — All other overhead expenses

STRICT RULES:
- Labor costs NEVER go in cogs. Ever. Regardless of where they appear in QBO.
- Owner compensation ALWAYS goes in owner_pay_detected.
- When in doubt between cogs and other_opex, choose other_opex.
- When in doubt between subcontractors and employee_direct_labor,
  choose subcontractors if the account name implies 1099 work.
- Pass-through and reimbursed items: use suggested_field 'revenue_flagged'.

Return a JSON array only. No explanation. No preamble. No markdown.
Format: [{"name": "account name", "suggested_field": "field_name", "confidence": 0.0}]
Confidence: 0.85+ means high confidence. 0.60-0.84 means review recommended.
Below 0.60 means owner must decide.`;

/**
 * Classify unmatched QBO accounts via Claude Haiku.
 *
 * @param {Array<{name: string, section: string, amount: number}>} unmatchedAccounts
 * @param {string} businessType
 * @returns {Promise<Array<{name: string, suggested_field: string, confidence: number}>>}
 */
export async function aiClassify(unmatchedAccounts, businessType) {
  if (!unmatchedAccounts || unmatchedAccounts.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallback(unmatchedAccounts);
  }

  const accountList = unmatchedAccounts.map((a) => ({
    name: a.name,
    section: a.section,
    amount: a.amount,
  }));

  const userMessage = `Business type: ${businessType || 'unknown'}\nAccounts to classify:\n${JSON.stringify(accountList)}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallback(unmatchedAccounts);

    const classifications = JSON.parse(jsonMatch[0]);

    return classifications.map((c) => ({
      name: c.name,
      suggested_field: c.suggested_field || 'other_opex',
      confidence: typeof c.confidence === 'number' ? Math.min(c.confidence, 0.95) : 0.5,
    }));
  } catch (err) {
    console.warn('QBO AI classification failed, using fallback:', err.message);
    return fallback(unmatchedAccounts);
  }
}

function fallback(accounts) {
  return accounts.map((a) => {
    const section = (a.section || '').toLowerCase();
    let field = 'other_opex';
    let confidence = 0.5;

    if (section === 'income' || section === 'otherincome') {
      field = 'revenue';
      confidence = 0.6;
    } else if (section === 'costofgoodssold') {
      field = 'cogs';
      confidence = 0.5;
    }

    return { name: a.name, suggested_field: field, confidence };
  });
}
