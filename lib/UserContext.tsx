import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import * as authService from './services/utils/authService';
import type { LoginInput, RegisterInput, User } from './types/auth';

interface UserContextValue {
  user: User | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<{ success: boolean; error?: string }>;
  register: (input: RegisterInput) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const current = await authService.getCurrentUser();
      setUser(current);
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const result = await authService.login(input);
    if (result.success && result.user) setUser(result.user);
    return { success: result.success, error: result.error };
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await authService.register(input);
    if (result.success && result.user) setUser(result.user);
    return { success: result.success, error: result.error };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
}