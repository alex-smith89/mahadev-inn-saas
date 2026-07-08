'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface BookingChartProps {
  bookings: any[];
}

export default function BookingChart({ bookings }: BookingChartProps) {
  const [chartData, setChartData] = useState<any>(null);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'doughnut'>('bar');

  useEffect(() => {
    if (!bookings || bookings.length === 0) {
      setChartData({
        bar: {
          labels: ['No Data'],
          datasets: [{
            label: 'Bookings',
            data: [0],
            backgroundColor: ['#e5e7eb'],
            borderColor: ['#9ca3af'],
            borderWidth: 1,
          }],
        },
        line: {
          labels: ['No Data'],
          datasets: [{
            label: 'Booking Trend',
            data: [0],
            borderColor: '#e5e7eb',
            backgroundColor: 'rgba(229, 231, 235, 0.1)',
          }],
        },
        doughnut: {
          labels: ['No Data'],
          datasets: [{
            data: [1],
            backgroundColor: ['#e5e7eb'],
            borderColor: '#ffffff',
            borderWidth: 2,
          }],
        },
      });
      return;
    }

    // Group bookings by date (last 30 days)
    const bookingsByDate: { [key: string]: number } = {};
    const now = new Date();
    const last30Days = [];

    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      last30Days.push(key);
      bookingsByDate[key] = 0;
    }

    // Count bookings by date
    bookings.forEach((booking) => {
      if (booking.checkIn) {
        const date = new Date(booking.checkIn).toISOString().split('T')[0];
        if (bookingsByDate[date] !== undefined) {
          bookingsByDate[date]++;
        }
      }
    });

    // Prepare labels
    const labels = last30Days.map(date => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const data = last30Days.map(date => bookingsByDate[date] || 0);

    // Get booking status distribution
    const statusCount: { [key: string]: number } = {};
    bookings.forEach((booking) => {
      const status = booking.bookingStatus || 'Unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    const statusLabels = Object.keys(statusCount);
    const statusData = Object.values(statusCount);
    const statusColors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#6b7280', '#8b5cf6'];

    // Get current date for today's date marker
    const today = new Date().toISOString().split('T')[0];
    const todayIndex = last30Days.indexOf(today);

    // Check if there's any data
    const hasData = data.some(val => val > 0);

    // Create bar chart data with colors based on activity
    const barColors = data.map((val: number, index: number) => {
      if (val > 0) {
        // Check if this is today
        if (index === todayIndex) {
          return '#7c3aed'; // Purple for today
        }
        return '#4f46e5'; // Indigo for other days
      }
      return '#e5e7eb'; // Gray for no data
    });

    setChartData({
      bar: {
        labels,
        datasets: [{
          label: 'Daily Bookings',
          data: data,
          backgroundColor: barColors,
          borderColor: barColors.map((color: string) => color === '#e5e7eb' ? '#9ca3af' : '#4f46e5'),
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      line: {
        labels,
        datasets: [{
          label: 'Booking Trend',
          data: data,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: data.map((val: number, index: number) => {
            if (val > 0) {
              return index === todayIndex ? '#7c3aed' : '#4f46e5';
            }
            return '#e5e7eb';
          }),
          pointBorderColor: '#4f46e5',
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      doughnut: {
        labels: statusLabels.length > 0 ? statusLabels : ['No Data'],
        datasets: [{
          data: statusLabels.length > 0 ? statusData : [1],
          backgroundColor: statusLabels.length > 0 
            ? statusLabels.map((_, i) => statusColors[i % statusColors.length])
            : ['#e5e7eb'],
          borderColor: '#ffffff',
          borderWidth: 2,
        }],
      },
    });
  }, [bookings]);

  if (!chartData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const renderChart = () => {
    const hasData = bookings.length > 0;

    if (!hasData) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-lg">No booking data available</p>
          <p className="text-sm">Create your first booking to see analytics</p>
        </div>
      );
    }

    const barOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              return `${context.raw} bookings`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: {
            color: 'rgba(0,0,0,0.05)',
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 15,
            font: {
              size: 10,
            },
          },
        },
      },
    };

    const lineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: {
            color: 'rgba(0,0,0,0.05)',
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 15,
            font: {
              size: 10,
            },
          },
        },
      },
    };

    const doughnutOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = total > 0 ? Math.round((context.raw / total) * 100) : 0;
              return `${context.label}: ${context.raw} (${percentage}%)`;
            }
          }
        }
      },
      cutout: '60%',
    };

    switch (chartType) {
      case 'bar':
        return <Bar data={chartData.bar} options={barOptions} />;
      case 'line':
        return <Line data={chartData.line} options={lineOptions} />;
      case 'doughnut':
        return <Doughnut data={chartData.doughnut} options={doughnutOptions} />;
      default:
        return <Bar data={chartData.bar} options={barOptions} />;
    }
  };

  // Get booking stats for summary
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(b => b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Confirm').length;
  const pendingBookings = bookings.filter(b => b.bookingStatus === 'Pending').length;
  const cancelledBookings = bookings.filter(b => b.bookingStatus === 'Cancelled').length;

  return (
    <div>
      {/* Chart Type Selector */}
      <div className="flex justify-end space-x-2 mb-4">
        <button
          onClick={() => setChartType('bar')}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            chartType === 'bar'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Bar
        </button>
        <button
          onClick={() => setChartType('line')}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            chartType === 'line'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Line
        </button>
        <button
          onClick={() => setChartType('doughnut')}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            chartType === 'doughnut'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Status
        </button>
      </div>

      {/* Chart Container */}
      <div className="h-64">
        {renderChart()}
      </div>

      {/* Summary Stats */}
      {bookings.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xl font-bold text-indigo-600">{totalBookings}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xl font-bold text-green-600">{confirmedBookings}</p>
            <p className="text-xs text-gray-500">Confirmed</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xl font-bold text-yellow-600">{pendingBookings}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xl font-bold text-red-600">{cancelledBookings}</p>
            <p className="text-xs text-gray-500">Cancelled</p>
          </div>
        </div>
      )}
    </div>
  );
}