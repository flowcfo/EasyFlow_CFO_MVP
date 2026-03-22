import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { useQBO } from '../hooks/useQBO.js';
import { api } from '../utils/api.js';
import InputField from '../components/InputField.jsx';

const LOADING_STEPS = [
  'Reading your revenue.',
  'Checking your margins.',
  'Finding your labor costs.',
  'Scanning for leaks.',
  'Building your score.',
];

export default function OnboardQBO() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { inputs, setQBOInputs, updateInputs, calculate } = useSnapshot();
  const { connect, pull } = useQBO();
  const [step, setStep] = useState(searchParams.get('connected') ? 'loading' : 'start');
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step === 'loading') {
      runLoadingSequence();
    }
  }, [step]);

  async function runLoadingSequence() {
    for (let i = 0; i < LOADING_STEPS.length; i++) {
      setLoadingStep(i);
      await new Promise((r) => setTimeout(r, 2500));
    }

    try {
      const data = await pull();
      setQBOInputs(data.inputs, data.sources);
      setStep('confirm');
    } catch (err) {
      setError('Could not read your QuickBooks data. Please try again.');
      setStep('start');
    }
  }

  async function handleConnect() {
    if (!user) {
      navigate('/onboard/email?next=/onboard/qbo');
      return;
    }
    try {
      const url = await connect();
      window.location.href = url;
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDemoConnect() {
    setError('');
    setStep('loading');
    try {
      await api.post('/integrations/demo/connect');
      const data = await api.post('/integrations/demo/pull');
      setQBOInputs(data.inputs, data.sources);
      for (let i = 0; i < LOADING_STEPS.length; i++) {
        setLoadingStep(i);
        await new Promise((r) => setTimeout(r, 1500));
      }
      setStep('confirm');
    } catch (err) {
      setError(`Demo failed: ${err.message}`);
      setStep('start');
    }
  }

  async function handleCalculate() {
    try {
      await calculate(inputs, 'Initial QBO Import', 'ttm');
      navigate('/onboard/reveal');
    } catch (err) {
      setError(err.message);
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="space-y-4">
            {LOADING_STEPS.map((text, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={i <= loadingStep ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <span className={`text-lg ${i < loadingStep ? 'text-status-green' : i === loadingStep ? 'text-orange animate-pulse' : 'text-stone/30'}`}>
                  {i < loadingStep ? '✓' : i === loadingStep ? '○' : '○'}
                </span>
                <span className={`font-mulish ${i <= loadingStep ? 'text-white' : 'text-stone/30'}`}>
                  {text}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="card-light">
            <h2 className="font-sora text-xl font-bold text-navy mb-2">Almost there. Three quick questions.</h2>
            <p className="font-mulish text-sm text-stone mb-6">
              Your QuickBooks data is loaded. Confirm these three fields and we will calculate your score.
            </p>

            <div className="space-y-4">
              <InputField
                label="How much of your payroll is your own direct work?"
                name="owner_direct_labor"
                value={inputs.owner_direct_labor}
                onChange={(name, val) => updateInputs({ [name]: val })}
                tooltip="Split your total owner pay 50/50 between direct labor and management wage. This is the direct labor half."
              />
              <InputField
                label="What would you pay a manager to replace yourself? Annual salary."
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

            {error && <p className="text-status-red text-sm mt-3">{error}</p>}

            <button onClick={handleCalculate} className="btn-primary w-full mt-6 py-3">
              Calculate My Score
            </button>
            <button onClick={() => navigate(-1)} className="btn-ghost w-full mt-2 text-sm text-stone/60 hover:text-navy">
              &larr; Back
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="font-sora text-2xl font-bold text-white mb-4">
          Connect your QuickBooks. Get your Profit Score in 60 seconds.
        </h2>
        <p className="font-mulish text-stone mb-8">
          We will read your P&L report. Read-only access. Your data stays private.
        </p>

        {error && <p className="text-status-red text-sm mb-4">{error}</p>}

        <button onClick={handleConnect} className="btn-primary w-full py-4 text-lg mb-3">
          Connect QuickBooks
        </button>

        <button onClick={handleDemoConnect} className="btn-secondary w-full py-3 mb-3">
          No QuickBooks? Try with demo data.
        </button>

        <button onClick={() => navigate('/onboard/upload')} className="btn-ghost text-sm mb-2">
          Upload Excel/CSV instead
        </button>

        <button onClick={() => navigate(-1)} className="btn-ghost text-sm text-stone/60 hover:text-white">
          &larr; Back
        </button>
      </motion.div>
    </div>
  );
}
