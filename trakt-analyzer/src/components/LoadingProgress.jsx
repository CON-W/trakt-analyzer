import React, { useState, useEffect } from 'react';

const loadingMessages = [
  { icon: '📡', text: '正在连接 Trakt 服务器...' },
  { icon: '🔍', text: '正在搜索你的观影记录...' },
  { icon: '🎬', text: '正在整理电影数据...' },
  { icon: '📺', text: '正在整理剧集数据...' },
  { icon: '✨', text: '正在获取海报和详细信息...' },
  { icon: '📊', text: '正在生成分析报告...' },
  { icon: '🎯', text: '正在计算统计数据...' },
  { icon: '⭐', text: '正在获取评分信息...' },
  { icon: '🔄', text: '正在去重合并数据...' },
  { icon: '🏆', text: '正在找出你的最爱...' },
];

export default function LoadingProgress({ progress, message, step }) {
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Cycle through messages every 2.5 seconds
  useEffect(() => {
    if (step === 'complete') return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentMsgIndex(prev => (prev + 1) % loadingMessages.length);
        setVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, [step]);

  const getStepIcon = (stepName) => {
    switch (stepName) {
      case 'fetch': return '📡';
      case 'enrich': return '✨';
      case 'analyze': return '📊';
      case 'complete': return '✅';
      default: return '⏳';
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full animate-fade-in">
        <div className="bg-[#1C1C1E] backdrop-blur-xl rounded-3xl p-8 text-center shadow-lg border border-white/5">
          {/* Animated icon */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-[#007AFF]/10 rounded-full animate-ping" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-[#007AFF] to-[#AF52DE] rounded-full flex items-center justify-center shadow-lg">
              <span className="text-3xl">{getStepIcon(step)}</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-white mb-3">
            {step === 'complete' ? '分析完成！' : '正在分析你的观影记录'}
          </h3>

          {/* Animated message cycling */}
          {step !== 'complete' && (
            <div className="h-12 flex items-center justify-center mb-6">
              <div className={`transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                <p className="text-sm text-[#8E8E93]">
                  <span className="mr-2">{loadingMessages[currentMsgIndex].icon}</span>
                  {loadingMessages[currentMsgIndex].text}
                </p>
              </div>
            </div>
          )}

          {/* Status message from server */}
          {message && (
            <p className="text-xs text-[#AEAEB2] mb-4 min-h-[16px]">
              {message}
            </p>
          )}

          {/* Progress bar */}
          <div className="w-full bg-white/10 rounded-full h-1.5 mb-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#007AFF] to-[#AF52DE] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* Percentage */}
          <p className="text-xs text-[#AEAEB2] font-medium">
            {Math.min(progress, 100)}%
          </p>

          {/* Tips */}
          {step !== 'complete' && (
            <div className="mt-6 p-3 bg-white/5 rounded-2xl">
              <p className="text-xs text-white/40">
                💡 首次加载需要从 Trakt 获取数据，请耐心等待
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
