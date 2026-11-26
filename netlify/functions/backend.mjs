// Runs the Express API (server/index.js) as one Netlify Function.
// The browser calls /backend/*; client/public/_redirects rewrites that here.
import serverless from 'serverless-http';
import app from '../../server/index.js';

export const handler = serverless(app, {
  // Excel uploads arrive as raw bytes; keep them binary instead of decoding as text.
  binary: ['application/octet-stream', 'application/pdf'],
});
