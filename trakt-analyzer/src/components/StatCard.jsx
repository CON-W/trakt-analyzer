import React from 'react';

export default function StatCard({ icon, value, label, gradient = 'blue', trend, onClick }) {
  const gradientClasses = {
    blue: 'from-apple-blue to-apple-purple',
    green: 'from-apple-green to-apple-teal',
    orange: 'from-apple-orange to-apple-pink',
    purple: 'from-apple-purple to-apple-indigo',
  };

  return (
    <div
      className={`bg-[#1C1C1E] rounded-2xl p-5 border border-white/5 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientClasses[gradient]} bg-opacity-10 flex items-center justify-center`}>
          <span className="text-lg">{icon}</span>
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend > 0 ? 'bg-apple-green/10 text-apple-green' : 'bg-apple-red/10 text-apple-red'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className={`text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${gradientClasses[gradient]}`}>
        {value}
      </p>
      <p className="text-sm text-white/40 mt-1">{label}</p>
    </div>
  );
}
