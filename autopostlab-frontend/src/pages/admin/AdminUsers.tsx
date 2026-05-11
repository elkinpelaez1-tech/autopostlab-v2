import React, { useState, useEffect } from 'react';
import { UserCheck, UserX, Shield, User as UserIcon } from 'lucide-react';
import api from '../../services/api';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  isBlocked: boolean;
  createdAt: string;
  organization: {
    id: string;
    name: string;
  } | null;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/admin/users');
        setUsers(data);
      } catch (error) {
        console.error('Failed to fetch system users', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Auditando base de usuarios...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Usuarios del Sistema</h2>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Monitoreo de identidades y accesos.</p>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead style={{ backgroundColor: '#f8fafc', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Nombre / Email</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Organización</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Rol</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Fecha Ingreso</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Seguridad</th>
              </tr>
            </thead>
            <tbody>
              {users.map((usr) => (
                <tr key={usr.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ fontWeight: 500, color: '#1e293b' }}>{usr.name || 'Sin Nombre'}</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{usr.email}</div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: '#475569' }}>
                    {usr.organization?.name || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Sin Org</span>}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      fontWeight: 600, 
                      fontSize: '0.7rem',
                      backgroundColor: usr.role === 'SUPER_ADMIN' ? '#fef2f2' : '#f0fdf4',
                      color: usr.role === 'SUPER_ADMIN' ? '#b91c1c' : '#15803d'
                    }}>
                      {usr.role === 'SUPER_ADMIN' ? <Shield size={12} /> : <UserIcon size={12} />}
                      {usr.role}
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>
                    {new Date(usr.createdAt).toLocaleDateString('es-CO')}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    {usr.isBlocked ? (
                      <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                        <UserX size={16} /> Bloqueado
                      </span>
                    ) : (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                        <UserCheck size={16} /> Activo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
