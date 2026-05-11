import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Calendar } from 'lucide-react';
import api from '../../services/api';

interface CompanyStats {
  usersCount: number;
  postsCount: number;
  socialAccountsCount: number;
}

interface Company {
  id: string;
  name: string;
  plan: string;
  isSuspended: boolean;
  planExpiresAt: string | null;
  createdAt: string;
  stats: CompanyStats;
}

const AdminCompanies: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/admin/companies');
        setCompanies(data);
      } catch (error) {
        console.error('Failed to load companies', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No expira';
    return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando listado corporativo...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Empresas Registradas</h2>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Detalle de uso y suscripción por organización.</p>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead style={{ backgroundColor: '#f8fafc', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Organización</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Plan</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Stats (Usr/Post/Soc)</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Creación</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Vencimiento</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: 500, color: '#1e293b' }}>{c.name}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.625rem', 
                      borderRadius: '6px', 
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      backgroundColor: c.plan === 'PRO' ? '#eef2ff' : '#f1f5f9',
                      color: c.plan === 'PRO' ? '#4f46e5' : '#475569'
                    }}>
                      {c.plan}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: '#475569' }}>
                    <span title="Usuarios">{c.stats.usersCount}</span> / <span title="Posts">{c.stats.postsCount}</span> / <span title="Redes">{c.stats.socialAccountsCount}</span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>{formatDate(c.createdAt)}</td>
                  <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={14} /> {formatDate(c.planExpiresAt)}
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    {c.isSuspended ? (
                      <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                        <XCircle size={16} /> Suspendida
                      </span>
                    ) : (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                        <CheckCircle2 size={16} /> Activa
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No se encontraron empresas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCompanies;
