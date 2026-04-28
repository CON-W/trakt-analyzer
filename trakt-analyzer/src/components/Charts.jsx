import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const chartColors = {
  blue: '#007AFF',
  blueLight: 'rgba(0, 122, 255, 0.1)',
  purple: '#AF52DE',
  purpleLight: 'rgba(175, 82, 222, 0.1)',
  green: '#34C759',
  greenLight: 'rgba(52, 199, 89, 0.1)',
  orange: '#FF9500',
  orangeLight: 'rgba(255, 149, 0, 0.1)',
  pink: '#FF2D55',
  pinkLight: 'rgba(255, 45, 85, 0.1)',
  teal: '#5AC8FA',
  tealLight: 'rgba(90, 200, 250, 0.1)',
  gray: '#8E8E93',
};

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(44, 44, 46, 0.95)',
      titleFont: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 13 },
      bodyFont: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 12 },
      padding: 12,
      cornerRadius: 8,
      displayColors: false,
    },
  },
};

const darkGridColor = 'rgba(255, 255, 255, 0.06)';
const darkTickColor = 'rgba(255, 255, 255, 0.4)';

export function MonthlyChart({ data }) {
  const chartData = {
    labels: data?.map(d => d.month) || [],
    datasets: [
      {
        label: '观看次数',
        data: data?.map(d => d.count) || [],
        backgroundColor: chartColors.blueLight,
        borderColor: chartColors.blue,
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(0, 122, 255, 0.3)',
      },
    ],
  };

  const options = {
    ...defaultOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 },
          color: darkTickColor,
          maxRotation: 45,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: darkGridColor },
        ticks: {
          font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 },
          color: darkTickColor,
          stepSize: 1,
        },
      },
    },
  };

  return (
    <div className="chart-container" style={{ height: '300px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export function DayOfWeekChart({ data }) {
  const chartData = {
    labels: data?.map(d => d.day) || [],
    datasets: [
      {
        label: '观看次数',
        data: data?.map(d => d.count) || [],
        backgroundColor: [
          'rgba(255, 45, 85, 0.7)',
          'rgba(255, 149, 0, 0.7)',
          'rgba(255, 204, 0, 0.7)',
          'rgba(52, 199, 89, 0.7)',
          'rgba(90, 200, 250, 0.7)',
          'rgba(0, 122, 255, 0.7)',
          'rgba(175, 82, 222, 0.7)',
        ],
        borderColor: [
          chartColors.pink,
          chartColors.orange,
          '#FFCC00',
          chartColors.green,
          chartColors.teal,
          chartColors.blue,
          chartColors.purple,
        ],
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    ...defaultOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 },
          color: darkTickColor,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: darkGridColor },
        ticks: {
          font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 },
          color: darkTickColor,
          stepSize: 1,
        },
      },
    },
  };

  return (
    <div className="chart-container" style={{ height: '250px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export function HourChart({ data }) {
  const chartData = {
    labels: data?.map(d => d.hour) || [],
    datasets: [
      {
        label: '观看次数',
        data: data?.map(d => d.count) || [],
        fill: true,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 250);
          gradient.addColorStop(0, 'rgba(0, 122, 255, 0.3)');
          gradient.addColorStop(1, 'rgba(0, 122, 255, 0.01)');
          return gradient;
        },
        borderColor: chartColors.blue,
        borderWidth: 2,
        pointBackgroundColor: chartColors.blue,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.4,
      },
    ],
  };

  const options = {
    ...defaultOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 10 },
          color: darkTickColor,
          maxTicksLimit: 12,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: darkGridColor },
        ticks: {
          font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 },
          color: darkTickColor,
          stepSize: 1,
        },
      },
    },
  };

  return (
    <div className="chart-container" style={{ height: '250px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

export function YearlyChart({ data }) {
  const chartData = {
    labels: data?.map(d => `${d.year}年`) || [],
    datasets: [
      {
        label: '观看次数',
        data: data?.map(d => d.count) || [],
        backgroundColor: chartColors.purpleLight,
        borderColor: chartColors.purple,
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(175, 82, 222, 0.3)',
      },
    ],
  };

  const options = {
    ...defaultOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 },
          color: darkTickColor,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: darkGridColor },
        ticks: {
          font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 },
          color: darkTickColor,
          stepSize: 1,
        },
      },
    },
  };

  return (
    <div className="chart-container" style={{ height: '250px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export function TopItemsChart({ data, type }) {
  const top10 = data?.slice(0, 10) || [];
  const colors = [
    '#FF2D55', '#FF9500', '#FFCC00', '#34C759', '#5AC8FA',
    '#007AFF', '#5856D6', '#AF52DE', '#8E8E93', '#636366',
  ];

  const chartData = {
    labels: top10.map(d => d.title),
    datasets: [
      {
        data: top10.map(d => d.count),
        backgroundColor: colors.slice(0, top10.length),
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  const options = {
    ...defaultOptions,
    plugins: {
      ...defaultOptions.plugins,
      legend: {
        display: true,
        position: 'right',
        labels: {
          font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 },
          color: darkTickColor,
          padding: 12,
          boxWidth: 12,
          boxHeight: 12,
          borderRadius: 3,
        },
      },
    },
    cutout: '55%',
  };

  return (
    <div className="chart-container" style={{ height: '350px' }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
}
