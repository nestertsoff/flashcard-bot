import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const u = await api.login(username, password);
    setUser(u);
  };

  const register = async (username, password) => {
    const u = await api.register(username, password);
    setUser(u);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  if (loading) return <div className="loader-wrap"><div className="loader"></div></div>;

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
