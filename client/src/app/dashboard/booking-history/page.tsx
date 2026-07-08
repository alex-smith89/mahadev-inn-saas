'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = 'http://localhost:4000/api';

export default function BookingHistoryPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const router = useRouter();

  // ✅ Normalize branch name function
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
        
        // ✅ Ensure consistent branch names
        userBranches = userBranches.map((b: string) => normalizeBranchName(b));
        userBranches = [...new Set(userBranches)];
        
        setBranches(userBranches);
        setIsOwner(userData.role === 'OWNER');
        setIsViewer(userData.role === 'VIEWER');
        setIsManager(userData.role === 'MANAGER');
        
        let savedBranch = localStorage.getItem('selectedBranch');
        if (userData.role === 'OWNER') {
          if (savedBranch && (savedBranch === 'all' || userBranches.includes(savedBranch))) {
            setSelectedBranch(savedBranch);
          } else {
            setSelectedBranch('all');
            localStorage.setItem('selectedBranch', 'all');
          }
        } else {
          if (savedBranch && userBranches.includes(savedBranch)) {
            setSelectedBranch(savedBranch);
          } else if (userBranches.length > 0) {
            setSelectedBranch(userBranches[0]);
            localStorage.setItem('selectedBranch', userBranches[0]);
          }
        }
        
        console.log('✅ User loaded:', userData);
        console.log('📋 Selected branch:', selectedBranch || 'all');
        console.log('👤 User role:', userData.role);
      } catch (e) {
        console.error('Error parsing user:', e);
        router.push('/login');
        return;
      }
    }
    
    fetchBookingHistory();
  }, []);

  // ✅ Auto-refresh when branch changes
  useEffect(() => {
    if (selectedBranch && user) {
      console.log('🔄 Branch changed, fetching booking history...');
      fetchBookingHistory();
    }
  }, [selectedBranch]);

  // ✅ Auto-refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedBranch && user) {
        console.log('👁️ Page became visible, auto-refreshing booking history...');
        fetchBookingHistory();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedBranch, user]);

  // ✅ Auto-refresh on focus
  useEffect(() => {
    const handleFocus = () => {
      if (selectedBranch && user) {
        console.log('🔲 Window focused, auto-refreshing booking history...');
        fetchBookingHistory();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedBranch, user]);

  // ✅ Auto-refresh every 30 seconds
  useEffect(() => {
    if (!selectedBranch || !user) return;

    const interval = setInterval(() => {
      console.log('⏰ Auto-refresh timer triggered for booking history...');
      fetchBookingHistory();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedBranch, user]);

  const fetchBookingHistory = async () => {
    try {
      setLoading(true);
      setError('');
      setIsLocalMode(false);
      
      const token = localStorage.getItem('token');
      const branch = selectedBranch || user?.branches?.[0] || '';

      console.log('📋 Fetching booking history for branch:', branch);
      console.log('📍 API URL:', API_URL);

      let bookingsData: any[] = [];

      try {
        // ✅ Fetch all bookings
        const response = await fetch(`${API_URL}/bookings`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('📥 Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('📥 Full API response:', data);
          
          let allBookings = data.bookings || data.data || [];
          console.log(`📋 Total bookings from API:`, allBookings.length);
          
          // Log first booking to see structure
          if (allBookings.length > 0) {
            console.log('📋 First booking structure:', allBookings[0]);
          }

          // ✅ Normalize branch names for all bookings
          allBookings = allBookings.map((b: any) => {
            const bookingBranch = b.branch || b.branchName || '';
            const normalizedBranch = normalizeBranchName(bookingBranch);
            return { ...b, branch: normalizedBranch, branchName: normalizedBranch };
          });

          // ✅ Filter based on user role and selected branch
          if (user?.role === 'OWNER') {
            if (branch === 'all') {
              bookingsData = allBookings;
              console.log(`📋 Owner: Showing ALL bookings: ${bookingsData.length}`);
            } else {
              bookingsData = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === branch;
              });
              console.log(`📋 Owner: Filtered bookings for ${branch}: ${bookingsData.length}`);
            }
          } else {
            // ✅ For Manager & Viewer: Filter by selected branch ONLY
            if (branch) {
              bookingsData = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === branch;
              });
              console.log(`📋 ${user?.role}: Filtered bookings for ${branch}: ${bookingsData.length}`);
            } else {
              const firstBranch = user?.branches?.[0] || '';
              bookingsData = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === firstBranch;
              });
              console.log(`📋 ${user?.role}: Filtered bookings for ${firstBranch}: ${bookingsData.length}`);
            }
          }

          // ✅ Store in localStorage as backup
          localStorage.setItem('bookings', JSON.stringify(bookingsData));
          
        } else if (response.status === 401) {
          console.log('⚠️ Unauthorized - Token expired');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        } else {
          console.error('❌ Failed to fetch bookings. Status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          
          // Try local storage fallback
          const localBookings = JSON.parse(localStorage.getItem('bookings') || '[]');
          if (localBookings.length > 0) {
            // Normalize local bookings
            const normalizedLocal = localBookings.map((b: any) => {
              const bookingBranch = b.branch || b.branchName || '';
              const normalizedBranch = normalizeBranchName(bookingBranch);
              return { ...b, branch: normalizedBranch, branchName: normalizedBranch };
            });
            
            // Filter by branch
            let filteredLocal = [];
            if (user?.role === 'OWNER' && branch === 'all') {
              filteredLocal = normalizedLocal;
            } else {
              filteredLocal = normalizedLocal.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === branch;
              });
            }
            
            if (filteredLocal.length > 0) {
              bookingsData = filteredLocal;
              setIsLocalMode(true);
              console.log(`📋 Using ${bookingsData.length} bookings from local storage`);
            } else {
              setError('No bookings found. Please create a booking first.');
            }
          } else {
            setError('No bookings found. Please create a booking first.');
          }
        }
      } catch (err) {
        console.error('Error fetching bookings:', err);
        // Try local storage fallback
        const localBookings = JSON.parse(localStorage.getItem('bookings') || '[]');
        if (localBookings.length > 0) {
          const normalizedLocal = localBookings.map((b: any) => {
            const bookingBranch = b.branch || b.branchName || '';
            const normalizedBranch = normalizeBranchName(bookingBranch);
            return { ...b, branch: normalizedBranch, branchName: normalizedBranch };
          });
          
          let filteredLocal = [];
          if (user?.role === 'OWNER' && branch === 'all') {
            filteredLocal = normalizedLocal;
          } else {
            filteredLocal = normalizedLocal.filter((b: any) => {
              const bookingBranch = b.branch || b.branchName || '';
              return bookingBranch === branch;
            });
          }
          
          if (filteredLocal.length > 0) {
            bookingsData = filteredLocal;
            setIsLocalMode(true);
            console.log(`📋 Using ${bookingsData.length} bookings from local storage`);
          } else {
            setError('No bookings found. Please create a booking first.');
          }
        } else {
          setError('Failed to fetch booking history. Please check if the server is running.');
        }
      }

      setBookings(bookingsData);
      console.log(`📋 Final: ${bookingsData.length} booking history entries for ${branch}`);
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setError('Failed to fetch booking history');
      setLoading(false);
    }
  };

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    localStorage.setItem('selectedBranch', branch);
    if (user) {
      const updatedUser = { ...user, selectedBranch: branch };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedBranch');
    router.push('/login');
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

  const formatCurrency = (amount: number) => {
    if (!amount || amount === 0) return 'Rs. 0';
    if (amount >= 100000) {
      return `Rs. ${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `Rs. ${(amount / 1000).toFixed(1)}K`;
    }
    return `Rs. ${amount.toFixed(2)}`;
  };

  const displayBranchName = selectedBranch === 'all' ? 'All Branches' : selectedBranch;
  
  const filteredBookings = filter === 'all' 
    ? bookings 
    : bookings.filter(b => b.bookingStatus === filter);

  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(b => b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed').length;
  const pendingBookings = bookings.filter(b => b.bookingStatus === 'Pending').length;
  const checkedInBookings = bookings.filter(b => b.bookingStatus === 'CheckedIn').length;
  const checkedOutBookings = bookings.filter(b => b.bookingStatus === 'CheckedOut').length;
  const cancelledBookings = bookings.filter(b => b.bookingStatus === 'Cancelled').length;

  const totalRevenue = bookings.reduce((sum, b) => {
    const amount = Number(b.totalCost) || Number(b.roomCharges) || Number(b.price) || 0;
    return sum + amount;
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading booking history...</p>
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
            <h2 className="text-base sm:text-xl font-semibold text-gray-800">Booking History - {displayBranchName}</h2>
            {isLocalMode && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                📝 Offline Mode
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
            {branches.length > 0 && (
              <select
                value={selectedBranch || (isOwner ? 'all' : branches[0])}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="text-xs sm:text-sm border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white"
              >
                {isOwner && <option value="all">🌐 All Branches</option>}
                {branches.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            )}
            <button
              onClick={fetchBookingHistory}
              className="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm"
            >
              🔄 Refresh
            </button>
            {(isManager || isViewer) && (
              <Link href="/bookings/new" className="bg-indigo-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-indigo-700 transition-colors text-xs sm:text-sm">
                + New Booking
              </Link>
            )}
            {isOwner && (
              <span className="bg-purple-100 text-purple-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium">
                🔍 View Only
              </span>
            )}
            <button onClick={handleLogout} className="bg-red-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        {error && (
          <div className={`border px-4 py-3 rounded mb-4 ${
            error.includes('No booking') 
              ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
              : 'bg-red-100 border-red-400 text-red-700'
          }`}>
            ❌ {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-blue-500">
            <p className="text-xs sm:text-sm text-gray-500">Total Bookings</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-800">{totalBookings}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">in {displayBranchName}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-green-500">
            <p className="text-xs sm:text-sm text-gray-500">Revenue</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">from {totalBookings} bookings</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-yellow-500">
            <p className="text-xs sm:text-sm text-gray-500">Active Bookings</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{confirmedBookings + checkedInBookings}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Confirmed + Checked In</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-purple-500">
            <p className="text-xs sm:text-sm text-gray-500">Pending</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">{pendingBookings}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Awaiting confirmation</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📋 All ({totalBookings})
          </button>
          <button
            onClick={() => setFilter('Confirm')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === 'Confirm' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ✅ Confirmed ({confirmedBookings})
          </button>
          <button
            onClick={() => setFilter('Pending')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === 'Pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ⏳ Pending ({pendingBookings})
          </button>
          <button
            onClick={() => setFilter('CheckedIn')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === 'CheckedIn' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📥 Checked In ({checkedInBookings})
          </button>
          <button
            onClick={() => setFilter('CheckedOut')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === 'CheckedOut' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📤 Checked Out ({checkedOutBookings})
          </button>
          <button
            onClick={() => setFilter('Cancelled')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === 'Cancelled' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ❌ Cancelled ({cancelledBookings})
          </button>
        </div>

        {/* Booking History Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-gray-500 text-sm sm:text-lg">No booking history found in {displayBranchName}</p>
              {(isManager || isViewer) && (
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
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Branch</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Room Type</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Check In</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Check Out</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking, index) => (
                    <tr key={booking.id || booking.bookingNo || index} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm font-medium text-indigo-600">{booking.bookingNo}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-900">{booking.agentName}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 truncate max-w-[120px]">{booking.email || booking.agentEmail || 'N/A'}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden sm:table-cell">
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs bg-indigo-100 text-indigo-700 rounded-full">
                          {booking.branch}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden sm:table-cell">{booking.roomType}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">{new Date(booking.checkIn).toLocaleDateString()}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">{new Date(booking.checkOut).toLocaleDateString()}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs rounded-full ${getStatusColor(booking.bookingStatus)} whitespace-nowrap`}>
                          {getStatusIcon(booking.bookingStatus)} {booking.bookingStatus}
                        </span>
                      </td>
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
            {filter !== 'all' && <span className="ml-2">(Filtered by: {filter})</span>}
          </span>
          <span className="flex flex-wrap gap-2 sm:gap-4">
            <span className="text-green-600">✅ Confirmed: {confirmedBookings}</span>
            <span className="text-yellow-600">⏳ Pending: {pendingBookings}</span>
            <span className="text-blue-600">📥 Checked In: {checkedInBookings}</span>
            <span className="text-gray-600">📤 Checked Out: {checkedOutBookings}</span>
            <span className="text-red-600">❌ Cancelled: {cancelledBookings}</span>
          </span>
        </div>

        {/* Export Options */}
        {bookings.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => {
                const headers = ['Booking No', 'Guest Name', 'Email', 'Branch', 'Room Type', 'Check In', 'Check Out', 'Status'];
                const rows = bookings.map(b => [
                  b.bookingNo,
                  b.agentName,
                  b.email || b.agentEmail || 'N/A',
                  b.branch,
                  b.roomType,
                  new Date(b.checkIn).toLocaleDateString(),
                  new Date(b.checkOut).toLocaleDateString(),
                  b.bookingStatus
                ]);
                const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `booking_history_${displayBranchName}_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-xs sm:text-sm bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded hover:bg-gray-200"
            >
              📥 Export CSV
            </button>
            <button
              onClick={() => {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  const headers = ['Booking No', 'Guest Name', 'Email', 'Branch', 'Room Type', 'Check In', 'Check Out', 'Status'];
                  const rows = bookings.map(b => [
                    b.bookingNo,
                    b.agentName,
                    b.email || b.agentEmail || 'N/A',
                    b.branch,
                    b.roomType,
                    new Date(b.checkIn).toLocaleDateString(),
                    new Date(b.checkOut).toLocaleDateString(),
                    b.bookingStatus
                  ]);
                  
                  let html = `
                    <html>
                    <head><title>Booking History - ${displayBranchName}</title>
                    <style>
                      body { font-family: Arial, sans-serif; padding: 20px; }
                      h1 { color: #333; }
                      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                      th { background-color: #4f46e5; color: white; padding: 10px; text-align: left; }
                      td { padding: 10px; border-bottom: 1px solid #ddd; }
                      .summary { margin-top: 20px; display: flex; gap: 20px; flex-wrap: wrap; }
                      .summary-item { background: #f3f4f6; padding: 10px 15px; border-radius: 5px; }
                    </style>
                    </head>
                    <body>
                    <h1>Booking History - ${displayBranchName}</h1>
                    <div class="summary">
                      <div class="summary-item">📋 Total: ${totalBookings}</div>
                      <div class="summary-item">✅ Confirmed: ${confirmedBookings}</div>
                      <div class="summary-item">⏳ Pending: ${pendingBookings}</div>
                      <div class="summary-item">📥 Checked In: ${checkedInBookings}</div>
                      <div class="summary-item">📤 Checked Out: ${checkedOutBookings}</div>
                      <div class="summary-item">❌ Cancelled: ${cancelledBookings}</div>
                      <div class="summary-item">💰 Revenue: ${formatCurrency(totalRevenue)}</div>
                    </div>
                    <table>
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
                    </table>
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">Generated on ${new Date().toLocaleString()}</p>
                    </body>
                    </html>
                  `;
                  printWindow.document.write(html);
                  printWindow.document.close();
                  printWindow.print();
                }
              }}
              className="text-xs sm:text-sm bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded hover:bg-gray-200"
            >
              🖨️ Print
            </button>
          </div>
        )}
      </div>
    </div>
  );
}