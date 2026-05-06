import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Activity, ArrowLeft } from 'lucide-react';

const AdminLayout: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>
      {/* Navbar Minimalista */}
      <header style={{ 
        backgroundColor: '#fff', 
        borderBottom: '1px solid #e5e7eb',
        padding: '0 2rem',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Activity size={24} color="#4f46e5" />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', margin: 0 }}>
            AutoPostLab <span style={{ color: '#6b7280', fontWeight: 400 }}>Admin</span>
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link to="/dashboard" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            color: '#4b5563', 
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500
          }}>
            <ArrowLeft size={16} /> Volver al App
          </Link>
          <button 
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#ef4444',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
