import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { useSnapshot } from '../hooks/useSnapshot.js';
import { api } from '../utils/api.js';

export default function OnboardUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setQBOInputs } = useSnapshot();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  async function handleFile(file) {
    if (!file) return;
    setImporting(true);
    setError('');
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const data = await api.upload('/integrations/excel/upload', buffer, file.name);

      if (data.metadata?.error) {
        const meta = data.metadata;
        let detail = meta.error;
        if (meta.sheet_used) detail += ` (Sheet: ${meta.sheet_used})`;
        if (meta.total_rows != null) detail += ` — ${meta.total_rows} rows scanned, ${meta.accounts_extracted || 0} accounts found.`;
        if (meta.label_column != null) detail += ` Label col: ${String.fromCharCode(65 + meta.label_column)}, Value col: ${String.fromCharCode(65 + meta.value_column)}.`;
        setError(detail);
        return;
      }

      if (data.confirmation && data.confirmation.mappings?.length > 0) {
        navigate('/import/confirm', {
          state: {
            confirmation: data.confirmation,
            metadata: data.metadata,
            inputs: data.inputs,
            sources: data.sources,
            fileName: file.name,
          },
        });
      } else if (data.inputs) {
        setQBOInputs(data.inputs, data.sources);
        navigate('/import/final-review', {
          state: { inputs: data.inputs, sources: data.sources, fileName: file.name },
        });
      } else {
        setError('Could not extract accounts from this file. Check that it is a Profit & Loss report.');
      }
    } catch (err) {
      setError(`Failed to parse file: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleDemoImport() {
    setImporting(true);
    setError('');
    setFileName('Demo QuickBooks Data');
    try {
      await api.post('/integrations/demo/connect');
      const data = await api.post('/integrations/demo/pull');
      setQBOInputs(data.inputs, data.sources);
      navigate('/import/final-review', {
        state: { inputs: data.inputs, sources: data.sources, fileName: 'Demo QuickBooks Data' },
      });
    } catch (err) {
      setError(`Demo import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-md text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="font-sora text-2xl font-bold text-white mb-2">
          Upload your P&L. Get your score in 60 seconds.
        </h2>
        <p className="font-mulish text-stone text-sm mb-8">
          Drop an Excel, CSV, or QuickBooks export. We will read it and fill everything in.
        </p>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-stone/30 hover:border-orange rounded-xl p-10 mb-6 transition cursor-pointer"
          onClick={() => document.getElementById('fileInput').click()}
        >
          {importing ? (
            <div className="text-center">
              <div className="animate-spin text-orange text-3xl mb-3">&#9696;</div>
              <p className="font-mulish text-white">Reading your file...</p>
            </div>
          ) : (
            <>
              <p className="text-4xl mb-3">📄</p>
              <p className="font-sora text-white font-semibold mb-1">
                Drop your file here, or click to browse
              </p>
              <p className="font-mulish text-stone text-xs">
                Supports .xlsx, .xls, and .csv
              </p>
            </>
          )}
          <input
            id="fileInput"
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFile(e.target.files?.[0])}
            disabled={importing}
          />
        </div>

        {error && <p className="text-status-red text-sm mb-4">{error}</p>}

        <button
          onClick={handleDemoImport}
          disabled={importing}
          className="btn-secondary w-full py-3 mb-3"
        >
          No file? Load demo QuickBooks data instead.
        </button>

        <button
          onClick={() => navigate(-1)}
          className="btn-ghost text-sm text-stone/60 hover:text-white"
        >
          &larr; Back
        </button>
      </motion.div>
    </div>
  );
}
