import React, { useState, useEffect } from 'react';
import { DollarSign, Users, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface Metrics {
  totalOrganizations: number;
  totalFreeOrganizations: number;
  totalProOrganizations: number;
  totalAgencyOrganizations: number;
  monthlyRecurringRevenue: number;
  annualRunRate: number;
  conversionRate: number;
  expiringSoon: number;
  expiredSubscriptions: number;
}

interface Subscription {
  id: string;
  organizationName: string;
  currentPlan: string;
  expirationDate: string | null;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
}

const AdminMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        
        const [metricsRes, subsRes] = await Promise.all([
          api.get('/billing/metrics', { headers }),
          api.get('/billing/subscriptions', { headers })
        ]);

        setMetrics(metricsRes.data);
        setSubscriptions(subsRes.data);
      } catch (err: any) {
        if (err.response?.status === 403) {
          setError('No tienes permisos de administrador global para ver esta página.');
        } else {
          setError('Error al cargar las métricas. Verifica tu conexión.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando métricas...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        <AlertCircle size={48} style={{ margin: '0 auto 1rem' }} />
        <h2>Acceso Denegado</h2>
        <p>{error}</p>
      </div>
    );
  }

  // Formatters
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'percent',
      maximumFractionDigits: 1
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={12} /> Activa</span>;
      case 'EXPIRING_SOON':
        return <span style={{ background: '#fef9c3', color: '#854d0e', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /> Vence pronto</span>;
      case 'EXPIRED':
        return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={12} /> Expirada</span>;
      default:
        return <span>{status}</span>;
    }
  };

  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>Métricas SaaS</h2>
        <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>Monitoreo de crecimiento y revenue.</p>
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* MRR Card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>MRR (Ingreso Mensual)</span>
            <DollarSign size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>
            {formatCurrency(metrics?.monthlyRecurringRevenue || 0)}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            ARR: {formatCurrency(metrics?.annualRunRate || 0)}
          </div>
        </div>

        {/* PRO Users Card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Organizaciones PRO</span>
            <Users size={20} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>
            {metrics?.totalProOrganizations || 0}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            de {metrics?.totalOrganizations} orgs. registradas
          </div>
        </div>

        {/* Conversion Rate Card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Tasa de Conversión</span>
            <TrendingUp size={20} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>
            {formatPercent(metrics?.conversionRate || 0)}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Basado en Free + Pro
          </div>
        </div>

        {/* Churn Risk Card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Retención</span>
            <AlertCircle size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>
            {metrics?.expiringSoon || 0} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#6b7280' }}>por vencer</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {metrics?.expiredSubscriptions} suscripciones caídas
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>Estado de Suscripciones</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f9fafb', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <tr>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>Empresa</th>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>Plan</th>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>Vencimiento</th>
                <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>Estado</th>
              </tr>
            </thead>
            <tbody style={{ divideY: '1px solid #e5e7eb' }}>
              {subscriptions.map((sub, idx) => (
                <tr key={sub.id} style={{ borderBottom: idx === subscriptions.length - 1 ? 'none' : '1px solid #e5e7eb' }}>
                  <td style={{ padding: '1rem 1.5rem', color: '#111827', fontWeight: 500 }}>{sub.organizationName}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '0.375rem', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      backgroundColor: sub.currentPlan === 'PRO' ? '#e0e7ff' : '#f3f4f6',
                      color: sub.currentPlan === 'PRO' ? '#4338ca' : '#4b5563'
                    }}>
                      {sub.currentPlan}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: '#6b7280' }}>
                    {formatDate(sub.expirationDate)}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    {getStatusBadge(sub.status)}
                  </td>
                </tr>
              ))}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    No hay organizaciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminMetrics;
