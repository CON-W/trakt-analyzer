import React from 'react';

// ============ 横向滚动区域的骨架卡片 ============
export function SkeletonCard({ count = 5, width = 'w-44' }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex-shrink-0 ${width} animate-pulse`}>
          <div className="aspect-[2/3] rounded-2xl bg-white/5 mb-3" />
          <div className="h-4 bg-white/5 rounded-lg mb-2 w-3/4" />
          <div className="h-3 bg-white/5 rounded-lg w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ============ 人物圆形骨架 ============
export function SkeletonPerson({ count = 4 }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-28 animate-pulse">
          <div className="w-20 h-20 mx-auto rounded-full bg-white/5 mb-3" />
          <div className="h-4 bg-white/5 rounded-lg mx-auto w-16 mb-1" />
          <div className="h-3 bg-white/5 rounded-lg mx-auto w-12" />
        </div>
      ))}
    </div>
  );
}

// ============ 类型标签骨架 ============
export function SkeletonGenre() {
  return (
    <div className="flex flex-wrap gap-2 animate-pulse">
      {['w-16', 'w-20', 'w-14', 'w-24', 'w-18', 'w-16', 'w-22', 'w-14'].map((w, i) => (
        <div key={i} className={`h-8 ${w} rounded-xl bg-white/5`} />
      ))}
    </div>
  );
}

// ============ 轻量刷新 Toast ============
export function RefreshToast({ visible, message }) {
  if (!visible) return null;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-[#1C1C1E]/90 backdrop-blur-xl rounded-full px-5 py-2.5 shadow-lg border border-white/10 flex items-center gap-2.5">
        <div className="w-4 h-4 border-2 border-[#007AFF]/30 border-t-[#007AFF] rounded-full animate-spin" />
        <span className="text-sm text-white/70">{message || '正在刷新...'}</span>
      </div>
    </div>
  );
}
