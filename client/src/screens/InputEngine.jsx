import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { useCalc } from '../hooks/useCalc.js';
import { api } from '../utils/api.js';
import InputField from '../components/InputField.jsx';
import Tooltip from '../components/Tooltip.jsx';
import { INPUT_SECTIONS, INPUT_SHAPE, getDefaultInputs, INPUT_FIELDS } from '../../../shared/schema.js';

function sanitizeImportedInputs(raw) {
  const base = getDefaultInputs();
  if (!raw || typeof raw !== 'object') return base;
  for (const k of INPUT_FIELDS) {
    if (raw[k] == null || raw[k] === '') continue;
    const n = Number(raw[k]);
    if (Number.isFinite(n)) base[k] = n;
  }
  return base;
}
import { formatCurrency, formatPercent } from '../utils/format.js';

export default function InputEngine() {
  const navigate = useNavigate();
  const { inputs, updateInputs, setQBOInputs, fieldSources, calculate, loading } = useSnapshot();
  const { debouncedCalc } = useCalc();
  const [liveOutputs, setLiveOutputs] = useState(null);
  const [errors, setErrors] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [importing, setImporting] = useState(false);

  function handleChange(name, value) {
    updateInputs({ [name]: value });
    debouncedCalc({ ...inputs, [name]: value }, (data) => {
      setLiveOutputs(data.outputs);
    });
  }

  async function handleSubmit() {
    setErrors({});
    try {
      await calculate(inputs, null, 'annual');
      navigate('/app/dashboard');
    } catch (err) {
      if (err.details) setErrors(err.details);
    }
  }

  async function handleExcelUpload(file) {
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const buffer = await file.arrayBuffer();
      const data = await api.upload('/integrations/excel/upload', buffer, file.name);

      if (data.inputs) {
        setQBOInputs(
          sanitizeImportedInputs(data.inputs),
          data.sources || {},
          data.monthlyHistory || null,
        );
        const allRange = data.metadata?.all_months_range || '';
        const periodNote = data.metadata?.monthly_mode
          ? ` (TTM: ${data.metadata.month_range || ''}, ${data.metadata.all_months_count || 0} total months imported${allRange ? ` from ${allRange}` : ''})`
          : '';
        setImportStatus({
          type: 'success',
          message: `Imported from "${file.name}" — ${data.metadata?.matched_lines || 0} line items matched${periodNote}. Review below and adjust as needed.`,
        });
      } else if (data.confirmation) {
        const confirmed = [
          ...(data.confirmation.auto_confirmed || []),
          ...(data.confirmation.needs_review || []),
          ...(data.confirmation.requires_decision || []),
        ];
        const built = {};
        for (const acct of confirmed) {
          const field = acct.field || acct.suggested_field;
          if (!field || field === 'skip' || field === 'revenue_flagged') continue;
          if (field === 'revenue') {
            built.revenue = (built.revenue || 0) + (acct.amount || 0);
          } else {
            built[field] = (built[field] || 0) + Math.abs(acct.amount || 0);
          }
        }
        const sources = {};
        for (const key of Object.keys(built)) sources[key] = 'excel';
        setQBOInputs(sanitizeImportedInputs(built), sources, data.monthlyHistory || null);
        const total = confirmed.length;
        setImportStatus({
          type: 'success',
          message: `Imported from "${file.name}" — ${total} accounts mapped. Review below and adjust as needed.`,
        });
      } else {
        setImportStatus({
          type: 'error',
          message: `Could not extract data from "${file.name}". Check that it is a Profit & Loss report.`,
        });
      }
    } catch (err) {
      setImportStatus({ type: 'error', message: `Upload failed: ${err.message}` });
    } finally {
      setImporting(false);
    }
  }

  async function handleDemoImport() {
    setImporting(true);
    setImportStatus(null);
    try {
      await api.post('/integrations/demo/connect');
      const data = await api.post('/integrations/demo/pull');
      setQBOInputs(data.inputs, data.sources, data.monthlyHistory || null);
      setImportStatus({
        type: 'success',
        message: 'Loaded demo QuickBooks data — $852K home-services business. Review below and adjust as needed.',
      });
    } catch (err) {
      setImportStatus({ type: 'error', message: `Demo import failed: ${err.message}` });
    } finally {
      setImporting(false);
    }
  }

  const liveRevenue = liveOutputs?.waterfall?.total_revenue || inputs.revenue || 0;
  const livePretax = liveOutputs?.waterfall?.pretax_net_income;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="sticky top-0 z-10 bg-navy/95 backdrop-blur-sm py-4 mb-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-stone hover:text-white transition text-sm"
            >
              &larr; Back
            </button>
            <h1 className="font-sora text-2xl font-bold text-white">Input Engine</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="font-mulish text-xs text-stone">Revenue</p>
              <p className="font-sora text-lg text-white">{formatCurrency(liveRevenue)}</p>
            </div>
            {livePretax !== undefined && (
              <div className="text-right">
                <p className="font-mulish text-xs text-stone">Pretax Profit</p>
                <p className={`font-sora text-lg ${livePretax >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                  {formatCurrency(livePretax)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <motion.div
        className="bg-gradient-to-r from-orange/10 to-navy-light rounded-xl p-5 border border-orange/20 mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="font-sora text-lg font-semibold text-white mb-1">Import Your Data</h2>
        <p className="font-mulish text-sm text-stone mb-4">
          Skip manual entry — upload an Excel/CSV P&L export or load demo data instantly.
        </p>

        <div className="flex flex-wrap gap-3">
          <label className={`bg-orange text-white px-5 py-2.5 rounded-lg font-sora font-semibold text-sm cursor-pointer hover:bg-orange/90 transition ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            {importing ? 'Importing...' : 'Upload Excel / CSV'}
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleExcelUpload(e.target.files?.[0])}
              disabled={importing}
            />
          </label>

          <button
            onClick={handleDemoImport}
            disabled={importing}
            className="bg-white/10 text-white px-5 py-2.5 rounded-lg font-sora font-semibold text-sm hover:bg-white/20 transition disabled:opacity-50"
          >
            Load Demo Data (QuickBooks)
          </button>
        </div>

        {importStatus && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-3 text-sm font-mulish ${importStatus.type === 'success' ? 'text-green-400' : 'text-status-red'}`}
          >
            {importStatus.message}
          </motion.p>
        )}
      </motion.div>

      <div className="space-y-8">
        {INPUT_SECTIONS.map((section) => (
          <div key={section.title} className="card-dark">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-sora text-lg font-semibold text-white">{section.title}</h2>
              {section.tooltip && (
                <Tooltip content={section.tooltip}>
                  <span className="text-stone text-xs cursor-help">(?)</span>
                </Tooltip>
              )}
            </div>

            <div className={`grid gap-4 ${section.fields.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {section.fields.map((field) => {
                const config = INPUT_SHAPE[field];
                const isOwnerPay = field === 'owner_direct_labor' || field === 'owner_management_wage';

                const inputType =
                  field === 'tax_rate'
                    ? 'percent'
                    : field === 'operating_months_per_year' || field === 'core_capital_months'
                      ? 'plain'
                      : 'currency';

                return (
                  <InputField
                    key={field}
                    label={config.label}
                    name={field}
                    value={inputs[field]}
                    onChange={handleChange}
                    type={inputType}
                    tooltip={
                      isOwnerPay
                        ? 'Split your total owner pay 50/50 between these two fields.'
                        : field === 'operating_months_per_year'
                          ? 'Months you actually operate (1–12). Breakeven “required monthly” divides annual need by this count.'
                          : undefined
                    }
                    source={fieldSources[field]}
                    error={errors[field]}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 bg-navy/95 backdrop-blur-sm py-4 mt-6 border-t border-white/10">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary w-full py-4 text-lg"
        >
          {loading ? 'Calculating...' : 'Calculate My Profit Score'}
        </button>
      </div>
    </div>
  );
}
