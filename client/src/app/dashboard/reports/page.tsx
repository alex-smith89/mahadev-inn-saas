'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FiDownload, FiTrendingUp, FiTrendingDown, FiUsers, 
  FiBookOpen, FiHome, FiDollarSign, FiCalendar, FiClock,
  FiPieChart, FiBarChart2, FiRefreshCw, FiStar, FiAward,
  FiArrowUp, FiArrowDown, FiMinus, FiEye
} from 'react-icons/fi';

// ✅ Updated API URL to match NestJS backend
const API_URL = 'http://localhost:4000/api';

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [totalRooms, setTotalRooms] = useState(65);

  // Stats state
  const [stats, setStats] = useState({
    totalBookings: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    checkedInBookings: 0,
    checkedOutBookings: 0,
    cancelledBookings: 0,
    totalRevenue: 0,
    averageBookingValue: 0,
    totalCustomers: 0,
    occupiedRooms: 0,
    availableRooms: 65,
    occupancyRate: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    todayActiveBookings: 0,
    roomsCheckInToday: 0,
    roomsCheckOutToday: 0,
    todayCheckInsCount: 0,
    todayCheckOutsCount: 0,
    tomorrowCheckOuts: 0,
    yesterdayCheckIns: 0,
    yesterdayCheckOuts: 0,
    yesterdayConfirmed: 0,
    yesterdayPending: 0,
    todayConfirmed: 0,
    todayPending: 0,
    checkInsChange: 0,
    checkOutsChange: 0,
    confirmedChange: 0,
  });

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
        setBranches(userData.branches || []);
        setIsOwner(userData.role === 'OWNER');
        
        let savedBranch = localStorage.getItem('selectedBranch');
        if (userData.role === 'OWNER') {
          if (savedBranch && userData.branches.includes(savedBranch)) {
            setSelectedBranch(savedBranch);
          } else {
            setSelectedBranch('all');
            localStorage.setItem('selectedBranch', 'all');
          }
        } else {
          if (savedBranch && userData.branches.includes(savedBranch)) {
            setSelectedBranch(savedBranch);
          } else if (userData.branches.length > 0) {
            setSelectedBranch(userData.branches[0]);
            localStorage.setItem('selectedBranch', userData.branches[0]);
          }
        }
        
        console.log('✅ User loaded:', userData);
        console.log('📋 Available branches:', userData.branches);
        console.log('📋 Selected branch:', savedBranch || 'all');
        console.log('👤 User role:', userData.role);
      } catch (e) {
        console.error('Error parsing user:', e);
        router.push('/login');
        return;
      }
    }
    
    fetchReports();
  }, []);

  // ✅ Auto-refresh when branch changes
  useEffect(() => {
    if (selectedBranch && user) {
      fetchReports();
    }
  }, [selectedBranch]);

  // ✅ Auto-refresh when page becomes visible (navigation back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedBranch && user) {
        console.log('👁️ Page became visible, auto-refreshing reports...');
        fetchReports();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedBranch, user]);

  // ✅ Auto-refresh on focus (when user clicks back)
  useEffect(() => {
    const handleFocus = () => {
      if (selectedBranch && user) {
        console.log('🔲 Window focused, auto-refreshing reports...');
        fetchReports();
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
      console.log('⏰ Auto-refresh timer triggered for reports...');
      fetchReports();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedBranch, user]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      setError('');
      setIsLocalMode(false);
      
      const token = localStorage.getItem('token');
      const branch = selectedBranch || user?.branches?.[0] || '';

      console.log('📊 Fetching reports for branch:', branch);
      console.log('👤 User role:', user?.role);
      console.log('📊 API URL:', API_URL);
      
      let bookingsData: any[] = [];

      // ✅ For Owner: Fetch all bookings first, then filter
      if (user?.role === 'OWNER') {
        console.log('👑 Owner: Fetching all bookings from all branches...');
        try {
          const url = `${API_URL}/bookings`;
          console.log('📊 Fetching from:', url);
          
          const allBookingsResponse = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (allBookingsResponse.ok) {
            const data = await allBookingsResponse.json();
            const allBookings = data.bookings || data.data || [];
            console.log(`📋 All bookings from API (all branches):`, allBookings.length);
            
            if (branch === 'all') {
              bookingsData = allBookings;
              console.log(`📋 Showing ALL bookings: ${bookingsData.length}`);
            } else {
              bookingsData = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === branch;
              });
              console.log(`📋 Filtered bookings for ${branch}: ${bookingsData.length}`);
            }
            localStorage.setItem('bookings', JSON.stringify(bookingsData));
          } else if (allBookingsResponse.status === 401) {
            console.log('⚠️ Unauthorized - Token expired');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            router.push('/login');
            return;
          } else {
            console.error('❌ Failed to fetch bookings');
          }
        } catch (err) {
          console.error('Error fetching bookings:', err);
          setError('Failed to fetch bookings from server');
        }
      } else {
        // For Manager/Viewer: Fetch bookings with branch filter
        console.log(`📋 ${user?.role}: Fetching bookings for branch: ${branch}`);
        try {
          let url = `${API_URL}/bookings`;
          if (branch) {
            url += `?branch=${branch}`;
          }
          console.log('📊 Fetching from:', url);
          
          const bookingsResponse = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (bookingsResponse.ok) {
            const data = await bookingsResponse.json();
            bookingsData = data.bookings || data.data || [];
            console.log(`📋 Bookings from API for ${branch}:`, bookingsData.length);
            localStorage.setItem('bookings', JSON.stringify(bookingsData));
          } else if (bookingsResponse.status === 401) {
            console.log('⚠️ Unauthorized - Token expired');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            router.push('/login');
            return;
          } else {
            console.error('❌ Failed to fetch bookings');
          }
        } catch (err) {
          console.error('Error fetching bookings:', err);
          setError('Failed to fetch bookings from server');
        }
      }

      // ✅ If no bookings from API, try local storage
      if (bookingsData.length === 0) {
        try {
          const localBookings = JSON.parse(localStorage.getItem('bookings') || '[]');
          if (localBookings.length > 0) {
            const filteredLocal = branch === 'all' 
              ? localBookings 
              : localBookings.filter((b: any) => (b.branch || b.branchName) === branch);
            if (filteredLocal.length > 0) {
              bookingsData = filteredLocal;
              setIsLocalMode(true);
              console.log(`📋 Using ${bookingsData.length} bookings from local storage`);
            }
          }
        } catch (e) {
          console.error('Error loading local bookings:', e);
        }
      }

      // ✅ Fetch branch capacity
      let capacityTotal = 65;
      if (branch !== 'all') {
        try {
          const capacityRes = await fetch(`${API_URL}/room-capacity/branch/${branch}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (capacityRes.ok) {
            const capacityData = await capacityRes.json();
            const data = capacityData.data || capacityData;
            const total = (data.singleCap || 0) + 
                         (data.doubleCap || 0) + 
                         (data.tripleCap || 0) + 
                         (data.quardCap || 0);
            capacityTotal = total > 0 ? total : 65;
            setTotalRooms(capacityTotal);
            console.log('🏨 Branch capacity loaded:', { total: capacityTotal, ...data });
          }
        } catch (err) {
          console.log('⚠️ Could not fetch branch capacity, using default 65');
          setTotalRooms(65);
        }
      } else {
        let totalCapacity = 0;
        for (const b of branches) {
          try {
            const capacityRes = await fetch(`${API_URL}/room-capacity/branch/${b}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
            if (capacityRes.ok) {
              const capacityData = await capacityRes.json();
              const data = capacityData.data || capacityData;
              totalCapacity += (data.singleCap || 0) + 
                             (data.doubleCap || 0) + 
                             (data.tripleCap || 0) + 
                             (data.quardCap || 0);
            }
          } catch (err) {
            console.log(`⚠️ Could not fetch capacity for ${b}`);
          }
        }
        capacityTotal = totalCapacity > 0 ? totalCapacity : 65;
        setTotalRooms(capacityTotal);
        console.log('🏨 Total capacity across all branches:', capacityTotal);
      }

      setBookings(bookingsData);
      calculateStats(bookingsData, capacityTotal);
      
      setLoading(false);
      setRefreshing(false);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      setError('Failed to fetch report data');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleBranchChange = (branch: string) => {
    console.log('🔄 Switching to branch:', branch);
    setSelectedBranch(branch);
    localStorage.setItem('selectedBranch', branch);
    if (user) {
      const updatedUser = { ...user, selectedBranch: branch };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  const calculateStats = (bookingsData: any[], capacity: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const confirmed = bookingsData.filter(b => 
      b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed'
    );
    const pending = bookingsData.filter(b => 
      b.bookingStatus === 'Pending'
    );
    const checkedIn = bookingsData.filter(b => 
      b.bookingStatus === 'CheckedIn'
    );
    const checkedOut = bookingsData.filter(b => 
      b.bookingStatus === 'CheckedOut'
    );
    const cancelled = bookingsData.filter(b => 
      b.bookingStatus === 'Cancelled'
    );

    let totalRevenue = 0;
    confirmed.forEach((b: any) => {
      totalRevenue += (b.totalCost || b.roomCharges || b.price || 0);
    });

    const uniqueCustomers = new Set();
    bookingsData.forEach((b: any) => {
      if (b.agentName) uniqueCustomers.add(b.agentName);
    });

    const activeBookings = bookingsData.filter((b: any) => {
      const checkIn = new Date(b.checkIn);
      checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(b.checkOut);
      checkOut.setHours(0, 0, 0, 0);
      return (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn') &&
             checkIn <= today && 
             checkOut > today;
    });

    const occupiedRooms = activeBookings.reduce((sum: number, b: any) => sum + (b.roomsCount || 1), 0);
    const availableRooms = Math.max(0, capacity - occupiedRooms);
    const occupancyRate = capacity > 0 ? Math.round((occupiedRooms / capacity) * 100) : 0;

    const todayStr = today.toDateString();
    const todayBookings = bookingsData.filter(b => 
      new Date(b.checkIn).toDateString() === todayStr
    );
    
    const todayCheckInsCount = todayBookings.filter(b => 
      b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed'
    ).length;
    
    const todayCheckOutsCount = bookingsData.filter(b => 
      new Date(b.checkOut).toDateString() === todayStr
    ).length;
    
    const todayConfirmed = bookingsData.filter(b => 
      new Date(b.checkIn).toDateString() === todayStr &&
      (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed')
    ).length;
    
    const todayPending = bookingsData.filter(b => 
      new Date(b.checkIn).toDateString() === todayStr &&
      b.bookingStatus === 'Pending'
    ).length;

    const yesterdayStr = yesterday.toDateString();
    const yesterdayCheckIns = bookingsData.filter(b => 
      new Date(b.checkIn).toDateString() === yesterdayStr &&
      (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed')
    ).length;
    
    const yesterdayCheckOuts = bookingsData.filter(b => 
      new Date(b.checkOut).toDateString() === yesterdayStr
    ).length;
    
    const yesterdayConfirmed = bookingsData.filter(b => 
      new Date(b.checkIn).toDateString() === yesterdayStr &&
      (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed')
    ).length;
    
    const yesterdayPending = bookingsData.filter(b => 
      new Date(b.checkIn).toDateString() === yesterdayStr &&
      b.bookingStatus === 'Pending'
    ).length;

    const tomorrowStr = tomorrow.toDateString();
    const tomorrowCheckOuts = bookingsData.filter(b => 
      new Date(b.checkOut).toDateString() === tomorrowStr
    ).length;

    const checkInsChange = yesterdayCheckIns > 0 
      ? Math.round(((todayCheckInsCount - yesterdayCheckIns) / yesterdayCheckIns) * 100)
      : todayCheckInsCount > 0 ? 100 : 0;
    
    const checkOutsChange = yesterdayCheckOuts > 0 
      ? Math.round(((todayCheckOutsCount - yesterdayCheckOuts) / yesterdayCheckOuts) * 100)
      : todayCheckOutsCount > 0 ? 100 : 0;
    
    const confirmedChange = yesterdayConfirmed > 0 
      ? Math.round(((todayConfirmed - yesterdayConfirmed) / yesterdayConfirmed) * 100)
      : todayConfirmed > 0 ? 100 : 0;

    let roomsCheckInToday = 0;
    let roomsCheckOutToday = 0;
    
    bookingsData.forEach((b: any) => {
      if (new Date(b.checkIn).toDateString() === todayStr && 
          (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn')) {
        roomsCheckInToday += (b.roomsCount || 1);
      }
      if (new Date(b.checkOut).toDateString() === todayStr) {
        roomsCheckOutToday += (b.roomsCount || 1);
      }
    });

    const displayBranch = selectedBranch === 'all' ? 'All Branches' : selectedBranch;
    console.log(`📊 Calculated stats for ${displayBranch}:`, {
      capacity,
      totalBookings: bookingsData.length,
      totalCustomers: uniqueCustomers.size,
      totalRevenue,
      occupiedRooms,
      availableRooms,
      occupancyRate
    });

    setStats({
      totalBookings: bookingsData.length,
      confirmedBookings: confirmed.length,
      pendingBookings: pending.length,
      checkedInBookings: checkedIn.length,
      checkedOutBookings: checkedOut.length,
      cancelledBookings: cancelled.length,
      totalRevenue: totalRevenue,
      averageBookingValue: confirmed.length > 0 ? totalRevenue / confirmed.length : 0,
      totalCustomers: uniqueCustomers.size,
      occupiedRooms: occupiedRooms,
      availableRooms: availableRooms,
      occupancyRate: occupancyRate,
      todayActiveBookings: activeBookings.length,
      roomsCheckInToday: roomsCheckInToday,
      roomsCheckOutToday: roomsCheckOutToday,
      todayCheckInsCount: todayCheckInsCount,
      todayCheckOutsCount: todayCheckOutsCount,
      tomorrowCheckOuts: tomorrowCheckOuts,
      yesterdayCheckIns: yesterdayCheckIns,
      yesterdayCheckOuts: yesterdayCheckOuts,
      yesterdayConfirmed: yesterdayConfirmed,
      yesterdayPending: yesterdayPending,
      todayConfirmed: todayConfirmed,
      todayPending: todayPending,
      checkInsChange: checkInsChange,
      checkOutsChange: checkOutsChange,
      confirmedChange: confirmedChange,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedBranch');
    router.push('/login');
  };

  const formatCurrency = (amount: number) => {
    if (!amount) return 'Rs. 0';
    if (amount >= 100000) {
      return `Rs. ${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `Rs. ${(amount / 1000).toFixed(1)}K`;
    }
    return `Rs. ${amount}`;
  };

  const getOccupancyColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getOccupancyBgColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getOccupancyStatus = (rate: number) => {
    if (rate >= 80) return { text: 'Excellent', emoji: '🌟', color: 'text-green-600' };
    if (rate >= 60) return { text: 'Good', emoji: '👍', color: 'text-blue-600' };
    if (rate >= 40) return { text: 'Moderate', emoji: '😐', color: 'text-yellow-600' };
    if (rate >= 20) return { text: 'Low', emoji: '🔴', color: 'text-red-600' };
    return { text: 'Very Low', emoji: '⚠️', color: 'text-red-700' };
  };

  const occupancyStatus = getOccupancyStatus(stats.occupancyRate);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = months.map((month, index) => {
    const monthBookings = bookings.filter(b => {
      const date = new Date(b.checkIn);
      return date.getMonth() === index;
    });
    return { month, bookings: monthBookings.length };
  });

  const currentMonth = new Date().getMonth();
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const idx = (currentMonth - i + 12) % 12;
    last6Months.push(monthlyData[idx]);
  }

  const maxBookings = Math.max(...last6Months.map(d => d.bookings), 1);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const displayBranchName = selectedBranch === 'all' ? 'All Branches' : selectedBranch;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800 flex items-center">
              <span className="mr-2">←</span>
              Back to Dashboard
            </Link>
            <h2 className="text-xl font-semibold text-gray-800">Reports</h2>
            {isLocalMode && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                📝 Offline Mode
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {branches.length > 0 && (
              <select
                value={selectedBranch || (isOwner ? 'all' : branches[0])}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-white"
              >
                {isOwner && (
                  <option value="all">🌐 All Branches</option>
                )}
                {branches.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            )}
            <button
              onClick={fetchReports}
              disabled={refreshing}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            {user?.role === 'OWNER' && (
              <span className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg text-sm font-medium">
                🔍 View Only
              </span>
            )}
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-6xl mx-auto">
        {error && (
          <div className={`border px-4 py-3 rounded mb-4 ${
            error.includes('No bookings') 
              ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
              : 'bg-red-100 border-red-400 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {stats.totalBookings === 0 && !loading && (
          <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            📋 No bookings found for {displayBranchName}.
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Bookings</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalBookings}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FiBookOpen className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <div className="mt-2 text-sm flex flex-wrap gap-2">
              <span className="text-green-600">✓ {stats.confirmedBookings} Confirmed</span>
              <span className="text-yellow-600">⏳ {stats.pendingBookings} Pending</span>
            </div>
            <div className="mt-1 text-xs text-gray-400">
              in {displayBranchName}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-3xl font-bold text-gray-800">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FiDollarSign className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Avg. Booking: {formatCurrency(stats.averageBookingValue)}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              From {stats.confirmedBookings} confirmed bookings
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Customers</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalCustomers}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FiUsers className="w-6 h-6 text-purple-500" />
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">Unique guests in {displayBranchName}</div>
            <div className="mt-1 text-xs text-gray-400">
              From {stats.totalBookings} total bookings
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Occupancy Rate</p>
                <p className={`text-3xl font-bold ${getOccupancyColor(stats.occupancyRate)}`}>
                  {stats.occupancyRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FiHome className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <span className="text-sm font-medium">{occupancyStatus.emoji}</span>
              <span className={`text-sm font-medium ${occupancyStatus.color}`}>
                {occupancyStatus.text}
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`${getOccupancyBgColor(stats.occupancyRate)} h-2.5 rounded-full transition-all duration-500`} 
                style={{ width: `${Math.min(stats.occupancyRate, 100)}%` }}
              ></div>
            </div>
            <div className="mt-2 text-xs text-gray-500 flex justify-between">
              <span>{stats.occupiedRooms} occupied</span>
              <span>{stats.availableRooms} available</span>
              <span>{totalRooms} total</span>
            </div>
          </div>
        </div>

        {/* Report Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <FiPieChart className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-800">Occupancy Details</h3>
            </div>
            
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-40 h-40">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="72"
                    stroke="#E5E7EB"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="72"
                    stroke={getOccupancyBgColor(stats.occupancyRate)}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(stats.occupancyRate / 100) * 452} 452`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-in-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className={`text-3xl font-bold ${getOccupancyColor(stats.occupancyRate)}`}>
                    {stats.occupancyRate}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Occupancy</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Today's Active Bookings:</span>
                <span className="font-bold text-blue-600">{stats.todayActiveBookings}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Checked-in Today:</span>
                <span className="font-bold text-green-600">{stats.roomsCheckInToday} rooms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Check-outs Today:</span>
                <span className="font-bold text-red-600">{stats.roomsCheckOutToday} rooms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Occupied Rooms:</span>
                <span className="font-bold text-orange-600">{stats.occupiedRooms}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Available Rooms:</span>
                <span className="font-bold text-green-600">{stats.availableRooms}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-600">Status:</span>
                <span className={`font-bold ${occupancyStatus.color}`}>
                  {occupancyStatus.emoji} {occupancyStatus.text}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <FiDollarSign className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-800">Average Booking Value</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.averageBookingValue)}</p>
            <p className="mt-2 text-sm text-gray-500">Based on {stats.totalBookings} total bookings in {displayBranchName}</p>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Revenue:</span>
                <span className="font-bold text-indigo-600">{formatCurrency(stats.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Avg per Customer:</span>
                <span className="font-bold text-purple-600">
                  {stats.totalCustomers > 0 ? formatCurrency(stats.totalRevenue / stats.totalCustomers) : 'Rs. 0'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <FiCalendar className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Today vs Yesterday</h3>
            </div>
            
            <div className="mb-3 p-2 bg-blue-50 rounded-lg">
              <p className="text-xs font-semibold text-blue-600 mb-1">📅 Today</p>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div>
                  <p className="text-sm font-bold text-blue-600">{stats.todayCheckInsCount}</p>
                  <p className="text-[10px] text-gray-500">Check-ins</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-orange-600">{stats.todayCheckOutsCount}</p>
                  <p className="text-[10px] text-gray-500">Check-outs</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-green-600">{stats.todayConfirmed}</p>
                  <p className="text-[10px] text-gray-500">Confirmed</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-yellow-600">{stats.todayPending}</p>
                  <p className="text-[10px] text-gray-500">Pending</p>
                </div>
              </div>
            </div>

            <div className="mb-2 p-2 bg-purple-50 rounded-lg">
              <p className="text-xs font-semibold text-purple-600 mb-1">📅 Tomorrow</p>
              <div className="text-center">
                <p className="text-sm font-bold text-purple-600">{stats.tomorrowCheckOuts}</p>
                <p className="text-[10px] text-gray-500">Check-outs</p>
              </div>
            </div>

            <div className="p-2 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 mb-1">📅 Yesterday</p>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div>
                  <p className="text-sm font-bold text-gray-600">{stats.yesterdayCheckIns}</p>
                  <p className="text-[10px] text-gray-500">Check-ins</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-600">{stats.yesterdayCheckOuts}</p>
                  <p className="text-[10px] text-gray-500">Check-outs</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-600">{stats.yesterdayConfirmed}</p>
                  <p className="text-[10px] text-gray-500">Confirmed</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-600">{stats.yesterdayPending}</p>
                  <p className="text-[10px] text-gray-500">Pending</p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-1 bg-blue-50 rounded">
                  <p className="text-xs text-gray-500">Check-ins</p>
                  <p className={`text-sm font-bold ${stats.checkInsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.checkInsChange >= 0 ? '↑' : '↓'} {Math.abs(stats.checkInsChange)}%
                  </p>
                </div>
                <div className="p-1 bg-orange-50 rounded">
                  <p className="text-xs text-gray-500">Check-outs</p>
                  <p className={`text-sm font-bold ${stats.checkOutsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.checkOutsChange >= 0 ? '↑' : '↓'} {Math.abs(stats.checkOutsChange)}%
                  </p>
                </div>
                <div className="p-1 bg-green-50 rounded">
                  <p className="text-xs text-gray-500">Confirmed</p>
                  <p className={`text-sm font-bold ${stats.confirmedChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.confirmedChange >= 0 ? '↑' : '↓'} {Math.abs(stats.confirmedChange)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Booking Trend */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-4">
            <FiBarChart2 className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-800">Monthly Booking Trend</h3>
            {stats.totalBookings > 0 && (
              <span className="text-sm text-gray-500 ml-auto">Total: {stats.totalBookings} bookings in {displayBranchName}</span>
            )}
          </div>
          <div className="grid grid-cols-6 gap-4">
            {last6Months.map((item, index) => {
              const height = maxBookings > 0 ? Math.max(10, (item.bookings / maxBookings) * 100) : 10;
              return (
                <div key={index} className="text-center">
                  <div className="relative h-40 flex items-end justify-center group">
                    <div 
                      className="w-full bg-indigo-500 rounded-t transition-all duration-500 hover:bg-indigo-600 cursor-pointer relative"
                      style={{ height: `${height}%` }}
                    >
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.bookings}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{item.month}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Bookings Table */}
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Recent Bookings</h3>
            {bookings.length > 0 && (
              <span className="text-sm text-gray-500">Showing latest {Math.min(bookings.length, 10)} bookings in {displayBranchName}</span>
            )}
          </div>
          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No bookings found in {displayBranchName}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booking No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.slice(0, 10).map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-indigo-600">{booking.bookingNo}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{booking.agentName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                          {booking.branch}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(booking.checkIn).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">Rs. {booking.roomCharges || booking.price || 0}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          booking.bookingStatus === 'Confirm' || booking.bookingStatus === 'Confirmed' 
                            ? 'bg-green-100 text-green-800' 
                            : booking.bookingStatus === 'Pending' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : booking.bookingStatus === 'CheckedIn'
                            ? 'bg-blue-100 text-blue-800'
                            : booking.bookingStatus === 'CheckedOut'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {booking.bookingStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {bookings.length > 10 && (
            <div className="mt-4 text-center">
              <Link href="/bookings" className="text-indigo-600 hover:underline text-sm">
                View all {bookings.length} bookings →
              </Link>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center border-t-4 border-indigo-500">
            <p className="text-2xl font-bold text-indigo-600">{stats.totalBookings}</p>
            <p className="text-xs text-gray-500">Total Bookings</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center border-t-4 border-green-500">
            <p className="text-2xl font-bold text-green-600">{stats.confirmedBookings}</p>
            <p className="text-xs text-gray-500">✅ Confirmed</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center border-t-4 border-yellow-500">
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingBookings}</p>
            <p className="text-xs text-gray-500">⏳ Pending</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center border-t-4 border-purple-500">
            <p className="text-2xl font-bold text-purple-600">{stats.totalCustomers}</p>
            <p className="text-xs text-gray-500">Total Customers</p>
          </div>
        </div>
      </div>
    </div>
  );
}