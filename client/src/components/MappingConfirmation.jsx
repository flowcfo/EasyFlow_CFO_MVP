import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FIELD_LABELS = {
  revenue: 'Revenue',
  cogs: 'COGS (Materials)',
  employee_direct_labor: 'Employee Direct Labor',
  subcontractors: 'Subcontractors',
  marketing: 'Marketing',
  owner_pay_detected: 'Owner Pay',
  owner_management_wage: 'Owner Management',
  rent: 'Rent / Facilities',
  insurance: 'Insurance',
  software_subscriptions: 'Software',
  other_opex: 'Other Overhead',
  skip: 'Skip this account',
};

function fmt(n) { return '$' + Math.round(Math.abs(n)).toLocaleString(); }
function pct(val, total) { return total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '--'; }

function ConfidencePill({ confidence }) {
  if (confidence >= 0.85) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">High</span>;
  if (confidence >= 0.60) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700">Review</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">Decide</span>;
}

function WaterfallPreview({ preview, unconfirmedFields }) {
  const rev = preview.revenue || 0;
  const cogs = preview.cogs || 0;
  const gm = rev - cogs;
  const dl = (preview.employee_direct_labor || 0) + (preview.subcontractors || 0) + (preview.owner_pay_detected ? preview.owner_pay_detected / 2 : 0);
  const mktg = preview.marketing || 0;
  const cm = gm - dl - mktg;
  const mgmt = (preview.owner_management_wage || 0) + (preview.owner_pay_detected ? preview.owner_pay_detected / 2 : 0);
  const overhead = (preview.rent || 0) + (preview.insurance || 0) + (preview.software_subscriptions || 0) + (preview.other_opex || 0);
  const pretax = cm - mgmt - overhead;

  const rows = [
    { label: 'Revenue', value: rev, color: 'text-[#0E1B2E]', fields: ['revenue'] },
    { label: '- COGS', value: cogs, color: 'text-[#8A8278]', fields: ['cogs'] },
    { label: '= Gross Margin', value: gm, color: gm >= 0 ? 'text-green-600' : 'text-red-500', bold: true, fields: [] },
    { label: '- Direct Labor', value: dl, color: 'text-[#8A8278]', fields: ['employee_direct_labor', 'subcontractors'] },
    { label: '- Marketing', value: mktg, color: 'text-[#8A8278]', fields: ['marketing'] },
    { label: '= Contribution Margin', value: cm, color: cm >= 0 ? 'text-green-600' : 'text-red-500', bold: true, fields: [] },
    { label: '- Management + Overhead', value: mgmt + overhead, color: 'text-[#8A8278]', fields: ['rent', 'insurance', 'software_subscriptions', 'other_opex'] },
    { label: '= Pre-Tax Profit', value: pretax, color: pretax >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold', bold: true, fields: [] },
  ];

  return (
    <div className="bg-[#F5F3F0] rounded-xl p-4 border border-[#8A8278]/20">
      <h3 className="font-sora text-sm font-bold text-[#0E1B2E] mb-3">Live P&L Preview</h3>
      <div className="space-y-1">
        {rows.map((r, i) => {
          const hasUnconfirmed = r.fields.some((f) => unconfirmedFields.has(f));
          return (
            <div key={i} className={`flex justify-between py-1 ${r.bold ? 'border-t border-[#8A8278]/20 pt-2 mt-1' : ''}`}>
              <div className="flex items-center gap-1.5">
                <span className={`font-mulish text-sm ${r.bold ? 'font-bold text-[#0E1B2E]' : 'text-[#8A8278]'}`}>{r.label}</span>
                {hasUnconfirmed && <span className="text-yellow-500 text-xs" title="Some accounts contributing here are unconfirmed">&#9888;</span>}
              </div>
              <div className="flex gap-3">
                <span className={`font-mono text-sm ${hasUnconfirmed ? 'text-[#8A8278]/50' : r.color}`}>{fmt(r.value)}</span>
                <span className="font-mono text-xs text-[#8A8278]/50 w-12 text-right">{pct(Math.abs(r.value), rev)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountRow({ item, onChangeField }) {
  const isYellow = item.confidence >= 0.60 && item.confidence < 0.85;
  const isRed = item.confidence < 0.60;
  const bg = isRed ? 'bg-red-50/60' : isYellow ? 'bg-yellow-50/60' : '';

  return (
    <div className={`${bg} rounded-lg p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-mulish text-sm font-bold text-[#0E1B2E] truncate">{item.name}</p>
          {isYellow && <p className="font-mulish text-xs text-[#8A8278] mt-0.5">We think this is {FIELD_LABELS[item.field] || item.field}. Confirm or change.</p>}
          {isRed && <p className="font-mulish text-xs text-red-500 mt-0.5">We could not classify this. Please assign it.</p>}
        </div>
        <div className="flex items-center gap-3 ml-3 shrink-0">
          <ConfidencePill confidence={item.confidence} />
          <span className="font-mono text-sm text-[#0E1B2E] font-bold">{fmt(item.amount)}</span>
        </div>
      </div>
      <select
        value={item.confirmed_field || item.field}
        onChange={(e) => onChangeField(item.name, e.target.value)}
        className="w-full text-sm border border-[#8A8278]/20 rounded-lg px-3 py-2 bg-white text-[#0E1B2E] font-mulish focus:outline-none focus:ring-2 focus:ring-[#F05001]/30"
      >
        {Object.entries(FIELD_LABELS).map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>
    </div>
  );
}

export default function MappingConfirmation({ confirmation, onConfirm, onBack }) {
  const [reviewItems, setReviewItems] = useState(() =>
    [...(confirmation.needs_review || []), ...(confirmation.requires_decision || [])].map((item) => ({
      ...item,
      confirmed_field: item.field || item.suggested_field,
    }))
  );

  const [autoItems, setAutoItems] = useState(() =>
    (confirmation.auto_confirmed || []).map((item) => ({
      ...item,
      confirmed_field: item.field,
    }))
  );

  const [showAuto, setShowAuto] = useState(false);
  const [error, setError] = useState('');

  const handleReviewChange = useCallback((name, field) => {
    setReviewItems((prev) =>
      prev.map((item) => item.name === name ? { ...item, confirmed_field: field } : item)
    );
  }, []);

  const handleAutoChange = useCallback((name, field) => {
    setAutoItems((prev) =>
      prev.map((item) => item.name === name ? { ...item, confirmed_field: field } : item)
    );
  }, []);

  const allConfirmed = useMemo(() => [...autoItems, ...reviewItems], [autoItems, reviewItems]);

  const preview = useMemo(() => {
    const p = { revenue: 0, cogs: 0, employee_direct_labor: 0, subcontractors: 0, marketing: 0, owner_pay_detected: 0, owner_management_wage: 0, rent: 0, insurance: 0, software_subscriptions: 0, other_opex: 0 };
    for (const item of allConfirmed) {
      const field = item.confirmed_field || item.field;
      if (field === 'skip') continue;
      if (field === 'revenue') {
        p.revenue += item.amount || 0;
      } else if (p.hasOwnProperty(field)) {
        p[field] += Math.abs(item.amount || 0);
      }
    }
    if (confirmation.owner_pay?.detected) {
      p.owner_pay_detected = confirmation.owner_pay.detected;
    }
    return p;
  }, [allConfirmed, confirmation.owner_pay]);

  const unconfirmedFields = useMemo(() => {
    const fields = new Set();
    for (const item of reviewItems) {
      if (!item.confirmed_field || item.confirmed_field === item.field) {
        if (item.confidence < 0.60) fields.add(item.confirmed_field || item.field);
      }
    }
    return fields;
  }, [reviewItems]);

  const hardBlocks = useMemo(
    () => reviewItems.filter((item) => item.tier === 'hard_block' && (!item.confirmed_field || item.confirmed_field === item.field)),
    [reviewItems]
  );

  const hasHardBlocks = hardBlocks.length > 0 && hardBlocks.some((h) => h.confidence < 0.60 && !h.confirmed_field);

  function handleConfirm() {
    setError('');

    const finalInputs = {
      revenue: 0, cogs: 0, employee_direct_labor: 0, subcontractors: 0,
      marketing: 0, rent: 0, insurance: 0, software_subscriptions: 0,
      other_opex: 0, owner_pay_detected: confirmation.owner_pay?.detected || 0,
      owner_pay_source: confirmation.owner_pay?.source || 'not_found',
      owner_direct_labor: 0, owner_management_wage: 0,
      owner_market_wage_annual: 0, tax_rate: 0.40, core_capital_months: 2,
    };

    for (const item of allConfirmed) {
      const field = item.confirmed_field || item.field;
      if (field === 'skip' || field === 'revenue_flagged') continue;
      if (field === 'revenue') {
        finalInputs.revenue += item.amount || 0;
      } else if (field === 'owner_pay_detected') {
        // Tracked separately
      } else if (finalInputs.hasOwnProperty(field)) {
        finalInputs[field] += Math.abs(item.amount || 0);
      }
    }

    // Rule 7: sanitize
    for (const key of Object.keys(finalInputs)) {
      if (typeof finalInputs[key] === 'number' && (isNaN(finalInputs[key]) || finalInputs[key] == null)) {
        finalInputs[key] = 0;
      }
    }

    // Rule 6: cascade check
    const grossMargin = finalInputs.revenue - finalInputs.cogs;
    if (finalInputs.revenue > 0 && grossMargin < 0) {
      setError('Your COGS exceeds revenue. Review the accounts assigned to Revenue and COGS.');
      return;
    }

    onConfirm(finalInputs);
  }

  const autoCount = confirmation.auto_confirmed?.length || 0;
  const reviewCount = confirmation.needs_review?.length || 0;
  const decisionCount = confirmation.requires_decision?.length || 0;

  return (
    <div className="min-h-screen bg-[#0E1B2E]">
      {/* Status Bar */}
      <div className="bg-[#0E1B2E] px-6 py-5 border-b border-[#8A8278]/20">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-sora text-xl font-bold text-white">Confirm Your Mappings</h1>
            <button onClick={onBack} className="font-mulish text-sm text-[#8A8278] hover:text-white transition">&larr; Back</button>
          </div>
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="font-mulish text-sm text-white">{autoCount} Auto-confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span className="font-mulish text-sm text-white">{reviewCount} To review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="font-mulish text-sm text-white">{decisionCount} Needs decision</span>
            </div>
          </div>
          {confirmation.coverage?.show_warning && (
            <div className="mt-3 bg-yellow-900/30 border border-yellow-500/40 rounded-lg px-4 py-2">
              <p className="font-mulish text-sm text-yellow-200">
                Warning: {((1 - confirmation.coverage.coverage_pct) * 100).toFixed(1)}% of your QuickBooks data was not mapped.
                Your score may be understated until you assign the items below.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Items requiring action */}
        <div className="lg:col-span-3 space-y-3">
          {reviewItems.length > 0 && (
            <>
              <h2 className="font-sora text-base font-bold text-white mb-2">Items Requiring Your Review</h2>
              <div className="space-y-2">
                {reviewItems.map((item) => (
                  <AccountRow key={item.name} item={item} onChangeField={handleReviewChange} />
                ))}
              </div>
            </>
          )}

          {reviewItems.length === 0 && (
            <div className="bg-[#F5F3F0] rounded-xl p-6 text-center">
              <p className="font-sora text-lg font-bold text-[#0E1B2E] mb-1">All accounts mapped automatically</p>
              <p className="font-mulish text-sm text-[#8A8278]">
                Every account from QuickBooks was matched with high confidence.
                Review the preview on the right, then confirm.
              </p>
            </div>
          )}

          {/* Flagged items */}
          {confirmation.flagged?.length > 0 && (
            <div className="mt-4">
              <h3 className="font-sora text-sm font-bold text-yellow-400 mb-2">Flagged Accounts</h3>
              {confirmation.flagged.map((f, i) => (
                <div key={i} className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-4 py-2 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mulish text-sm text-yellow-200">{f.name}</span>
                    <span className="font-mono text-sm text-yellow-200">{fmt(f.amount)}</span>
                  </div>
                  <p className="font-mulish text-xs text-yellow-400/70 mt-1">
                    {f.reason === 'negative_income' && 'Negative income. May be a refund or correction. Not included in revenue.'}
                    {f.reason === 'possible_passthrough' && 'This looks like a pass-through or reimbursement. Not included in revenue.'}
                    {f.reason === 'owner_pay_duplicate' && 'Owner pay was found in both COGS and Expenses. Using the Expenses amount only.'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Auto-confirmed collapsible */}
          <div className="mt-4">
            <button
              onClick={() => setShowAuto(!showAuto)}
              className="font-mulish text-sm text-[#8A8278] hover:text-white transition flex items-center gap-1"
            >
              <span className={`transition-transform ${showAuto ? 'rotate-90' : ''}`}>&#9654;</span>
              Auto-confirmed accounts ({autoCount})
            </button>
            <AnimatePresence>
              {showAuto && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1">
                    {autoItems.map((item) => (
                      <div key={item.name} className="bg-[#F5F3F0]/90 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="font-mulish text-sm text-[#0E1B2E] truncate block">{item.name}</span>
                        </div>
                        <select
                          value={item.confirmed_field || item.field}
                          onChange={(e) => handleAutoChange(item.name, e.target.value)}
                          className="text-xs border border-[#8A8278]/20 rounded px-2 py-1 bg-white text-[#0E1B2E] font-mulish shrink-0"
                        >
                          {Object.entries(FIELD_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                        <span className="font-mono text-xs text-[#8A8278] shrink-0 w-20 text-right">{fmt(item.amount)}</span>
                        <ConfidencePill confidence={item.confidence} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right sidebar: P&L preview + confirm */}
        <div className="lg:col-span-2 space-y-4">
          <WaterfallPreview preview={preview} unconfirmedFields={unconfirmedFields} />

          {error && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-2">
              <p className="font-mulish text-sm text-red-300">{error}</p>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={hasHardBlocks}
            className={`w-full py-3.5 rounded-xl font-sora font-bold text-white text-base transition-all
              ${hasHardBlocks
                ? 'bg-[#8A8278]/40 cursor-not-allowed'
                : 'bg-[#F05001] hover:bg-[#D04400] active:scale-[0.98]'
              }`}
          >
            {hasHardBlocks ? 'Assign all required fields to continue' : 'Confirm and Calculate'}
          </button>
        </div>
      </div>
    </div>
  );
}
