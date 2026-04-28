import React from 'react';

export default function LoadingSpinner({ size = 'md', text = '加载中...' }) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizeClasses[size]} relative`}>
        <div className={`${sizeClasses[size]} border-2 border-apple-gray-200 rounded-full`} />
        <div className={`${sizeClasses[size]} border-2 border-apple-blue border-t-transparent rounded-full animate-spin absolute inset-0`} />
      </div>
      {text && <p className="text-sm text-apple-gray-400 font-medium">{text}</p>}
    </div>
  );
}
