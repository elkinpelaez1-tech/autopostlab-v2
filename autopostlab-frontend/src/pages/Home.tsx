import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Share2, Calendar, BarChart3, ChevronRight, Check } from 'lucide-react';

const Home: React.FC = () => {
  return (
    <div className="landing-page" style={{ background: 'var(--bg-main)', color: '#fff' }}>
      {/* Navigation */}
      <nav className="landing-nav" style={{ background: 'rgba(6, 6, 8, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="container">
          <div className="nav-content">
            <div className="logo">
              <img src="/src/assets/LOGO AUTOPOSTLAB.png" alt="AutopostLab" className="logo-img" />
              <span style={{ color: '#fff' }}>AutopostLab</span>
            </div>
            <div className="nav-links">
              <Link to="/login" className="btn-login-nav" style={{ color: '#94a3b8' }}>Entrar</Link>
              <Link to="/login" className="btn-get-started">Probar Gratis</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(170, 59, 255, 0.15) 0%, transparent 50%)' }}>
        <div className="container">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="hero-content"
          >
            <span className="badge" style={{ background: 'rgba(170, 59, 255, 0.1)', border: '1px solid rgba(170, 59, 255, 0.2)' }}>
              Nueva Era de Automatización
            </span>
            <h1 style={{ color: '#fff' }}>Lleva tus redes sociales al <span className="text-gradient">siguiente nivel</span></h1>
            <p style={{ color: '#94a3b8' }}>
              Programa, publica y analiza tus contenidos en todas tus plataformas desde un solo lugar. 
              Ahorra tiempo y haz crecer tu comunidad con AutopostLab.
            </p>
            <div className="hero-actions">
              <Link to="/login" className="btn-hero-primary">
                Comenzar Ahora <ChevronRight size={20} />
              </Link>
              <a href="#features" className="btn-hero-secondary" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}>
                Saber más
              </a>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="hero-dashboard-preview"
          >
            <div className="glass-card preview-card" style={{ background: '#151518', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="preview-header" style={{ background: '#0f0f12', borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="dot red"></div>
                <div className="dot yellow"></div>
                <div className="dot green"></div>
              </div>
              <div className="preview-body">
                <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop" alt="Dashboard Preview" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="features" style={{ background: '#060608' }}>
        <div className="container">
          <div className="section-title">
            <h2 style={{ color: '#fff' }}>Potencia tu presencia digital</h2>
            <p style={{ color: '#94a3b8' }}>Herramientas diseñadas para creadores de contenido y agencias.</p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card" style={{ background: '#0f0f12', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="feature-icon"><Share2 /></div>
              <h3 style={{ color: '#fff' }}>Multi-Plataforma</h3>
              <p style={{ color: '#64748b' }}>Conecta Instagram, Facebook, TikTok y más en segundos.</p>
            </div>
            <div className="feature-card" style={{ background: '#0f0f12', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="feature-icon"><Calendar /></div>
              <h3 style={{ color: '#fff' }}>Calendario Inteligente</h3>
              <p style={{ color: '#64748b' }}>Visualiza y organiza tus publicaciones con arrastrar y soltar.</p>
            </div>
            <div className="feature-card" style={{ background: '#0f0f12', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="feature-icon"><BarChart3 /></div>
              <h3 style={{ color: '#fff' }}>Estadísticas Reales</h3>
              <p style={{ color: '#64748b' }}>Mide el impacto de cada publicación con métricas detalladas.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer" style={{ background: '#060608', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo" style={{ color: '#fff' }}>AutopostLab</div>
            <p style={{ color: '#64748b' }}>&copy; 2026 AutopostLab. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
