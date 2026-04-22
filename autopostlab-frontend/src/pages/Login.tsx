import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Login: React.FC = () => {
  const { login, token } = useAuth();
  const navigate = useNavigate();

  // Si ya hay un token, redirigir al dashboard automáticamente
  useEffect(() => {
    if (token) {
      navigate('/dashboard');
    }
  }, [token, navigate]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const { credential } = credentialResponse;
      const response = await api.post('/auth/google', { token: credential });
      const { accessToken } = response.data;
      
      // Guardar en contexto y localStorage
      login(accessToken);
      
      // FORZAR Redirección inmediata al dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      alert('Error al iniciar sesión. Por favor, intenta de nuevo.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-large">🚀</div>
          <h1>Bienvenido a AutopostLab</h1>
          <p>Gestiona y programa tus redes sociales con IA</p>
        </div>
        
        <div className="login-actions">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              console.log('Login Failed');
            }}
            useOneTap
          />
        </div>
        
        <div className="login-footer">
          <p>Al continuar, aceptas nuestros términos y condiciones.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
