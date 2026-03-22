import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { api } from '../utils/api.js';
import InputField from '../components/InputField.jsx';

const FIELD_LABELS = {
  revenue: 'Revenue',
  cogs: 'COGS (Materials)',
  owner_direct_labor: 'Owner Direct Labor',
  employee_direct_labor: 'Employee Labor',
  subcontractors: 'Subcontractors',
  marketing: 'Marketing',
  owner_management_wage: 'Owner Management',
  rent: 'Rent / Facilities',
  insurance: 'Insurance',
  software_subscriptions: 'Software',
  other_opex: 'Other Overhead',
};

const FIELD_OPTIONS = Object.entries(FIELD_LABELS).map(([value, label]) => ({ value, label }));

function ConfidenceBadge({ confidence, source }) {
  if (confidence >= 0.85) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600"><span>&#10003;</span> High</span>;
  }
  if (confidence >= 0.70) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-600"><span>&#9888;</span> Medium</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500"><span>&#9873;</span> Low</span>;
}

function WaterfallPreview({ fieldTotals }) {
  const rev = fieldTotals.revenue || 0;
  const cogs = fieldTotals.cogs || 0;
  const gm = rev - cogs;
  const directLabor =
    (fieldTotals.owner_direct_labor || 0) +
    (fieldTotals.employee_direct_labor || 0) +
    (fieldTotals.subcontractors || 0);
  const mktg = fieldTotals.marketing || 0;
  const cm = gm - directLabor - mktg;
  const mgmt = fieldTotals.owner_management_wage || 0;
  const overhead =
    (fieldTotals.rent || 0) +
    (fieldTotals.insurance || 0) +
    (fieldTotals.software_subscriptions || 0) +
    (fieldTotals.other_opex || 0);
  const pretax = cm - mgmt - overhead;

  const pct = (val) => (rev > 0 ? ((val / rev) * 100).toFixed(1) + '%' : '—');
  const fmt = (val) => '$' + Math.round(val).toLocaleString();

  const rows = [
    { label: 'Revenue', value: rev, pct: '100%', color: 'text-navy' },
    { label: '– COGS', value: -cogs, pct: pct(cogs), color: 'text-stone' },
    { label: '= Gross Margin', value: gm, pct: pct(gm), color: gm >= 0 ? 'text-green-600' : 'text-red-500', bold: true },
    { label: '– Direct Labor', value: -directLabor, pct: pct(directLabor), color: 'text-stone' },
    { label: '– Marketing', value: -mktg, pct: pct(mktg), color: 'text-stone' },
    { label: '= Contribution Margin', value: cm, pct: pct(cm), color: cm >= 0 ? 'text-green-600' : 'text-red-500', bold: true },
    { label: '– Management', value: -mgmt, pct: pct(mgmt), color: 'text-stone' },
    { label: '– Overhead', value: -overhead, pct: pct(overhead), color: 'text-stone' },
    { label: '= Pre-Tax Profit', value: pretax, pct: pct(pretax), color: pretax >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold', bold: true },
  ];

  return (
    <div className="bg-white border border-stone/20 rounded-lg p-4">
      <h3 className="font-sora text-sm font-bold text-navy mb-3">Live P&L Waterfall</h3>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className={`flex justify-between py-1 ${r.bold ? 'border-t border-stone/20 pt-2 mt-1' : ''}`}>
            <span className={`font-mulish text-sm ${r.bold ? 'font-bold text-navy' : 'text-stone'}`}>{r.label}</span>
            <div className="flex gap-4">
              <span className={`font-mono text-sm ${r.color}`}>{fmt(Math.abs(r.value))}</span>
              <span className="font-mono text-xs text-stone/60 w-12 text-right">{r.pct}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ImportConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { inputs, updateInputs, setQBOInputs, calculate } = useSnapshot();

  const confirmationData = location.state?.confirmation;
  const metadata = location.state?.metadata;
  const quickInputs = location.state?.inputs;
  const fileName = location.state?.fileName || 'Import';

  const [mappings, setMappings] = useState(() =>
    confirmationData?.mappings || []
  );
  const [filter, setFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fieldTotals = useMemo(() => {
    const totals = {};
    for (const f of Object.keys(FIELD_LABELS)) totals[f] = 0;
    for (const m of mappings) {
      const field = m.confirmed_field || m.suggested_field;
      if (totals.hasOwnProperty(field)) {
        totals[field] += Math.abs(m.original_amount);
      }
    }
    return totals;
  }, [mappings]);

  const warnings = useMemo(() => confirmationData?.warnings || [], [confirmationData]);

  const counts = useMemo(() => {
    const auto = mappings.filter((m) => m.status === 'auto_confirmed').length;
    const review = mappings.filter((m) => m.status === 'needs_review').length;
    const flagged = mappings.filter((m) => m.status === 'flagged').length;
    return { auto, review, flagged, total: mappings.length };
  }, [mappings]);

  const filteredMappings = useMemo(() => {
    if (filter === 'all') return mappings;
    return mappings.filter((m) => m.status === filter);
  }, [mappings, filter]);

  const updateMapping = useCallback((index, field) => {
    setMappings((prev) => {
      const updated = [...prev];
      const realIndex = filter === 'all' ? index : prev.indexOf(filteredMappings[index]);
      updated[realIndex] = {
        ...updated[realIndex],
        confirmed_field: field,
        status: 'auto_confirmed',
      };
      return updated;
    });
  }, [filter, filteredMappings]);

  const confirmAll = useCallback(() => {
    setMappings((prev) =>
      prev.map((m) => ({
        ...m,
        confirmed_field: m.confirmed_field || m.suggested_field,
        status: 'auto_confirmed',
      }))
    );
  }, []);

  async function handleFinalize() {
    setSubmitting(true);
    setError('');
    try {
      const payload = mappings.map((m) => ({
        name: m.name,
        original_amount: m.original_amount,
        confirmed_field: m.confirmed_field || m.suggested_field,
        source: m.source,
      }));
      const data = await api.post('/integrations/excel/finalize', { confirmedMappings: payload });
      setQBOInputs(data.inputs, data.sources);
      navigate('/import/final-review', {
        state: { inputs: data.inputs, sources: data.sources, fileName },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkipToQuick() {
    if (quickInputs) {
      setQBOInputs(quickInputs, location.state?.sources || {});
    }
    navigate('/import/final-review', {
      state: { inputs: quickInputs || inputs, sources: location.state?.sources || {}, fileName },
    });
  }

  if (!confirmationData) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="text-center">
          <p className="font-mulish text-white mb-4">No import data found.</p>
          <button onClick={() => navigate('/onboard/upload')} className="btn-primary">
            Upload a file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-navy text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-sora text-xl font-bold">Confirm Your Account Mappings</h1>
            <p className="font-mulish text-stone text-sm mt-1">
              From: {fileName}
              {metadata?.period_selected && ` · Period: ${metadata.period_selected}`}
              {metadata?.accounts_extracted != null && ` · ${metadata.accounts_extracted} accounts extracted`}
              {metadata?.rule_matched != null && ` · ${metadata.rule_matched} matched by rules`}
              {metadata?.ai_classified != null && metadata.ai_classified > 0 && ` · ${metadata.ai_classified} classified by AI`}
            </p>
            {metadata?.sheet_used && (
              <p className="font-mulish text-stone/50 text-xs mt-0.5">
                Sheet: {metadata.sheet_used}
                {metadata?.label_column != null && ` · Label col: ${String.fromCharCode(65 + metadata.label_column)}`}
                {metadata?.value_column != null && ` · Value col: ${String.fromCharCode(65 + metadata.value_column)}`}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleSkipToQuick} className="btn-ghost text-sm text-stone/80 hover:text-white">
              Skip review
            </button>
            <button onClick={() => navigate(-1)} className="btn-ghost text-sm text-stone/80 hover:text-white">
              &larr; Back
            </button>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          {warnings.map((w, i) => (
            <div key={i} className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2 mb-2 flex items-start gap-2">
              <span className="text-yellow-600 mt-0.5">&#9888;</span>
              <p className="font-mulish text-sm text-yellow-800">{w.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Mapping Table */}
        <div className="lg:col-span-2">
          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'all', label: `All (${counts.total})` },
              { key: 'needs_review', label: `Review (${counts.review})`, color: 'text-yellow-600' },
              { key: 'flagged', label: `Flagged (${counts.flagged})`, color: 'text-red-500' },
              { key: 'auto_confirmed', label: `Confirmed (${counts.auto})`, color: 'text-green-600' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  filter === tab.key
                    ? 'bg-navy text-white'
                    : `bg-white border border-stone/20 ${tab.color || 'text-navy'} hover:bg-stone/10`
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={confirmAll}
              className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition"
            >
              Confirm all
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-stone/20 overflow-hidden">
            <div className="grid grid-cols-[1fr_200px_80px] gap-0 px-4 py-2 bg-stone/5 border-b border-stone/20">
              <span className="font-sora text-xs font-bold text-navy uppercase tracking-wider">Account</span>
              <span className="font-sora text-xs font-bold text-navy uppercase tracking-wider">Easy Numbers Field</span>
              <span className="font-sora text-xs font-bold text-navy uppercase tracking-wider text-center">Confidence</span>
            </div>
            <div className="divide-y divide-stone/10 max-h-[60vh] overflow-y-auto">
              {filteredMappings.map((m, i) => {
                const bgClass =
                  m.status === 'flagged' ? 'bg-red-50' :
                  m.status === 'needs_review' ? 'bg-yellow-50/50' :
                  '';
                return (
                  <div key={`${m.name}-${i}`} className={`grid grid-cols-[1fr_200px_80px] gap-0 px-4 py-2.5 items-center ${bgClass} hover:bg-stone/5 transition`}>
                    <div>
                      <p className="font-mulish text-sm text-navy">{m.name}</p>
                      <p className="font-mono text-xs text-stone">
                        ${Math.abs(m.original_amount).toLocaleString()}
                        {m.section && m.section !== 'unknown' && (
                          <span className="ml-2 text-stone/50">({m.section})</span>
                        )}
                      </p>
                      {m.warning && (
                        <p className="text-xs text-red-500 mt-0.5">{m.warning}</p>
                      )}
                    </div>
                    <div>
                      <select
                        value={m.confirmed_field || m.suggested_field}
                        onChange={(e) => updateMapping(i, e.target.value)}
                        className="w-full text-sm border border-stone/20 rounded-md px-2 py-1.5 bg-white text-navy font-mulish focus:outline-none focus:ring-2 focus:ring-orange/30"
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="text-center">
                      <ConfidenceBadge confidence={m.confidence} source={m.source} />
                    </div>
                  </div>
                );
              })}
              {filteredMappings.length === 0 && (
                <div className="px-4 py-8 text-center text-stone font-mulish text-sm">
                  No accounts match this filter.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar: live waterfall + action */}
        <div className="space-y-4">
          <WaterfallPreview fieldTotals={fieldTotals} />

          <div className="bg-white border border-stone/20 rounded-lg p-4 space-y-3">
            <h3 className="font-sora text-sm font-bold text-navy">Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-mulish">
              <span className="text-stone">Total accounts</span>
              <span className="text-navy font-bold text-right">{counts.total}</span>
              <span className="text-green-600">Auto-confirmed</span>
              <span className="text-green-600 font-bold text-right">{counts.auto}</span>
              <span className="text-yellow-600">Needs review</span>
              <span className="text-yellow-600 font-bold text-right">{counts.review}</span>
              <span className="text-red-500">Flagged</span>
              <span className="text-red-500 font-bold text-right">{counts.flagged}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleFinalize}
            disabled={submitting}
            className="btn-primary w-full py-3 text-sm"
          >
            {submitting ? 'Finalizing...' : 'Confirm & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
