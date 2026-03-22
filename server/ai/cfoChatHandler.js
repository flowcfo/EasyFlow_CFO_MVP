import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './brandInjector.js';
import { COMIC_PANEL_INSTRUCTION } from './systemPrompt.js';
import { AI_MODELS } from '../../shared/constants.js';
import { anonymizeOutputs, reconstructDollars } from './anonymizer.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function handleCFOChat(res, messages, snapshotOutputs, userType = 'owner', partnerBrandName = null, responseMode = 'comic') {
  const safeOutputs = anonymizeOutputs(snapshotOutputs);
  const wantsPanels = responseMode === 'comic';

  const panelInstruction = wantsPanels
    ? `\n\n${COMIC_PANEL_INSTRUCTION}\nReturn your response as a JSON object with "plain_text" (string) and "panels" (array). The plain_text follows the Four-Line Response Rule. The panels array follows the comic panel format. Respond only with valid JSON. No markdown wrapping.`
    : '';

  const systemPrompt = `${buildSystemPrompt(userType, partnerBrandName)}

The owner's current normalized financial metrics (ratios and percentages only):
${JSON.stringify(safeOutputs, null, 2)}

Rules for this conversation:
- Follow the Four-Line Response Rule in every response.
- Detect which of the Five AI Modes applies and use its format.
- Use the Analogy Library when explaining concepts.
- Reference their ratios and percentages. Express dollar amounts using revenue_index * 100000 when relevant.
- End every response with one clear next step.
- If a question requires running new calculations (like a hire analysis), walk through the math using their ratios.
- Keep responses concise. 2-4 paragraphs max.
- No em dashes. Use periods.${panelInstruction}`;

  const anthropicMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  if (wantsPanels) {
    try {
      const message = await anthropic.messages.create({
        model: AI_MODELS.SONNET,
        max_tokens: 1200,
        system: systemPrompt,
        messages: anthropicMessages,
      });

      const rawText = message.content[0].text.trim();
      let parsed;
      try {
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { plain_text: rawText, panels: [] };
      }

      const plainText = reconstructDollars(parsed.plain_text || rawText, snapshotOutputs);
      const panels = (parsed.panels || []).map((p) => ({
        ...p,
        caption: reconstructDollars(p.caption || '', snapshotOutputs),
        subtext: reconstructDollars(p.subtext || '', snapshotOutputs),
      }));

      res.json({ plain_text: plainText, panels, source: 'ai' });
    } catch (err) {
      console.error('CFO Chat error:', err.message);
      res.status(500).json({ error: 'AI chat failed. Please try again.' });
    }
  } else {
    let fullResponse = '';

    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = anthropic.messages.stream({
        model: AI_MODELS.SONNET,
        max_tokens: 600,
        system: systemPrompt,
        messages: anthropicMessages,
      });

      stream.on('text', (text) => {
        fullResponse += text;
        const reconstructed = reconstructDollars(text, snapshotOutputs);
        res.write(`data: ${JSON.stringify({ content: reconstructed })}\n\n`);
      });

      stream.on('end', () => {
        res.write('data: [DONE]\n\n');
        res.end();
      });

      stream.on('error', (err) => {
        console.error('CFO Chat stream error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'AI chat failed. Please try again.' });
        } else {
          res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
          res.end();
        }
      });
    } catch (err) {
      console.error('CFO Chat error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'AI chat failed. Please try again.' });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
        res.end();
      }
    }
  }
}

export const STARTER_QUESTIONS = [
  'Can I afford a hire at $45K?',
  'Why is my cash always tight?',
  'What should I fix first?',
  'What does my breakeven look like if I raise prices 10%?',
];
