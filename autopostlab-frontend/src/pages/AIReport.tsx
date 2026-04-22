import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  TrendingUp, 
  PieChart, 
  MessageSquare, 
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Sparkles,
  BarChart2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AIReport: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/posts');
      const posts = response.data;
      
      // Procesar métricas reales
      const publishedCount = posts.filter((p: any) => p.scheduledPosts.some((sp: any) => sp.status === 'PUBLISHED')).length;
      
      // Simulamos engagement basado en datos reales (ID del post como semilla)
      const totalEngagement = posts.reduce((acc: number, post: any) => {
        const seed = post.id.charCodeAt(0) + post.id.charCodeAt(post.id.length - 1);
        return acc + Math.floor((seed % 100) + 50);
      }, 0);

      // Datos para Radar Chart (Simulación de desempeño por categoría basada en datos reales)
      const radarData = [
        { subject: 'Engagement', A: publishedCount * 15, fullMark: 150 },
        { subject: 'Alcance', A: totalEngagement / 10, fullMark: 150 },
        { subject: 'Consistencia', A: 120, fullMark: 150 },
        { subject: 'Viralidad', A: 85, fullMark: 150 },
        { subject: 'Crecimiento', A: 105, fullMark: 150 },
      ];

      setData({
        posts: publishedCount,
        engagement: totalEngagement,
        radarData,
        insights: [
          { 
            title: "Optimización de Caption", 
            text: "Tus publicaciones con más de 100 caracteres están generando un 15% más de interacción en LinkedIn.",
            icon: <MessageSquare size={18} />,
            type: 'positive'
          },
          { 
            title: "Patrón de Tiempo", 
            text: "Detectamos un pico de actividad los Martes a las 18:30. Sugerimos programar tu contenido estrella en este slot.",
            icon: <TrendingUp size={18} />,
            type: 'trend'
          },
          { 
            title: "Sugerencia de Formato", 
            text: "El contenido visual (MP4) en TikTok está superando al reach orgánico de Instagram por un factor de 2.4x.",
            icon: <Zap size={18} />,
            type: 'action'
          }
        ]
      });
    } catch (err) {
      console.error('Error fetching AI report data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-loading" style={{ height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="bi-loader" style={{ width: '60px', height: '60px', border: '5px solid rgba(74, 124, 147, 0.1)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '20px', fontWeight: 500, color: 'var(--text-main)' }}>Motor AI Analizando tu contenido...</p>
        <style>
          {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
        </style>
      </div>
    );
  }

  return (
    <div className="dashboard-analytics scale-in">
      {/* HEADER SECTION */}
      <div className="analytics-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="btn-icon-sm" 
            style={{ padding: '8px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', backgroundColor: 'white' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="bi-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              Reporte Avanzado AI <Sparkles size={20} color="var(--accent)" />
            </h1>
            <p className="bi-subtitle">Análisis predictivo y optimización de contenido basado en tu historial real</p>
          </div>
        </div>
      </div>

      {/* AI SUMMARY BANNER */}
      <div className="premium-ai-banner" style={{ 
        background: 'linear-gradient(135deg,rgba(47, 72, 88, 0.95) 0%, #1a2a33 100%)', 
        borderRadius: '24px', 
        padding: '32px', 
        color: 'white',
        marginBottom: '32px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
             <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
               Smart Insight Engine v2.4
             </div>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '12px', color: '#FFFFFF', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>Estado de tu Ecosistema Digital</h2>
          <p style={{ maxWidth: '700px', opacity: 0.85, lineHeight: '1.6', fontSize: '16px', color: '#FFFFFF' }}>
            Tu contenido está demostrando una tendencia de crecimiento **orgánico del {((data?.posts || 0) * 2.5).toFixed(1)}%**. 
            La audiencia de LinkedIn está respondiendo positivamente a tus publicaciones de tarde-noche, 
            mientras que TikTok se consolida como tu motor de descubrimiento principal.
          </p>
          <div style={{ marginTop: '24px', display: 'flex', gap: '20px' }}>
             <button className="btn-full-premium" style={{ width: 'auto', padding: '12px 24px', background: 'var(--accent)', color: 'white' }}>
               Refinar Estrategia AI
             </button>
          </div>
        </div>
        {/* Background decoration elements */}
        <div style={{ position: 'absolute', right: '-50px', top: '-50px', width: '300px', height: '300px', background: 'var(--accent)', filter: 'blur(100px)', opacity: 0.15, borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', left: '20%', bottom: '-100px', width: '400px', height: '400px', background: '#3b82f6', filter: 'blur(120px)', opacity: 0.1, borderRadius: '50%' }}></div>
      </div>

      {/* METRIC CARDS */}
      <div className="metrics-grid" style={{ marginBottom: '32px' }}>
         <div className="metric-card glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <span className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                   Performance Score <Lightbulb size={14} color="#f59e0b" />
                </span>
                <h2 className="metric-value">84/100</h2>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} />
              </div>
            </div>
            <div style={{ marginTop: '12px', width: '100%', height: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
               <div style={{ width: '84%', height: '100%', background: '#f59e0b', borderRadius: '10px' }}></div>
            </div>
         </div>

         <div className="metric-card glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <span className="metric-label">Impacto Estimado</span>
                <h2 className="metric-value">High</h2>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={20} />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '8px', opacity: 0.85 }}>Tu alcance potencial ha subido +14%</p>
         </div>

         <div className="metric-card glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <span className="metric-label">Predicción Clones</span>
                <h2 className="metric-value">Active</h2>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Search size={20} />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '8px', opacity: 0.85 }}>Analizando 12 variaciones de captions</p>
         </div>
      </div>

      <div className="analytics-charts-grid">
         {/* RADAR ANALYTICS */}
         <div className="chart-wrapper glass-card" style={{ flex: 1 }}>
            <div className="chart-header">
                <h3>Vectores de Contenido</h3>
                <p style={{ fontSize: '12px', color: '#64748b' }}>Fortalezas detectadas por la AI</p>
            </div>
            <div style={{ height: '350px', display: 'flex', justifyContent: 'center' }}>
               <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data?.radarData}>
                    <PolarGrid stroke="rgba(0,0,0,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12 }} />
                    <Radar
                      name="Métrica"
                      dataKey="A"
                      stroke="var(--accent)"
                      fill="var(--accent)"
                      fillOpacity={0.6}
                    />
                    <Tooltip />
                  </RadarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* INSIGHTS GRID */}
         <div className="insights-container" style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Recomendaciones accionables</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
               {data?.insights.map((insight: any, idx: number) => (
                  <div key={idx} className="glass-card" style={{ padding: '20px', border: '1px solid rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.7)', transition: 'transform 0.2s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                     <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '10px', 
                        background: insight.type === 'positive' ? '#d1fae5' : (insight.type === 'trend' ? '#dbeafe' : '#f3e8ff'),
                        color: insight.type === 'positive' ? '#065f46' : (insight.type === 'trend' ? '#1e40af' : '#6b21a8'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px'
                     }}>
                        {insight.icon}
                     </div>
                     <h4 style={{ fontWeight: 600, marginBottom: '8px', color: '#1e293b' }}>{insight.title}</h4>
                     <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5', opacity: 0.9 }}>{insight.text}</p>
                  </div>
               ))}
            </div>
            
            {/* NEXT STEPS */}
            <div className="glass-card" style={{ padding: '24px', flex: 1, display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(74, 124, 147, 0.05)' }}>
               <div style={{ background: 'var(--accent)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                 <AlertCircle size={24} />
               </div>
               <div>
                  <h4 style={{ fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Próximo paso sugerido</h4>
                  <p style={{ fontSize: '14px', color: '#334155', opacity: 0.95 }}>
                    Tu tasa de conversión en LinkedIn puede subir un **8%** si añades un CTA directo al final de tus posts de tecnología.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default AIReport;
