import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getMe, login as apiLogin, register as apiRegister, logout as apiLogout, getAccessToken, setTokens } from './api';

interface User {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const tokens = await apiLogin(email, password);
    setTokens(tokens);
    const me = await getMe();
    setUser(me);
  };

  const register = async (email: string, password: string, displayName?: string) => {
    await apiRegister(email, password, displayName);
    await login(email, password);
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
