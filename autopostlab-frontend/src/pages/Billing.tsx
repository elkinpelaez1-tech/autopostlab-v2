import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CheckCircle2, Zap, Building2, AlertCircle } from 'lucide-react';

const Billing: React.FC = () => {
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Fallback seguro si user no está listo
  const plan = user?.plan || 'FREE';
  const expiresAt = user?.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString() : null;
  const isExpired = user?.plan === 'FREE' && user?.hadPro;

  // Lógica de upgrade dummy (visual)
  const handleUpgradeClick = (selectedPlan: string) => {
    setIsUpgrading(true);
    console.log(`Iniciando upgrade visual para plan: ${selectedPlan}`);
    // Simulamos una demora para mostrar el estado de carga
    setTimeout(() => {
      alert(`Flujo de upgrade a ${selectedPlan} simulado. La lógica de Wompi se integrará luego.`);
      setIsUpgrading(false);
    }, 1000);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <div>
          <h2>Planes y Suscripción</h2>
          <p>Gestiona tu plan actual, límites y opciones de facturación.</p>
        </div>
      </div>

      {/* Banner de Estado Actual */}
      <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
            padding: '1rem', 
            borderRadius: '50%',
            color: 'var(--accent)'
          }}>
            <CreditCard size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Tu plan actual es <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{plan}</span>
            </h3>
            {plan === 'PRO' && expiresAt && (
              <p style={{ color: '#4b5563' }}>
                Tu suscripción PRO está activa y vence el <strong>{expiresAt}</strong>.
              </p>
            )}
            {plan === 'FREE' && !isExpired && (
              <p style={{ color: '#4b5563' }}>
                Estás en el plan básico gratuito. Mejora tu plan para obtener más funcionalidades.
              </p>
            )}
            {isExpired && (
              <p style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                Tu suscripción expiró. Has vuelto al plan FREE. Renueva para recuperar acceso completo.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tarjetas de Precios */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem' 
      }}>
        
        {/* PLAN FREE */}
        <div className="card" style={{ 
          border: plan === 'FREE' ? '2px solid var(--accent)' : '1px solid #e5e7eb',
          position: 'relative'
        }}>
          {plan === 'FREE' && (
            <div style={{
              position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
              backgroundColor: 'var(--accent)', color: 'white', padding: '0.25rem 1rem',
              borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600
            }}>
              PLAN ACTUAL
            </div>
          )}
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Gratis</h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Ideal para empezar a organizar tu contenido.</p>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>$0 <span style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 400 }}>/ mes</span></div>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#10b981" /> 3 Cuentas Sociales Mínimas</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#10b981" /> 10 Publicaciones mensuales</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#10b981" /> Calendario Básico</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#9ca3af' }}><CheckCircle2 size={18} color="#d1d5db" /> Analytics Avanzado</li>
          </ul>

          <button 
            disabled={plan === 'FREE'}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 600,
              backgroundColor: plan === 'FREE' ? '#f3f4f6' : 'white',
              color: plan === 'FREE' ? '#9ca3af' : '#374151',
              border: '1px solid #d1d5db',
              cursor: plan === 'FREE' ? 'default' : 'pointer'
            }}
          >
            {plan === 'FREE' ? 'Plan Activo' : 'Elegir Gratis'}
          </button>
        </div>

        {/* PLAN PRO */}
        <div className="card" style={{ 
          border: plan === 'PRO' ? '2px solid var(--accent)' : '1px solid #e5e7eb',
          backgroundColor: '#eff6ff',
          position: 'relative'
        }}>
          {plan === 'PRO' && (
            <div style={{
              position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
              backgroundColor: 'var(--accent)', color: 'white', padding: '0.25rem 1rem',
              borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600
            }}>
              PLAN ACTUAL
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e3a8a' }}>PRO</h3>
            <Zap size={24} color="#3b82f6" />
          </div>
          <p style={{ color: '#3b82f6', marginBottom: '1.5rem' }}>Para creadores de contenido serios.</p>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1e3a8a' }}>$79.000 <span style={{ fontSize: '1rem', color: '#3b82f6', fontWeight: 400 }}>/ mes</span></div>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', color: '#1e3a8a' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#3b82f6" /> Cuentas Sociales Ilimitadas</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#3b82f6" /> Publicaciones Ilimitadas</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#3b82f6" /> Analytics Avanzado</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#3b82f6" /> Soporte Prioritario</li>
          </ul>

          <button 
            onClick={() => handleUpgradeClick('PRO')}
            disabled={plan === 'PRO' || isUpgrading}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 600,
              backgroundColor: plan === 'PRO' ? '#bfdbfe' : '#3b82f6',
              color: plan === 'PRO' ? '#1e3a8a' : 'white',
              border: 'none',
              cursor: plan === 'PRO' ? 'default' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {isUpgrading ? 'Cargando...' : (plan === 'PRO' ? 'Plan Activo' : 'Upgrade a PRO')}
          </button>
        </div>

        {/* PLAN AGENCY */}
        <div className="card" style={{ 
          border: plan === 'AGENCY' ? '2px solid var(--accent)' : '1px solid #e5e7eb',
          position: 'relative'
        }}>
          {plan === 'AGENCY' && (
            <div style={{
              position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
              backgroundColor: 'var(--accent)', color: 'white', padding: '0.25rem 1rem',
              borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600
            }}>
              PLAN ACTUAL
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Agencia</h3>
            <Building2 size={24} color="#6b7280" />
          </div>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Para equipos y agencias de marketing.</p>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>$249.000 <span style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 400 }}>/ mes</span></div>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#10b981" /> Todo lo de PRO</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#10b981" /> Múltiples Workspaces</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#10b981" /> Roles y Permisos de Equipo</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={18} color="#10b981" /> Marca Blanca (Whitelabel)</li>
          </ul>

          <button 
            onClick={() => handleUpgradeClick('AGENCY')}
            disabled={plan === 'AGENCY' || isUpgrading}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 600,
              backgroundColor: plan === 'AGENCY' ? '#f3f4f6' : 'white',
              color: plan === 'AGENCY' ? '#9ca3af' : '#111827',
              border: '2px solid #111827',
              cursor: plan === 'AGENCY' ? 'default' : 'pointer'
            }}
          >
             {isUpgrading ? 'Cargando...' : (plan === 'AGENCY' ? 'Plan Activo' : 'Upgrade a Agencia')}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Billing;
