import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const handleGoogleLogin = () => {
    window.location.href = "https://autopostlab-v2-2.onrender.com/api/social-auth/google";
  };

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
          <button 
            onClick={handleGoogleLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '16px',
              color: '#3c4043',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184L12.048 13.56c-.477.319-1.088.508-1.99.508-2.103 0-3.882-1.446-4.522-3.39H2.46v2.329C3.947 15.928 6.277 18 9 18z" fill="#34a853"/>
              <path d="M4.478 10.677c-.163-.489-.256-1.011-.256-1.549 0-.538.093-1.061.256-1.549V5.25H2.46A8.996 8.996 0 0 0 0 9c0 1.397.32 2.716.889 3.891l2.589-2.214z" fill="#fbbc05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.801 11.426 0 9 0 6.277 0 3.947 2.072 2.46 5.071L5.048 7.399C5.688 5.454 7.467 3.58 9 3.58z" fill="#ea4335"/>
            </svg>
            Continuar con Google
          </button>
        </div>
        
        <div className="login-footer">
          <p>Al continuar, aceptas nuestros términos y condiciones.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
