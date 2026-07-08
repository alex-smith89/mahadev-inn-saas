'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiDownload, FiEye, FiTrash2, FiCheck, FiRefreshCw, FiInfo } from 'react-icons/fi';

const API_URL = 'http://localhost:4000/api';

export default function DownloadHistoryPage() {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [filter, setFilter] = useState('all');
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
        console.log('📋 Selected branch:', savedBranch || 'all');
        console.log('👤 User role:', userData.role);
      } catch (e) {
        console.error('Error parsing user:', e);
        router.push('/login');
        return;
      }
    }
    
    fetchDownloads();
  }, []);

  // ✅ Auto-refresh when branch changes
  useEffect(() => {
    if (selectedBranch && user) {
      console.log('🔄 Branch changed, fetching download history...');
      fetchDownloads();
    }
  }, [selectedBranch]);

  // ✅ Auto-refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedBranch && user) {
        console.log('👁️ Page became visible, auto-refreshing download history...');
        fetchDownloads();
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
        console.log('🔲 Window focused, auto-refreshing download history...');
        fetchDownloads();
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
      console.log('⏰ Auto-refresh timer triggered for download history...');
      fetchDownloads();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedBranch, user]);

  const fetchDownloads = async () => {
    try {
      setLoading(true);
      setError('');
      setIsLocalMode(false);
      
      const token = localStorage.getItem('token');
      const branch = selectedBranch || user?.branches?.[0] || '';

      console.log('📋 Fetching downloads for branch:', branch);
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
          setError('Failed to fetch download history. Please check if the server is running.');
        }
      }

      // ✅ Create download items from bookings
      const downloadStatus = JSON.parse(localStorage.getItem('downloadStatus') || '{}');

      const downloadItems = bookingsData.map((b: any) => {
        const status = downloadStatus[b.id] || 'Ready';
        return {
          id: b.id,
          bookingNo: b.bookingNo,
          guestName: b.agentName,
          branch: b.branch,
          checkIn: new Date(b.checkIn).toLocaleDateString(),
          checkOut: new Date(b.checkOut).toLocaleDateString(),
          amount: b.totalCost || b.roomCharges || b.price || 0,
          currency: b.currency || 'NPR',
          status: status,
          booking: b,
        };
      });

      setDownloads(downloadItems);
      console.log(`📋 Loaded ${downloadItems.length} download history entries for ${branch}`);
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching downloads:', err);
      setError('Failed to fetch download history');
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

  const updateDownloadStatus = (id: string, status: string) => {
    const downloadStatus = JSON.parse(localStorage.getItem('downloadStatus') || '{}');
    downloadStatus[id] = status;
    localStorage.setItem('downloadStatus', JSON.stringify(downloadStatus));
    setDownloads(downloads.map(d => d.id === id ? { ...d, status: status } : d));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedBranch');
    router.push('/login');
  };

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${id}/pdf`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `MahadevInn_Booking_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      updateDownloadStatus(id, 'Downloaded');
    } catch (err: any) {
      console.error('Error downloading PDF:', err);
      alert('❌ Failed to download PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleView = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${id}/pdf`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      updateDownloadStatus(id, 'Viewed');
    } catch (err: any) {
      console.error('Error viewing PDF:', err);
      alert('❌ Failed to view PDF. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        alert('✅ Booking deleted successfully!');
        
        const updatedDownloads = downloads.filter(d => d.id !== id);
        setDownloads(updatedDownloads);
        
        const savedBookings = JSON.parse(localStorage.getItem('bookings') || '[]');
        const updatedBookings = savedBookings.filter((b: any) => b.id !== id);
        localStorage.setItem('bookings', JSON.stringify(updatedBookings));
        
        const downloadStatus = JSON.parse(localStorage.getItem('downloadStatus') || '{}');
        delete downloadStatus[id];
        localStorage.setItem('downloadStatus', JSON.stringify(downloadStatus));
      } else {
        alert('❌ Failed to delete booking');
      }
    } catch (err) {
      console.error('Error deleting booking:', err);
      alert('❌ Failed to delete booking');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Downloaded':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center gap-1"><FiCheck className="w-3 h-3" /> Downloaded</span>;
      case 'Viewed':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center gap-1"><FiEye className="w-3 h-3" /> Viewed</span>;
      case 'Ready':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1"><FiDownload className="w-3 h-3" /> Ready</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const displayBranchName = selectedBranch === 'all' ? 'All Branches' : selectedBranch;
  const filteredDownloads = filter === 'all' 
    ? downloads 
    : downloads.filter(d => d.status === filter);

  const totalBookings = downloads.length;
  const downloadedCount = downloads.filter(d => d.status === 'Downloaded').length;
  const readyCount = downloads.filter(d => d.status === 'Ready').length;
  const viewedCount = downloads.filter(d => d.status === 'Viewed').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading download history...</p>
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
            <h2 className="text-base sm:text-xl font-semibold text-gray-800">Download History - {displayBranchName}</h2>
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
              onClick={fetchDownloads}
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

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-indigo-500">
            <p className="text-xs sm:text-sm text-gray-500">Total Bookings</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-600">{totalBookings}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">in {displayBranchName}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-green-500">
            <p className="text-xs sm:text-sm text-gray-500">Downloaded</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{downloadedCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-yellow-500">
            <p className="text-xs sm:text-sm text-gray-500">Ready to Download</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{readyCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-blue-500">
            <p className="text-xs sm:text-sm text-gray-500">Viewed</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{viewedCount}</p>
          </div>
        </div>

        {/* Filter Buttons */}
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
            onClick={() => setFilter('Ready')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === 'Ready' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ⏳ Ready ({readyCount})
          </button>
          <button
            onClick={() => setFilter('Downloaded')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === 'Downloaded' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ✅ Downloaded ({downloadedCount})
          </button>
          <button
            onClick={() => setFilter('Viewed')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              filter === 'Viewed' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            👁️ Viewed ({viewedCount})
          </button>
        </div>

        {/* Downloads Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredDownloads.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <FiInfo className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm sm:text-lg">No download history found in {displayBranchName}</p>
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
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Branch</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Check In</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Check Out</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDownloads.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm font-medium text-indigo-600">{item.bookingNo}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-900">{item.guestName}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden sm:table-cell">
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs bg-indigo-100 text-indigo-700 rounded-full">
                          {item.branch}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">{item.checkIn}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 hidden md:table-cell">{item.checkOut}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-[10px] sm:text-sm text-gray-500 font-medium">Rs. {item.amount.toLocaleString()}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4">{getStatusBadge(item.status)}</td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => handleView(item.id)}
                            className="p-1.5 sm:p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View PDF"
                          >
                            <FiEye className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(item.id)}
                            disabled={downloadingId === item.id}
                            className={`p-1.5 sm:p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors ${
                              downloadingId === item.id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Download PDF"
                          >
                            {downloadingId === item.id ? (
                              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <FiDownload className="w-3 h-3 sm:w-4 sm:h-4" />
                            )}
                          </button>
                          {(isOwner || isManager) && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 sm:p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Booking"
                            >
                              <FiTrash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          )}
                          {isViewer && (
                            <span className="text-[8px] sm:text-xs text-purple-500 font-medium">🔍 View</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="mt-4 text-[10px] sm:text-sm text-gray-500 flex flex-wrap justify-between items-center gap-2">
          <span>
            Total: <span className="font-semibold">{filteredDownloads.length}</span> bookings in {displayBranchName}
            {filter !== 'all' && <span className="ml-2">(Filtered by: {filter})</span>}
          </span>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></span>
              Downloaded: {downloadedCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 sm:w-3 sm:h-3 bg-yellow-500 rounded-full"></span>
              Ready: {readyCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></span>
              Viewed: {viewedCount}
            </span>
          </div>
        </div>

        {/* Export Options */}
        {downloads.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => {
                const headers = ['Booking No', 'Guest Name', 'Branch', 'Check In', 'Check Out', 'Amount', 'Status'];
                const rows = downloads.map(d => [
                  d.bookingNo,
                  d.guestName,
                  d.branch,
                  d.checkIn,
                  d.checkOut,
                  `Rs. ${d.amount}`,
                  d.status
                ]);
                const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `download_history_${displayBranchName}_${new Date().toISOString().split('T')[0]}.csv`;
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
                  const headers = ['Booking No', 'Guest Name', 'Branch', 'Check In', 'Check Out', 'Amount', 'Status'];
                  const rows = downloads.map(d => [
                    d.bookingNo,
                    d.guestName,
                    d.branch,
                    d.checkIn,
                    d.checkOut,
                    `Rs. ${d.amount}`,
                    d.status
                  ]);
                  
                  let html = `
                    <html>
                    <head><title>Download History - ${displayBranchName}</title>
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
                    <h1>Download History - ${displayBranchName}</h1>
                    <div class="summary">
                      <div class="summary-item">📋 Total: ${totalBookings}</div>
                      <div class="summary-item">✅ Downloaded: ${downloadedCount}</div>
                      <div class="summary-item">⏳ Ready: ${readyCount}</div>
                      <div class="summary-item">👁️ Viewed: ${viewedCount}</div>
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