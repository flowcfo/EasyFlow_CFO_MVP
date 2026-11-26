import { createContext, useState, useEffect } from 'react';
import { api } from '../utils/api.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Local design preview only (npm run dev): open any page with ?devpreview=owner or
    // ?devpreview=partner to see the signed-in screens with a sample user and no server.
    // import.meta.env.DEV is false in production builds, so Vite removes this block.
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const kind = params.get('devpreview') || sessionStorage.getItem('devpreview');
      if (kind === 'owner' || kind === 'partner') {
        sessionStorage.setItem('devpreview', kind);
        setUser(kind === 'partner'
          ? { id: 'dev-partner', email: 'nick@easyflowcfo.com', full_name: 'Nick Marcogliese', user_type: 'partner', tier: 'partner_scale' }
          : { id: 'dev-owner', email: 'owner@example.com', full_name: 'Jamie Morgan', business_name: 'Sample Company', user_type: 'owner', tier: 'harvest' });
        setLoading(false);
        return;
      }
    }

    const token = localStorage.getItem('access_token')?.trim();
    if (token) {
      api.get('/auth/me')
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function signup(userData) {
    const data = await api.post('/auth/signup', userData);
    localStorage.setItem('access_token', String(data.access_token || '').trim());
    localStorage.setItem('refresh_token', String(data.refresh_token || '').trim());
    setUser(data.user);
    return data;
  }

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', String(data.access_token || '').trim());
    localStorage.setItem('refresh_token', String(data.refresh_token || '').trim());
    setUser(data.user);
    return data;
  }

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  }

  function updateUser(updates) {
    setUser((prev) => ({ ...prev, ...updates }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
