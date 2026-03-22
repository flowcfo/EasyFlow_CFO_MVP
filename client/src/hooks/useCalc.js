import { useState, useRef, useCallback } from 'react';
import { api } from '../utils/api.js';

export function useCalc() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const calculate = useCallback(async (inputs) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/calc/snapshot', {
        inputs,
        label: 'Live preview',
        skip_persist: true,
      });
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedCalc = useCallback((inputs, onResult, delay = 300) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await calculate(inputs);
        onResult(data);
      } catch {
        // error already set
      }
    }, delay);
  }, [calculate]);

  return { calculate, debouncedCalc, loading, error };
}
