import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Search, Bell, Settings, User, LogOut, CheckCircle2, AlertCircle, Clock, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Layout: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [billingNotification, setBillingNotification] = useState<any>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Parse query params and handle email actions
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('action') === 'upgrade') {
      setEmailMessage('Te enviamos un correo con información de tu suscripción.');
      handleUpgrade();
      
      // Limpiar query param sin recargar página
      window.history.replaceState(null, '', window.location.pathname);
      
      // Ocultar mensaje después de 5 segundos
      setTimeout(() => setEmailMessage(null), 5000);
    }
  }, [location.search, token]);

  // Fetch billing notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/billing/notifications', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data && res.data.length > 0) {
          // Tomar la notificación más reciente
          setBillingNotification(res.data[0]);
        }
      } catch (error) {
        console.error('Error fetching billing notifications', error);
      }
    };

    if (token) {
      fetchNotifications();
    }
  }, [token]);

  const handleUpgrade = async () => {
    if (!token) return;
    try {
      setIsUpgrading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const res = await api.post('/billing/create-checkout', { plan: 'PRO' }, { headers });
      
      if (res.data && res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      }
    } catch (error) {
      console.error('Error al iniciar upgrade:', error);
      alert('No se pudo iniciar el proceso de pago. Intenta de nuevo.');
    } finally {
      setIsUpgrading(false);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mockNotifications = [
    { id: 1, title: 'Post publicado', type: 'success', time: 'Hace 5 min', icon: <CheckCircle2 size={14} className="text-success" /> },
    { id: 2, title: 'Error en publicación', type: 'error', time: 'Hace 1 hora', icon: <AlertCircle size={14} className="text-error" /> },
    { id: 3, title: 'Post programado', type: 'info', time: 'Hace 3 horas', icon: <Clock size={14} className="text-info" /> },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="content">
        <header className="content-header">
          {emailMessage && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#eff6ff',
              color: '#1e40af',
              padding: '0.75rem 1.5rem',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              zIndex: 50,
              fontSize: '0.875rem',
              fontWeight: 500,
              animation: 'fadeInDown 0.3s ease-out'
            }}>
              <Info size={18} />
              {emailMessage}
            </div>
          )}

          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Buscar publicaciones, estadísticas..." />
          </div>
          <div className="header-actions">
            {/* Notificaciones */}
            <div className="dropdown-wrapper" ref={notificationRef}>
              <button 
                className={`icon-btn-header ${showNotifications ? 'active' : ''}`}
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setHasUnread(false);
                }}
              >
                <Bell size={20} />
                {hasUnread && <span className="notification-badge-dot"></span>}
              </button>
              
              {showNotifications && (
                <div className="dropdown-panel notifications-panel scale-in">
                  <div className="dropdown-header">
                    <h4>Notificaciones</h4>
                  </div>
                  <div className="dropdown-body">
                    {mockNotifications.map(n => (
                      <div 
                        key={n.id} 
                        className="notification-item clickable"
                        onClick={() => {
                          setShowNotifications(false);
                          if (n.id === 3) navigate('/dashboard/calendar');
                          else navigate('/dashboard/posts');
                        }}
                      >
                        <div className={`notification-icon-bg ${n.type}`}>
                          {n.icon}
                        </div>
                        <div className="notification-content">
                          <p className="notification-title">{n.title}</p>
                          <span className="notification-time">{n.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button 
              className="icon-btn-header" 
              onClick={() => navigate('/dashboard/settings')}
              title="Ajustes"
            >
              <Settings size={20} />
            </button>

            <div className="header-divider"></div>

            {/* Menú de Usuario */}
            <div className="dropdown-wrapper" ref={userMenuRef}>
              <button 
                className="user-profile-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                 {user?.avatarUrl ? (
                   <img src={user.avatarUrl} alt="Avatar" className="avatar-mini" />
                 ) : (
                   <div className="avatar-mini">{user?.name?.charAt(0) || 'U'}</div>
                 )}
              </button>

              {showUserMenu && (
                <div className="dropdown-panel user-menu-panel scale-in">
                  <div className="user-menu-header">
                    <p className="menu-user-name">{user?.name || 'Usuario'}</p>
                    <p className="menu-user-email">{user?.email || 'email@ejemplo.com'}</p>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-body">
                    <Link to="/dashboard/settings" className="dropdown-menu-item" onClick={() => setShowUserMenu(false)}>
                      <User size={16} />
                      Perfil
                    </Link>
                    <Link to="/dashboard/settings" className="dropdown-menu-item" onClick={() => setShowUserMenu(false)}>
                      <Settings size={16} />
                      Ajustes
                    </Link>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-menu-item danger" onClick={logout}>
                      <LogOut size={16} />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        
        {/* Banner de Suscripción Persistente */}
        {billingNotification && (
          <div style={{
            backgroundColor: billingNotification.type === 'EXPIRED' ? '#fee2e2' : '#fef3c7',
            color: billingNotification.type === 'EXPIRED' ? '#991b1b' : '#92400e',
            padding: '1rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${billingNotification.type === 'EXPIRED' ? '#fca5a5' : '#fcd34d'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertCircle size={20} />
              <span style={{ fontWeight: 500 }}>{billingNotification.message}</span>
            </div>
            <button 
              onClick={handleUpgrade}
              disabled={isUpgrading}
              style={{
                backgroundColor: billingNotification.type === 'EXPIRED' ? '#ef4444' : '#d97706',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 600,
                cursor: isUpgrading ? 'not-allowed' : 'pointer',
                opacity: isUpgrading ? 0.7 : 1,
                fontSize: '0.875rem'
              }}
            >
              {isUpgrading ? 'Cargando...' : (billingNotification.type === 'EXPIRED' ? 'Volver a PRO' : 'Renovar ahora')}
            </button>
          </div>
        )}

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
