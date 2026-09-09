import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CheckCircle2, Zap, Building2, AlertCircle } from 'lucide-react';
import api from '../services/api';

const Billing: React.FC = () => {
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
const [showProModal, setShowProModal] = useState(false);





  const plan = user?.plan || 'FREE';
  const expiresAt = user?.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString() : null;
  const isExpired = user?.plan === 'FREE' && user?.hadPro;

  // Lógica de upgrade real para PRO
  const handleUpgradeClick = async (selectedPlan: string) => {
    if (selectedPlan !== 'PRO') {
      alert('Solo se soporta el plan PRO por ahora');
      return;
    }

    setIsUpgrading(true);
    setErrorMsg(null);

    try {
      const response = await api.post('/billing/create-checkout', { plan: 'PRO' });
      if (response.data && response.data.checkoutUrl) {
        // Redirección directa a la pasarela segura de Wompi
        window.location.href = response.data.checkoutUrl;
      } else {
        throw new Error('No se recibió la URL de checkout de Wompi desde el backend');
      }
    } catch (error: any) {
      console.error('Error al generar checkout de Wompi:', error);
      const message = error.response?.data?.message || error.message || 'Error desconocido';
      setErrorMsg(`No se pudo iniciar la compra: ${message}`);
    } finally {
      setIsUpgrading(false);
    }
  };

  return ( <> 
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

.pro-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

          .pro-modal-overlay .pro-modal-card {
            width: min(560px, calc(100vw - 32px)) !important;
            max-width: 560px !important;
            box-sizing: border-box;
            background: #ffffff;
            color: #111827;
            padding: 24px;
            border-radius: 24px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          }

        .pro-modal-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .pro-modal-header img {
          max-width: 120px;
          margin-bottom: 0.5rem;
        }
        .pro-modal-title {
          font-size: 1.8rem;
          font-weight: 700;
          color: #111827;
        }
        .pro-modal-section {
          margin-bottom: 16px;
        }
                  .pro-modal-overlay .pro-modal-card p { color: #374151; }
          .pro-modal-overlay .pro-modal-card h2,
          .pro-modal-overlay .pro-modal-card h4 { color: #111827; }
          .pro-modal-overlay .pro-modal-card .steps-list li { color: #374151; }
          .pro-modal-overlay .pro-modal-card .steps-list li strong { color: #111827; }


        .bank-card {
          background: #c62828; /* Davivienda red */
          color: #fff;
          border-radius: 12px;
          padding: 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .bank-card strong {
          color: #fff;
        }
        .steps-list {
          counter-reset: step;
          list-style: none;
          padding-left: 0;
        }
        .steps-list li {
          margin-bottom: 1rem;
          padding-left: 2rem;
          position: relative;
        }
        .steps-list li::before {
          counter-increment: step;
          content: counter(step);
          position: absolute;
          left: 0;
          top: 0;
          width: 1.5rem;
          height: 1.5rem;
          background: #3b82f6;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }
        .breb-section {
          background: #f9fafb;
          color: #374151;
          border-left: 4px solid #c62828;
          padding: 1rem;
          border-radius: 8px;
        }
        .breb-section strong {
          color: #c62828;
        }
      `}</style>

      <div className="pricing-header-premium">
        <div>
          <h2 style={{ color: 'white' }}>Planes y Suscripción</h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Gestiona tu plan actual, límites y opciones de facturación.</p>
        </div>
      </div>

      {/* Mensaje de Error Amigable si falla el Checkout */}
      {errorMsg && (
        <div className="card" style={{ marginBottom: '2.5rem', borderLeft: '4px solid #ef4444', background: 'white', color: '#1f2937' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              padding: '1rem', 
              borderRadius: '50%',
              color: '#ef4444'
            }}>
              <AlertCircle size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem', color: '#111827' }}>
                No pudimos procesar tu solicitud
              </h3>
              <p style={{ color: '#ef4444', fontWeight: 500 }}>
                {errorMsg}
              </p>
            </div>
          </div>
        </div>
      )}

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
          <p className="plan-desc-premium">Para comenzar a gestionar tus redes sociales.</p>
          <div className="plan-price-premium">$0 <span>/ mes</span></div>
          
          <ul className="features-list-premium">
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> 1 usuario</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> 1 cuenta social</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> 5 publicaciones mensuales</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Dashboard básico</li>
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
            <h3 className="plan-title-premium">Pro</h3>
            <Zap size={24} color="#ffffff" />
          </div>
          <p className="plan-desc-premium">Ideal para profesionales y marcas en crecimiento.</p>
          <div className="plan-price-premium">$45.000 <span>/ mes</span></div>
          
          <ul className="features-list-premium">
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#ffffff" /> 2 usuarios</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#ffffff" /> 4 cuentas sociales</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#ffffff" /> Publicaciones ilimitadas</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#ffffff" /> Métricas avanzadas</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#ffffff" /> Soporte prioritario</li>
          </ul>

            <button
              onClick={() => {
                if (plan !== 'PRO') {
                  setShowProModal(true);
                }
              }}
              disabled={plan === 'PRO'}
              className={`plan-btn-premium primary ${plan === 'PRO' ? 'active-btn' : ''}`}
            >
              {plan === 'PRO' ? 'Plan Activo' : 'Elegir Pro'}
            </button>
          </div> {/* close pricing-grid-premium */}
        </div> {/* close settings-container */}
{showProModal && createPortal(
  <div className="pro-modal-overlay" onClick={() => setShowProModal(false)}>
  <div className="pro-modal-card" onClick={e => e.stopPropagation()}>
    <div className="pro-modal-header">
      <img src="/logo.png" alt="AutoPostLab logo" />
      <h2 className="pro-modal-title">Activa tu Plan Pro</h2>
    </div>
    <p className="pro-modal-section">
      Realiza el pago por transferencia a la cuenta de Davivienda y comienza a disfrutar de todas las funciones de AutoPostLab.
    </p>
    <div className="bank-card">
      <strong>DAVIVIENDA</strong>
      <p><strong>Tipo de cuenta:</strong> Cuenta de Ahorros</p>
      <p><strong>Número de cuenta:</strong> 037470250590</p>
      <p><strong>A nombre de:</strong> ELKIN PELAEZ</p>
    </div>
      <p className="pro-modal-section">
        Una vez realices el pago, envíanos el comprobante para activar tu cuenta.
      </p>
    <h4 className="pro-modal-section">¿Cómo activar tu plan?</h4>
    <ol className="steps-list">
      <li><strong>Realiza la transferencia</strong><br/>Desde tu app de Davivienda a la cuenta de ahorros.</li>
      <li><strong>Envía tu comprobante</strong><br/>Al correo elkinpelaez1@gmail.com</li>
      <li><strong>¡Listo!</strong><br/>Te activaremos tu Plan Pro en el menor tiempo posible.</li>
    </ol>
    <p className="pro-modal-section">
      Normalmente la activación se realiza en menos de 1 hora.
    </p>
    <div className="breb-section">
      También puedes Transferir a través de <strong>@PLATA3117287366</strong>
    </div>
    <button className="plan-btn-premium primary" onClick={() => setShowProModal(false)}>
      Entendido, realizaré el pago
    </button>
  </div>
</div>



, document.body)}
        </div>

        {/* PLAN AGENCY */}
        <div className="pricing-card-premium">
          {plan === 'AGENCY' && (
            <div className="active-badge-premium">
              Plan Activo
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="plan-title-premium">Agency</h3>
            <Building2 size={24} color="#6b7280" />
          </div>
          <p className="plan-desc-premium">Para agencias y equipos que necesitan máxima capacidad.</p>
          <div className="plan-price-premium">$105.000 <span>/ mes</span></div>
          
          <ul className="features-list-premium">
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Multiusuario</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> 4 cuentas sociales</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Publicaciones ilimitadas</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Métricas avanzadas</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Soporte prioritario</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> API / integraciones</li>
            <li className="feature-item-premium"><CheckCircle2 size={18} color="#10b981" /> Soporte dedicado 24/7</li>
          </ul>

          <button 
            onClick={() => handleUpgradeClick('AGENCY')}
            disabled={plan === 'AGENCY' || isUpgrading}
            className={`plan-btn-premium ${plan === 'AGENCY' ? 'active-btn' : ''}`}
            style={{ borderColor: '#111827', color: '#111827' }}
          >
              {isUpgrading ? 'Cargando...' : (plan === 'AGENCY' ? 'Plan Activo' : 'Elegir Agency')}
          </button>
        </div>

      
    
  </>
);
};

export default Billing;
