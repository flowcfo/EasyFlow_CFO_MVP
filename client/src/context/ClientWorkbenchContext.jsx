import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { api } from '../utils/api.js';
import { getDefaultInputs } from '../../../shared/schema.js';

/**
 * Per-client CFO workbench state.
 *
 * Same surface as SnapshotContext (so screens can call useWorkbench() instead
 * of useSnapshot() and keep working) plus draft / publish controls. All reads
 * and writes target /partner/clients/:clientId/draft*.
 */

export const ClientWorkbenchContext = createContext(null);

export function ClientWorkbenchProvider({ clientId, children }) {
  const [client, setClient] = useState(null);
  const [inputs, setInputs] = useState(getDefaultInputs);
  const [outputs, setOutputs] = useState(null);
  const [interpretation, setInterpretation] = useState(null);
  const [fieldSources, setFieldSources] = useState({});
  const [monthlyHistory, setMonthlyHistory] = useState(null);
  const [lastPublishedAt, setLastPublishedAt] = useState(null);
  const [lastPublishedSnapshotId, setLastPublishedSnapshotId] = useState(null);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(false);

  function applyDraft(draft) {
    if (!draft) return;
    setClient(draft.client || null);
    setInputs(draft.inputs || getDefaultInputs());
    setOutputs(draft.outputs || null);
    setInterpretation(draft.interpretation || null);
    setFieldSources(draft.field_sources || {});
    setMonthlyHistory(draft.monthly_history || null);
    setLastPublishedAt(draft.last_published_at || null);
    setLastPublishedSnapshotId(draft.last_published_snapshot_id || null);
    setHasUnpublishedChanges(Boolean(draft.has_unpublished_changes));
  }

  // Initial load whenever the client changes.
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOutputs(null);
    api.get(`/partner/clients/${clientId}/draft`)
      .then((data) => {
        if (cancelled) return;
        applyDraft(data.draft);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId]);

  const updateInputs = useCallback((updates) => {
    setInputs((prev) => ({ ...prev, ...updates }));
    setHasUnpublishedChanges(true);
  }, []);

  /**
   * Mirrors SnapshotContext.calculate signature: (inputData, label, periodType).
   * Writes inputs + outputs to the draft and returns { outputs }.
   * The label and periodType params are ignored on the partner side; saves are
   * always to the draft (period/label are decided at publish time).
   */
  const calculate = useCallback(async (inputData) => {
    setLoading(true);
    setError(null);
    try {
      const payload = inputData || inputs;
      const data = await api.post(
        `/partner/clients/${clientId}/draft/calc`,
        { inputs: payload },
      );
      applyDraft(data.draft);
      return { outputs: data.outputs, interpretation: null };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clientId, inputs]);

  /**
   * Excel/CSV import via partner-side endpoint. Reuses the existing parser and
   * writes results into the draft.
   */
  async function importExcel(buffer, filename, extraHeaders = {}) {
    const data = await api.upload(
      `/partner/clients/${clientId}/draft/import/excel`,
      buffer,
      filename,
      extraHeaders,
    );
    if (data.draft) applyDraft(data.draft);
    return data;
  }

  /**
   * Mirrors SnapshotContext.setQBOInputs — used by the Input Engine import
   * fallback when the user manually maps columns. Saves to the draft.
   */
  const setQBOInputs = useCallback(async (qboInputs, sources, history) => {
    if (!qboInputs || typeof qboInputs !== 'object') return;
    setInputs((prev) => ({ ...prev, ...qboInputs }));
    if (sources) setFieldSources(sources);
    if (history) setMonthlyHistory(history);
    setHasUnpublishedChanges(true);

    try {
      await api.put(`/partner/clients/${clientId}/draft`, {
        inputs: { ...inputs, ...qboInputs },
        field_sources: sources || fieldSources,
        monthly_history: history || monthlyHistory,
      });
    } catch (err) {
      setError(err.message);
    }
  }, [clientId, inputs, fieldSources, monthlyHistory]);

  async function publishDraft(opts = {}) {
    setPublishing(true);
    setError(null);
    try {
      const data = await api.post(
        `/partner/clients/${clientId}/draft/publish`,
        { note: opts.note || '' },
      );
      if (data.draft) applyDraft(data.draft);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setPublishing(false);
    }
  }

  async function resetDraft() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post(`/partner/clients/${clientId}/draft/reset`);
      applyDraft(data.draft);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  // No-op stub so screens that call loadSnapshot don't crash. Drafts don't have
  // a snapshot history list yet.
  const loadSnapshot = useCallback(async () => null, []);

  const value = useMemo(() => ({
    inputs,
    outputs,
    interpretation,
    loading,
    error,
    fieldSources,
    monthlyHistory,
    setInputs,
    updateInputs,
    setQBOInputs,
    calculate,
    loadSnapshot,
    setOutputs,
    // workbench-specific
    client,
    clientId,
    lastPublishedAt,
    lastPublishedSnapshotId,
    hasUnpublishedChanges,
    publishing,
    publishDraft,
    resetDraft,
    importExcel,
    isWorkbench: true,
  }), [
    inputs, outputs, interpretation, loading, error,
    fieldSources, monthlyHistory, updateInputs, setQBOInputs, calculate, loadSnapshot,
    client, clientId, lastPublishedAt, lastPublishedSnapshotId,
    hasUnpublishedChanges, publishing,
  ]);

  return (
    <ClientWorkbenchContext.Provider value={value}>
      {children}
    </ClientWorkbenchContext.Provider>
  );
}
