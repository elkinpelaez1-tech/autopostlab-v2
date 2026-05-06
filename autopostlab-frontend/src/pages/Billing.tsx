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
    setTimeout(() => {
      alert(`Flujo de upgrade a ${selectedPlan} simulado. La lógica de Wompi se integrará luego.`);
      setIsUpgrading(false);
    }, 1000);
  };

  return (
    <div className="settings-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Estilos CSS Embebidos Premium */}
      <style>{`
        .pricing-header-premium {
          margin-bottom: 2.5rem;
        }
        .pricing-grid-premium {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 2rem;
          align-items: stretch;
          margin-top: 1rem;
        }
        .pricing-card-premium {
          background: #ffffff;
          border-radius: 24px;
          padding: 3rem 2.2rem;
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          position: relative;
          color: #1f2937;
        }
        .pricing-card-premium:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
        }
        .pricing-card-premium.recommended {
          background: linear-gradient(145deg, #1e3a8a 0%, #3b82f6 100%);
          color: #ffffff;
          border: none;
          box-shadow: 0 20px 40px rgba(59, 130, 246, 0.15);
          transform: scale(1.03);
          z-index: 2;
        }
        .pricing-card-premium.recommended:hover {
          transform: scale(1.05) translateY(-8px);
          box-shadow: 0 25px 50px rgba(59, 130, 246, 0.25);
        }
        .pricing-card-premium.recommended .plan-title-premium,
        .pricing-card-premium.recommended .plan-desc-premium,
        .pricing-card-premium.recommended .plan-price-premium,
        .pricing-card-premium.recommended .feature-item-premium {
          color: #ffffff !important;
        }
        .recommended-badge-premium {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          background: #10b981;
          color: white;
          padding: 0.35rem 1.25rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          text-transform: uppercase;
        }
        .active-badge-premium {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          background: #4A7C93;
          color: white;
          padding: 0.35rem 1.25rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          box-shadow: 0 4px 12px rgba(74, 124, 147, 0.3);
          text-transform: uppercase;
        }
        .plan-title-premium {
          font-size: 1.6rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 0.5rem;
        }
        .plan-desc-premium {
          font-size: 0.95rem;
          color: #6b7280;
          margin-bottom: 2rem;
          line-height: 1.4;
          min-height: 2.8rem;
        }
        .plan-price-premium {
          font-size: 2.8rem;
          font-weight: 800;
          color: #111827;
          margin-bottom: 2.5rem;
          display: flex;
          align-items: baseline;
        }
        .plan-price-premium span {
          font-size: 1rem;
          font-weight: 500;
          color: #6b7280;
          margin-left: 0.25rem;
        }
        .features-list-premium {
          list-style: none;
          padding: 0;
          margin: 0 0 3rem 0;
          flex-grow: 1;
        }
        .feature-item-premium {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.1rem;
          font-size: 0.95rem;
          color: #4b5563;
        }
        .plan-btn-premium {
          width: 100%;
          padding: 0.9rem;
          border-radius: 14px;
          font-weight: 600;
          font-size: 1rem;
          border: 2px solid #e5e7eb;
          background: white;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .plan-btn-premium:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }
        .plan-btn-premium.primary {
          background: #3b82f6;
          color: white;
          border: none;
        }
        .plan-btn-premium.primary:hover {
          background: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }
        .recommended .plan-btn-premium.primary {
          background: white;
          color: #2563eb;
        }
        .recommended .plan-btn-premium.primary:hover {
          background: #f3f4f6;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
        }
        .plan-btn-premium.active-btn {
          background: #f3f4f6;
          color: #9ca3af;
          border-color: #e5e7eb;
          cursor: default;
        }
        .plan-btn-premium.active-btn:hover {
          background: #f3f4f6;
          transform: none;
          box-shadow: none;
        }
      `}</style>

      <div className="pricing-header-premium">
        <div>
          <h2 style={{ color: 'white' }}>Planes y Suscripción</h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Gestiona tu plan actual, límites y opciones de facturación.</p>
        </div>
      </div>

      {/* Banner de Estado Actual */}
      <div className="card" style={{ marginBottom: '2.5rem', borderLeft: '4px solid var(--accent)', background: 'white', color: '#1f2937' }}>
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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem', color: '#111827' }}>
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
      <div className="pricing-grid-premium">
        
        {/* PLAN FREE */}
        <div className="pricing-card-premium">
          {plan === 'FREE' && (
            <div className="active-badge-premium">
              Plan Activo
            </div>
          )}
          <h3 className="plan-title-premium">Gratis</h3>
          <p className="plan-desc-premium">Ideal para empezar a organizar tu contenido de manera sencilla.</p>
          <div className="plan-price-premium">$0 <span>/ mes</span></div>
          
          <ul className="features-list-premium">
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> 1 Cuenta Social</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> 10 Publicaciones mensuales</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Calendario Básico</li>
            <li className="feature-item-premium" style={{ color: '#9ca3af', textDecoration: 'line-through' }}><CheckCircle2 size={18} color="#d1d5db" /> Analytics Avanzado</li>
          </ul>

          <button 
            disabled={plan === 'FREE'}
            className={`plan-btn-premium ${plan === 'FREE' ? 'active-btn' : ''}`}
          >
            {plan === 'FREE' ? 'Plan Activo' : 'Elegir Gratis'}
          </button>
        </div>

        {/* PLAN PRO */}
        <div className="pricing-card-premium recommended">
          <div className="recommended-badge-premium">
            Recomendado
          </div>
          {plan === 'PRO' && (
            <div className="active-badge-premium" style={{ top: '24px' }}>
              Plan Activo
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="plan-title-premium">PRO</h3>
            <Zap size={24} color="#ffffff" />
          </div>
          <p className="plan-desc-premium">Para creadores de contenido serios y profesionales de marketing.</p>
          <div className="plan-price-premium">$79.000 <span>/ mes</span></div>
          
          <ul className="features-list-premium">
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#ffffff" /> Cuentas Sociales Ilimitadas</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#ffffff" /> Publicaciones Ilimitadas</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#ffffff" /> Analytics Avanzado</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#ffffff" /> Soporte Prioritario</li>
          </ul>

          <button 
            onClick={() => handleUpgradeClick('PRO')}
            disabled={plan === 'PRO' || isUpgrading}
            className={`plan-btn-premium primary ${plan === 'PRO' ? 'active-btn' : ''}`}
          >
            {isUpgrading ? 'Cargando...' : (plan === 'PRO' ? 'Plan Activo' : 'Upgrade a PRO')}
          </button>
        </div>

        {/* PLAN AGENCY */}
        <div className="pricing-card-premium">
          {plan === 'AGENCY' && (
            <div className="active-badge-premium">
              Plan Activo
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="plan-title-premium">Agencia</h3>
            <Building2 size={24} color="#6b7280" />
          </div>
          <p className="plan-desc-premium">Para equipos, marcas en expansión y agencias de marketing.</p>
          <div className="plan-price-premium">$249.000 <span>/ mes</span></div>
          
          <ul className="features-list-premium">
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Todo lo de PRO</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Múltiples Workspaces</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Roles y Permisos de Equipo</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Marca Blanca (Whitelabel)</li>
          </ul>

          <button 
            onClick={() => handleUpgradeClick('AGENCY')}
            disabled={plan === 'AGENCY' || isUpgrading}
            className={`plan-btn-premium ${plan === 'AGENCY' ? 'active-btn' : ''}`}
            style={{ borderColor: '#111827', color: '#111827' }}
          >
             {isUpgrading ? 'Cargando...' : (plan === 'AGENCY' ? 'Plan Activo' : 'Upgrade a Agencia')}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Billing;
