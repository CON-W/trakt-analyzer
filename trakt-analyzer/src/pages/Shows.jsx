import React, { useState, useEffect, useRef } from 'react';
import { fetchEnrichedHistory } from '../utils/api';
import { useDataCache } from '../context/DataCacheContext';
import LoadingProgress from '../components/LoadingProgress';

function ShowCard({ item, index, onClick }) {
  const show = item.show;
  const enriched = item._enriched || {};
  const posterUrl = enriched.poster;
  const title = enriched.title_cn || show?.title || '未知';
  const originalTitle = enriched.original_title && enriched.original_title !== title ? enriched.original_title : null;
  const hasPoster = !!posterUrl;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className="group cursor-pointer animate-fade-in"
      style={{ animationDelay: `${Math.min(index * 30, 1000)}ms` }}
      onClick={() => onClick(item)}
    >
      <div className="glass-card overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10 rounded-2xl">
        {/* Poster */}
        <div className="relative aspect-[2/3] bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E] overflow-hidden">
          {hasPoster && (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E]">
                  <div className="w-8 h-8 border-2 border-[#007AFF]/30 border-t-[#007AFF] rounded-full animate-spin" />
                </div>
              )}
              <img
                src={posterUrl}
                alt={title}
                className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-700 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onError={(e) => {
                  e.target.style.display = 'none';
                  setImgLoaded(false);
                }}
              />
            </>
          )}
          {!hasPoster && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center p-4">
                <span className="text-4xl block mb-2">📺</span>
                <p className="text-xs text-[#8E8E93] line-clamp-2">{title}</p>
              </div>
            </div>
          )}

          {/* Year badge */}
          {show?.year && (
            <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-xl text-xs text-white font-medium">
              {show.year}
            </div>
          )}

          {/* Ended badge */}
          {enriched.status === 'Ended' && (
            <div className="absolute top-2 right-2 px-2.5 py-1 bg-[#34C759]/80 backdrop-blur-sm rounded-xl text-xs text-white font-medium">
              已完结
            </div>
          )}

          {/* Rating badge */}
          {enriched.vote_average && enriched.status !== 'Ended' && (
            <div className="absolute top-2 right-2 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-xl text-xs text-white font-medium flex items-center gap-1">
              <span>⭐</span>
              {enriched.vote_average.toFixed(1)}
            </div>
          )}
          {enriched.vote_average && enriched.status === 'Ended' && (
            <div className="absolute top-2 right-2 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-xl text-xs text-white font-medium flex items-center gap-1 mt-8">
              <span>⭐</span>
              {enriched.vote_average.toFixed(1)}
            </div>
          )}

          {/* Episode progress badge */}
          {item._episodeCount > 0 && (
            <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-[#FF9500]/80 backdrop-blur-sm rounded-xl text-xs text-white font-medium">
              {item._seasonRange} · {item._episodeCount} 集
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5 bg-[#1C1C1E]">
          <h3 className="font-semibold text-white text-sm leading-tight mb-1 line-clamp-2">
            {title}
          </h3>
          {originalTitle && (
            <p className="text-xs text-white/40 mb-1.5 truncate">{originalTitle}</p>
          )}
          <div className="flex flex-wrap gap-1">
            {enriched.genres?.slice(0, 2).map((g, i) => (
              <span key={i} className="px-2 py-0.5 bg-[#007AFF]/15 text-[#5AC8FA] rounded-full text-[10px] font-medium">{g}</span>
            ))}
          </div>
          {enriched.overview && (
            <p className="text-xs text-white/40 mt-2 line-clamp-2 leading-relaxed">
              {enriched.overview}
            </p>
          )}
          {/* Season info */}
          {enriched.number_of_seasons && (
            <p className="text-[10px] text-white/30 mt-1.5">
              {enriched.number_of_seasons} 季 · {enriched.number_of_episodes || '?'} 集
            </p>
          )}
          {(enriched.creators?.length > 0 || enriched.writers?.length > 0) && (
            <p className="text-[10px] text-white/30 mt-1 truncate">
              {enriched.creators?.length > 0
                ? `创作者: ${enriched.creators.slice(0, 2).join(', ')}`
                : `编剧: ${enriched.writers.slice(0, 2).join(', ')}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PosterWall({ items }) {
  const posters = items
    ?.filter(item => item._enriched?.poster)
    .slice(0, 30)
    .map(item => item._enriched.poster) || [];

  if (posters.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.04]">
      <div className="absolute inset-0 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1 p-1">
        {posters.map((url, i) => (
          <div key={i} className="aspect-[2/3] rounded-sm overflow-hidden">
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowDetail({ item, onClose }) {
  const show = item.show;
  const enriched = item._enriched || {};
  const posterUrl = enriched.poster;
  const backdropUrl = enriched.backdrop;
  const title = enriched.title_cn || show?.title || '未知';
  const originalTitle = enriched.original_title;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <div className="max-w-2xl w-full bg-[#1C1C1E] backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in border border-white/10" onClick={e => e.stopPropagation()}>
        {/* Hero with backdrop */}
        <div className="relative h-64 bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E]">
          {backdropUrl ? (
            <img src={backdropUrl} alt="" className="w-full h-full object-cover" />
          ) : posterUrl ? (
            <img src={posterUrl} alt="" className="w-full h-full object-cover opacity-40 scale-110" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors text-sm"
          >
            ✕
          </button>
          <div className="absolute bottom-4 left-6 right-6">
            <h2 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">{title}</h2>
            {originalTitle && originalTitle !== title && (
              <p className="text-sm text-white/70 drop-shadow">{originalTitle}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Meta info row */}
          <div className="flex flex-wrap gap-3 mb-4">
            {show?.year && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-xl text-sm text-white/70">
                <span>📅</span> {show.year}
              </div>
            )}
            {enriched.vote_average && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-xl text-sm">
                <span>⭐</span>
                <span className="font-semibold text-white">{enriched.vote_average.toFixed(1)}</span>
                <span className="text-white/40">/ 10</span>
              </div>
            )}
            {enriched.number_of_seasons && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-xl text-sm text-white/70">
                <span>📦</span> {enriched.number_of_seasons} 季
              </div>
            )}
            {enriched.number_of_episodes && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-xl text-sm text-white/70">
                <span>📺</span> {enriched.number_of_episodes} 集
              </div>
            )}
            {item._episodeCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF9500]/20 rounded-xl text-sm text-[#FF9500]">
                <span>📺</span> 已看 {item._seasonRange} · {item._episodeCount} 集
              </div>
            )}
            {enriched.status === 'Ended' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#34C759]/20 rounded-xl text-sm text-[#34C759]">
                <span>✅</span> 已完结
              </div>
            )}
          </div>

          {/* Genres */}
          {enriched.genres && enriched.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {enriched.genres.map((g, i) => (
                <span key={i} className="px-3 py-1 bg-[#007AFF]/10 text-[#007AFF] rounded-full text-xs font-medium">{g}</span>
              ))}
            </div>
          )}

          {/* Overview */}
          {enriched.overview && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-white mb-1.5">简介</h4>
              <p className="text-sm text-white/50 leading-relaxed">{enriched.overview}</p>
            </div>
          )}

          {/* Creators, Writers & Cast */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {enriched.creators && enriched.creators.length > 0 && (
              <div className="bg-white/10 rounded-2xl p-3">
                <h4 className="text-xs font-semibold text-white mb-1">创作者</h4>
                <p className="text-sm text-white/50">{enriched.creators.join(', ')}</p>
              </div>
            )}
            {enriched.writers && enriched.writers.length > 0 && (
              <div className="bg-white/10 rounded-2xl p-3">
                <h4 className="text-xs font-semibold text-white mb-1">编剧</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {enriched.writers.slice(0, 10).map((writer, i) => (
                    <p key={i} className="text-sm text-white/50">{writer}</p>
                  ))}
                </div>
              </div>
            )}
            {enriched.cast && enriched.cast.length > 0 && (
              <div className="bg-white/10 rounded-2xl p-3">
                <h4 className="text-xs font-semibold text-white mb-1">主演</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {enriched.cast.map((actor, i) => (
                    <p key={i} className="text-sm text-white/50">
                      {typeof actor === 'string' ? actor : `${actor.name}${actor.character ? ` 饰 ${actor.character}` : ''}`}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <p className="text-xs text-white/30">
              观看时间：{new Date(item.watched_at || item._lastWatched).toLocaleString('zh-CN')}
            </p>
            <div className="flex gap-3">
              {show?.ids?.imdb && (
                <a href={`https://www.imdb.com/title/${show.ids.imdb}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#007AFF] hover:underline">
                  IMDB ↗
                </a>
              )}
              {enriched.douban_url && (
                <a href={enriched.douban_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#007AFF] hover:underline">
                  豆瓣 ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Shows() {
  const { showData, setShowData, showLoading, setShowLoading } = useDataCache();
  const [localShows, setLocalShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressStep, setProgressStep] = useState('fetch');
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [selectedShow, setSelectedShow] = useState(null);
  const [enrichedCount, setEnrichedCount] = useState(0);
  const controllerRef = useRef(null);

  // On mount, check cache first
  useEffect(() => {
    if (showData) {
      setLocalShows(showData);
      setLoading(false);
      setEnriching(false);
      setProgressMessage('加载完成');
      setProgress(100);
    } else {
      loadShows();
    }
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const loadShows = () => {
    setLoading(true);
    setEnriching(false);
    setError(null);
    setProgress(0);
    setProgressMessage('正在获取剧集观看记录...');
    setProgressStep('fetch');
    setLocalShows([]);
    setEnrichedCount(0);
    setShowLoading(true);

    controllerRef.current = fetchEnrichedHistory('shows', {
      onProgress: (data) => {
        setProgress(data.progress);
        setProgressMessage(data.message);
        setProgressStep(data.step);
      },
      onResult: (data) => {
        if (data.type === 'result') {
          setLocalShows(data.data || []);
          setLoading(false);
          setEnriching(true);
          setProgressMessage('正在获取海报和详细信息...');
        }
        if (data.type === 'enriched_result') {
          const finalData = data.data || [];
          setLocalShows(finalData);
          setShowData(finalData);
          setEnriching(false);
          setShowLoading(false);
          setProgressMessage('加载完成');
        }
      },
      onItem: (data) => {
        setLocalShows(prev => {
          const newArr = [...prev];
          if (data.index < newArr.length) {
            newArr[data.index] = data.item;
          }
          return newArr;
        });
        setEnrichedCount(data.index + 1);
      },
      onError: (msg) => {
        setError(msg);
        setLoading(false);
        setEnriching(false);
        setShowLoading(false);
      },
    });
  };

  const filteredShows = localShows.filter(item => {
    const title = item.show?.title || '';
    const year = item.show?.year?.toString() || '';
    const search = searchTerm.toLowerCase();
    return title.toLowerCase().includes(search) || year.includes(search);
  });

  const sortedShows = [...filteredShows].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return (a.show?.title || '').localeCompare(b.show?.title || '');
      case 'year':
        return (b.show?.year || 0) - (a.show?.year || 0);
      case 'rating':
        return (b._enriched?.vote_average || 0) - (a._enriched?.vote_average || 0);
      case 'date':
      default:
        return new Date(b.watched_at || b._lastWatched || 0) - new Date(a.watched_at || a._lastWatched || 0);
    }
  });

  if (loading) {
    return <LoadingProgress progress={progress} message={progressMessage} step={progressStep} />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#FF3B30]/10 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">加载失败</h2>
          <p className="text-white/40 mb-4">{error}</p>
          <button onClick={() => { setShowData(null); loadShows(); }} className="px-6 py-3 bg-[#007AFF] text-white rounded-2xl text-sm font-semibold hover:bg-[#007AFF]/90 transition-colors">
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Poster wall background */}
      <PosterWall items={localShows} />

      {/* Decorative background elements - 增强光晕 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#FF9500]/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#FF2D55]/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-[#AF52DE]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-[#007AFF]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with rating ring */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-5">
            <div>
              <h1 className="text-3xl font-bold text-white">剧集</h1>
              <p className="text-white/40 mt-1">
                共 {localShows.length} 部
                {enriching && enrichedCount > 0 && (
                  <span className="ml-2 text-[#007AFF]">· 已加载 {enrichedCount}/{localShows.length} 张海报</span>
                )}
              </p>
            </div>
            {(() => {
              const ratings = localShows.filter(m => m._enriched?.vote_average);
              const avg = ratings.length > 0 ? ratings.reduce((s, m) => s + (m._enriched?.vote_average || 0), 0) / ratings.length : 0;
              const angle = (avg / 10) * 360;
              return (
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#FF9500" strokeWidth="3"
                      strokeDasharray={`${angle} ${360 - angle}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-sm font-bold text-white leading-none">{avg.toFixed(1)}</span>
                    <span className="text-[8px] text-white/40 mt-0.5">评分</span>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="搜索剧集..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]/50 transition-all w-48"
              />
            </div>
            <div className="flex bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-0.5">
              {[
                { value: 'date', label: '最近' },
                { value: 'title', label: '名称' },
                { value: 'year', label: '年份' },
                { value: 'rating', label: '评分' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
                    sortBy === opt.value
                      ? 'bg-[#FF9500] text-white shadow-sm'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Enriching indicator */}
        {enriching && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white/10 backdrop-blur-sm rounded-2xl text-sm text-[#5AC8FA] font-medium mb-6 animate-fade-in border border-white/10">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>正在获取海报和详细信息 ({enrichedCount}/{localShows.length})...</span>
          </div>
        )}

        {/* Show Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sortedShows.map((item, index) => (
            <ShowCard key={item.show?.ids?.trakt || index} item={item} index={index} onClick={setSelectedShow} />
          ))}
        </div>

        {sortedShows.length === 0 && (
          <div className="text-center py-20">
            <span className="text-5xl mb-4 block">📺</span>
            <h3 className="text-xl font-semibold text-white mb-2">没有找到匹配的剧集</h3>
            <p className="text-white/40">尝试修改搜索条件</p>
          </div>
        )}
      </div>

      {/* Show Detail Modal */}
      {selectedShow && (
        <ShowDetail item={selectedShow} onClose={() => setSelectedShow(null)} />
      )}
    </div>
  );
}
