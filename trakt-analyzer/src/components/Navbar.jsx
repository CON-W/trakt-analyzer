import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDataCache } from '../context/DataCacheContext';

// ============ 刷新倒计时 ============
function RefreshTimer({ onRefresh }) {
  const [countdown, setCountdown] = useState(300);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleDoRefresh();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleDoRefresh = async () => {
    setIsRefreshing(true);
    try { await onRefresh(); } catch (e) {}
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleManualRefresh = () => {
    setCountdown(300);
    handleDoRefresh();
  };

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const pct = (countdown / 300) * 100;
  const circumference = 2 * Math.PI * 8;
  const offset = circumference * (1 - pct / 100);

  return (
    <button
      onClick={handleManualRefresh}
      disabled={isRefreshing}
      className="group relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50"
      title="点击立即刷新"
    >
      <svg className="w-4 h-4 -rotate-90" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
        <circle
          cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-1000 ease-linear ${isRefreshing ? 'text-[#007AFF]' : 'text-white/30'}`}
          strokeLinecap="round"
        />
      </svg>
      <svg
        className={`w-3.5 h-3.5 text-white/40 group-hover:text-white/70 transition-all ${isRefreshing ? 'animate-spin text-[#007AFF]' : ''}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span className={`text-[11px] font-medium tabular-nums hidden sm:inline ${isRefreshing ? 'text-[#007AFF]' : 'text-white/40 group-hover:text-white/60'}`}>
        {isRefreshing ? '刷新中' : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
      </span>
    </button>
  );
}

// ============ 问候语（完整版） ============
function Greeting() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  let greet = '晚上好';
  let emoji = '🌙';
  if (hour < 6) { greet = '夜深了'; emoji = '🌃'; }
  else if (hour < 12) { greet = '早上好'; emoji = '☀️'; }
  else if (hour < 14) { greet = '中午好'; emoji = '🌤️'; }
  else if (hour < 18) { greet = '下午好'; emoji = '🌅'; }
  const name = user?.name || user?.username || '';
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="text-lg sm:text-xl">{emoji}</span>
      <div className="hidden sm:block">
        <h1 className="text-[17px] font-bold text-white/90 leading-tight">{greet}{name ? `，${name}` : ''}</h1>
        <p className="text-[12px] text-white/40 leading-tight mt-0.5">来看看你的观影故事吧</p>
      </div>
      <div className="sm:hidden">
        <h1 className="text-sm font-bold text-white/90 leading-tight">{greet}{name ? `，${name}` : ''}</h1>
      </div>
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { movieLoading, showLoading, setMovieData, setShowData } = useDataCache();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', label: '概览', icon: '◉', mobileIcon: '◉' },
    { path: '/movies', label: '电影', icon: '🎬', mobileIcon: '🎬' },
    { path: '/shows', label: '剧集', icon: '📺', mobileIcon: '📺' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleRefresh = () => {
    setMovieData(null);
    setShowData(null);
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      {/* 顶部导航栏 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* 左侧：问候语 */}
            <Greeting />

            {/* 中间：导航（桌面端） */}
            <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-full p-0.5 border border-white/5">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative px-4 py-1.5 text-[13px] font-medium transition-all duration-200 rounded-full ${
                    isActive(item.path)
                      ? 'text-white bg-white/15 shadow-sm'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>

            {/* 右侧：刷新 + 退出 */}
            <div className="flex items-center gap-1 sm:gap-2">
              <RefreshTimer onRefresh={handleRefresh} />
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-white/5 hover:bg-[#FF453A]/15 text-white/40 hover:text-[#FF453A] transition-all group"
                  title="退出登录"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-[12px] font-medium hidden sm:inline">退出</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 移动端底部导航栏 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black/80 backdrop-blur-2xl border-t border-white/5 safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1 transition-all ${
                isActive(item.path)
                  ? 'text-[#007AFF]'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <span className="text-lg">{item.mobileIcon}</span>
              <span className={`text-[10px] font-medium ${isActive(item.path) ? 'text-[#007AFF]' : 'text-white/40'}`}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
