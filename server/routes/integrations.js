import { Router } from 'express';
import path from 'path';
import { authGuard, optionalAuth } from '../middleware/authGuard.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { supabaseAdmin } from '../db/supabase.js';
import { consumeOAuthNonce } from '../integrations/oauthNonce.js';

// QBO
import { getAuthorizationUrl as qboAuthUrl, handleCallback as qboCallback, revokeTokens as qboRevoke, getIntegrationStatus as qboStatus } from '../integrations/qbo/auth.js';
import { pullProfitAndLoss as qboPull } from '../integrations/qbo/puller.js';
import { mapQBOToInputs, mapQBOToEasyNumbers } from '../integrations/qbo/mapper.js';
import { finalizeInputs as finalizeQBOInputs } from '../integrations/qbo/confirmationBuilder.js';
import { ensureFreshToken as qboRefresh } from '../integrations/qbo/refresher.js';

// Xero
import { getAuthorizationUrl as xeroAuthUrl, handleCallback as xeroExchange, revokeTokens as xeroRevoke } from '../integrations/xero/auth.js';
import { pullProfitAndLoss as pullXeroProfitAndLoss } from '../integrations/xero/puller.js';
import { mapXeroToInputs } from '../integrations/xero/mapper.js';

// FreshBooks
import { getAuthorizationUrl as freshbooksAuthUrl, handleCallback as freshbooksExchange, revokeTokens as freshbooksRevoke } from '../integrations/freshbooks/auth.js';
import { pullProfitAndLoss as pullFreshBooksProfitAndLoss } from '../integrations/freshbooks/puller.js';
import { mapFreshBooksToInputs } from '../integrations/freshbooks/mapper.js';

// Wave
import { getAuthorizationUrl as waveAuthUrl, handleCallback as waveExchange, revokeTokens as waveRevoke } from '../integrations/wave/auth.js';
import { pullProfitAndLoss as pullWaveProfitAndLoss } from '../integrations/wave/puller.js';
import { mapWaveToInputs } from '../integrations/wave/mapper.js';

// Sage
import { getAuthorizationUrl as sageAuthUrl, handleCallback as sageExchange, revokeTokens as sageRevoke } from '../integrations/sage/auth.js';
import { pullProfitAndLoss as pullSageProfitAndLoss } from '../integrations/sage/puller.js';
import { mapSageToInputs } from '../integrations/sage/mapper.js';

// Zoho
import { getAuthorizationUrl as zohoAuthUrl, exchangeCodeForTokens as zohoExchange, revokeTokens as zohoRevoke } from '../integrations/zoho/auth.js';
import { pullZohoProfitAndLoss } from '../integrations/zoho/puller.js';
import { mapZohoToInputs } from '../integrations/zoho/mapper.js';

// Excel (new mapping pipeline)
import { parseExcelFile } from '../integrations/excel/parser.js';
import { finalizeMappings } from '../integrations/confirmationBuilder.js';
import { mapAccounts } from '../integrations/ruleMapper.js';
import { classifyAccounts } from '../integrations/aiClassifier.js';
import { buildConfirmation } from '../integrations/confirmationBuilder.js';

// Demo / Mock
import { mockQBOReport } from '../integrations/qbo/mockReport.js';
import { mapQBOToInputs as mapDemoInputs, generateDemoMonthlyHistory } from '../integrations/qbo/mapper.js';

// P&L Template Writer (Python bridge)
import { writeEasyNumbersToTemplate, fixTemplate, mapAccountsToRows } from '../integrations/template/templateBridge.js';

const router = Router();

// ==================== STATUS (all providers) ====================
router.get('/status', authGuard, async (req, res, next) => {
  try {
    const { data: integrations } = await supabaseAdmin
      .from('integrations')
      .select('provider, realm_id, last_pulled_at, pull_status, token_expires_at')
      .eq('user_id', req.user.id);

    const statusMap = {};
    for (const i of integrations || []) {
      statusMap[i.provider] = {
        connected: true,
        realm_id: i.realm_id,
        last_pulled_at: i.last_pulled_at,
        pull_status: i.pull_status,
        token_expired: new Date(i.token_expires_at) < new Date(),
      };
    }

    res.json({ integrations: statusMap });
  } catch (err) {
    next(err);
  }
});

// ==================== QBO ====================
router.get('/qbo/connect', authGuard, async (req, res, next) => {
  try {
    const authUrl = await qboAuthUrl(req.user.id);
    res.json({ url: authUrl });
  } catch (err) {
    next(err);
  }
});

router.get('/qbo/callback', async (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const userId = await consumeOAuthNonce(req.query.state, 'qbo');
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    await qboCallback(url, userId);
    res.redirect(`${frontendUrl}/onboard/qbo?connected=true`);
  } catch (err) {
    res.redirect(`${frontendUrl}/onboard/qbo?error=connection_failed`);
  }
});

// Legacy pull: returns flat inputs (backward compatible)
router.post('/qbo/pull', authGuard, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.body;
    const report = await qboPull(req.user.id, { start_date, end_date });
    const { inputs, sources } = mapQBOToInputs(report);
    res.json({ inputs, sources, provider: 'qbo' });
  } catch (err) {
    next(err);
  }
});

// New pull: returns confirmation data for MappingConfirmation screen
router.post('/qbo/pull-confirm', authGuard, async (req, res, next) => {
  try {
    const { start_date, end_date, business_type } = req.body;
    const report = await qboPull(req.user.id, { start_date, end_date });
    const confirmation = await mapQBOToEasyNumbers(report, business_type);
    res.json({ confirmation, provider: 'qbo' });
  } catch (err) {
    next(err);
  }
});

// Finalize: owner-confirmed mappings → Easy Numbers input shape
router.post('/qbo/finalize', optionalAuth, async (req, res, next) => {
  try {
    const { confirmedMappings, ownerPayDetected, ownerPaySource } = req.body;
    if (!confirmedMappings || !Array.isArray(confirmedMappings)) {
      return res.status(400).json({ error: 'confirmedMappings array required' });
    }
    const inputs = finalizeQBOInputs(confirmedMappings, ownerPayDetected || 0, ownerPaySource || 'not_found');
    res.json({ inputs, provider: 'qbo' });
  } catch (err) {
    next(err);
  }
});

router.post('/qbo/refresh', authGuard, async (req, res, next) => {
  try {
    await qboRefresh(req.user.id);
    res.json({ message: 'Token refreshed successfully' });
  } catch (err) {
    next(err);
  }
});

router.delete('/qbo/disconnect', authGuard, async (req, res, next) => {
  try {
    await qboRevoke(req.user.id);
    res.json({ message: 'QuickBooks disconnected' });
  } catch (err) {
    next(err);
  }
});

router.get('/qbo/status', authGuard, async (req, res, next) => {
  try {
    const status = await qboStatus(req.user.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// ==================== XERO ====================
router.get('/xero/connect', authGuard, async (req, res, next) => {
  try {
    res.json({ url: await xeroAuthUrl(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/xero/callback', async (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const userId = await consumeOAuthNonce(req.query.state, 'xero');
    await xeroExchange(req.query.code, userId);
    res.redirect(`${frontendUrl}/app/input?provider=xero&connected=true`);
  } catch (err) {
    res.redirect(`${frontendUrl}/app/input?error=xero_connection_failed`);
  }
});

router.post('/xero/pull', authGuard, async (req, res, next) => {
  try {
    const report = await pullXeroProfitAndLoss(req.user.id, req.body);
    const { inputs, sources } = mapXeroToInputs(report);
    res.json({ inputs, sources, provider: 'xero' });
  } catch (err) {
    next(err);
  }
});

router.delete('/xero/disconnect', authGuard, async (req, res, next) => {
  try {
    await xeroRevoke(req.user.id);
    res.json({ message: 'Xero disconnected' });
  } catch (err) {
    next(err);
  }
});

// ==================== FRESHBOOKS ====================
router.get('/freshbooks/connect', authGuard, async (req, res, next) => {
  try {
    res.json({ url: await freshbooksAuthUrl(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/freshbooks/callback', async (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const userId = await consumeOAuthNonce(req.query.state, 'freshbooks');
    await freshbooksExchange(req.query.code, userId);
    res.redirect(`${frontendUrl}/app/input?provider=freshbooks&connected=true`);
  } catch (err) {
    res.redirect(`${frontendUrl}/app/input?error=freshbooks_connection_failed`);
  }
});

router.post('/freshbooks/pull', authGuard, async (req, res, next) => {
  try {
    const report = await pullFreshBooksProfitAndLoss(req.user.id, req.body);
    const { inputs, sources } = mapFreshBooksToInputs(report);
    res.json({ inputs, sources, provider: 'freshbooks' });
  } catch (err) {
    next(err);
  }
});

router.delete('/freshbooks/disconnect', authGuard, async (req, res, next) => {
  try {
    await freshbooksRevoke(req.user.id);
    res.json({ message: 'FreshBooks disconnected' });
  } catch (err) {
    next(err);
  }
});

// ==================== WAVE ====================
router.get('/wave/connect', authGuard, async (req, res, next) => {
  try {
    res.json({ url: await waveAuthUrl(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/wave/callback', async (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const userId = await consumeOAuthNonce(req.query.state, 'wave');
    await waveExchange(req.query.code, userId);
    res.redirect(`${frontendUrl}/app/input?provider=wave&connected=true`);
  } catch (err) {
    res.redirect(`${frontendUrl}/app/input?error=wave_connection_failed`);
  }
});

router.post('/wave/pull', authGuard, async (req, res, next) => {
  try {
    const report = await pullWaveProfitAndLoss(req.user.id, req.body);
    const { inputs, sources } = mapWaveToInputs(report);
    res.json({ inputs, sources, provider: 'wave' });
  } catch (err) {
    next(err);
  }
});

router.delete('/wave/disconnect', authGuard, async (req, res, next) => {
  try {
    await waveRevoke(req.user.id);
    res.json({ message: 'Wave disconnected' });
  } catch (err) {
    next(err);
  }
});

// ==================== SAGE ====================
router.get('/sage/connect', authGuard, async (req, res, next) => {
  try {
    res.json({ url: await sageAuthUrl(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/sage/callback', async (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const userId = await consumeOAuthNonce(req.query.state, 'sage');
    await sageExchange(req.query.code, userId);
    res.redirect(`${frontendUrl}/app/input?provider=sage&connected=true`);
  } catch (err) {
    res.redirect(`${frontendUrl}/app/input?error=sage_connection_failed`);
  }
});

router.post('/sage/pull', authGuard, async (req, res, next) => {
  try {
    const report = await pullSageProfitAndLoss(req.user.id, req.body);
    const { inputs, sources } = mapSageToInputs(report);
    res.json({ inputs, sources, provider: 'sage' });
  } catch (err) {
    next(err);
  }
});

router.delete('/sage/disconnect', authGuard, async (req, res, next) => {
  try {
    await sageRevoke(req.user.id);
    res.json({ message: 'Sage disconnected' });
  } catch (err) {
    next(err);
  }
});

// ==================== ZOHO ====================
router.get('/zoho/connect', authGuard, async (req, res, next) => {
  try {
    res.json({ url: await zohoAuthUrl(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/zoho/callback', async (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const userId = await consumeOAuthNonce(req.query.state, 'zoho');
    await zohoExchange(req.query.code, userId);
    res.redirect(`${frontendUrl}/app/input?provider=zoho&connected=true`);
  } catch (err) {
    res.redirect(`${frontendUrl}/app/input?error=zoho_connection_failed`);
  }
});

router.post('/zoho/pull', authGuard, async (req, res, next) => {
  try {
    const report = await pullZohoProfitAndLoss(req.user.id, req.body);
    const { inputs, sources } = mapZohoToInputs(report);
    res.json({ inputs, sources, provider: 'zoho' });
  } catch (err) {
    next(err);
  }
});

router.delete('/zoho/disconnect', authGuard, async (req, res, next) => {
  try {
    await zohoRevoke(req.user.id);
    res.json({ message: 'Zoho disconnected' });
  } catch (err) {
    next(err);
  }
});

// ==================== DEMO MODE (simulated QBO) ====================
router.post('/demo/connect', optionalAuth, async (req, res, next) => {
  try {
    if (req.user?.id) {
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      await supabaseAdmin
        .from('integrations')
        .upsert({
          user_id: req.user.id,
          provider: 'qbo',
          realm_id: 'demo-realm-123456',
          access_token: 'demo-access-token',
          refresh_token: 'demo-refresh-token',
          token_expires_at: expiresAt,
          pull_status: 'pending',
        }, { onConflict: 'user_id,provider' })
        .select()
        .single();
    }

    res.json({ connected: true, provider: 'qbo', demo: true });
  } catch (err) {
    next(err);
  }
});

router.post('/demo/pull', optionalAuth, async (req, res, next) => {
  try {
    const { inputs, sources } = mapDemoInputs(mockQBOReport);
    const monthlyHistory = generateDemoMonthlyHistory(inputs);

    if (req.user?.id) {
      await supabaseAdmin
        .from('integrations')
        .update({
          last_pulled_at: new Date().toISOString(),
          pull_status: 'success',
        })
        .eq('user_id', req.user.id)
        .eq('provider', 'qbo');
    }

    res.json({ inputs, sources, monthlyHistory, provider: 'qbo', demo: true });
  } catch (err) {
    next(err);
  }
});

// Demo pull with confirmation screen (new pipeline)
router.post('/demo/pull-confirm', optionalAuth, async (req, res, next) => {
  try {
    const { business_type } = req.body;
    const confirmation = await mapQBOToEasyNumbers(mockQBOReport, business_type);

    if (req.user?.id) {
      await supabaseAdmin
        .from('integrations')
        .update({ last_pulled_at: new Date().toISOString(), pull_status: 'success' })
        .eq('user_id', req.user.id)
        .eq('provider', 'qbo');
    }

    res.json({ confirmation, provider: 'qbo', demo: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/demo/disconnect', authGuard, async (req, res, next) => {
  try {
    await supabaseAdmin
      .from('integrations')
      .delete()
      .eq('user_id', req.user.id)
      .eq('provider', 'qbo');

    res.json({ message: 'Demo QuickBooks disconnected' });
  } catch (err) {
    next(err);
  }
});

// ==================== EXCEL/CSV UPLOAD ====================

const ALLOWED_UPLOAD_EXTS = new Set(['.xlsx', '.xls', '.csv']);

// Step 1: Upload and parse → returns confirmation data for the frontend
router.post('/excel/upload', authGuard, uploadLimiter, async (req, res, next) => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'File upload required' });
    }

    const filename = String(req.headers['x-filename'] || 'upload.xlsx');
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
      return res.status(400).json({ error: 'Unsupported file type. Allowed: .xlsx, .xls, .csv' });
    }

    const businessType = req.headers['x-business-type'] || '';
    const result = await parseExcelFile(req.body, filename, businessType);
    res.json({ ...result, provider: 'excel' });
  } catch (err) {
    next(err);
  }
});

// Step 2: Owner confirms/adjusts mappings → finalize into Easy Numbers inputs
router.post('/excel/finalize', optionalAuth, async (req, res, next) => {
  try {
    const { confirmedMappings } = req.body;
    if (!confirmedMappings || !Array.isArray(confirmedMappings)) {
      return res.status(400).json({ error: 'confirmedMappings array required' });
    }

    const { inputs, sources } = finalizeMappings(confirmedMappings);
    res.json({ inputs, sources, provider: 'excel' });
  } catch (err) {
    next(err);
  }
});

// ==================== QBO CONFIRMATION FLOW ====================

// Parse QBO report through mapping pipeline (same as Excel but for QBO data)
router.post('/qbo/parse-for-confirmation', optionalAuth, async (req, res, next) => {
  try {
    const { report, businessType } = req.body;
    const qboReport = report || mockQBOReport;

    const rows = qboReport?.Rows?.Row || [];
    const accounts = [];

    function extractQBOAccounts(rowList, section) {
      if (!Array.isArray(rowList)) return;
      for (const row of rowList) {
        const label = row.ColData?.[0]?.value || row.Header?.ColData?.[0]?.value || '';
        const value = parseFloat(row.ColData?.[1]?.value || row.Summary?.ColData?.[1]?.value || '0');

        if (label && !isNaN(value) && value !== 0) {
          accounts.push({ name: label, amount: Math.abs(value), section: section || 'unknown' });
        }

        const header = (row.Header?.ColData?.[0]?.value || row.group || '').toLowerCase();
        let childSection = section;
        if (header.includes('income') || header.includes('revenue')) childSection = 'income';
        else if (header.includes('cost of goods') || header.includes('cogs')) childSection = 'cogs';
        else if (header.includes('expense')) childSection = 'expenses';

        if (row.Rows?.Row) {
          extractQBOAccounts(row.Rows.Row, childSection);
        }
      }
    }

    extractQBOAccounts(rows, null);

    const { matched, unmatched } = mapAccounts(accounts);
    let aiClassified = [];
    if (unmatched.length > 0) {
      aiClassified = await classifyAccounts(unmatched, businessType);
    }

    const confirmation = buildConfirmation(matched, aiClassified, accounts);
    res.json({ confirmation, provider: 'qbo' });
  } catch (err) {
    next(err);
  }
});

// ==================== P&L TEMPLATE WRITER ====================

// Allowlisted base dirs for template I/O. TEMPLATE_DIR holds source xlsx files; OUTPUT_DIR holds generated copies.
// Defaults match the existing local dev path so nothing breaks; production should set both env vars to absolute paths.
const TEMPLATE_DIR = path.resolve(process.env.TEMPLATE_DIR || 'C:/Users/nmarc/EasyFlowCFO/templates');
const OUTPUT_DIR = path.resolve(process.env.TEMPLATE_OUTPUT_DIR || 'C:/Users/nmarc/EasyFlowCFO/outputs');

function safeResolveUnder(baseDir, userPath) {
  if (!userPath) return null;
  const candidate = path.resolve(baseDir, String(userPath));
  // Ensure resolved path is inside baseDir (prevents ../../../ traversal). Trailing sep avoids /foo matching /foobar.
  const baseWithSep = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (candidate !== baseDir && !candidate.startsWith(baseWithSep)) return null;
  if (path.extname(candidate).toLowerCase() !== '.xlsx') return null;
  return candidate;
}

// Fix known issues in the template (standalone)
router.post('/template/fix', authGuard, async (req, res, next) => {
  try {
    if (req.body.template_path) {
      const safe = safeResolveUnder(TEMPLATE_DIR, req.body.template_path);
      if (!safe) return res.status(400).json({ error: 'Invalid template_path' });
      const result = await fixTemplate(safe);
      return res.json(result);
    }
    const result = await fixTemplate();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Map accounts to template rows (dry run)
router.post('/template/map-preview', authGuard, async (req, res, next) => {
  try {
    const { accounts } = req.body;
    if (!accounts || !Array.isArray(accounts)) {
      return res.status(400).json({ error: 'accounts array required' });
    }
    const result = await mapAccountsToRows(accounts);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Write finalized Easy Numbers inputs to the P&L template
router.post('/template/write', authGuard, async (req, res, next) => {
  try {
    const {
      inputs,
      template_path,
      output_path,
      overwrite_existing,
      business_type,
      direct_labor_pct,
      months,
    } = req.body;

    if (!inputs) {
      return res.status(400).json({ error: 'inputs object required' });
    }

    const writeOpts = {
      overwriteExisting: overwrite_existing || false,
      businessType: business_type || 'unknown',
      directLaborPct: direct_labor_pct,
      months: months || [],
    };
    if (template_path) {
      const safe = safeResolveUnder(TEMPLATE_DIR, template_path);
      if (!safe) return res.status(400).json({ error: 'Invalid template_path' });
      writeOpts.templatePath = safe;
    }
    if (output_path) {
      const safe = safeResolveUnder(OUTPUT_DIR, output_path);
      if (!safe) return res.status(400).json({ error: 'Invalid output_path' });
      writeOpts.outputPath = safe;
    }

    const result = await writeEasyNumbersToTemplate(inputs, writeOpts);

    res.json({ ...result, provider: 'template' });
  } catch (err) {
    next(err);
  }
});

export default router;
