import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SPLIT_DEFAULTS = {
  solo_service: 0.70,
  small_team: 0.50,
  larger_team: 0.30,
  retail_product: 0.40,
  unknown: 0.50,
};

function getDefaultSplit(businessType) {
  return SPLIT_DEFAULTS[businessType] ?? SPLIT_DEFAULTS.unknown;
}

function calculateSplit(totalOwnerPay, directLaborPct) {
  const clamped = Math.max(0, Math.min(1, directLaborPct));
  const directLabor = Math.floor(totalOwnerPay * clamped);
  const managementWage = totalOwnerPay - directLabor;
  return { owner_direct_labor: directLabor, owner_management_wage: managementWage };
}

function fmt(n) {
  return '$' + Math.round(n).toLocaleString();
}

function ratio(numerator, denominator) {
  if (!denominator || denominator === 0) return '-.--';
  return (numerator / denominator).toFixed(2);
}

export default function OwnerPaySlider({
  totalOwnerPay = 0,
  businessType = 'unknown',
  onConfirm,
  currentDirectLpr = 0,
  currentManPr = 0,
  currentGrossMargin = 0,
  currentDirectLabor = 0,
  currentContributionMargin = 0,
  currentOpEx = 0,
  previousOwnerDirectLabor = 0,
  previousOwnerManagementWage = 0,
  fromQBO = false,
}) {
  const defaultPct = getDefaultSplit(businessType);
  const [totalPay, setTotalPay] = useState(totalOwnerPay);
  const [editingTotal, setEditingTotal] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');
  const [directLaborPct, setDirectLaborPct] = useState(defaultPct);
  const [marketRate, setMarketRate] = useState('');
  const [error, setError] = useState('');

  const split = useMemo(
    () => calculateSplit(totalPay, directLaborPct),
    [totalPay, directLaborPct],
  );

  const pctDisplay = Math.round(directLaborPct * 100);

  const newDirectLpr = useMemo(() => {
    const denom =
      currentDirectLabor - previousOwnerDirectLabor + split.owner_direct_labor;
    if (!currentGrossMargin || !denom || denom <= 0) return null;
    return currentGrossMargin / denom;
  }, [currentGrossMargin, currentDirectLabor, previousOwnerDirectLabor, split.owner_direct_labor]);

  const newManPr = useMemo(() => {
    const denom =
      currentOpEx - previousOwnerManagementWage + split.owner_management_wage;
    if (!currentContributionMargin || !denom || denom <= 0) return null;
    return currentContributionMargin / denom;
  }, [currentContributionMargin, currentOpEx, previousOwnerManagementWage, split.owner_management_wage]);

  const guidance = useMemo(() => {
    if (pctDisplay > 70) {
      return 'Most owners in your revenue range split closer to 50/50. High direct labor is common for solo operators.';
    }
    if (pctDisplay < 30) {
      return 'This means most of your value is in managing the business. Typical for owners with established teams.';
    }
    return 'Balanced split. Common for owners with a small team.';
  }, [pctDisplay]);

  const handleSlider = useCallback((e) => {
    const raw = Number(e.target.value);
    setDirectLaborPct(raw / 100);
  }, []);

  function startEditTotal() {
    setEditingTotal(true);
    setEditBuffer(totalPay > 0 ? totalPay.toString() : '');
  }

  function saveEditTotal() {
    const cleaned = editBuffer.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num >= 0) setTotalPay(num);
    setEditingTotal(false);
  }

  function handleConfirm() {
    setError('');

    const effectivePay = totalPay > 0 ? totalPay : parseInt((marketRate || '0').replace(/[^0-9]/g, ''), 10);
    if (!effectivePay || effectivePay <= 0) {
      setError('Enter your total owner pay or market rate before confirming.');
      return;
    }

    const final = calculateSplit(effectivePay, directLaborPct);
    if (final.owner_direct_labor + final.owner_management_wage !== effectivePay) {
      setError('Split does not sum correctly. Adjust and try again.');
      return;
    }

    onConfirm?.(final.owner_direct_labor, final.owner_management_wage, directLaborPct);
  }

  return (
    <div className="min-h-screen bg-[#0E1B2E] flex items-center justify-center px-4 py-8">
      <motion.div
        className="w-full max-w-xl"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <h1 className="font-sora text-2xl font-bold text-white text-center mb-2">
          How do you split your time?
        </h1>
        <p className="font-mulish text-sm text-[#8A8278] text-center mb-8">
          Drag the slider to show how much of your work is billable vs. management.
        </p>

        {/* Total Pay */}
        <div className="bg-[#F5F3F0] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mulish text-sm text-[#8A8278]">Total Owner Pay (Annual)</span>
            {fromQBO && !editingTotal && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mulish">
                From QuickBooks
              </span>
            )}
          </div>

          {editingTotal ? (
            <div className="flex items-center gap-2">
              <span className="font-sora text-lg text-[#0E1B2E]">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={editBuffer}
                onChange={(e) => setEditBuffer(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && saveEditTotal()}
                autoFocus
                className="flex-1 bg-white border border-[#8A8278]/30 rounded-lg px-3 py-2 font-sora text-lg text-[#0E1B2E] outline-none focus:border-[#F05001]"
              />
              <button
                onClick={saveEditTotal}
                className="px-3 py-2 bg-[#F05001] text-white rounded-lg font-mulish text-sm"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-sora text-2xl font-bold text-[#0E1B2E]">
                {fmt(totalPay)}
              </span>
              <button
                onClick={startEditTotal}
                className="text-xs text-[#F05001] font-mulish underline underline-offset-2 hover:text-[#D04400]"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Zero pay warning */}
        {totalPay === 0 && (
          <div className="bg-[#F5F3F0] rounded-xl p-5 mb-6 border border-[#F05001]/30">
            <p className="font-mulish text-sm text-[#0E1B2E] mb-3">
              You entered $0 for owner pay. Enter your market rate below. This is for your
              financial model only. It calculates your Owner Pay Gap and true breakeven.
              It does not affect your books.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8278] font-mulish">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={marketRate}
                onChange={(e) => setMarketRate(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 75000"
                className="w-full bg-white border border-[#8A8278]/30 rounded-lg pl-7 pr-3 py-2.5 font-mulish text-[#0E1B2E] outline-none focus:border-[#F05001]"
              />
            </div>
          </div>
        )}

        {/* Visual Split Bar */}
        <div className="mb-2">
          <div className="flex rounded-lg overflow-hidden h-10">
            <motion.div
              className="bg-[#F05001] flex items-center justify-center"
              animate={{ width: `${pctDisplay}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {pctDisplay >= 15 && (
                <span className="font-sora text-xs font-bold text-white">
                  {pctDisplay}% Doing the Work
                </span>
              )}
            </motion.div>
            <motion.div
              className="bg-[#0E1B2E] flex items-center justify-center border border-[#8A8278]/20"
              animate={{ width: `${100 - pctDisplay}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {100 - pctDisplay >= 15 && (
                <span className="font-sora text-xs font-bold text-white">
                  {100 - pctDisplay}% Running the Business
                </span>
              )}
            </motion.div>
          </div>
        </div>

        {/* Slider */}
        <div className="mb-6 px-1">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pctDisplay}
            onChange={handleSlider}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #F05001 0%, #F05001 ${pctDisplay}%, #374151 ${pctDisplay}%, #374151 100%)`,
            }}
          />
          <div className="flex justify-between font-mulish text-xs text-[#8A8278] mt-1">
            <span>0% direct labor</span>
            <span>100% direct labor</span>
          </div>
        </div>

        {/* Two Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Direct Labor card */}
          <div className="bg-[#F5F3F0] rounded-xl p-4 border-2 border-[#F05001]/40">
            <p className="font-mulish text-xs text-[#8A8278] mb-1">Owner Direct Labor</p>
            <p className="font-mulish text-[10px] text-[#8A8278]/70 mb-2">Row 23</p>
            <p className="font-sora text-xl font-bold text-[#0E1B2E] mb-2">
              {fmt(split.owner_direct_labor)}
            </p>
            {newDirectLpr !== null && (
              <p className="font-mulish text-xs text-[#8A8278]">
                Your Direct LPR with this split:{' '}
                <span className="font-sora font-bold text-[#F05001]">
                  {ratio(currentGrossMargin, currentDirectLabor - previousOwnerDirectLabor + split.owner_direct_labor)}x
                </span>
              </p>
            )}
          </div>

          {/* Management Wage card */}
          <div className="bg-[#F5F3F0] rounded-xl p-4 border-2 border-[#0E1B2E]/30">
            <p className="font-mulish text-xs text-[#8A8278] mb-1">Owner Management Wage</p>
            <p className="font-mulish text-[10px] text-[#8A8278]/70 mb-2">Row 42</p>
            <p className="font-sora text-xl font-bold text-[#0E1B2E] mb-2">
              {fmt(split.owner_management_wage)}
            </p>
            {newManPr !== null && (
              <p className="font-mulish text-xs text-[#8A8278]">
                Your ManPR with this split:{' '}
                <span className="font-sora font-bold text-[#0E1B2E]">
                  {ratio(currentContributionMargin, currentOpEx - previousOwnerManagementWage + split.owner_management_wage)}x
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Guidance */}
        <AnimatePresence mode="wait">
          <motion.p
            key={guidance}
            className="font-mulish text-sm text-[#8A8278] text-center mb-8 px-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {guidance}
          </motion.p>
        </AnimatePresence>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm text-center font-mulish mb-4">{error}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-xl font-sora font-bold text-white text-base
                     bg-[#F05001] hover:bg-[#D04400] active:scale-[0.98] transition-all"
        >
          Confirm My Split
        </button>
      </motion.div>
    </div>
  );
}
