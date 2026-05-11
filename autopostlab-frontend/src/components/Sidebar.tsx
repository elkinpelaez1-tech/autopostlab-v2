import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Send, 
  Share2, 
  Settings, 
  LogOut, 
  BarChart3,
  PlusSquare,
  Calendar,
  Image as ImageIcon,
  Video,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar: React.FC = () => {
  const { logout, user } = useAuth();

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <PlusSquare size={20} />, label: 'Nuevo Post', path: '/dashboard/create' },
    { icon: <Calendar size={20} />, label: 'Calendario', path: '/dashboard/calendar' },
    { icon: <Send size={20} />, label: 'Publicaciones', path: '/dashboard/posts' },
    { icon: <ImageIcon size={20} />, label: 'Fotos', path: '/dashboard/photos' },
    { icon: <Video size={20} />, label: 'Videos', path: '/dashboard/videos' },
    { icon: <Share2 size={20} />, label: 'Cuentas Sociales', path: '/dashboard/social-accounts' },
    { icon: <CreditCard size={20} />, label: 'Planes y Suscripción', path: '/dashboard/billing' },
    { icon: <BarChart3 size={20} />, label: 'Estadísticas', path: '/dashboard/analytics' },
  ];

  return (
    <aside className="sidebar-premium">
      <div className="sidebar-header">
        <img src="/src/assets/LOGO AUTOPOSTLAB.png" alt="AutopostLab" className="sidebar-logo" />
        <span className="brand-name">AutopostLab</span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path} 
            end={item.path === '/dashboard'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className={`nav-icon-wrapper ${isActive ? 'active' : ''}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        
        {/* Shortcut seguro al Panel de Control Superior */}
        {user?.role === 'SUPER_ADMIN' && (
          <NavLink 
            to="/admin" 
            className="nav-item"
            style={{ marginTop: '2rem', backgroundColor: '#fef2f2', border: '1px dashed #ef4444', color: '#b91c1c' }}
          >
            <span className="nav-icon-wrapper" style={{ color: '#ef4444' }}>
              <Settings size={20} />
            </span>
            <span style={{ fontWeight: 600 }}>PANEL ADMIN</span>
          </NavLink>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="user-avatar-premium image" />
          ) : (
            <div className="user-avatar-premium">{user?.name?.charAt(0) || 'U'}</div>
          )}
          <div className="user-info">
            <p className="user-name-premium">{user?.name || 'Elkin'}</p>
            <p className="user-email-premium">{user?.email || 'elkin@example.com'}</p>
          </div>
        </div>
        <button onClick={logout} className="logout-btn">
          <LogOut size={18} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
