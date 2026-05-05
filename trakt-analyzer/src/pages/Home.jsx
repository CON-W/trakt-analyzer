import React, { useState, useEffect, useRef } from 'react';
import { traktApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverReady, setServerReady] = useState(false);
  const [loginStatus, setLoginStatus] = useState('');
  const [statusType, setStatusType] = useState('info'); // 'info' | 'success' | 'error'
  const popupRef = useRef(null);
  const listenerRef = useRef(null);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await traktApi.health();
        setServerReady(response.data.configured);
      } catch {
        setServerReady(false);
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        window.removeEventListener('message', listenerRef.current);
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setLoginStatus('正在获取认证链接...');
    setStatusType('info');

    try {
      const response = await traktApi.getAuthUrl();
      setLoginStatus('正在打开 Trakt 登录窗口...');
      setStatusType('info');

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      const popup = window.open(
        response.data.url,
        'Trakt Login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );
      popupRef.current = popup;

      if (!popup || popup.closed) {
        setError('弹窗被浏览器拦截，请允许弹窗后重试');
        setStatusType('error');
        setLoading(false);
        setLoginStatus('');
        return;
      }

      setLoginStatus('请在打开的 Trakt 窗口中完成授权...');
      setStatusType('info');

      // Listen for message from popup
      const handleMessage = async (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type === 'TRAKT_AUTH') {
          setLoginStatus('正在接收授权，请稍候...');
          setStatusType('info');
          const { code, state } = event.data;
          const success = await login(code, state);
          if (success) {
            setLoginStatus('登录成功！正在跳转...');
            setStatusType('success');
            setTimeout(() => {
              window.location.href = `${import.meta.env.BASE_URL}dashboard`;
            }, 500);

          } else {
            setError('登录失败，请重试');
            setStatusType('error');
            setLoginStatus('');
          }
          setLoading(false);
        }
      };

      listenerRef.current = handleMessage;
      window.addEventListener('message', handleMessage);

      // Poll for popup close
      pollTimerRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(pollTimerRef.current);
          if (loading) {
            setError('登录已取消');
            setStatusType('error');
            setLoading(false);
            setLoginStatus('');
          }
        }
      }, 1000);

    } catch (err) {
      setError('无法连接到服务器，请确保服务器已启动');
      setStatusType('error');
      setLoading(false);
      setLoginStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-gradient-to-br from-[#007AFF]/5 to-[#AF52DE]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-gradient-to-br from-[#34C759]/5 to-[#5AC8FA]/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[#007AFF]/3 to-[#AF52DE]/3 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#007AFF]/10 rounded-full text-sm font-medium text-[#007AFF] mb-8 animate-fade-in">
            <span className="w-2 h-2 bg-[#007AFF] rounded-full animate-pulse" />
            Trakt.tv 数据分析工具
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in">
            <span className="gradient-text">你的观看记录</span>
            <br />
            <span className="text-white">值得被分析</span>
          </h1>

          {/* Description */}
          <p className="text-lg sm:text-xl text-white/40 leading-relaxed mb-12 animate-fade-in max-w-lg mx-auto">
            连接你的 Trakt 账号，探索你的观影习惯。
            从观看趋势到内容偏好，用数据讲述你的观影故事。
          </p>

          {/* CTA Section */}
          <div className="animate-fade-in">
            {!serverReady ? (
              <div className="flex flex-col items-center gap-4">
                <button
                  disabled
                  className="px-10 py-4 bg-[#007AFF]/50 text-white rounded-2xl text-lg font-semibold cursor-not-allowed inline-flex items-center gap-3"
                >
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  正在连接服务器...
                </button>
                <p className="text-sm text-[#8E8E93]">
                  请先启动后端服务器
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className={`px-10 py-4 bg-[#007AFF] text-white rounded-2xl text-lg font-semibold 
                    inline-flex items-center gap-3 transition-all duration-300
                    ${loading ? 'opacity-80 cursor-wait' : 'hover:bg-[#007AFF]/90 hover:shadow-lg hover:shadow-[#007AFF]/25 active:scale-[0.98]'}
                  `}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      授权中...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                      通过 Trakt 登录
                    </>
                  )}
                </button>

                {/* Status Messages */}
                {loginStatus && (
                  <div className={`
                    flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium animate-fade-in
                    ${statusType === 'success' ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#007AFF]/10 text-[#007AFF]'}
                  `}>
                    {statusType === 'success' ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {loginStatus}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 px-5 py-3 bg-[#FF3B30]/10 rounded-2xl text-sm font-medium text-[#FF3B30] animate-fade-in">
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
                    </svg>
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Features */}
          <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              { emoji: '📊', title: '观看统计', desc: '总观看次数、独特内容、连续观看天数等关键指标一目了然' },
              { emoji: '📈', title: '趋势分析', desc: '按年、月、星期和小时分析你的观看模式' },
              { emoji: '🏆', title: '内容排行', desc: '发现你反复观看的内容，了解你的最爱排行榜' },
            ].map((f, i) => (
              <div key={i} className="bg-[#1C1C1E] rounded-2xl p-6 border border-white/5 hover:shadow-2xl hover:shadow-black/10 transition-all duration-500 hover:-translate-y-1">
                <span className="text-2xl mb-3 block">{f.emoji}</span>
                <h3 className="text-base font-semibold text-white mb-1">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs text-white/30">
            基于{' '}
            <a href="https://github.com/xbgmsharp/trakt" target="_blank" rel="noopener noreferrer" className="text-[#007AFF] hover:underline">
              xbgmsharp/trakt
            </a>
            {' '}构建 · 使用 Trakt.tv API
          </p>
        </div>
      </footer>
    </div>
  );
}
