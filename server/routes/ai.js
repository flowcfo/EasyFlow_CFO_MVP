import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authGuard } from '../middleware/authGuard.js';
import { tierGuard } from '../middleware/tierGuard.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { supabaseAdmin } from '../db/supabase.js';
import { interpretScore } from '../ai/interpreter.js';
import { handleCFOChat, STARTER_QUESTIONS } from '../ai/cfoChatHandler.js';
import { generateAIActionPlan } from '../ai/actionPlanGen.js';
import { generatePricingRecommendation } from '../ai/pricingAI.js';
import { encryptMessages, decryptMessages } from '../ai/conversationEncryption.js';
import { anonymizeOutputs } from '../ai/anonymizer.js';
import { buildSystemPrompt } from '../ai/brandInjector.js';
import { buildDynamicStartersPrompt } from '../ai/systemPrompt.js';
import { AI_SESSION_LIMITS, TIER_RANK, AI_MODELS } from '../../shared/constants.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const router = Router();

async function checkSessionLimit(userId, tier) {
  const limit = AI_SESSION_LIMITS[tier];
  if (!limit || limit === Infinity) return { allowed: true, used: 0, limit };

  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { count } = await supabaseAdmin
    .from('ai_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('month_year', monthYear);

  return {
    allowed: (count || 0) < limit,
    used: count || 0,
    limit,
  };
}

async function recordSession(userId, conversationId) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await supabaseAdmin.from('ai_sessions').insert({
    user_id: userId,
    conversation_id: conversationId,
    month_year: monthYear,
  });
}

router.post('/interpret', authGuard, tierGuard('clarity'), aiRateLimiter, async (req, res, next) => {
  try {
    const { outputs } = req.body;
    if (!outputs) return res.status(400).json({ error: 'outputs object required' });

    const result = await interpretScore(outputs, req.user.user_type, req.brandName);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/price', authGuard, tierGuard('clarity'), aiRateLimiter, async (req, res, next) => {
  try {
    const { pricing_inputs, direct_lpr } = req.body;
    if (!pricing_inputs) return res.status(400).json({ error: 'pricing_inputs object required' });

    const result = await generatePricingRecommendation(
      pricing_inputs,
      direct_lpr || 0,
      req.user.user_type,
      req.brandName,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/chat', authGuard, tierGuard('control'), aiRateLimiter, async (req, res, next) => {
  try {
    const { messages, snapshot_id, conversation_id } = req.body;

    const sessionCheck = await checkSessionLimit(req.user.id, req.user.tier);
    if (!sessionCheck.allowed) {
      return res.status(429).json({
        error: 'Monthly session limit reached',
        used: sessionCheck.used,
        limit: sessionCheck.limit,
        message: `You have used all ${sessionCheck.limit} AI CFO sessions this month. Upgrade to Harvest for unlimited sessions.`,
      });
    }

    let snapshotOutputs = {};
    if (snapshot_id) {
      const { data } = await supabaseAdmin
        .from('snapshots')
        .select('outputs')
        .eq('id', snapshot_id)
        .eq('user_id', req.user.id)
        .single();
      snapshotOutputs = data?.outputs || {};
    }

    let convId = conversation_id;
    const encryptedMessages = encryptMessages(messages);

    if (convId) {
      await supabaseAdmin
        .from('ai_conversations')
        .update({ messages: encryptedMessages })
        .eq('id', convId)
        .eq('user_id', req.user.id);
    } else {
      const { data: conv } = await supabaseAdmin
        .from('ai_conversations')
        .insert({
          user_id: req.user.id,
          snapshot_id,
          messages: encryptedMessages,
        })
        .select('id')
        .single();

      convId = conv.id;
      res.setHeader('X-Conversation-Id', convId);

      await recordSession(req.user.id, convId);
    }

    const responseMode = req.user.response_mode || 'comic';
    await handleCFOChat(res, messages, snapshotOutputs, req.user.user_type, req.brandName, responseMode);
  } catch (err) {
    next(err);
  }
});

router.post('/action-plan', authGuard, tierGuard('control'), aiRateLimiter, async (req, res, next) => {
  try {
    const { outputs } = req.body;
    if (!outputs) return res.status(400).json({ error: 'outputs object required' });

    const actions = await generateAIActionPlan(outputs, req.user.user_type, req.brandName);
    if (!actions) {
      return res.json({ actions: outputs.actionPlan?.actions || [], source: 'static' });
    }

    await supabaseAdmin
      .from('game_progress')
      .update({ fix_queue: actions })
      .eq('user_id', req.user.id);

    res.json({ actions, source: 'ai' });
  } catch (err) {
    next(err);
  }
});

router.get('/conversations', authGuard, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin
      .from('ai_conversations')
      .select('id, snapshot_id, messages, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    const conversations = (data || []).map((conv) => ({
      id: conv.id,
      snapshot_id: conv.snapshot_id,
      messages: decryptMessages(conv.messages),
      created_at: conv.created_at,
    }));

    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions', authGuard, async (req, res, next) => {
  try {
    const sessionCheck = await checkSessionLimit(req.user.id, req.user.tier);
    res.json(sessionCheck);
  } catch (err) {
    next(err);
  }
});

router.get('/starter-questions', (_req, res) => {
  res.json({ questions: STARTER_QUESTIONS });
});

router.post('/dynamic-starters', authGuard, async (req, res, next) => {
  try {
    const { outputs } = req.body;
    if (!outputs) return res.json({ questions: STARTER_QUESTIONS });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ questions: STARTER_QUESTIONS });
    }

    const safeOutputs = anonymizeOutputs(outputs);
    const systemPrompt = buildSystemPrompt(req.user.user_type, req.brandName);
    const prompt = buildDynamicStartersPrompt(safeOutputs);

    const message = await anthropic.messages.create({
      model: AI_MODELS.HAIKU,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].text.trim();
    let questions;
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleaned);
    } catch {
      questions = STARTER_QUESTIONS;
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      questions = STARTER_QUESTIONS;
    }

    res.json({ questions: questions.slice(0, 4) });
  } catch (err) {
    console.error('Dynamic starters failed:', err.message);
    res.json({ questions: STARTER_QUESTIONS });
  }
});

router.put('/response-mode', authGuard, async (req, res, next) => {
  try {
    const { mode } = req.body;
    if (!mode || !['comic', 'classic'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "comic" or "classic"' });
    }

    await supabaseAdmin
      .from('users')
      .update({ response_mode: mode })
      .eq('id', req.user.id);

    res.json({ response_mode: mode });
  } catch (err) {
    next(err);
  }
});

export default router;
