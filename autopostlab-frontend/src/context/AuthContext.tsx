import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      if (token && token !== 'undefined' && token !== 'null') {
        try {
          const decoded: any = jwtDecode(token);
          const currentTime = Date.now() / 1000;
          
          if (decoded.exp < currentTime) {
            console.warn('Token expirado');
            logout();
          } else {
            // 🔄 REHIDRATACIÓN: Consultar datos frescos del backend
            try {
              const res = await api.get('/users/me');
              const userData = res.data;
              setUser({
                id: userData.id,
                email: userData.email,
                name: userData.name,
                workspaceId: userData.workspaceId || decoded.workspaceId,
                avatarUrl: userData.avatarUrl || null,
              });
            } catch (fetchError) {
              console.error('Error sincronizando perfil desde backend:', fetchError);
              // Fallback a los datos del token si la red falla pero el token es válido
              setUser({
                id: decoded.sub || decoded.id,
                email: decoded.email,
                name: decoded.name,
                workspaceId: decoded.workspaceId,
                avatarUrl: decoded.avatarUrl || null,
              });
            }
          }
        } catch (error) {
          console.error('Error decodificando token:', error);
          logout();
        }
      } else {
        if (token) logout(); 
      }
      setIsLoading(false);
    };

    validateToken();
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = (data: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
