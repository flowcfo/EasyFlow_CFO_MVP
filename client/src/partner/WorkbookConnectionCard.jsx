import { useEffect, useState } from 'react';
import { api } from '../utils/api.js';

/**
 * CFO-only card: is the portal connected to the EasyFlow Clients SharePoint site,
 * and can it change a cell in a workbook and read Excel's answer back?
 */
export default function WorkbookConnectionCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function loadStatus() {
    setLoading(true);
    try {
      setStatus(await api.get('/workbook/status'));
    } catch (err) {
      setStatus({ error: { message: err.message } });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function runTest() {
    setError('');
    setResult(null);
    try {
      setStep('Copying your template into a test folder...');
      const copy = await api.post('/workbook/test/copy', {});
      setStep('Writing two cells and reading Excel\'s answer...');
      const rw = await api.post('/workbook/test/write-read', { itemId: copy.itemId });
      setResult({ ...rw, fileUrl: copy.webUrl, fileName: copy.name });
    } catch (err) {
      setError(err.message || 'The test did not finish.');
    } finally {
      setStep('');
    }
  }

  const ok = status && status.signedIn && status.site && status.template && !status.error;

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-ember">Workbook connection</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-navy">EasyFlow Clients on SharePoint</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${
          loading ? 'bg-offwhite text-slate' : ok ? 'bg-pale text-ink' : 'bg-cream text-ember ring-1 ring-inset ring-[#F6D9BF]'}`}>
          {loading ? 'Checking...' : ok ? 'Connected' : 'Not connected yet'}
        </span>
      </div>

      {!loading && status && (
        <ul className="mt-4 space-y-1.5 text-[15px] text-navy">
          <li>{status.configured ? '✓' : '✗'} Microsoft app settings saved</li>
          <li>{status.signedIn ? '✓' : '✗'} Portal can sign in to Microsoft</li>
          <li>{status.site ? '✓' : '✗'} Can open the EasyFlow Clients site</li>
          <li>{status.template ? `✓ Template found: ${status.template.name}` : '✗ Template found in _Template'}</li>
        </ul>
      )}
      {status?.error && <p className="mt-3 rounded-[10px] bg-cream px-3 py-2 text-sm text-ember">{status.error.message}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={runTest} disabled={!ok || Boolean(step)} className="btn-primary">
          {step ? 'Testing...' : 'Run workbook test'}
        </button>
        <button type="button" onClick={loadStatus} className="btn-ghost">Check again</button>
      </div>
      {step && <p className="mt-3 text-sm text-slate">{step}</p>}
      {error && <p className="mt-3 rounded-[10px] bg-cream px-3 py-2 text-sm text-ember">{error}</p>}

      {result && (
        <div className={`mt-4 rounded-[10px] px-4 py-3 ${result.recalculated ? 'bg-pale text-ink' : 'bg-cream text-ember'}`}>
          <p className="font-bold">{result.recalculated ? 'It works. Excel did the math.' : 'The cells were written, but the answer did not match.'}</p>
          <p className="mt-1 text-sm">
            Set the hourly rate to ${result.after.hourlyRate} and the top employee rate to ${result.after.employeeRate}.
            The workbook's price-to-labor formula now reads <b>{result.after.ratioText || result.after.ratio}</b> (was {String(result.before.ratio)}).
          </p>
          <a href={result.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-cobalt hover:underline">
            Open the test copy in Excel
          </a>
        </div>
      )}
    </section>
  );
}
