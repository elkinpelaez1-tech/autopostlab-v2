import React, { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Activity, ArrowLeft, LayoutDashboard, Building2, Users, BarChart2 } from 'lucide-react';

const AdminLayout: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('DEBUG LAYOUT - Current User Data:', user);
    console.log('DEBUG LAYOUT - User Role:', user?.role);
    
    // Si no está cargando y el usuario no es super admin, expulsarlo al dashboard normal
    if (!isLoading && user && user.role !== 'SUPER_ADMIN') {
      console.warn('Intento de acceso denegado: No eres SUPER_ADMIN');
      navigate('/dashboard');
    }
  }, [user, isLoading, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Resumen', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Empresas', path: '/admin/companies', icon: Building2 },
    { label: 'Usuarios', path: '/admin/users', icon: Users },
    { label: 'Métricas SaaS', path: '/admin/metrics', icon: BarChart2 },
  ];

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        Cargando consola administrativa...
      </div>
    );
  }

  // Doble blindaje: No renderizar nada si no es SUPER_ADMIN durante la redirección
  if (!user || user.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', fontFamily: '"Inter", sans-serif' }}>
      {/* Global Header */}
      <header style={{ 
        backgroundColor: '#1e293b', 
        padding: '0 2rem',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        color: '#f8fafc',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Activity size={24} color="#818cf8" />
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
            AutoPostLab <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.875rem', marginLeft: '4px' }}>SUPER ADMIN</span>
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link to="/dashboard" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            color: '#cbd5e1', 
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
          >
            <ArrowLeft size={16} /> Panel Usuario
          </Link>
          <button 
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#fca5a5',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sub Sidebar/Navbar */}
        <aside style={{ 
          width: '260px', 
          backgroundColor: '#ffffff', 
          borderRight: '1px solid #e2e8f0',
          padding: '1.5rem 1rem'
        }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: isActive ? '#4f46e5' : '#475569',
                    backgroundColor: isActive ? '#f5f3ff' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Contenido Principal */}
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
