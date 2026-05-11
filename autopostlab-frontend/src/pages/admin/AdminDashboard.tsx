import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Share2, Building, ShieldCheck, Activity } from 'lucide-react';
import api from '../../services/api';

interface GlobalStats {
  summary: {
    totalOrganizations: number;
    totalUsers: number;
    totalPosts: number;
    totalSocialAccounts: number;
  };
  health: string;
  timestamp: string;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/admin/stats');
        setStats(response.data);
      } catch (err) {
        setError('Error al conectar con los servicios administrativos.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Calculando métricas de red...</div>;
  if (error) return <div style={{ color: '#ef4444', padding: '2rem' }}>{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Resumen del Ecosistema</h2>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Vista consolidada de AutoPostLab en tiempo real.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.875rem' }}>Total Empresas</span>
            <Building size={20} color="#6366f1" />
          </div>
          <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0', color: '#1e293b' }}>
            {stats?.summary.totalOrganizations}
          </h3>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.875rem' }}>Total Usuarios</span>
            <Users size={20} color="#3b82f6" />
          </div>
          <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0', color: '#1e293b' }}>
            {stats?.summary.totalUsers}
          </h3>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.875rem' }}>Cuentas Conectadas</span>
            <Share2 size={20} color="#10b981" />
          </div>
          <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0', color: '#1e293b' }}>
            {stats?.summary.totalSocialAccounts}
          </h3>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.875rem' }}>Posts Totales</span>
            <Activity size={20} color="#f59e0b" />
          </div>
          <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0', color: '#1e293b' }}>
            {stats?.summary.totalPosts}
          </h3>
        </div>
      </div>

      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <ShieldCheck size={24} color="#3b82f6" />
        <div>
          <h4 style={{ margin: 0, color: '#1d4ed8', fontWeight: 600 }}>Estado del API Administrativo</h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#3b82f6' }}>El núcleo responde correctamente. Integridad de base de datos: {stats?.health}.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
