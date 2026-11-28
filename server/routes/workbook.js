import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { partnerGuard, loadPartnerProfile } from '../middleware/partnerGuard.js';
import {
  connectionStatus, copyTemplateTo, getSiteAndDrive, openSession, closeSession,
  writeRange, readRange, GraphError,
} from '../integrations/sharepoint/graph.js';

/**
 * CFO-only checks for the SharePoint / Excel connection (stage 2).
 * Mounted at /workbook. Every route needs a signed-in partner.
 */
const router = Router();
router.use(authGuard);
router.use(partnerGuard);
router.use(loadPartnerProfile);

function sendGraphError(res, err, next) {
  if (err instanceof GraphError) {
    return res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message, code: err.code });
  }
  return next(err);
}

// Can the portal sign in to Microsoft, see the EasyFlow Clients site and find the template?
router.get('/status', async (_req, res, next) => {
  try {
    res.json(await connectionStatus());
  } catch (err) {
    sendGraphError(res, err, next);
  }
});

// Proof step 1: copy the master template into _Connection Test (never touches the master).
router.post('/test/copy', async (_req, res, next) => {
  try {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.');
    const copy = await copyTemplateTo('_Connection Test', `Connection test ${stamp}`);
    res.json(copy);
  } catch (err) {
    sendGraphError(res, err, next);
  }
});

// Proof step 2: write two inputs into the test copy and read the recalculated answer.
// ASSUMPTIONS!B22 = customer hourly rate, B23 = highest loaded employee rate,
// B24 = price-to-labor ratio, a formula (=B22/B23) the workbook recalculates.
router.post('/test/write-read', async (req, res, next) => {
  const { itemId } = req.body || {};
  if (!itemId) return res.status(400).json({ error: 'itemId from the copy step is required' });
  let sessionId = null;
  let driveId = null;
  try {
    ({ driveId } = await getSiteAndDrive());
    sessionId = await openSession(driveId, itemId, { persist: true });

    const before = await readRange(driveId, itemId, 'ASSUMPTIONS', 'B22:B24', sessionId);
    await writeRange(driveId, itemId, 'ASSUMPTIONS', 'B3', [['Portal Connection Test Co']], sessionId);
    await writeRange(driveId, itemId, 'ASSUMPTIONS', 'B22:B23', [[150], [40]], sessionId);
    const after = await readRange(driveId, itemId, 'ASSUMPTIONS', 'B22:B24', sessionId);
    const name = await readRange(driveId, itemId, 'ASSUMPTIONS', 'B3', sessionId);

    const ratio = Number(after.values?.[2]?.[0]);
    res.json({
      before: { hourlyRate: before.values?.[0]?.[0], employeeRate: before.values?.[1]?.[0], ratio: before.values?.[2]?.[0] },
      after: { hourlyRate: after.values?.[0]?.[0], employeeRate: after.values?.[1]?.[0], ratio, ratioText: after.text?.[2]?.[0] },
      businessName: name.values?.[0]?.[0],
      recalculated: Math.abs(ratio - 150 / 40) < 0.0001,
    });
  } catch (err) {
    sendGraphError(res, err, next);
  } finally {
    if (driveId && sessionId) await closeSession(driveId, itemId, sessionId);
  }
});

export default router;
