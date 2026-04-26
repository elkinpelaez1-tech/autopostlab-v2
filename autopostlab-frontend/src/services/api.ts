import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3001').endsWith('/api') 
    ? (import.meta.env.VITE_API_URL || 'http://localhost:3001')
    : `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api`,
  withCredentials: true,
});

// Interceptor para añadir el token JWT a las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores globales (ej: 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Opcional: Manejar expiración de token o redirigir a login
      console.warn('Sesión no autorizada o expirada.');
    }
    return Promise.reject(error);
  }
);

export default api;
