// src/app/bookings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiEdit2, FiTrash2, FiEye } from 'react-icons/fi';

const API_URL = 'http://localhost:4000/api';

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Normalize branch name
  const normalizeBranchName = (branchName: string) => {
    if (!branchName) return '';
    const lower = branchName.toLowerCase().trim();
    if (lower === 'bhairawa' || lower === 'bhairawaha') return 'Bhairawaha';
    if (lower === 'ktm1' || lower === 'kathmandu1') return 'Kathmandu1';
    if (lower === 'ktm2' || lower === 'kathmandu2') return 'Kathmandu2';
    if (lower === 'pokhara') return 'Pokhara';
    return branchName;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        
        let userBranches = [];
        if (Array.isArray(userData.branches)) {
          userBranches = userData.branches;
        } else if (typeof userData.branches === 'string') {
          userBranches = userData.branches.split(',').map((b: string) => b.trim());
        } else if (userData.branches && typeof userData.branches === 'object') {
          userBranches = Object.values(userData.branches);
        }
        
        userBranches = userBranches.map((b: string) => normalizeBranchName(b));
        userBranches = [...new Set(userBranches)];
        
        setBranches(userBranches);
        setIsOwner(userData.role === 'OWNER');
        setIsManager(userData.role === 'MANAGER');
        setIsViewer(userData.role === 'VIEWER');
        
        let savedBranch = localStorage.getItem('selectedBranch');
        if (savedBranch && userBranches.includes(savedBranch)) {
          setSelectedBranch(savedBranch);
        } else if (userBranches.length > 0) {
          setSelectedBranch(userBranches[0]);
        }
        
        console.log('✅ User loaded:', userData);
        console.log('👤 Role:', userData.role);
        console.log('🔑 Is Owner:', userData.role === 'OWNER');
      } catch (e) {
        console.error('Error parsing user:', e);
        router.push('/login');
        return;
      }
    }
    
    fetchBookings();
  }, [router]);

  // ✅ Check for refresh query param
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const refreshParam = queryParams.get('refresh');
    
    if (refreshParam === 'true') {
      console.log('🔄 Refresh triggered from query param');
      window.history.replaceState({}, '', '/bookings');
      setTimeout(() => {
        fetchBookings(true);
      }, 500);
    }
  }, []);

  // ✅ Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'forceRefresh' || e.key === 'bookings' || e.key === 'bookingUpdated') {
        console.log('📦 Storage changed, refreshing bookings...');
        fetchBookings(true);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    // ✅ Listen for custom event
    const handleBookingCreated = () => {
      console.log('📢 Booking created, refreshing bookings...');
      fetchBookings(true);
    };
    
    window.addEventListener('bookingCreated', handleBookingCreated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingCreated', handleBookingCreated);
    };
  }, []);

  // Auto-refresh when branch changes
  useEffect(() => {
    if (selectedBranch) {
      fetchBookings(true);
    }
  }, [selectedBranch]);

  const fetchBookings = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError('');
      
      if (forceRefresh) {
        localStorage.removeItem('bookings');
      }
      
      const token = localStorage.getItem('token');
      const branch = selectedBranch || user?.branches?.[0] || '';

      console.log('📋 Fetching bookings for branch:', branch);

      const response = await fetch(`${API_URL}/bookings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok) {
        const data = await response.json();
        let allBookings = data.bookings || data.data || [];
        
        // Normalize branch names
        allBookings = allBookings.map((b: any) => {
          const bookingBranch = b.branch || b.branchName || '';
          const normalizedBranch = normalizeBranchName(bookingBranch);
          return { ...b, branch: normalizedBranch, branchName: normalizedBranch };
        });
        
        // Filter by branch
        let filteredBookings = allBookings;
        if (branch) {
          filteredBookings = allBookings.filter((b: any) => {
            const bookingBranch = b.branch || b.branchName || '';
            return bookingBranch === branch;
          });
        }
        
        setBookings(filteredBookings);
        localStorage.setItem('bookings', JSON.stringify(filteredBookings));
        console.log(`📋 Loaded ${filteredBookings.length} bookings`);
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      } else {
        setError('Failed to fetch bookings');
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    localStorage.setItem('selectedBranch', branch);
  };

  // ✅ Edit Booking Handler - Navigate to edit page
  const handleEditBooking = (booking: any) => {
    if (isViewer) {
      alert('You do not have permission to edit bookings.');
      return;
    }
    router.push(`/bookings/edit/${booking.id}`);
  };

  // ✅ Delete Booking Handler with confirmation
  const handleDeleteBooking = async (booking: any) => {
    if (isViewer) {
      alert('You do not have permission to delete bookings.');
      return;
    }

    if (isManager) {
      alert('Only owners can delete bookings.');
      return;
    }

    // Confirm deletion
    const confirmMessage = `Are you sure you want to delete booking #${booking.bookingNo} for "${booking.agentName}"?\n\nThis action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setDeletingId(booking.id);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/bookings/${booking.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Remove from local state
        setBookings(prev => prev.filter(b => b.id !== booking.id));
        
        // Clear caches
        localStorage.removeItem('bookings');
        localStorage.removeItem('allBookingsCache');
        localStorage.setItem('forceRefresh', Date.now().toString());
        
        // Show success message
        alert(`✅ Booking #${booking.bookingNo} deleted successfully!`);
        
        // Refresh data
        await fetchBookings(true);
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to delete booking: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error deleting booking:', err);
      alert(`❌ Error deleting booking: ${err.message || 'Please try again'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmed':
      case 'Confirm':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      case 'CheckedIn':
        return 'bg-blue-100 text-blue-800';
      case 'CheckedOut':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Confirmed':
      case 'Confirm':
        return '✅';
      case 'Pending':
        return '⏳';
      case 'Cancelled':
        return '❌';
      case 'CheckedIn':
        return '📥';
      case 'CheckedOut':
        return '📤';
      default:
        return '📌';
    }
  };

  // ✅ Format check-in date with time for today's bookings
  const formatCheckInDisplay = (checkIn: string) => {
    if (!checkIn) return 'N/A';
    
    const checkInDate = new Date(checkIn);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const checkInDay = new Date(checkInDate);
    checkInDay.setHours(0, 0, 0, 0);
    
    const isToday = checkInDay.getTime() === today.getTime();
    const hasTime = checkInDate.getHours() !== 0 || checkInDate.getMinutes() !== 0 || checkInDate.getSeconds() !== 0;
    
    const dateStr = checkInDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    const timeStr = hasTime ? checkInDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) : '';
    
    if (isToday && hasTime) {
      return `Today ${timeStr}`;
    }
    
    return hasTime ? `${dateStr} ${timeStr}` : dateStr;
  };

  const filteredBookings = filterStatus === 'all' 
    ? bookings 
    : bookings.filter(b => b.bookingStatus === filterStatus || (filterStatus === 'Confirm' && (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed')));

  const displayBranchName = selectedBranch || 'All Branches';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm sm:text-base">
              <span className="mr-1 sm:mr-2">←</span>
              Back to Dashboard
            </Link>
            <h2 className="text-base sm:text-xl font-semibold text-gray-800">Bookings - {displayBranchName}</h2>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
            {branches.length > 0 && (
              <select
                value={selectedBranch || branches[0]}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="text-xs sm:text-sm border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white"
              >
                {branches.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => fetchBookings(true)}
              className="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm"
            >
              🔄 Refresh
            </button>
            {(isManager || isOwner) && (
              <Link href="/bookings/new" className="bg-indigo-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-indigo-700 transition-colors text-xs sm:text-sm">
                + New Booking
              </Link>
            )}
            {isViewer && (
              <span className="bg-purple-100 text-purple-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium">
                🔍 View Only
              </span>
            )}
            <button 
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('selectedBranch');
                router.push('/login');
              }}
              className="bg-red-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-6">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📋 All ({bookings.length})
          </button>
          <button
            onClick={() => setFilterStatus('Confirm')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filterStatus === 'Confirm' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ✅ Confirmed ({bookings.filter(b => b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed').length})
          </button>
          <button
            onClick={() => setFilterStatus('Pending')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filterStatus === 'Pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ⏳ Pending ({bookings.filter(b => b.bookingStatus === 'Pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('CheckedIn')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filterStatus === 'CheckedIn' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📥 Checked In ({bookings.filter(b => b.bookingStatus === 'CheckedIn').length})
          </button>
          <button
            onClick={() => setFilterStatus('CheckedOut')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filterStatus === 'CheckedOut' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📤 Checked Out ({bookings.filter(b => b.bookingStatus === 'CheckedOut').length})
          </button>
          <button
            onClick={() => setFilterStatus('Cancelled')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filterStatus === 'Cancelled' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ❌ Cancelled ({bookings.filter(b => b.bookingStatus === 'Cancelled').length})
          </button>
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-gray-500 text-sm sm:text-lg">No bookings found in {displayBranchName}</p>
              {(isManager || isOwner) && (
                <Link href="/bookings/new" className="text-indigo-600 hover:underline mt-2 inline-block text-sm">
                  Create your first booking →
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Booking No</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Guest</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Branch</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Room Type</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Check In</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Check Out</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Status</th>
                    {/* ✅ Actions column - Only show for Owner and Manager */}
                    {(isOwner || isManager) && (
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm font-medium text-indigo-600">{booking.bookingNo}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-900">{booking.agentName}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden sm:table-cell">
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs bg-indigo-100 text-indigo-700 rounded-full">
                          {booking.branch}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">{booking.roomType}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">
                        {formatCheckInDisplay(booking.checkIn)}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">
                        {new Date(booking.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs rounded-full ${getStatusColor(booking.bookingStatus)} whitespace-nowrap`}>
                          {getStatusIcon(booking.bookingStatus)} {booking.bookingStatus}
                        </span>
                      </td>
                      {/* ✅ Actions - Only visible to Owner and Manager */}
                      {(isOwner || isManager) && (
                        <td className="px-3 sm:px-6 py-2 sm:py-4">
                          <div className="flex items-center gap-1 sm:gap-2">
                            {/* Edit button - Owner only */}
                            {isOwner && (
                              <button
                                onClick={() => handleEditBooking(booking)}
                                className="p-1 sm:p-1.5 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded-lg transition-colors"
                                title="Edit booking"
                              >
                                <FiEdit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                            )}
                            
                            {/* Delete button - Owner only */}
                            {isOwner && (
                              <button
                                onClick={() => handleDeleteBooking(booking)}
                                disabled={deletingId === booking.id}
                                className={`p-1 sm:p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors ${
                                  deletingId === booking.id ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                title="Delete booking"
                              >
                                {deletingId === booking.id ? (
                                  <span className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-red-600 inline-block"></span>
                                ) : (
                                  <FiTrash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                )}
                              </button>
                            )}
                            
                            {/* Manager - View only (no edit/delete) */}
                            {isManager && !isOwner && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <FiEye className="w-3 h-3" />
                                View
                              </span>
                            )}
                            
                            {/* Viewer - View only */}
                            {isViewer && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <FiEye className="w-3 h-3" />
                                View
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mt-4 text-[10px] sm:text-sm text-gray-500 flex flex-wrap justify-between items-center gap-2">
          <span>
            Total: <span className="font-semibold">{filteredBookings.length}</span> bookings in {displayBranchName}
            {filterStatus !== 'all' && <span className="ml-2">(Filtered by: {filterStatus})</span>}
          </span>
          <span>
            {isOwner && '👑 Owner - Full access'}
            {isManager && '📋 Manager - View access'}
            {isViewer && '🔍 Viewer - Read only'}
          </span>
        </div>
      </div>
    </div>
  );
}