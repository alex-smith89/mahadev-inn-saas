// lib/auth.tsx
import { createContext, useContext, useState } from 'react';

interface User {
  id: string;
  username: string;
  role: 'Owner' | 'Manager' | 'Viewer';
  branches: string[];   // ✅ now an array
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
