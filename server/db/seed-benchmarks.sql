-- Seed benchmark data for 5 industries
-- Run in Supabase SQL Editor after schema is applied

INSERT INTO benchmarks (industry, revenue_band, avg_gm_pct, avg_direct_lpr, avg_mpr, avg_manpr, avg_pretax_profit_pct, sample_size) VALUES
-- Construction / Trades
('construction', '100k-200k', 0.45, 2.1, 4.5, 0.85, 0.06, 50),
('construction', '200k-500k', 0.48, 2.3, 5.0, 0.90, 0.08, 75),
('construction', '500k-850k', 0.50, 2.5, 5.5, 1.0, 0.10, 60),
('construction', '850k-2m', 0.52, 2.7, 6.0, 1.1, 0.12, 45),
('construction', '2m-3.5m', 0.50, 2.8, 6.5, 1.15, 0.13, 30),
('construction', '3.5m-5m', 0.48, 3.0, 7.0, 1.2, 0.14, 20),

-- Professional Services
('professional-services', '100k-200k', 0.65, 2.8, 6.0, 1.1, 0.12, 80),
('professional-services', '200k-500k', 0.68, 3.0, 6.5, 1.2, 0.14, 100),
('professional-services', '500k-850k', 0.70, 3.2, 7.0, 1.3, 0.16, 75),
('professional-services', '850k-2m', 0.70, 3.3, 7.5, 1.35, 0.18, 55),
('professional-services', '2m-3.5m', 0.68, 3.4, 8.0, 1.4, 0.19, 35),
('professional-services', '3.5m-5m', 0.65, 3.5, 8.5, 1.45, 0.20, 20),

-- Home Services (HVAC, Plumbing, Electrical)
('home-services', '100k-200k', 0.50, 2.0, 4.0, 0.80, 0.05, 60),
('home-services', '200k-500k', 0.52, 2.2, 4.5, 0.85, 0.07, 90),
('home-services', '500k-850k', 0.55, 2.4, 5.0, 0.95, 0.09, 70),
('home-services', '850k-2m', 0.55, 2.6, 5.5, 1.0, 0.11, 50),
('home-services', '2m-3.5m', 0.53, 2.7, 6.0, 1.1, 0.12, 30),
('home-services', '3.5m-5m', 0.52, 2.9, 6.5, 1.15, 0.13, 15),

-- Landscaping
('landscaping', '100k-200k', 0.42, 1.9, 3.5, 0.75, 0.04, 40),
('landscaping', '200k-500k', 0.45, 2.1, 4.0, 0.80, 0.06, 55),
('landscaping', '500k-850k', 0.48, 2.3, 4.5, 0.90, 0.08, 40),
('landscaping', '850k-2m', 0.50, 2.5, 5.0, 0.95, 0.10, 30),
('landscaping', '2m-3.5m', 0.48, 2.6, 5.5, 1.0, 0.11, 20),
('landscaping', '3.5m-5m', 0.47, 2.7, 6.0, 1.05, 0.12, 10),

-- Creative / Marketing Agencies
('creative-agency', '100k-200k', 0.60, 2.5, 5.5, 1.0, 0.10, 45),
('creative-agency', '200k-500k', 0.62, 2.7, 6.0, 1.1, 0.12, 65),
('creative-agency', '500k-850k', 0.65, 2.9, 6.5, 1.2, 0.14, 50),
('creative-agency', '850k-2m', 0.65, 3.0, 7.0, 1.25, 0.16, 35),
('creative-agency', '2m-3.5m', 0.63, 3.1, 7.5, 1.3, 0.17, 20),
('creative-agency', '3.5m-5m', 0.62, 3.2, 8.0, 1.35, 0.18, 12)
ON CONFLICT (industry, revenue_band) DO UPDATE SET
  avg_gm_pct = EXCLUDED.avg_gm_pct,
  avg_direct_lpr = EXCLUDED.avg_direct_lpr,
  avg_mpr = EXCLUDED.avg_mpr,
  avg_manpr = EXCLUDED.avg_manpr,
  avg_pretax_profit_pct = EXCLUDED.avg_pretax_profit_pct,
  sample_size = EXCLUDED.sample_size,
  updated_at = now();
