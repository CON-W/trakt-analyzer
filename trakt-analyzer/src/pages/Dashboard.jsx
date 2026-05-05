import React, { useState, useEffect, useRef } from 'react';
import { fetchCombinedAnalysis, API_BASE } from '../utils/api';
import LoadingProgress from '../components/LoadingProgress';


// ============ 背景海报墙 ============
function BackgroundPoster({ items, onIndexChange }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const itemsWithPoster = items?.filter(i => i.enriched?.backdrop || i.enriched?.poster) || [];

  useEffect(() => {
    if (onIndexChange) onIndexChange(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (itemsWithPoster.length < 2) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        // 随机切换到下一张，确保不重复
        setCurrentIndex(prev => {
          let next;
          do {
            next = Math.floor(Math.random() * itemsWithPoster.length);
          } while (next === prev && itemsWithPoster.length > 1);
          return next;
        });
        setVisible(true);
      }, 500);
    }, 7000);
    return () => clearInterval(interval);
  }, [itemsWithPoster.length]);

  if (!itemsWithPoster.length) return <div className="fixed inset-0 z-0 bg-black" />;

  // 只渲染当前和下一张图片，避免大量 DOM 节点
  const currentItem = itemsWithPoster[currentIndex];
  const nextIndex = (currentIndex + 1) % itemsWithPoster.length;
  const nextItem = itemsWithPoster[nextIndex];
  const currentUrl = currentItem?.enriched?.backdrop || currentItem?.enriched?.poster;
  const nextUrl = nextItem?.enriched?.backdrop || nextItem?.enriched?.poster;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" style={{ top: '64px' }}>
      {/* 下一张（预加载） */}
      {nextUrl && nextIndex !== currentIndex && (
        <div className="absolute inset-0 opacity-0 pointer-events-none">
          <img src={nextUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      {/* 当前显示 */}
      <div
        key={currentUrl}
        className={`absolute inset-0 transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        <img src={currentUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/80" />
      </div>
    </div>
  );
}

// ============ 台词轮播 ============
function QuoteCarousel({ items }) {
  const allQuotes = (items || []).filter(i => i.enriched?.tagline);
  // 每次数据刷新时，从所有有台词的作品中随机选 5 条
  const [quotes, setQuotes] = useState([]);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const shuffled = [...allQuotes].sort(() => Math.random() - 0.5).slice(0, 5);
    setQuotes(shuffled);
    setCurrent(0);
  }, [items]);
  useEffect(() => {
    if (quotes.length < 2) return;
    const interval = setInterval(() => setCurrent(prev => (prev + 1) % quotes.length), 6000);
    return () => clearInterval(interval);
  }, [quotes.length]);
  if (quotes.length === 0) return null;
  const q = quotes[current];
  const title = q.enriched?.title_cn || q.title;
  return (
    <div className="relative min-h-[65vh] flex items-center">
      <div className="max-w-5xl px-8">
        <p className="text-4xl md:text-5xl lg:text-6xl font-light italic text-white/85 leading-[1.6] tracking-normal" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", textShadow: '0 4px 40px rgba(0,0,0,0.7)' }}>
          "{q.enriched?.tagline}"
        </p>
        <p className="mt-10 text-xl md:text-2xl text-white/50 font-medium tracking-wide" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
          — {title}
        </p>
      </div>
      {quotes.length > 1 && (
        <div className="absolute bottom-12 left-8 flex items-center gap-2">
          {quotes.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === current ? 'w-8 bg-white/40' : 'w-1 bg-white/20'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============ 推荐详情弹窗 ============
function RecommendModal({ item, onClose }) {
  const [tmdbData, setTmdbData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item?.id) return;
    setLoading(true);
    const mediaType = item.type === 'movie' ? 'movie' : 'tv';
    fetch(`https://api.themoviedb.org/3/${mediaType}/${item.id}?api_key=${import.meta.env.VITE_TMDB_API_KEY || ''}&language=zh-CN&append_to_response=credits`)
      .then(r => r.json())
      .then(d => { setTmdbData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [item?.id]);

  const isMovie = item.type === 'movie';
  const title = item.title;
  const overview = tmdbData?.overview || item.overview || '暂无简介';
  const genres = tmdbData?.genres?.map(g => g.name) || [];
  const directors = tmdbData?.credits?.crew?.filter(p => p.job === 'Director').map(p => p.name) || [];
  const cast = tmdbData?.credits?.cast?.slice(0, 8) || [];
  const voteAvg = item.rating || (tmdbData?.vote_average ? tmdbData.vote_average.toFixed(1) : null);
  const releaseDate = tmdbData?.release_date || tmdbData?.first_air_date || item.year || '';
  const runtime = tmdbData?.runtime || tmdbData?.episode_run_time?.[0] || null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-full max-w-lg bg-[#1C1C1E] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-scale-in max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 海报头部 */}
        <div className="relative h-48 flex-shrink-0 bg-gradient-to-br from-[#007AFF]/20 to-[#AF52DE]/20">
          {item.backdrop ? (
            <img src={item.backdrop} alt="" className="w-full h-full object-cover" />
          ) : item.poster ? (
            <img src={item.poster} alt="" className="w-full h-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1E] via-[#1C1C1E]/60 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <h3 className="text-2xl font-bold text-white">{title}</h3>
            <div className="flex items-center gap-3 mt-2">
              {voteAvg && (
                <span className="text-sm text-white/70">⭐ {voteAvg}</span>
              )}
              {releaseDate && (
                <span className="text-sm text-white/50">{releaseDate.slice(0, 4)}</span>
              )}
              <span className="text-sm text-white/50">{isMovie ? '电影' : '剧集'}</span>
              {runtime && (
                <span className="text-sm text-white/50">{runtime}分钟</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* 类型标签 */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {genres.map(g => (
                    <span key={g} className="px-3 py-1 rounded-full bg-white/10 text-xs text-white/60">{g}</span>
                  ))}
                </div>
              )}

              {/* 简介 */}
              <div>
                <h4 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-2">简介</h4>
                <p className="text-sm text-white/70 leading-relaxed">{overview}</p>
              </div>

              {/* 导演 */}
              {directors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-2">导演</h4>
                  <p className="text-sm text-white/70">{directors.join('、')}</p>
                </div>
              )}

              {/* 演员 */}
              {cast.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-2">主演</h4>
                  <div className="flex flex-wrap gap-2">
                    {cast.map((c, i) => (
                      <span key={i} className="text-sm text-white/60">
                        {c.name}{c.character ? ` (${c.character})` : ''}{i < cast.length - 1 ? '、' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============ 人物详情弹窗 ============
function PersonModal({ person, type, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const label = type === 'director' ? '导演' : '演员';
  const icon = type === 'director' ? '🎬' : '🌟';
  const gradient = type === 'director'
    ? 'from-[#007AFF]/20 to-[#007AFF]/5'
    : 'from-[#AF52DE]/20 to-[#AF52DE]/5';

  useEffect(() => {
    if (!person?.name) return;
    setLoading(true);
    const sessionId = localStorage.getItem('trakt_session_id');
    const headers = sessionId ? { 'x-session-id': sessionId } : {};
    fetch(`${API_BASE}/person/${encodeURIComponent(person.name)}/credits`, { headers })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [person?.name]);


  const credits = data?.credits || [];
  const sortedCredits = [...credits].sort((a, b) => {
    if (a.watched && !b.watched) return -1;
    if (!a.watched && b.watched) return 1;
    return (b.year || '0').localeCompare(a.year || '0');
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-full max-w-2xl bg-[#1C1C1E] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-scale-in max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className={`bg-gradient-to-br ${gradient} p-8 pb-8 flex-shrink-0`}>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 ring-2 ring-white/20 flex-shrink-0">
              {data?.person?.profile_path ? (
                <img src={data.person.profile_path} alt={person.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">{icon}</div>
              )}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">{person.name}</h3>
              <p className="text-base text-white/60 mt-1">
                {label} · 看过 {data?.watchedCount || 0} / {data?.totalWorks || 0} 部作品
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <h4 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">全部作品</h4>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sortedCredits.map((work, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${work.watched ? 'bg-white/10' : 'bg-white/5'}`}>
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                    {work.poster ? (
                      <img src={work.poster} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm">{work.media_type === 'movie' ? '🎬' : '📺'}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${work.watched ? 'text-white/85' : 'text-white/45'}`}>
                        《{work.title}》
                      </p>
                      {work.watched && (
                        <span className="text-[11px] text-[#34C759] font-semibold flex-shrink-0">✓ 看过</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {work.year && <span className="text-xs text-white/35">{work.year}</span>}
                      {work.character && (
                        <span className="text-xs text-white/45">饰 {work.character}</span>
                      )}
                      {work.job && (
                        <span className="text-xs text-white/45">{work.job}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============ 人物卡片 ============
function PersonCard({ person, type, avatarUrl, onClick }) {
  const [imgError, setImgError] = useState(false);
  const [totalWorks, setTotalWorks] = useState(null);
  const label = type === 'director' ? '🎬 导演' : '🌟 演员';
  const gradient = type === 'director'
    ? 'from-[#007AFF]/20 to-[#007AFF]/5'
    : 'from-[#AF52DE]/20 to-[#AF52DE]/5';
  const icon = type === 'director' ? '🎬' : '🌟';

  useEffect(() => {
    if (totalWorks !== null) return;
    const sessionId = localStorage.getItem('trakt_session_id');
    const headers = sessionId ? { 'x-session-id': sessionId } : {};
    fetch(`${API_BASE}/person/${encodeURIComponent(person.name)}/credits`, { headers })
      .then(r => r.json())
      .then(d => { if (d?.totalWorks) setTotalWorks(d.totalWorks); })
      .catch(() => {});
  }, [person.name]);


  return (
    <div onClick={onClick} className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 hover:bg-white/10 transition-all animate-fade-in group cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-white/5 flex-shrink-0 ring-2 ring-white/10 group-hover:ring-white/25 transition-all">
          {avatarUrl && !imgError ? (
            <img src={avatarUrl} alt={person.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xl`}>{icon}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-white truncate">{person.name}</p>
          <p className="text-sm text-white/50 mt-1">
            {label} · 看过 {person.watchedCount || person.count}
            {totalWorks ? ` / ${totalWorks} 部` : ' 部'}
          </p>
        </div>
        <svg className="w-5 h-5 text-white/30 flex-shrink-0 group-hover:text-white/50 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

// ============ 即将上映卡片 ============
function UpcomingCard({ item }) {
  const isMovie = item.type === 'movies';
  const dateStr = isMovie ? item.release_date : item.first_air_date;
  const date = dateStr ? new Date(dateStr) : null;
  const now = new Date();
  const diffDays = date ? Math.ceil((date - now) / (1000 * 60 * 60 * 24)) : null;
  return (
    <div className="flex-shrink-0 w-44 group cursor-pointer animate-fade-in">
      <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-black/30 mb-3 shadow-xl shadow-black/30 group-hover:scale-[1.04] transition-transform relative border border-white/5">
        {item.poster ? (
          <img src={item.poster} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">{isMovie ? '🎬' : '📺'}</div>
        )}
        {diffDays !== null && diffDays <= 30 && diffDays >= 0 && (
          <div className="absolute top-2 right-2 bg-[#FF9500] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
            {diffDays === 0 ? '今日上映' : `${diffDays}天后`}
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-white/85 truncate">{item.title}</p>
      <p className="text-xs text-white/45 truncate mt-1">
        {isMovie ? '即将上映' : '新季开播'}
        {date && ` · ${date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}`}
      </p>
    </div>
  );
}

// ============ 追剧提醒卡片 ============
function TrackingCard({ item }) {
  const nextEp = item.next_episode;
  const lastEp = item.last_episode;
  const date = nextEp?.air_date ? new Date(nextEp.air_date) : null;
  const now = new Date();
  const diffDays = date ? Math.ceil((date - now) / (1000 * 60 * 60 * 24)) : null;
  const progress = item.user_progress;
  const progressPct = progress?.total_episodes > 0 ? Math.round((progress.watched_episodes / progress.total_episodes) * 100) : 0;
  const hasNewSeason = !nextEp && lastEp && item.latest_season_number > lastEp.season_number;
  return (
    <div className="flex-shrink-0 w-44 group cursor-pointer animate-fade-in">
      <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-black/30 mb-3 shadow-xl shadow-black/30 group-hover:scale-[1.04] transition-transform relative border border-white/5">
        {item.poster ? (
          <img src={item.poster} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">📺</div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50">
          <div className="h-full bg-[#007AFF] transition-all rounded-r-full" style={{ width: `${Math.min(progressPct, 100)}%` }} />
        </div>
        {nextEp && diffDays !== null && diffDays <= 14 && (
          <div className={`absolute top-2 right-2 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg ${diffDays <= 1 ? 'bg-[#FF3B30]' : 'bg-[#FF9500]'}`}>
            {diffDays <= 0 ? '今日更新' : `${diffDays}天后`}
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-white/85 truncate">{item.title}</p>
      <p className="text-xs text-white/45 truncate mt-1">
        {nextEp ? `S${nextEp.season_number}E${nextEp.episode_number} · ${date ? date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : ''}`
          : hasNewSeason ? `即将播出第${item.latest_season_number}季`
          : lastEp ? `最新 S${lastEp.season_number}E${lastEp.episode_number}`
          : '暂无更新信息'}
      </p>
      {progress && <p className="text-[11px] text-white/35 mt-1">已看 {progress.watched_episodes}/{progress.total_episodes} 集</p>}
    </div>
  );
}

// ============ 人物头像获取 Hook ============
function usePersonAvatars(names) {
  const [avatars, setAvatars] = useState({});
  useEffect(() => {
    const validNames = (names || []).filter(Boolean);
    if (validNames.length === 0) return;
    let cancelled = false;
    Promise.all(
      validNames.map(name =>
        fetch(`${API_BASE}/person/${encodeURIComponent(name)}`)
          .then(r => r.json())
          .then(data => ({ name, url: data?.profile_path || null }))
          .catch(() => ({ name, url: null }))
      )

    ).then(results => {
      if (!cancelled) {
        const map = {};
        results.forEach(r => { map[r.name] = r.url; });
        setAvatars(map);
      }
    });
    return () => { cancelled = true; };
  }, [JSON.stringify(names)]);
  return avatars;
}

// ============ 主组件 ============
export default function Dashboard() {
  const [analysis, setAnalysis] = useState(null);
  const [upcoming, setUpcoming] = useState({ movies: [], shows: [] });
  const [tracking, setTracking] = useState([]);
  const [upcomingTab, setUpcomingTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressStep, setProgressStep] = useState('fetch');
  const [error, setError] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [bgIndex, setBgIndex] = useState(0);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const controllerRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    loadAnalysis();
    fetchUpcoming();
    fetchTracking();
    return () => { if (controllerRef.current) controllerRef.current.abort(); };
  }, []);

  // 分析完成后自动加载推荐
  useEffect(() => {
    if (!loading && !enriching && analysis) {
      fetchRecommendations();
    }
  }, [loading, enriching, analysis]);

  const fetchRecommendations = async () => {
    if (recLoading) return;
    setRecLoading(true);
    try {
      const sessionId = localStorage.getItem('trakt_session_id');
      if (!sessionId) { setRecLoading(false); return; }
      const res = await fetch(`${API_BASE}/recommendations`, { headers: { 'x-session-id': sessionId } });

      const data = await res.json();
      if (Array.isArray(data)) setRecommendations(data);
    } catch (e) {}
    setRecLoading(false);
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const lastLoad = localStorage.getItem('trakt_last_load');
        if (lastLoad && Date.now() - parseInt(lastLoad) < 5 * 60 * 1000) return;
        fetchUpcoming();
        fetchTracking();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => { fetchUpcoming(); fetchTracking(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchUpcoming = async () => {
    try { const res = await fetch(`${API_BASE}/upcoming`); const data = await res.json(); setUpcoming(data); } catch (e) {}
  };

  const fetchTracking = async () => {
    try {
      const sessionId = localStorage.getItem('trakt_session_id');
      if (!sessionId) return;
      const res = await fetch(`${API_BASE}/upcoming/tracking`, { headers: { 'x-session-id': sessionId } });
      const data = await res.json();
      if (Array.isArray(data)) setTracking(data);
    } catch (e) {}
  };


  const loadAnalysis = () => {
    setLoading(true); setEnriching(false); setError(null); setProgress(0);
    setProgressMessage('正在获取你的观影记录...'); setProgressStep('fetch');
    controllerRef.current = fetchCombinedAnalysis({
      onProgress: (data) => { setProgress(data.progress); setProgressMessage(data.message); setProgressStep(data.step); },
      onRawResult: (data) => { setAnalysis(data.data); setLoading(false); setEnriching(true); setShowSkeleton(false); },
      onResult: (data) => { setAnalysis(data.data); setEnriching(false); setProgress(100); setProgressMessage('分析完成！'); setProgressStep('complete'); setShowSkeleton(false); },
      onError: (msg) => { setError(msg); setLoading(false); setEnriching(false); setShowSkeleton(false); },
    });
  };

  const topDirector = analysis?.topDirectors?.[0] || null;
  const topActors = (analysis?.topCast || []).slice(0, 3);
  const allPeople = [];
  if (topDirector) allPeople.push({ person: topDirector, type: 'director' });
  topActors.forEach(p => allPeople.push({ person: p, type: 'actor' }));
  const allNames = allPeople.map(p => p.person.name).filter(Boolean);
  const avatars = usePersonAvatars(allNames);

  // 即将上映横向滚动 - 鼠标滚轮支持
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      // 只在内容超出容器宽度时启用横向滚动
      if (el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [upcomingTab, upcoming, tracking]);

  if (loading && showSkeleton) return <LoadingProgress progress={progress} message={progressMessage} step={progressStep} />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 bg-[#FF3B30]/10 rounded-full flex items-center justify-center"><span className="text-3xl">⚠️</span></div>
          <h2 className="text-2xl font-semibold text-white mb-3">加载失败</h2>
          <p className="text-white/50 mb-6 text-lg">{error}</p>
          <button onClick={loadAnalysis} className="px-8 py-3 bg-[#007AFF] text-white rounded-2xl text-base font-semibold hover:bg-[#007AFF]/90 transition-colors">重新加载</button>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const totalMovies = analysis.totalMovies || 0;
  const totalShows = analysis.totalShows || 0;
  const totalEpisodes = analysis.totalEpisodes || 0;
  const avgRating = analysis.averageRating ? parseFloat(analysis.averageRating) : 0;
  const totalMinutes = analysis.totalWatchMinutes || 0;
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.floor(totalMinutes % 60);
  let totalWatchTime = '';
  if (totalMinutes > 0) {
    if (hours > 0) totalWatchTime += `${hours}小时`;
    if (mins > 0) totalWatchTime += `${mins}分`;
    if (!totalWatchTime) totalWatchTime = `${Math.round(totalMinutes)}分钟`;
  }

  const allUpcoming = [...(upcoming.movies || []), ...(upcoming.shows || [])]
    .filter(item => { const d = item.release_date || item.first_air_date; return d && new Date(d) >= new Date(Date.now() - 86400000); })
    .sort((a, b) => new Date(a.release_date || a.first_air_date) - new Date(b.release_date || b.first_air_date))
    .slice(0, 10);

  // 当前背景海报信息 - 跟随轮播索引
  const itemsWithPoster = analysis?.topItems?.filter(i => i.enriched?.backdrop || i.enriched?.poster) || [];
  const currentBgItem = itemsWithPoster[bgIndex] || itemsWithPoster[0] || null;
  const bgTitle = currentBgItem?.enriched?.title_cn || currentBgItem?.title || '';
  const bgYear = currentBgItem?.year || '';

  return (
    <div className="min-h-screen bg-black">
      <BackgroundPoster items={analysis.topItems} onIndexChange={(idx) => setBgIndex(idx)} />

      {selectedPerson && (
        <PersonModal person={selectedPerson.person} type={selectedPerson.type} onClose={() => setSelectedPerson(null)} />
      )}
      {selectedRecommendation && (
        <RecommendModal item={selectedRecommendation} onClose={() => setSelectedRecommendation(null)} />
      )}

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* 顶部：台词轮播 - 左对齐 */}
        <div className="flex-1 flex items-center">
          <QuoteCarousel items={analysis.topItems} />
        </div>

        {/* 右下角：统计信息 + 海报来源 - fixed 确保不被遮挡 */}
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 bg-black/30 backdrop-blur-md rounded-2xl px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span>🎬</span>
            <span className="text-white/70 tabular-nums">{totalMovies}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 text-sm">
            <span>📺</span>
            <span className="text-white/70 tabular-nums">{totalEpisodes}</span>
          </div>
          {avgRating > 0 && (
            <>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2 text-sm">
                <span>⭐</span>
                <span className="text-white/70 tabular-nums">{avgRating.toFixed(1)}</span>
              </div>
            </>
          )}
          {totalWatchTime && (
            <>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2 text-sm">
                <span>⏱️</span>
                <span className="text-white/70 tabular-nums">{totalWatchTime}</span>
              </div>
            </>
          )}
          {bgTitle && (
            <>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2 text-sm text-white/50">
                <span>🖼️</span>
                <span className="truncate max-w-[200px]">{bgTitle}{bgYear ? ` (${bgYear})` : ''}</span>
              </div>
            </>
          )}
        </div>

        {/* 下方内容：滚动可见 */}
        <div className="px-6 pb-10 mt-16">
          {/* 即将上映 / 追剧 */}
          {(allUpcoming.length > 0 || tracking.length > 0) && (
            <div className="mb-14">
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl font-bold text-white/90" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>🎬 即将上映</h2>
                <div className="flex bg-white/5 backdrop-blur-xl rounded-full p-1">
                  <button onClick={() => setUpcomingTab('upcoming')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${upcomingTab === 'upcoming' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/70'}`}>新片</button>
                  <button onClick={() => setUpcomingTab('tracking')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${upcomingTab === 'tracking' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/70'}`}>
                    追剧
                    {tracking.filter(t => { const d = t.next_episode?.air_date ? new Date(t.next_episode.air_date) : null; return d && Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24)) <= 7; }).length > 0 && (
                      <span className="ml-1.5 bg-[#FF3B30] text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        {tracking.filter(t => { const d = t.next_episode?.air_date ? new Date(t.next_episode.air_date) : null; return d && Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24)) <= 7; }).length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar pb-2" style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
                {upcomingTab === 'upcoming'
                  ? allUpcoming.map((item, i) => <UpcomingCard key={`${item.type}-${item.id}`} item={item} />)
                  : tracking.map((item, i) => <TrackingCard key={item.id} item={item} />)
                }
              </div>
            </div>
          )}

          {/* 常看的人 */}
          {allPeople.length > 0 && (
            <div className="mb-14">
              <h2 className="text-xl font-bold text-white/90 mb-6" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>👥 常看的人</h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2" style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
                {allPeople.map(({ person, type }) => (
                  <div
                    key={`${type}-${person.name}`}
                    onClick={() => setSelectedPerson({ person, type })}
                    className="flex-shrink-0 w-28 group cursor-pointer animate-fade-in"
                  >
                    <div className="w-20 h-20 mx-auto rounded-full overflow-hidden bg-white/5 ring-2 ring-white/10 group-hover:ring-white/25 transition-all mb-3">
                      {avatars[person.name] ? (
                        <img src={avatars[person.name]} alt={person.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center text-2xl ${type === 'director' ? 'bg-[#007AFF]/20' : 'bg-[#AF52DE]/20'}`}>
                          {type === 'director' ? '🎬' : '🌟'}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white/85 text-center truncate">{person.name}</p>
                    <p className="text-xs text-white/45 text-center mt-1">
                      {type === 'director' ? '🎬 导演' : '🌟 演员'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 为你推荐 */}
          {recommendations.length > 0 && (
            <div className="mb-14">
              <h2 className="text-xl font-bold text-white/90 mb-6" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>🎯 为你推荐</h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2" style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
                {recommendations.map((item) => (
                  <div key={`${item.type}-${item.id}`} onClick={() => setSelectedRecommendation(item)} className="flex-shrink-0 w-36 group cursor-pointer animate-fade-in">
                    <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-black/30 mb-3 shadow-xl shadow-black/30 group-hover:scale-[1.04] transition-transform relative border border-white/5">
                      {item.poster ? (
                        <img src={item.poster} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">{item.type === 'movie' ? '🎬' : '📺'}</div>
                      )}
                      {item.rating && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span>⭐</span>
                          <span>{item.rating}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white/85 truncate">{item.title}</p>
                    <p className="text-xs text-white/45 truncate mt-1">
                      {item.type === 'movie' ? '电影' : '剧集'}
                      {item.year ? ` · ${item.year}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 类型偏好 */}
          {Array.isArray(analysis.genreDistribution) && analysis.genreDistribution.length > 0 && (
            <div className="mb-14">
              <h2 className="text-xl font-bold text-white/90 mb-6" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>🎭 看过的类型</h2>
              <div className="flex flex-wrap gap-2">
                {analysis.genreDistribution.slice(0, 12).map((item) => {
                  const genre = Array.isArray(item) ? item[0] : item.genre || item.name;
                  const count = Array.isArray(item) ? item[1] : item.count;
                  const total = analysis.genreDistribution.slice(0, 12).reduce((sum, i) => sum + (Array.isArray(i) ? i[1] : i.count), 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div
                      key={genre}
                      className="px-4 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5 cursor-default"
                    >
                      <span className="text-sm text-white/70">{genre}</span>
                      <span className="ml-1.5 text-xs text-white/40">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
