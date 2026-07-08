'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiSearch, FiUserCheck, FiRefreshCw, FiInfo, FiCalendar, FiClock } from 'react-icons/fi';

const API_URL = 'http://localhost:4000/api';

export default function CheckInPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [todayDate, setTodayDate] = useState('');

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
    // Set today's date
    const today = new Date();
    setTodayDate(today.toISOString().split('T')[0]);

    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        console.log('📋 Full user data:', userData);
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
        
        if (userBranches.length === 0) {
          console.warn('⚠️ No branches found, using default');
          userBranches = ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'];
        }
        
        console.log('📋 Processed branches:', userBranches);
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
        console.log('📋 Selected branch:', selectedBranch || 'none');
      } catch (e) {
        console.error('Error parsing user:', e);
        router.push('/login');
        return;
      }
    }
    
    fetchCheckInBookings();
  }, []);

  // ✅ Auto-refresh when branch changes
  useEffect(() => {
    if (selectedBranch && user) {
      console.log('🔄 Branch changed, fetching check-in bookings...');
      fetchCheckInBookings();
    }
  }, [selectedBranch]);

  // ✅ Auto-refresh every 30 seconds
  useEffect(() => {
    if (!selectedBranch || !user) return;

    const interval = setInterval(() => {
      console.log('⏰ Auto-refresh timer triggered for check-in...');
      fetchCheckInBookings();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedBranch, user]);

  const fetchCheckInBookings = async () => {
    try {
      setLoading(true);
      setError('');
      setIsLocalMode(false);
      
      const token = localStorage.getItem('token');
      const branch = selectedBranch || user?.branches?.[0] || '';

      console.log('📋 Fetching check-in bookings for branch:', branch);
      console.log('📍 API URL:', API_URL);

      let bookingsData: any[] = [];

      try {
        // ✅ Fetch ALL bookings from API
        const response = await fetch(`${API_URL}/bookings`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('📥 Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('📥 Full API response received');
          
          let allBookings = data.bookings || data.data || [];
          console.log(`📋 Total bookings from API:`, allBookings.length);
          
          if (allBookings.length > 0) {
            console.log('📋 First booking structure:', allBookings[0]);
            console.log('📋 Booking status:', allBookings[0].bookingStatus);
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
          setError('Failed to fetch bookings. Please check if the server is running.');
        }
      }

      // ✅ Filter for confirmed bookings (Confirm or Confirmed status)
      // Check for both "Confirm" and "Confirmed" statuses
      const confirmedBookings = bookingsData.filter((b: any) => {
        const status = b.bookingStatus || '';
        return status === 'Confirm' || status === 'Confirmed';
      });
      
      console.log(`📋 Confirmed bookings: ${confirmedBookings.length}`);
      
      // Log each confirmed booking for debugging
      confirmedBookings.forEach((b: any) => {
        console.log(`📋 Confirmed booking: ${b.bookingNo} - ${b.agentName} - ${b.branch}`);
      });

      setBookings(confirmedBookings);
      setFilteredBookings(confirmedBookings);
      console.log(`📋 Final: ${confirmedBookings.length} confirmed bookings ready for check-in`);
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching check-in bookings:', err);
      setError('Failed to fetch check-in bookings');
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    
    if (term === '') {
      setFilteredBookings(bookings);
    } else {
      const filtered = bookings.filter((b: any) => {
        const guestName = (b.agentName || '').toLowerCase();
        const bookingNo = (b.bookingNo || '').toLowerCase();
        const roomType = (b.roomType || '').toLowerCase();
        const contact = (b.contact || b.phone || '').toLowerCase();
        
        return guestName.includes(term) || 
               bookingNo.includes(term) || 
               roomType.includes(term) ||
               contact.includes(term);
      });
      setFilteredBookings(filtered);
    }
  };

  const handleCheckIn = async (booking: any) => {
    if (!confirm(`Check in ${booking.agentName}?`)) return;
    
    setCheckingIn(booking.id);
    try {
      const token = localStorage.getItem('token');
      
      // ✅ Update booking status to CheckedIn
      const response = await fetch(`${API_URL}/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingStatus: 'CheckedIn',
          actualCheckIn: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        alert(`✅ Successfully checked in ${booking.agentName}!`);
        
        // ✅ Refresh the list
        await fetchCheckInBookings();
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to check in: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error checking in:', err);
      alert('❌ Error checking in. Please try again.');
    } finally {
      setCheckingIn(null);
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

  const displayBranchName = selectedBranch === 'all' ? 'All Branches' : selectedBranch;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading check-in bookings...</p>
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
            <h2 className="text-base sm:text-xl font-semibold text-gray-800">Check In</h2>
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
              onClick={fetchCheckInBookings}
              className="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <FiRefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Refresh</span>
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

        {/* Date and Stats */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <FiCalendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                <span className="font-bold text-green-600">{filteredBookings.length}</span> confirmed bookings ready for check-in
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by guest name, booking number, room type, contact..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <FiInfo className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm sm:text-lg">No confirmed bookings available for check-in</p>
              {(isManager || isViewer) && (
                <Link href="/bookings/new" className="text-indigo-600 hover:underline mt-2 inline-block text-sm">
                  Create a new booking →
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Booking No</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Guest Name</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Branch</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden xs:table-cell">Room Type</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Check In</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Check Out</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm font-medium text-indigo-600">{booking.bookingNo}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-900 font-medium">{booking.agentName}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden sm:table-cell">
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs bg-indigo-100 text-indigo-700 rounded-full">
                          {booking.branch}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden xs:table-cell">{booking.roomType}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">{new Date(booking.checkIn).toLocaleDateString()}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">{new Date(booking.checkOut).toLocaleDateString()}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4">
                        {isViewer ? (
                          <span className="text-xs text-gray-400">View only</span>
                        ) : (
                          <button
                            onClick={() => handleCheckIn(booking)}
                            disabled={checkingIn === booking.id}
                            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-[10px] sm:text-sm ${
                              checkingIn === booking.id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            {checkingIn === booking.id ? (
                              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <FiUserCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                            )}
                            <span>Check In</span>
                          </button>
                        )}
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
            Total: <span className="font-semibold">{filteredBookings.length}</span> confirmed bookings ready for check-in
          </span>
          <span className="flex items-center gap-1">
            <FiClock className="w-3 h-3" />
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}