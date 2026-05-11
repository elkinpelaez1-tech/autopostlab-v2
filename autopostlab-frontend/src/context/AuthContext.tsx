import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
  role?: string;
  avatarUrl?: string | null;
  plan?: string;
  planExpiresAt?: string | null;
  hadPro?: boolean;
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
    const captureAndValidate = async () => {
      let currentToken = token;

      // 1. CAPTURAR TOKENS DE LA URL (FLUJO GOOGLE REDIRECT)
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      const urlRefreshToken = params.get('refreshToken');

      if (urlToken) {
        console.log('Tokens capturados de la URL');
        localStorage.setItem('token', urlToken);
        if (urlRefreshToken) {
          localStorage.setItem('refreshToken', urlRefreshToken);
        }
        setToken(urlToken);
        currentToken = urlToken;
        // Limpiar URL y redirigir internamente sin recarga
        window.history.replaceState({}, document.title, "/dashboard");
      }

      if (currentToken && currentToken !== 'undefined' && currentToken !== 'null') {
        try {
          const decoded: any = jwtDecode(currentToken);
          const currentTime = Date.now() / 1000;
          
          if (decoded.exp < currentTime) {
            console.warn('Token expirado');
            logout();
          } else {
            // 🔄 REHIDRATACIÓN: Consultar datos frescos del backend
            try {
              const res = await api.get('/users/me', {
                headers: { Authorization: `Bearer ${currentToken}` }
              });
              const userData = res.data;
              setUser({
                id: userData.id,
                email: userData.email,
                name: userData.name,
                workspaceId: userData.workspaceId || decoded.workspaceId,
                role: userData.role || decoded.role,
                avatarUrl: userData.avatarUrl || null,
                plan: userData.organization?.plan || 'FREE',
                planExpiresAt: userData.organization?.planExpiresAt || null,
                hadPro: userData.organization?.hadPro || false,
              });
            } catch (fetchError) {
              console.error('Error sincronizando perfil desde backend:', fetchError);
              setUser({
                id: decoded.sub || decoded.id,
                email: decoded.email,
                name: decoded.name,
                workspaceId: decoded.workspaceId,
                role: decoded.role,
                avatarUrl: decoded.avatarUrl || null,
                plan: 'FREE',
                planExpiresAt: null,
                hadPro: false,
              });
            }
          }
        } catch (error) {
          console.error('Error decodificando token:', error);
          logout();
        }
      } else {
        if (currentToken) logout(); 
      }
      setIsLoading(false);
    };

    captureAndValidate();
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
