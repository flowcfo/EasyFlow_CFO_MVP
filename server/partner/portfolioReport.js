import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '../db/supabase.js';
import { TIER_COLORS, PROFIT_TIER_THRESHOLDS } from '../../shared/constants.js';

export async function generatePortfolioReport(partnerId, partnerBrand) {
  const { data: clients } = await supabaseAdmin
    .from('partner_clients')
    .select('client_user_id, client_name, business_name')
    .eq('partner_id', partnerId)
    .eq('status', 'active');

  const clientData = [];
  let totalScore = 0;
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const wins = [];
  const needsAttention = [];

  for (const client of clients || []) {
    const { data: game } = await supabaseAdmin
      .from('game_progress')
      .select('profit_score, profit_tier, score_history')
      .eq('user_id', client.client_user_id)
      .single();

    if (!game) continue;

    const score = game.profit_score;
    const tier = game.profit_tier;
    totalScore += score;
    tierCounts[tier]++;

    const history = game.score_history || [];
    let monthOverMonth = 0;
    if (history.length >= 2) {
      monthOverMonth = history[history.length - 1].score - history[history.length - 2].score;
    }

    clientData.push({
      name: client.business_name || client.client_name,
      score,
      tier,
      movement: monthOverMonth,
    });

    if (monthOverMonth > 5) {
      wins.push({ name: client.business_name, improvement: monthOverMonth });
    }
    if (tier <= 2 || monthOverMonth < -5) {
      needsAttention.push({ name: client.business_name, score, tier });
    }
  }

  const avgScore = clientData.length > 0 ? Math.round(totalScore / clientData.length) : 0;

  const doc = new PDFDocument({ size: 'letter', margin: 50 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  const brandName = partnerBrand?.brand_name || 'Easy Numbers CFO';
  const primaryColor = partnerBrand?.primary_color || '#F05001';

  doc.fontSize(20).font('Helvetica-Bold')
    .text(`${brandName} Portfolio Report`, { align: 'center' });
  doc.fontSize(10).font('Helvetica')
    .text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }), { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(14).font('Helvetica-Bold').text('Portfolio Summary');
  doc.fontSize(11).font('Helvetica');
  doc.text(`Total Clients: ${clientData.length}`);
  doc.text(`Average Portfolio Score: ${avgScore}/100`);
  doc.text(`Tier Distribution: ${Object.entries(tierCounts).map(([t, c]) => {
    const label = PROFIT_TIER_THRESHOLDS.find((pt) => pt.tier === Number(t))?.label || '';
    return `${label}: ${c}`;
  }).join(', ')}`);
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Client Scores');
  doc.moveDown(0.5);
  for (const c of clientData) {
    const arrow = c.movement > 0 ? '+' : '';
    doc.fontSize(10).font('Helvetica')
      .text(`${c.name}: ${c.score}/100 (Tier ${c.tier}) ${arrow}${c.movement} pts`, { indent: 10 });
  }
  doc.moveDown();

  if (wins.length > 0) {
    doc.fontSize(14).font('Helvetica-Bold').text('Top Wins');
    for (const w of wins.slice(0, 3)) {
      doc.fontSize(10).font('Helvetica')
        .text(`${w.name}: +${w.improvement} points`, { indent: 10 });
    }
    doc.moveDown();
  }

  if (needsAttention.length > 0) {
    doc.fontSize(14).font('Helvetica-Bold').text('Needs Attention');
    for (const n of needsAttention.slice(0, 3)) {
      doc.fontSize(10).font('Helvetica')
        .text(`${n.name}: Score ${n.score}, Tier ${n.tier}`, { indent: 10 });
    }
    doc.moveDown();
  }

  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica')
    .text(`Powered by Easy Numbers Profit System. ${brandName}.`, { align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}
