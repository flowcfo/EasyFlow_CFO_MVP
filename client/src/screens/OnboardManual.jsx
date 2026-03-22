import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { useSnapshot } from '../hooks/useSnapshot.js';

const QUESTIONS = [
  { key: 'revenue', label: 'What was your total revenue last year?', type: 'currency', tooltip: 'Annual or trailing 12 months.' },
  { key: 'cogs', label: 'What did you spend on materials and supplies? (Not labor.)', type: 'currency', tooltip: 'Cost of goods sold. Things you bought to deliver your service or product.' },
  { key: 'total_payroll', label: 'What is your total payroll for people doing the work? Include yourself.', type: 'currency' },
  { key: 'owner_split', label: 'How much of that payroll is your own pay?', type: 'slider', min: 0, max: 100, default: 50 },
  { key: 'marketing', label: 'What did you spend on marketing and advertising?', type: 'currency' },
  { key: 'monthly_overhead', label: 'What are your monthly overhead costs? Rent, software, insurance, etc.', type: 'currency', tooltip: 'We will annualize this for you.' },
  { key: 'owner_market_wage_annual', label: 'What would you pay a full-time manager to replace yourself?', type: 'currency', placeholder: 'Most owners say $60,000 to $90,000.' },
];

export default function OnboardManual() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateInputs, calculate } = useSnapshot();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentValue, setCurrentValue] = useState('');
  const [direction, setDirection] = useState(1);

  const q = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  function handleNext() {
    const val = q.type === 'slider'
      ? (currentValue || q.default)
      : parseFloat(currentValue.replace(/[^0-9.-]/g, '')) || 0;

    setAnswers((prev) => ({ ...prev, [q.key]: val }));
    setCurrentValue('');

    if (isLast) {
      const allAnswers = { ...answers, [q.key]: val };
      finalize(allAnswers);
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
      setCurrentValue('');
    }
  }

  async function finalize(a) {
    const totalPayroll = a.total_payroll || 0;
    const ownerSplitPct = (a.owner_split || 50) / 100;
    const ownerPay = totalPayroll * ownerSplitPct;
    const employeeLabor = totalPayroll - ownerPay;
    const monthlyOverhead = a.monthly_overhead || 0;

    const inputData = {
      revenue: a.revenue || 0,
      cogs: a.cogs || 0,
      owner_direct_labor: ownerPay / 2,
      employee_direct_labor: employeeLabor,
      subcontractors: 0,
      marketing: a.marketing || 0,
      owner_management_wage: ownerPay / 2,
      rent: monthlyOverhead * 12 * 0.4,
      insurance: monthlyOverhead * 12 * 0.15,
      software_subscriptions: monthlyOverhead * 12 * 0.2,
      other_opex: monthlyOverhead * 12 * 0.25,
      owner_market_wage_annual: a.owner_market_wage_annual || 0,
      tax_rate: 0.40,
      core_capital_months: 2,
    };

    updateInputs(inputData);

    if (!user) {
      navigate('/onboard/email?next=/onboard/reveal');
    } else {
      try {
        await calculate(inputData, 'Initial Manual Entry', 'annual');
        navigate('/onboard/reveal');
      } catch {
        navigate('/onboard/reveal');
      }
    }
  }

  const formatCurrencyInput = (val) => {
    const num = parseFloat(val.replace(/[^0-9]/g, ''));
    return isNaN(num) ? '' : num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex gap-1">
          {QUESTIONS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-orange' : 'bg-white/10'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ x: direction * 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -100, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            <h2 className="font-sora text-2xl font-bold text-white mb-2">{q.label}</h2>
            {q.tooltip && <p className="font-mulish text-sm text-stone mb-6">{q.tooltip}</p>}

            {q.type === 'slider' ? (
              <div className="mt-8">
                <input
                  type="range"
                  min={q.min}
                  max={q.max}
                  value={currentValue || q.default}
                  onChange={(e) => setCurrentValue(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #F05001 0%, #F05001 ${currentValue || q.default}%, #162844 ${currentValue || q.default}%, #162844 100%)`,
                  }}
                />
                <p className="font-sora text-3xl text-orange mt-4">{currentValue || q.default}%</p>
                {answers.total_payroll > 0 && (
                  <p className="font-mulish text-sm text-stone mt-2">
                    Your pay: ${Math.round(answers.total_payroll * (currentValue || q.default) / 100).toLocaleString()} |
                    Employee pay: ${Math.round(answers.total_payroll * (1 - (currentValue || q.default) / 100)).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="relative mt-6">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone text-xl">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(formatCurrencyInput(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  placeholder={q.placeholder || '0'}
                  autoFocus
                  className="w-full bg-offwhite text-navy font-sora text-2xl rounded-xl py-4 pl-10 pr-4
                    outline-none border border-stone/30 focus:border-orange text-center"
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3 mt-8">
          {step > 0 ? (
            <button onClick={handleBack} className="btn-secondary flex-1">Back</button>
          ) : (
            <button onClick={() => navigate(-1)} className="btn-secondary flex-1">&larr; Back</button>
          )}
          <button onClick={handleNext} className="btn-primary flex-1 py-3">
            {isLast ? 'Calculate My Score' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
