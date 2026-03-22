import { Router } from 'express';
import {
  readMonthlyData, buildMonthlyDataFromHistory,
  getAvailableWindows, calculateRolling12, calculateAllWindows,
  invalidateCache,
} from '../calculations/rolling12.js';
import { optionalAuth } from '../middleware/authGuard.js';

const router = Router();

/**
 * Resolve monthlyData: prefer template file, fall back to
 * in-memory history passed in the request body.
 */
function resolveMonthlyData(req) {
  let md = readMonthlyData();
  if (md) return md;

  // Fall back to client-supplied monthly history (from Excel/QBO import)
  if (req.body?.monthlyHistory) {
    return buildMonthlyDataFromHistory(req.body.monthlyHistory);
  }
  return null;
}

// GET /rolling12/windows?limit_years=N
router.get('/windows', optionalAuth, (req, res) => {
  const md = readMonthlyData();
  if (!md) {
    return res.json({
      windows: [],
      default_window: null,
      has_data_range: null,
      source: 'none',
    });
  }

  const limitYears = req.query.limit_years ? parseInt(req.query.limit_years) : null;
  const windows = getAvailableWindows(md, limitYears);
  const defaultWindow = windows.find((w) => w.has_any_data) || windows[0] || null;

  res.json({
    windows,
    default_window: defaultWindow,
    has_data_range: md.has_data_range,
    source: 'template',
  });
});

// POST /rolling12/windows-from-history
// Uses client-supplied monthlyHistory when no template file exists
router.post('/windows-from-history', optionalAuth, (req, res) => {
  const { monthlyHistory, limit_years } = req.body;
  if (!monthlyHistory) {
    return res.status(400).json({ error: 'monthlyHistory required' });
  }

  const md = buildMonthlyDataFromHistory(monthlyHistory);
  if (!md) {
    return res.json({ windows: [], default_window: null, has_data_range: null, source: 'none' });
  }

  const limitYears = limit_years ? parseInt(limit_years) : null;
  const windows = getAvailableWindows(md, limitYears);
  const defaultWindow = windows.find((w) => w.has_any_data) || windows[0] || null;

  res.json({
    windows,
    default_window: defaultWindow,
    has_data_range: md.has_data_range,
    source: 'history',
  });
});

// GET /rolling12/calculate?end_year=YYYY&end_month=M
router.get('/calculate', optionalAuth, (req, res) => {
  const endYear = parseInt(req.query.end_year);
  const endMonth = parseInt(req.query.end_month);

  if (!endYear || endYear < 2023 || endYear > 2026) {
    return res.status(400).json({ error: 'end_year must be between 2023 and 2026' });
  }
  if (!endMonth || endMonth < 1 || endMonth > 12) {
    return res.status(400).json({ error: 'end_month must be between 1 and 12' });
  }

  const md = readMonthlyData();
  if (!md) {
    return res.status(404).json({ error: 'Template file not found. Import data first.' });
  }

  const result = calculateRolling12(md, endYear, endMonth);
  res.json(result);
});

// POST /rolling12/calculate-from-history
router.post('/calculate-from-history', optionalAuth, (req, res) => {
  const { monthlyHistory, end_year, end_month } = req.body;
  if (!monthlyHistory) {
    return res.status(400).json({ error: 'monthlyHistory required' });
  }

  const endYear = parseInt(end_year);
  const endMonth = parseInt(end_month);
  if (!endYear || endYear < 2023 || endYear > 2026) {
    return res.status(400).json({ error: 'end_year must be between 2023 and 2026' });
  }
  if (!endMonth || endMonth < 1 || endMonth > 12) {
    return res.status(400).json({ error: 'end_month must be between 1 and 12' });
  }

  const md = buildMonthlyDataFromHistory(monthlyHistory);
  if (!md) {
    return res.status(400).json({ error: 'Could not parse monthlyHistory' });
  }

  const result = calculateRolling12(md, endYear, endMonth);
  res.json(result);
});

// GET /rolling12/all-windows
router.get('/all-windows', optionalAuth, (req, res) => {
  const md = readMonthlyData();
  if (!md) {
    return res.json({ results: [], trend: null, source: 'none' });
  }

  const allW = calculateAllWindows(md);
  res.json({ ...allW, source: 'template' });
});

// POST /rolling12/all-windows-from-history
router.post('/all-windows-from-history', optionalAuth, (req, res) => {
  const { monthlyHistory } = req.body;
  if (!monthlyHistory) {
    return res.status(400).json({ error: 'monthlyHistory required' });
  }

  const md = buildMonthlyDataFromHistory(monthlyHistory);
  if (!md) {
    return res.json({ results: [], trend: null, source: 'none' });
  }

  const allW = calculateAllWindows(md);
  res.json({ ...allW, source: 'history' });
});

// POST /rolling12/invalidate-cache
router.post('/invalidate-cache', optionalAuth, (_req, res) => {
  invalidateCache();
  res.json({ message: 'Rolling 12 cache invalidated' });
});

export default router;
