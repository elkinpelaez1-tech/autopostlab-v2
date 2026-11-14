import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Login: React.FC = () => {
  const { login, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const successNotice = location.state?.successMessage;

  // Mode: 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);
  const [resetSuccessBanner, setResetSuccessBanner] = useState<string | null>(successNotice || null);

  // Si ya hay un token, redirigir al dashboard automáticamente (a menos que vengamos de un reseteo exitoso)
  useEffect(() => {
    if (successNotice) {
      logout();
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      sessionStorage.clear();
      return;
    }

    if (token) {
      navigate('/dashboard');
    }
  }, [token, navigate, successNotice, logout]);

  const handleGoogleLogin = () => {
    window.location.href = 'https://app.autopostlab.me/api/social-auth/google';
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      const { accessToken } = response.data;
      login(accessToken);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error al iniciar sesión:', err);
      const msg = err.response?.data?.message || 'Credenciales inválidas. Verifica tu correo y contraseña.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccessBanner(null);

    if (!name.trim()) {
      setErrorMessage('Por favor ingresa tu nombre completo.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      // Registro exitoso: volver a login, mostrar confirmación y pre-cargar correo
      setResetSuccessBanner(
        response.data?.message || 'Cuenta creada exitosamente. Ya puedes iniciar sesión con tus credenciales.'
      );
      setPassword('');
      setConfirmPassword('');
      setMode('login');
    } catch (err: any) {
      console.error('Error al registrar usuario:', err);
      const msg = err.response?.data?.message || 'Error al crear la cuenta. Por favor intenta de nuevo.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setForgotSuccessMessage(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', {
        email: email.trim(),
      });

      // Anti-enumeración: siempre mostrar mensaje genérico amigable
      setForgotSuccessMessage(
        response.data?.message || 'Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos.'
      );
    } catch (err: any) {
      console.error('Error en forgot-password:', err);
      // Mantener respuesta neutra incluso en caso de error
      setForgotSuccessMessage('Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '440px' }}>
        <div className="login-header">
          <img
            src="https://res.cloudinary.com/dgk2vhigg/image/upload/v1778007746/imagen_2026-05-05_104201396-removebg-preview_ysfqmc.png"
            alt="AutoPostLab"
            style={{ height: '95px', width: 'auto', margin: '0 auto 12px', display: 'block', objectFit: 'contain' }}
          />
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '14px 0 6px' }}>
            {mode === 'login' && 'Bienvenido a AutopostLab'}
            {mode === 'register' && 'Crea tu cuenta en AutopostLab'}
            {mode === 'forgot' && 'Recuperar contraseña'}
          </h1>
          <p style={{ color: '#4b5563', fontSize: '14px', marginBottom: '24px' }}>
            {mode === 'login' && 'Gestiona y programa tus redes sociales con IA'}
            {mode === 'register' && 'Comienza a gestionar y programar tus redes con IA'}
            {mode === 'forgot' && 'Te enviaremos un enlace seguro para restablecer tu acceso'}
          </p>
        </div>

        {/* Notificación de éxito tras restablecer contraseña o registrarse */}
        {resetSuccessBanner && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #d1fae5',
              borderRadius: '8px',
              color: '#065f46',
              fontSize: '13px',
              textAlign: 'left',
              marginBottom: '18px',
              lineHeight: 1.5,
            }}
          >
            <CheckCircle size={18} style={{ flexShrink: 0, color: '#10b981' }} />
            <span>{resetSuccessBanner}</span>
          </div>
        )}

        {/* Notificación de Error */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px',
              textAlign: 'left',
              marginBottom: '18px',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Notificación de éxito en Forgot Password */}
        {forgotSuccessMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #d1fae5',
              borderRadius: '8px',
              color: '#065f46',
              fontSize: '13px',
              textAlign: 'left',
              marginBottom: '18px',
            }}
          >
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>{forgotSuccessMessage}</span>
          </div>
        )}

        {mode === 'login' && (
          <div>
            {/* Formulario de Inicio de Sesión */}
            <form onSubmit={handleEmailLogin} style={{ textAlign: 'left', marginBottom: '16px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Correo electrónico
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 38px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                      setForgotSuccessMessage(null);
                      setResetSuccessBanner(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6366f1',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      padding: 0,
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                    <Lock size={18} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '11px 40px 11px 38px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)',
                  marginTop: '8px',
                }}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>
            </form>

            {/* Enlace para Crear Cuenta */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                    setForgotSuccessMessage(null);
                    setResetSuccessBanner(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6366f1',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Crea tu cuenta
                </button>
              </span>
            </div>

            {/* Separador */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
              <div style={{ flex: 1, borderTop: '1px solid #e5e7eb' }} />
              <span style={{ padding: '0 10px', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>
                o continúa con
              </span>
              <div style={{ flex: 1, borderTop: '1px solid #e5e7eb' }} />
            </div>

            {/* Botón de Google */}
            <div className="login-actions" style={{ marginBottom: '20px' }}>
              <button
                type="button"
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
                  fontSize: '15px',
                  color: '#3c4043',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'background-color 0.2s',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                    fill="#4285f4"
                  />
                  <path
                    d="M9 18c2.43 0 4.467-.806 5.956-2.184L12.048 13.56c-.477.319-1.088.508-1.99.508-2.103 0-3.882-1.446-4.522-3.39H2.46v2.329C3.947 15.928 6.277 18 9 18z"
                    fill="#34a853"
                  />
                  <path
                    d="M4.478 10.677c-.163-.489-.256-1.011-.256-1.549 0-.538.093-1.061.256-1.549V5.25H2.46A8.996 8.996 0 0 0 0 9c0 1.397.32 2.716.889 3.891l2.589-2.214z"
                    fill="#fbbc05"
                  />
                  <path
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.801 11.426 0 9 0 6.277 0 3.947 2.072 2.46 5.071L5.048 7.399C5.688 5.454 7.467 3.58 9 3.58z"
                    fill="#ea4335"
                  />
                </svg>
                Continuar con Google
              </button>
            </div>
          </div>
        )}

        {mode === 'register' && (
          <div>
            {/* Formulario de Registro */}
            <form onSubmit={handleRegister} style={{ textAlign: 'left', marginBottom: '16px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Nombre completo
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre completo"
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 38px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Correo electrónico
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 38px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                    <Lock size={18} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    style={{
                      width: '100%',
                      padding: '11px 40px 11px 38px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Confirmar contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                    <Lock size={18} />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    style={{
                      width: '100%',
                      padding: '11px 40px 11px 38px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)',
                  marginTop: '4px',
                }}
              >
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>

            {/* Enlace para regresar a Iniciar sesión */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                    setForgotSuccessMessage(null);
                    setResetSuccessBanner(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6366f1',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Inicia sesión
                </button>
              </span>
            </div>

            {/* Separador */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
              <div style={{ flex: 1, borderTop: '1px solid #e5e7eb' }} />
              <span style={{ padding: '0 10px', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>
                o continúa con
              </span>
              <div style={{ flex: 1, borderTop: '1px solid #e5e7eb' }} />
            </div>

            {/* Botón de Google */}
            <div className="login-actions" style={{ marginBottom: '20px' }}>
              <button
                type="button"
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
                  fontSize: '15px',
                  color: '#3c4043',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'background-color 0.2s',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                    fill="#4285f4"
                  />
                  <path
                    d="M9 18c2.43 0 4.467-.806 5.956-2.184L12.048 13.56c-.477.319-1.088.508-1.99.508-2.103 0-3.882-1.446-4.522-3.39H2.46v2.329C3.947 15.928 6.277 18 9 18z"
                    fill="#34a853"
                  />
                  <path
                    d="M4.478 10.677c-.163-.489-.256-1.011-.256-1.549 0-.538.093-1.061.256-1.549V5.25H2.46A8.996 8.996 0 0 0 0 9c0 1.397.32 2.716.889 3.891l2.589-2.214z"
                    fill="#fbbc05"
                  />
                  <path
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.801 11.426 0 9 0 6.277 0 3.947 2.072 2.46 5.071L5.048 7.399C5.688 5.454 7.467 3.58 9 3.58z"
                    fill="#ea4335"
                  />
                </svg>
                Continuar con Google
              </button>
            </div>
          </div>
        )}

        {mode === 'forgot' && (
          /* Formulario de Recuperación de Contraseña */
          <div>
            <form onSubmit={handleForgotPassword} style={{ textAlign: 'left', marginBottom: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Correo electrónico registrado
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 38px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)',
                }}
              >
                {loading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setForgotSuccessMessage(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#6366f1',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </button>
            </div>
          </div>
        )}

        <div className="login-footer" style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>
            Al continuar, aceptas nuestros términos y condiciones de servicio.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
