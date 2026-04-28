import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('正在处理授权...');
  const [statusType, setStatusType] = useState('loading'); // 'loading' | 'success' | 'error'

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      // Try to send message to opener (popup mode)
      if (window.opener && !window.opener.closed) {
        setStatus('授权成功！正在通知主窗口...');
        setStatusType('success');
        window.opener.postMessage(
          { type: 'TRAKT_AUTH', code, state },
          window.location.origin
        );
        setTimeout(() => {
          setStatus('窗口即将关闭...');
          setTimeout(() => window.close(), 800);
        }, 500);
      } else {
        // Fallback: redirect to main page with params
        setStatus('正在重定向到主页面...');
        setStatusType('loading');
        setTimeout(() => {
          window.location.href = `/?code=${code}&state=${state}`;
        }, 500);
      }
    } else {
      setStatus('授权失败：缺少必要参数');
      setStatusType('error');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-[#1C1C1E] rounded-3xl p-8 text-center max-w-sm w-full animate-fade-in border border-white/5">
        {/* Icon */}
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
          statusType === 'success' ? 'bg-[#34C759]/10' :
          statusType === 'error' ? 'bg-[#FF3B30]/10' :
          'bg-[#007AFF]/10'
        }`}>
          {statusType === 'success' ? (
            <svg className="w-8 h-8 text-[#34C759]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : statusType === 'error' ? (
            <svg className="w-8 h-8 text-[#FF3B30]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg className="animate-spin w-7 h-7 text-[#007AFF]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold text-white mb-2">
          {statusType === 'success' ? '授权成功' :
           statusType === 'error' ? '授权失败' :
           'Trakt 授权'}
        </h2>

        {/* Status */}
        <p className={`text-sm ${
          statusType === 'success' ? 'text-[#34C759]' :
          statusType === 'error' ? 'text-[#FF3B30]' :
          'text-[#8E8E93]'
        }`}>
          {status}
        </p>

        {/* Progress bar for loading */}
        {statusType === 'loading' && (
          <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#007AFF] rounded-full animate-progress" style={{ width: '60%' }} />
          </div>
        )}

        {/* Close hint for success */}
        {statusType === 'success' && (
          <p className="mt-4 text-xs text-[#AEAEB2]">
            此窗口将自动关闭
          </p>
        )}

        {/* Retry button for error */}
        {statusType === 'error' && (
          <button
            onClick={() => window.close()}
            className="mt-4 px-6 py-2 bg-[#007AFF] text-white rounded-2xl text-sm font-semibold hover:bg-[#007AFF]/90 transition-colors"
          >
            关闭窗口
          </button>
        )}
      </div>
    </div>
  );
}
