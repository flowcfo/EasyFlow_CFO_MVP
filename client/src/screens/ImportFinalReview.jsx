import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { useSnapshot } from '../hooks/useSnapshot.js';
import OwnerPaySlider from '../components/OwnerPaySlider.jsx';
import InputField from '../components/InputField.jsx';

export default function ImportFinalReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { inputs, updateInputs, setQBOInputs, calculate } = useSnapshot();
  const [error, setError] = useState('');
  const [splitConfirmed, setSplitConfirmed] = useState(false);

  const fileName = location.state?.fileName || 'Import';
  const passedInputs = location.state?.inputs;
  const passedSources = location.state?.sources;

  useEffect(() => {
    if (passedInputs) {
      setQBOInputs(passedInputs, passedSources || {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ownerPayTotal =
    (passedInputs?.owner_pay_detected ?? inputs.owner_pay_detected) ||
    (inputs.owner_direct_labor || 0) + (inputs.owner_management_wage || 0) ||
    0;

  const grossMargin = (inputs.revenue || 0) - (inputs.cogs || 0);
  const directLabor = (inputs.employee_direct_labor || 0) + (inputs.subcontractors || 0) + (inputs.owner_direct_labor || 0);
  const contributionMargin = grossMargin - directLabor;
  const opEx = (inputs.owner_management_wage || 0) + (inputs.rent || 0) + (inputs.insurance || 0)
    + (inputs.software_subscriptions || 0) + (inputs.other_opex || 0);

  function handleSplitConfirm(ownerDirectLabor, ownerManagementWage, pct) {
    updateInputs({
      owner_direct_labor: ownerDirectLabor,
      owner_management_wage: ownerManagementWage,
    });
    setSplitConfirmed(true);
  }

  async function handleCalculate() {
    if (!user) {
      navigate('/onboard/email?next=/onboard/reveal');
      return;
    }
    try {
      await calculate(inputs, `Import: ${fileName}`, 'annual');
      navigate('/onboard/reveal');
    } catch {
      navigate('/onboard/reveal');
    }
  }

  if (!splitConfirmed && ownerPayTotal > 0) {
    return (
      <OwnerPaySlider
        totalOwnerPay={ownerPayTotal}
        businessType={passedInputs?.business_type || 'unknown'}
        onConfirm={handleSplitConfirm}
        currentGrossMargin={grossMargin}
        currentDirectLabor={directLabor}
        currentContributionMargin={contributionMargin}
        currentOpEx={opEx}
        previousOwnerDirectLabor={inputs.owner_direct_labor || 0}
        previousOwnerManagementWage={inputs.owner_management_wage || 0}
        fromQBO={!!passedSources?.owner_direct_labor || (passedInputs?.owner_pay_source && passedInputs.owner_pay_source !== 'not_found')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0E1B2E] flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="bg-[#F5F3F0] rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-green-500 text-lg">&#10003;</span>
            <h2 className="font-sora text-xl font-bold text-[#0E1B2E]">Data Mapped Successfully</h2>
          </div>
          <p className="font-mulish text-sm text-[#8A8278] mb-4">
            From: <span className="text-[#0E1B2E] font-semibold">{fileName}</span>
          </p>

          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-[#8A8278]/10 rounded-lg">
              <div>
                <p className="font-mulish text-xs text-[#8A8278]">Revenue</p>
                <p className="font-sora text-lg text-[#0E1B2E] font-bold">${(inputs.revenue || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="font-mulish text-xs text-[#8A8278]">COGS</p>
                <p className="font-sora text-lg text-[#0E1B2E] font-bold">${(inputs.cogs || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="font-mulish text-xs text-[#8A8278]">Employee Labor</p>
                <p className="font-sora text-lg text-[#0E1B2E] font-bold">${(inputs.employee_direct_labor || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="font-mulish text-xs text-[#8A8278]">Marketing</p>
                <p className="font-sora text-lg text-[#0E1B2E] font-bold">${(inputs.marketing || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Owner pay summary after split confirmed */}
            {splitConfirmed && (
              <div className="p-3 bg-[#F05001]/5 border border-[#F05001]/20 rounded-lg">
                <p className="font-sora text-sm font-semibold text-[#0E1B2E] mb-2">Owner Pay Split</p>
                <div className="flex justify-between text-sm font-mulish">
                  <span className="text-[#8A8278]">
                    Direct Labor: <strong className="text-[#0E1B2E]">${(inputs.owner_direct_labor || 0).toLocaleString()}</strong>
                  </span>
                  <span className="text-[#8A8278]">
                    Management: <strong className="text-[#0E1B2E]">${(inputs.owner_management_wage || 0).toLocaleString()}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setSplitConfirmed(false)}
                  className="text-xs text-[#F05001] font-mulish underline mt-2"
                >
                  Adjust split
                </button>
              </div>
            )}

            {ownerPayTotal === 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-300/40 rounded-lg">
                <p className="font-mulish text-sm text-[#0E1B2E] mb-1">
                  No owner pay was found in QuickBooks.
                </p>
                <p className="font-mulish text-xs text-[#8A8278]">
                  Enter your market rate below. This calculates your Owner Pay Gap. It does not change your books.
                </p>
              </div>
            )}

            <InputField
              label="What would you pay a manager to replace yourself? (Annual)"
              name="owner_market_wage_annual"
              value={inputs.owner_market_wage_annual}
              onChange={(name, val) => updateInputs({ [name]: val })}
              tooltip="Most owners say $60,000 to $90,000."
            />
            <InputField
              label="Your estimated tax rate"
              name="tax_rate"
              value={inputs.tax_rate || 0.40}
              onChange={(name, val) => updateInputs({ [name]: val })}
              type="percent"
              placeholder="40"
              tooltip="Default is 40%. Adjust if needed."
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <button
            onClick={handleCalculate}
            className="w-full py-3.5 rounded-xl font-sora font-bold text-white text-base bg-[#F05001] hover:bg-[#D04400] active:scale-[0.98] transition-all"
          >
            Calculate My Profit Score
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full mt-2 py-2 text-sm text-[#8A8278] hover:text-[#0E1B2E] font-mulish transition"
          >
            &larr; Back to mapping
          </button>
        </div>
      </motion.div>
    </div>
  );
}
