import { createContext, useState, useEffect } from 'react';
import { api } from '../utils/api.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
