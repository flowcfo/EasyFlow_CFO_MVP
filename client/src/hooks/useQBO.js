import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api.js';
import { useAuth } from './useAuth.js';

export function useQBO() {
  const { user } = useAuth();
  const [status, setStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) checkStatus();
  }, [user?.id]);

  async function checkStatus() {
    try {
      const data = await api.get('/integrations/qbo/status');
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    }
  }

  const connect = useCallback(async () => {
    const data = await api.get('/integrations/qbo/connect');
    return data.url;
  }, []);

  const pull = useCallback(async (dateRange) => {
    setLoading(true);
    try {
      const data = await api.post('/integrations/qbo/pull', dateRange || {});
      await checkStatus();
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await api.delete('/integrations/qbo/disconnect');
    setStatus({ connected: false });
  }, []);

  return { status, loading, connect, pull, disconnect, checkStatus };
}
