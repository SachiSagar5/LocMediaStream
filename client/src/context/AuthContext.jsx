import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let token = localStorage.getItem('token');
    const tryAuth = async (tok) => {
      api.defaults.headers.common['Authorization'] = `Bearer ${tok}`;
      try {
        const res = await api.get('/auth/me');
        setUser(res.data);
        localStorage.setItem('token', tok);
        return true;
      } catch {
        return false;
      }
    };

    (async () => {
      if (token) {
        const ok = await tryAuth(token);
        if (ok) { setLoading(false); return; }
      }
      try {
        const res = await api.post('/auth/login', { username: 'guest', password: 'guest' });
        const t = res.data.token;
        localStorage.setItem('token', t);
        api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
        setUser(res.data.user);
      } catch {
        localStorage.removeItem('token');
      }
      setLoading(false);
    })();
  }, []);

  const login = async (username, password, email) => {
    const res = await api.post('/auth/login', { username, password, email });
    localStorage.setItem('token', res.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    return res.data;
  };

  const register = async (username, email, password) => {
    const res = await api.post('/auth/register', { username, email, password });
    localStorage.setItem('token', res.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token: localStorage.getItem('token'), loading, login, register, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { api };