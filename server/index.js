import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.js';
import calcRoutes from './routes/calc.js';
import weeklyRoutes from './routes/weekly.js';
import stripeRoutes from './routes/stripe.js';
import benchmarkRoutes from './routes/benchmarks.js';
import aiRoutes from './routes/ai.js';
import gameRoutes from './routes/game.js';
import outputRoutes from './routes/outputs.js';
import integrationRoutes from './routes/integrations.js';
import partnerRoutes from './routes/partner.js';
import rolling12Routes from './routes/rolling12.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logSanitizer } from './middleware/logSanitizer.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { startCronJobs } from './cron.js';

// Fail fast in production if conversation encryption key is missing — silent failures are worse than a crash.
if (process.env.NODE_ENV === 'production' && !process.env.CONVERSATION_ENCRYPTION_KEY) {
  console.error('FATAL: CONVERSATION_ENCRYPTION_KEY must be set in production. Refusing to start.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

function parseAllowedOrigins() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173';
  // Browser Origin never has a trailing slash; strip so https://app.netlify.app/ still matches.
  return raw.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

// Pure JSON API — no inline scripts to whitelist. Disable CSP defaults that complicate API responses; keep the rest.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Bearer tokens in Authorization — cookies not required; credentials:false avoids strict CORS + fetch mismatches.
app.use(cors({
  origin: parseAllowedOrigins(),
  credentials: false,
}));

// Netlify (and some proxies) may forward the browser path including /backend; routes are mounted at /auth, /calc, etc.
app.use((req, _res, next) => {
  if (req.url === '/backend' || req.url.startsWith('/backend/') || req.url.startsWith('/backend?')) {
    req.url = req.url.slice('/backend'.length) || '/';
  }
  next();
});

app.use(logSanitizer);

// Global IP-based throttle. Skip /health (Railway probes) and the Stripe webhook (signed by Stripe IPs we cannot rate-limit).
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/stripe/webhook') return next();
  return globalLimiter(req, res, next);
});

app.post('/stripe/webhook', express.raw({ type: 'application/json' }));

app.post('/integrations/excel/upload', express.raw({ type: 'application/octet-stream', limit: '10mb' }));

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: 'v8', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/calc', calcRoutes);
app.use('/weekly', weeklyRoutes);
app.use('/stripe', stripeRoutes);
app.use('/benchmarks', benchmarkRoutes);
app.use('/ai', aiRoutes);
app.use('/game', gameRoutes);
app.use('/outputs', outputRoutes);
app.use('/integrations', integrationRoutes);
app.use('/partner', partnerRoutes);
app.use('/rolling12', rolling12Routes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Easy Numbers server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    startCronJobs();
  }
});

export default app;
