import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Send, 
  Instagram, 
  Facebook, 
  Linkedin, 
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Award,
  Share2,
  MoreVertical,
  Repeat,
  Image as ImageIcon,
  Video
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// --- Tipos para las analíticas ---
interface AnalyticsData {
  totalPublished: number;
  totalScheduled: number;
  totalEngagement: number;
  bestPlatform: string;
  charts: {
    postsByDay: any[];
    engagementByPlatform: any[];
    bestTimeToPost: any[];
  };
  platformStats: Record<string, any>;
  topPosts: any[];
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/posts');
      const posts = response.data;
      
      // --- PROCESAMIENTO DE DATOS BI ---
      const processed = processAnalytics(posts);
      setData(processed);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const processAnalytics = (posts: any[]): AnalyticsData => {
    // 1. Filtrar posts publicados vs programados
    const publishedPosts = posts.filter(p => p.scheduledPosts.some((sp: any) => sp.status === 'PUBLISHED'));
    const scheduledPosts = posts.filter(p => p.scheduledPosts.some((sp: any) => sp.status === 'PENDING' || sp.status === 'PROCESSING'));

    // 2. Simulación de engagement (como no está en BD, generamos números plausibles para el demo BI)
    // Usamos el ID del post como semilla para que sea "determinista" por post
    const getMockEngagement = (postId: string, provider: string) => {
      const seed = postId.charCodeAt(0) + postId.charCodeAt(postId.length - 1);
      const base = provider === 'instagram' ? 120 : (provider === 'facebook' ? 85 : 45);
      return Math.floor((seed % 50) + base);
    };

    const platformCounts: Record<string, { count: number; engagement: number }> = {
      instagram: { count: 0, engagement: 0 },
      facebook: { count: 0, engagement: 0 },
      linkedin: { count: 0, engagement: 0 }
    };

    publishedPosts.forEach(p => {
      p.scheduledPosts?.forEach((sp: any) => {
        const provider = sp.socialAccount?.provider?.toLowerCase();
        if (provider && platformCounts[provider]) {
          platformCounts[provider].count++;
          platformCounts[provider].engagement += getMockEngagement(p.id, provider);
        }
      });
    });

    // 3. Preparar datos para gráficos
    // Posts por día (últimos 7 días)
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      
      const count = publishedPosts.filter(p => {
        const pDate = new Date(p.createdAt);
        return pDate.toDateString() === date.toDateString();
      }).length;

      days.push({ name: dateStr, posts: count });
    }

    // Engagement por plataforma
    const engagementData = Object.keys(platformCounts).map(key => ({
      name: key.toUpperCase(),
      engagement: platformCounts[key].engagement,
      color: key === 'instagram' ? '#E4405F' : (key === 'facebook' ? '#1877F2' : '#0A66C2')
    }));

    // Determinar mejor plataforma
    const bestPlatform = Object.entries(platformCounts).reduce((a, b) => a[1].engagement > b[1].engagement ? a : b)[0];

    // TOP 5 Posts (Simulados)
    const topPosts = publishedPosts.slice(0, 5).map(p => ({
      id: p.id,
      content: p.content,
      platform: p.scheduledPosts[0]?.socialAccount.provider || 'LINKEDIN',
      engagement: getMockEngagement(p.id, p.scheduledPosts[0]?.socialAccount.provider.toLowerCase() || 'linkedin'),
      date: new Date(p.createdAt).toLocaleDateString()
    })).sort((a,b) => b.engagement - a.engagement);

    return {
      totalPublished: publishedPosts.length,
      totalScheduled: scheduledPosts.length,
      totalEngagement: Object.values(platformCounts).reduce((acc, curr) => acc + curr.engagement, 0),
      bestPlatform: bestPlatform,
      platformStats: {
        instagram: platformCounts.instagram || { count: 0, engagement: 0 },
        facebook: platformCounts.facebook || { count: 0, engagement: 0 },
        linkedin: platformCounts.linkedin || { count: 0, engagement: 0 }
      },
      topPosts: topPosts,
      charts: {
        postsByDay: days,
        engagementByPlatform: engagementData,
        bestTimeToPost: [
          { time: '09:00', reach: 45 },
          { time: '12:00', reach: 78 },
          { time: '15:00', reach: 62 },
          { time: '19:00', reach: 95 },
          { time: '22:00', reach: 55 },
        ]
      }
    };
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="bi-loader"></div>
        <p>Generando reporte de BI...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-analytics scale-in">
      {/* HEADER SECTION */}
      <div className="analytics-header">
        <div>
          <h1 className="bi-title">Analytics Dashboard <span className="beta-badge">BI v1.0</span></h1>
          <p className="bi-subtitle">Bienvenido al centro de inteligencia de AutopostLab</p>
        </div>
        <div className="date-filter">
          <Calendar size={16} />
          <span>Últimos 30 días</span>
        </div>
      </div>

      {/* METRIC CARDS GRID */}
      <div className="metrics-grid">
        <div className="metric-card glass-card clickable" onClick={() => navigate('/dashboard/posts')}>
          <div className="metric-icon published">
            <Send size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Publicados Total</span>
            <div className="flex-align-baseline">
              <h2 className="metric-value">{data?.totalPublished}</h2>
              <span className="trend positive"><ArrowUpRight size={14} /> 12%</span>
            </div>
          </div>
        </div>

        <div className="metric-card glass-card clickable" onClick={() => navigate('/dashboard/calendar')}>
          <div className="metric-icon scheduled">
            <Clock size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Programados</span>
            <h2 className="metric-value">{data?.totalScheduled}</h2>
            <span className="metric-subtext">Próximos 7 días</span>
          </div>
        </div>

        <div className="metric-card glass-card clickable" onClick={fetchData} title="Refrescar datos">
          <div className="metric-icon engagement">
            <TrendingUp size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Engagement Total</span>
            <div className="flex-align-baseline">
              <h2 className="metric-value">{data?.totalEngagement.toLocaleString()}</h2>
              <span className="trend positive"><ArrowUpRight size={14} /> 5.4%</span>
            </div>
          </div>
        </div>

        <div className="metric-card glass-card clickable" onClick={() => navigate('/dashboard/social-accounts')}>
          <div className="metric-icon best-platform">
            <Award size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Mejor Canal</span>
            <h2 className="metric-value capitalize">{data?.bestPlatform}</h2>
            <span className="metric-subtext">Por ratio de clics</span>
          </div>
        </div>
      </div>
      
      {/* QUICK ACCESS MEDIA */}
      <div className="metrics-grid" style={{ marginTop: '24px' }}>
         <div className="metric-card glass-card clickable" onClick={() => navigate('/dashboard/photos')} style={{ background: 'linear-gradient(135deg, rgba(74, 124, 147, 0.1) 0%, rgba(74, 124, 147, 0.05) 100%)' }}>
           <div className="metric-icon" style={{ background: 'var(--accent)', color: '#fff' }}>
             <ImageIcon size={24} />
           </div>
           <div className="metric-info">
             <span className="metric-label">Galería de Fotos</span>
             <h2 className="metric-value" style={{ fontSize: '18px', marginTop: '4px' }}>Gestionar imágenes</h2>
           </div>
         </div>

         <div className="metric-card glass-card clickable" onClick={() => navigate('/dashboard/videos')} style={{ background: 'linear-gradient(135deg, rgba(74, 124, 147, 0.1) 0%, rgba(74, 124, 147, 0.05) 100%)' }}>
           <div className="metric-icon" style={{ background: 'var(--text-contrast)', color: '#fff' }}>
             <Video size={24} />
           </div>
           <div className="metric-info">
             <span className="metric-label">Librería de Videos</span>
             <h2 className="metric-value" style={{ fontSize: '18px', marginTop: '4px' }}>Gestionar videos</h2>
           </div>
         </div>
         
         {/* Filler cards to maintain grid consistency if needed, or we just let it span 2 columns automatically based on CSS grid setup */}
      </div>

      {/* CHARTS CONTAINER */}
      <div className="analytics-charts-grid">
        <div className="chart-wrapper glass-card large">
          <div className="chart-header">
            <h3>Actividad de Publicación</h3>
            <div className="chart-legend">
              <span className="dot published"></span> Realizados
            </div>
          </div>
          <div className="chart-inner-panel" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.charts.postsByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A7C93" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4A7C93" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#2F4858', fontSize: 11, fontWeight: 400}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', border: 'none', borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.15)' }}
                  itemStyle={{ color: '#2F4858', fontWeight: 400 }}
                />
                <Area type="monotone" dataKey="posts" stroke="#4A7C93" strokeWidth={4} fillOpacity={1} fill="url(#colorPosts)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-wrapper glass-card Small">
            <div className="chart-header">
              <h3>Engagement por Canal</h3>
            </div>
            <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.charts.engagementByPlatform}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#2F4858', fontSize: 12, fontWeight: 400}} />
                        <YAxis hide />
                        <Tooltip cursor={{fill: 'rgba(0,0,0,0.04)'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="engagement" radius={[8, 8, 0, 0]}>
                            {data?.charts.engagementByPlatform.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* PLATFORM BREAKDOWN CARDS */}
      <div className="platform-cards-grid">
        <div className="platform-bi-card instagram gradient">
            <div className="bi-card-head">
                <Instagram size={20} />
                <span>Instagram</span>
            </div>
            <div className="bi-card-main">
                <div className="main-val">{data?.platformStats.instagram.count}</div>
                <div className="sub-val">Posts</div>
            </div>
            <div className="bi-card-foot">
                <span>Engagement: {data?.platformStats.instagram.engagement}</span>
                <span className="mini-trend">+8%</span>
            </div>
        </div>

        <div className="platform-bi-card facebook">
            <div className="bi-card-head">
                <Facebook size={20} />
                <span>Facebook</span>
            </div>
            <div className="bi-card-main">
                <div className="main-val">{data?.platformStats.facebook.count}</div>
                <div className="sub-val">Posts</div>
            </div>
            <div className="bi-card-foot">
                <span>Engagement: {data?.platformStats.facebook.engagement}</span>
                <span className="mini-trend">+5%</span>
            </div>
        </div>

        <div className="platform-bi-card linkedin">
            <div className="bi-card-head">
                <Linkedin size={20} />
                <span>LinkedIn</span>
            </div>
            <div className="bi-card-main">
                <div className="main-val">{data?.platformStats.linkedin.count}</div>
                <div className="sub-val">Posts</div>
            </div>
            <div className="bi-card-foot">
                <span>Engagement: {data?.platformStats.linkedin.engagement}</span>
                <span className="mini-trend negative">-2%</span>
            </div>
        </div>
      </div>

      {/* LOWER GRID: TOP POSTS AND INSIGHTS */}
      <div className="lower-analytics-grid">
        <div className="top-posts-card glass-card">
          <div className="card-header-bi">
            <h3>Contenido con Mejor Impacto</h3>
            <button className="btn-icon-sm"><MoreVertical size={16} /></button>
          </div>
          <div className="top-posts-list">
            {data?.topPosts.map((post, idx) => (
              <div key={post.id} className="top-post-item">
                <div className="post-rank">#{idx + 1}</div>
                <div className="post-platform-icon">
                   {post.platform === 'INSTAGRAM' ? <Instagram size={14} /> : (post.platform === 'FACEBOOK' ? <Facebook size={14} /> : <Linkedin size={14} />)}
                </div>
                <div className="post-content-preview">
                  <p>{post.content.length > 60 ? post.content.substring(0, 60) + '...' : post.content}</p>
                </div>
                <div className="post-metric">
                   <div className="val">{post.engagement}</div>
                   <div className="lab">Likes</div>
                </div>
                <button className="btn-repost" title="Volver a publicar">
                  <Repeat size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="insights-card glass-card">
            <div className="card-header-bi">
                <h3>Insights Estratégicos</h3>
                <Zap size={18} className="zap-icon" color="#4A7C93" />
            </div>
            <div className="insights-list">
                <div className="insight-item">
                    <div className="insight-indicator green"></div>
                    <div className="insight-text">
                        <strong>Mejor horario para publicar:</strong> 19:00 - 21:00 hs. Tus posts tienen un 40% más de engagement en esta franja.
                    </div>
                </div>
                <div className="insight-item">
                    <div className="insight-indicator purple"></div>
                    <div className="insight-text">
                        <strong>Recomendación de Canal:</strong> Instagram está siendo tu canal más rentable este mes. Considera aumentar la frecuencia.
                    </div>
                </div>
                <div className="insight-item">
                    <div className="insight-indicator blue"></div>
                    <div className="insight-text">
                        <strong>Oportunidad detectada:</strong> El post #1 tiene potencial para ser reutilizado. Intenta publicarlo en LinkedIn.
                    </div>
                </div>
            </div>
            <button 
              className="btn-full-premium" 
              onClick={() => {
                console.log("NAVIGATING TO AI REPORT");
                navigate('/dashboard/ai-report');
              }}
            >
              Ver reporte avanzado AI
            </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
