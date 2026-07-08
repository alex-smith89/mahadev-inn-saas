// src/components/BranchDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { useBranchData } from '@/context/BranchDataContext';

const API_URL = 'http://localhost:4000/api';

export function BranchDashboard() {
  const { selectedBranch, branchData, setBranchData, refreshBranchData, lastRefreshed } = useBranchData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadBranchData = async () => {
    if (!selectedBranch) return;
    
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/branch/${selectedBranch}/data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load branch data');
      }

      const data = await response.json();
      if (data.success) {
        setBranchData({
          ...branchData,
          bookings: data.data.bookings,
          stats: {
            totalBookings: data.data.totalBookings,
            activeBookings: data.data.activeBookings,
            totalRevenue: data.data.totalRevenue,
            totalRooms: data.data.totalRooms,
          },
          branchInfo: {
            branch: data.data.branch,
            users: data.data.branchUsers,
          },
          lastUpdated: data.data.lastUpdated
        });
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading branch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBranch) {
      loadBranchData();
    }
  }, [selectedBranch]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!selectedBranch) return;

    const interval = setInterval(() => {
      loadBranchData();
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedBranch]);

  if (!selectedBranch) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please select a branch to view data
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Branch Info */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              📍 {selectedBranch}
            </h3>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(lastRefreshed).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={loadBranchData}
            className="text-indigo-600 hover:text-indigo-800 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Total Bookings</p>
          <p className="text-2xl font-bold text-gray-800">
            {branchData.stats?.totalBookings || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Active Bookings</p>
          <p className="text-2xl font-bold text-gray-800">
            {branchData.stats?.activeBookings || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-800">
            Rs. {(branchData.stats?.totalRevenue || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">Total Rooms</p>
          <p className="text-2xl font-bold text-gray-800">
            {branchData.stats?.totalRooms || 0}
          </p>
        </div>
      </div>

      {/* Recent Bookings */}
      {branchData.bookings && branchData.bookings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h4 className="font-semibold text-gray-800 mb-3">Recent Bookings</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Booking No</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {branchData.bookings.slice(0, 10).map((booking: any) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-medium text-indigo-600">{booking.bookingNo}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{booking.agentName}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{booking.roomType}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(booking.bookingStatus)}`}>
                        {booking.bookingStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Confirmed':
    case 'Confirm':
      return 'bg-green-100 text-green-800';
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'CheckedIn':
      return 'bg-blue-100 text-blue-800';
    case 'CheckedOut':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}