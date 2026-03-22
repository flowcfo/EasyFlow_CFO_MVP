import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { api } from '../utils/api.js';
import { getDefaultInputs } from '../../../shared/schema.js';

export const SnapshotContext = createContext(null);

const STORAGE_KEY = 'easynumbers_inputs';
const SOURCES_KEY = 'easynumbers_sources';

function loadPersistedInputs() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.revenue !== undefined) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return getDefaultInputs();
}

function loadPersistedSources() {
  try {
    const raw = sessionStorage.getItem(SOURCES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function SnapshotProvider({ children }) {
  const [inputs, setInputs] = useState(loadPersistedInputs);
  const [outputs, setOutputs] = useState(null);
  const [interpretation, setInterpretation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldSources, setFieldSources] = useState(loadPersistedSources);
  const [monthlyHistory, setMonthlyHistory] = useState(() => {
    try {
      const raw = sessionStorage.getItem('easynumbers_monthly');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch { /* ignore */ }
  }, [inputs]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SOURCES_KEY, JSON.stringify(fieldSources));
    } catch { /* ignore */ }
  }, [fieldSources]);

  useEffect(() => {
    try {
      if (monthlyHistory) {
        sessionStorage.setItem('easynumbers_monthly', JSON.stringify(monthlyHistory));
      }
    } catch { /* ignore */ }
  }, [monthlyHistory]);

  const calculate = useCallback(async (inputData, label, periodType) => {
    setLoading(true);
    setError(null);
    try {
      const isAuto = label === 'Auto';
      const data = await api.post('/calc/snapshot', {
        inputs: inputData || inputs,
        label,
        period_type: periodType,
        ...(isAuto ? { skip_persist: true } : {}),
      });
      setOutputs(data.outputs);
      setInterpretation(data.interpretation);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [inputs]);

  // Auto-calculate once defaults (or restored session inputs) are valid, even if revenue is still 0.
  // Without this, dashboards wait forever on `!outputs` because the old guard required revenue > 0.
  const autoCalcInFlight = useRef(false);
  useEffect(() => {
    if (!outputs && !loading && inputs && !error && !autoCalcInFlight.current) {
      autoCalcInFlight.current = true;
      calculate(inputs, 'Auto', 'annual')
        .catch(() => {})
        .finally(() => {
          autoCalcInFlight.current = false;
        });
    }
  }, [outputs, loading, inputs, error, calculate]);

  const updateInputs = useCallback((updates) => {
    setInputs((prev) => ({ ...prev, ...updates }));
  }, []);

  const setQBOInputs = useCallback((qboInputs, sources, history) => {
    if (!qboInputs || typeof qboInputs !== 'object') return;
    setInputs((prev) => ({ ...prev, ...qboInputs }));
    setOutputs(null);
    if (sources) setFieldSources(sources);
    if (history) setMonthlyHistory(history);
  }, []);

  async function loadSnapshot(id) {
    setLoading(true);
    try {
      const data = await api.get(`/calc/snapshots/${id}`);
      setInputs(data.snapshot.inputs);
      setOutputs(data.snapshot.outputs);
      return data.snapshot;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SnapshotContext.Provider
      value={{
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
      }}
    >
      {children}
    </SnapshotContext.Provider>
  );
}
