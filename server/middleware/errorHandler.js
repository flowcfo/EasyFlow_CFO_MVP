export function errorHandler(err, req, res, _next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  if (err.type === 'validation') {
    return res.status(400).json({ error: err.message, details: err.details });
  }

  if (err.type === 'not_found') {
    return res.status(404).json({ error: err.message });
  }

  if (err.type === 'rate_limit') {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  res.status(500).json({ error: 'Internal server error' });
}
