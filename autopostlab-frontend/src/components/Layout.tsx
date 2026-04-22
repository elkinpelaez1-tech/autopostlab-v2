import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Search, Bell, Settings, User, LogOut, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
