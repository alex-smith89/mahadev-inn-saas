// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  FiHome, FiUsers, FiBookOpen, FiDollarSign,
  FiClock, FiMenu, FiX, FiDownload,
  FiCheckCircle, FiXCircle, FiFileText, FiPieChart, FiPlus,
  FiRefreshCw, FiUser, FiLogOut, FiTrendingUp, FiTrendingDown,
  FiEdit2, FiUserCheck, FiBarChart2, FiActivity, FiGrid,
  FiInfo, FiBell, FiAlertCircle, FiCheck, FiCalendar, FiMail,
  FiCpu, FiSettings, FiZap, FiBellOff, FiEye, FiEyeOff,
  FiMapPin, FiBriefcase, FiRadio, FiWatch, FiSearch
} from 'react-icons/fi';
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
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

// ✅ Import Notification Toast
import { NotificationToast } from '@/components/NotificationToast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

// ✅ API URL
const API_URL = 'http://localhost:4000/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [totalRooms, setTotalRooms] = useState(65);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [updateInterval, setUpdateInterval] = useState<NodeJS.Timeout | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning'>('info');
  
  // ✅ Stats state
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalBookings: 0,
    availableRooms: 65,
    occupiedRooms: 0,
    totalRevenue: 0,
    averageBookingValue: 0,
    occupancyRate: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    activeBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
  });

  // ✅ Recent Bookings with search
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [branchStats, setBranchStats] = useState<{[key: string]: {bookings: number, revenue: number, rooms: number}}>({});
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [upcomingCheckouts, setUpcomingCheckouts] = useState<any[]>([]);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [allBookingsCache, setAllBookingsCache] = useState<any[]>([]);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState<any[]>([]);
  const [showNotificationHistory, setShowNotificationHistory] = useState(false);
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [branchCounts, setBranchCounts] = useState<{[key: string]: number}>({});
  const [branchStatusSummary, setBranchStatusSummary] = useState<{[key: string]: any}>({});
  
  // ✅ New state for checkout information
  const [checkedOutGuests, setCheckedOutGuests] = useState<any[]>([]);
  const [vacantRooms, setVacantRooms] = useState<number>(0);
  const [recentCheckouts, setRecentCheckouts] = useState<any[]>([]);
  
  // ✅ Real-time notification states
  const [todayCheckins, setTodayCheckins] = useState<any[]>([]);
  const [tomorrowCheckins, setTomorrowCheckins] = useState<any[]>([]);
  const [todayCheckoutsList, setTodayCheckoutsList] = useState<any[]>([]);
  const [tomorrowCheckoutsList, setTomorrowCheckoutsList] = useState<any[]>([]);
  const [overdueCheckouts, setOverdueCheckouts] = useState<any[]>([]);
  
  const [monthlyData, setMonthlyData] = useState({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    bookings: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    checkIns: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  const [statusData, setStatusData] = useState({
    labels: ['Confirmed', 'Pending', 'Checked In', 'Checked Out', 'Cancelled'],
    values: [0, 0, 0, 0, 0],
  });
  const [revenueTrend, setRevenueTrend] = useState({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    values: [0, 0, 0, 0, 0, 0],
  });

  // ✅ Function to show notification toast
  const showNotification = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // ✅ Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  // ✅ Apply search filter
  const applySearchFilter = () => {
    if (!searchTerm || searchTerm.trim() === '') {
      setFilteredBookings(recentBookings);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = recentBookings.filter((booking: any) => {
      return (
        booking.agentName?.toLowerCase().includes(searchLower) ||
        booking.bookingNo?.toLowerCase().includes(searchLower) ||
        booking.email?.toLowerCase().includes(searchLower) ||
        booking.agentContact?.includes(searchLower) ||
        booking.branch?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredBookings(filtered);
  };

  // ✅ Update filtered bookings when search term or recent bookings change
  useEffect(() => {
    applySearchFilter();
  }, [searchTerm, recentBookings]);

  // ✅ Format check-in display
  const formatCheckInDisplay = (booking: any) => {
    if (!booking || !booking.checkIn) return 'N/A';
    
    const checkInDate = new Date(booking.checkIn);
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
    
    return hasTime ? `${dateStr} ${timeStr}` : dateStr;
  };

  // ✅ Get relative time string
  const getRelativeTime = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ✅ Check if check-in button should be visible
  const canCheckIn = (booking: any): boolean => {
    return booking.bookingStatus === 'Confirm' || 
           booking.bookingStatus === 'Confirmed' || 
           booking.bookingStatus === 'New' ||
           booking.bookingStatus === 'Pending';
  };

  // ✅ Check if check-out button should be visible
  const canCheckOut = (booking: any): boolean => {
    return booking.bookingStatus === 'CheckedIn';
  };

  // ✅ ✅ INDIVIDUAL AUTO CHECK-IN
  const handleIndividualCheckIn = async (bookingId: string) => {
    if (!confirm('Are you sure you want to check in this guest?')) return;
    
    setProcessingBookingId(bookingId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${bookingId}/checkin`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check in guest');
      }

      const data = await response.json();
      console.log('✅ Guest checked in:', data);
      
      setSuccessMessage(`✅ ${data.data?.agentName || 'Guest'} checked in successfully!`);
      showNotification(`✅ Guest checked in successfully!`, 'success');
      
      // Refresh all data
      await refreshAllData();
      
    } catch (err: any) {
      console.error('❌ Failed to check in guest:', err);
      setErrorMessage(`❌ Failed to check in guest: ${err.message}`);
      showNotification(`❌ Check-in failed: ${err.message}`, 'warning');
    } finally {
      setProcessingBookingId(null);
    }
  };

  // ✅ ✅ INDIVIDUAL AUTO CHECK-OUT
  const handleIndividualCheckOut = async (bookingId: string) => {
    if (!confirm('Are you sure you want to check out this guest?')) return;
    
    setProcessingBookingId(bookingId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${bookingId}/checkout`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check out guest');
      }

      const data = await response.json();
      console.log('✅ Guest checked out:', data);
      
      setSuccessMessage(`✅ ${data.data?.agentName || 'Guest'} checked out successfully!`);
      showNotification(`✅ Guest checked out successfully!`, 'success');
      
      // Refresh all data
      await refreshAllData();
      
    } catch (err: any) {
      console.error('❌ Failed to check out guest:', err);
      setErrorMessage(`❌ Failed to check out guest: ${err.message}`);
      showNotification(`❌ Check-out failed: ${err.message}`, 'warning');
    } finally {
      setProcessingBookingId(null);
    }
  };

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

  // ✅ Load Notifications
  const loadNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  };

  // ✅ Load Notification History
  const loadNotificationHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/notifications/history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotificationHistory(data.data || []);
      }
    } catch (err) {
      console.error('Error loading notification history:', err);
    }
  };

  // ✅ Load Upcoming Checkouts
  const loadUpcomingCheckouts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/checkout/upcoming`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUpcomingCheckouts(data.data || []);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const checkouts = data.data || [];
        setTodayCheckoutsList(checkouts.filter((b: any) => {
          const checkOut = new Date(b.checkOut);
          checkOut.setHours(0, 0, 0, 0);
          return checkOut.getTime() === today.getTime();
        }));
        setTomorrowCheckoutsList(checkouts.filter((b: any) => {
          const checkOut = new Date(b.checkOut);
          checkOut.setHours(0, 0, 0, 0);
          return checkOut.getTime() === tomorrow.getTime();
        }));
        setOverdueCheckouts(checkouts.filter((b: any) => {
          const checkOut = new Date(b.checkOut);
          checkOut.setHours(0, 0, 0, 0);
          return checkOut.getTime() < today.getTime() && b.bookingStatus !== 'CheckedOut';
        }));
      }
    } catch (err) {
      console.error('Error loading upcoming checkouts:', err);
    }
  };

  // ✅ Load Today's Check-ins
  const loadTodayCheckins = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/checkin/today`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const sorted = (data.data || []).sort((a: any, b: any) => {
          return new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime();
        });
        setTodayCheckins(sorted);
      }
    } catch (err) {
      console.error('Error loading today checkins:', err);
    }
  };

  // ✅ Load Tomorrow's Check-ins
  const loadTomorrowCheckins = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/checkin/tomorrow`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTomorrowCheckins(data.data || []);
      }
    } catch (err) {
      console.error('Error loading tomorrow checkins:', err);
    }
  };

  // ✅ Navigate to New Booking page
  const handleNewBooking = () => {
    if (user?.role === 'VIEWER') {
      alert('You do not have permission to create bookings.');
      return;
    }
    router.push('/bookings/new');
  };

  // ✅ Refresh All Data
  const refreshAllData = async () => {
    await loadDashboardData(true);
    await loadNotifications();
    await loadUpcomingCheckouts();
    await loadTodayCheckins();
    await loadTomorrowCheckins();
    await loadNotificationHistory();
    setLastRefresh(Date.now());
    setLastUpdate(new Date().toLocaleTimeString());
  };

  // ✅ Mark Notification as Read
  const markNotificationRead = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      loadNotifications();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // ✅ Mark All Notifications as Read
  const markAllNotificationsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      loadNotifications();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  // ✅ Check for new data every 15 seconds (Real-time updates)
  useEffect(() => {
    if (!selectedBranch || !user) return;

    refreshAllData();
    setLastUpdate(new Date().toLocaleTimeString());

    const interval = setInterval(() => {
      console.log(`🔄 Checking for updates in branch: ${selectedBranch}`);
      refreshAllData();
      setLastUpdate(new Date().toLocaleTimeString());
    }, 15000);

    setUpdateInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedBranch, user]);

  // ✅ Listen for real-time events from bookings
  useEffect(() => {
    const handleBookingCreated = (event: CustomEvent) => {
      const detail = event.detail;
      console.log('📢 Real-time booking event received:', detail);
      
      if (detail && detail.branch) {
        const currentBranch = selectedBranch || user?.branches?.[0] || '';
        if (detail.branch === currentBranch || selectedBranch === 'all') {
          refreshAllData();
          setLastUpdate(new Date().toLocaleTimeString());
          const timeMsg = detail.checkInTime ? ` at ${getFullDateTime(detail.checkInTime)}` : '';
          showNotification(`📋 New booking #${detail.bookingNo} created for ${detail.agentName}${timeMsg}`, 'success');
        }
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bookingUpdated') {
        try {
          const data = JSON.parse(e.newValue || '{}');
          console.log('📦 Cross-tab booking update:', data);
          
          const currentBranch = selectedBranch || user?.branches?.[0] || '';
          if (data.branch === currentBranch || selectedBranch === 'all') {
            refreshAllData();
            setLastUpdate(new Date().toLocaleTimeString());
            const timeMsg = data.checkInTime ? ` at ${getFullDateTime(data.checkInTime)}` : '';
            showNotification(`📋 New booking #${data.bookingNo} created in ${data.branch}${timeMsg}`, 'success');
          }
        } catch (err) {
          console.error('Error parsing booking update:', err);
        }
      }
    };

    window.addEventListener('bookingCreated', handleBookingCreated as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('bookingCreated', handleBookingCreated as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedBranch, user]);

  // ✅ Initialize user data
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
        console.log('📋 Full user data:', userData);
        console.log('📋 Branches from user:', userData.branches);
        console.log('👤 User role:', userData.role);
        
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
        console.log('📋 Available branches:', userBranches);
        console.log('📋 Selected branch:', savedBranch || 'none');
      } catch (e) {
        console.error('Error parsing user:', e);
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }
    }
    
    setLoading(false);
  }, [router]);

  // ✅ Check for refresh query param on page load
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const refreshParam = queryParams.get('refresh');
    
    if (refreshParam === 'true' && selectedBranch && user) {
      console.log('🔄 Refresh triggered from query param');
      window.history.replaceState({}, '', '/dashboard');
      setTimeout(() => {
        refreshAllData();
      }, 500);
    }
  }, [selectedBranch, user]);

  // ✅ Listen for storage changes (cross-tab communication)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'forceRefresh' || e.key === 'bookings' || e.key === 'allBookingsCache' || e.key === 'selectedBranch') {
        console.log('📦 Storage changed, refreshing data...');
        if (selectedBranch && user) {
          localStorage.removeItem('bookings');
          localStorage.removeItem('allBookingsCache');
          setTimeout(() => {
            refreshAllData();
          }, 300);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    const handleBookingCreated = () => {
      console.log('📢 Booking created event received!');
      if (selectedBranch && user) {
        localStorage.removeItem('bookings');
        localStorage.removeItem('allBookingsCache');
        setTimeout(() => {
          refreshAllData();
        }, 300);
      }
    };
    
    window.addEventListener('bookingCreated', handleBookingCreated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingCreated', handleBookingCreated);
    };
  }, [selectedBranch, user]);

  // ✅ Load data when branch or user changes
  useEffect(() => {
    if (!loading && selectedBranch && user) {
      console.log('🔄 Loading dashboard data for branch:', selectedBranch);
      refreshAllData();
    }
  }, [selectedBranch, loading]);

  // ✅ Auto-refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedBranch && user) {
        console.log('👁️ Page became visible, auto-refreshing data...');
        refreshAllData();
        setLastUpdate(new Date().toLocaleTimeString());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedBranch, user]);

  // ✅ Auto-refresh when window gets focus
  useEffect(() => {
    const handleFocus = () => {
      if (selectedBranch && user) {
        console.log('🔲 Window focused, auto-refreshing data...');
        refreshAllData();
        setLastUpdate(new Date().toLocaleTimeString());
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedBranch, user]);

  // ✅ Get full date and time string
  const getFullDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = hasTime ? date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) : '';
    return hasTime ? `${dateStr} ${timeStr}` : dateStr;
  };

  // ✅ Get check-in time color
  const getCheckInTimeColor = (booking: any) => {
    if (!booking || !booking.checkIn) return 'text-gray-400';
    
    const checkInDate = new Date(booking.checkIn);
    if (isNaN(checkInDate.getTime())) return 'text-gray-400';
    
    const now = new Date();
    const diffMs = now.getTime() - checkInDate.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    const isToday = checkInDate.toDateString() === now.toDateString();
    
    if (diffMinutes < 60) return 'text-green-600 font-semibold';
    if (isToday) return 'text-blue-600 font-medium';
    
    return 'text-gray-600';
  };

  // ✅ Get sorted today's check-ins
  const getSortedTodayCheckins = (bookings: any[]) => {
    return [...bookings].sort((a, b) => {
      const timeA = new Date(a.checkIn).getTime();
      const timeB = new Date(b.checkIn).getTime();
      return timeA - timeB;
    });
  };

  // ✅ Check if booking is recent (within last hour)
  const isRecentBooking = (dateString: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs < (1000 * 60 * 60);
  };

  // ✅ loadDashboardData
  const loadDashboardData = async (forceRefresh = false) => {
    try {
      setRefreshing(true);
      setError('');
      setIsLocalMode(false);
      
      if (forceRefresh) {
        localStorage.removeItem('bookings');
        localStorage.removeItem('allBookingsCache');
        console.log('🧹 Cache cleared for fresh data');
      }
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      // ✅ Determine branch to fetch
      let branchToFetch = '';
      
      if (selectedBranch && selectedBranch !== 'all' && selectedBranch !== 'undefined') {
        branchToFetch = selectedBranch;
      }
      
      if (isViewer) {
        const userBranches = user?.branches || [];
        if (userBranches.length === 0) {
          setRecentBookings([]);
          setFilteredBookings([]);
          setStats({
            totalCustomers: 0,
            totalBookings: 0,
            availableRooms: 65,
            occupiedRooms: 0,
            totalRevenue: 0,
            averageBookingValue: 0,
            occupancyRate: 0,
            todayCheckIns: 0,
            todayCheckOuts: 0,
            activeBookings: 0,
            pendingBookings: 0,
            confirmedBookings: 0,
          });
          setRefreshing(false);
          return;
        }
        if (!branchToFetch || branchToFetch === 'all') {
          branchToFetch = userBranches[0];
        }
      }

      console.log('📊 Loading dashboard data for branch:', branchToFetch || 'ALL (No filter)');

      let bookings: any[] = [];
      let branchInfoData = null;

      try {
        let url = `${API_URL}/bookings`;
        if (branchToFetch) {
          url += `?branch=${branchToFetch}`;
        }
        console.log('📊 Fetching all bookings from:', url);
        
        const allBookingsResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });
        
        console.log('📥 Response status:', allBookingsResponse.status);
        
        if (allBookingsResponse.ok) {
          const data = await allBookingsResponse.json();
          console.log('📥 Full API response received');
          
          if (data.branchInfo) {
            branchInfoData = data.branchInfo;
            setBranchInfo(branchInfoData);
            console.log('📍 Branch info:', branchInfoData);
          }
          
          if (data.branchCounts) {
            setBranchCounts(data.branchCounts);
            console.log('📊 Branch counts:', data.branchCounts);
          }
          
          if (data.branchStatusSummary) {
            setBranchStatusSummary(data.branchStatusSummary);
            console.log('📊 Branch status summary:', data.branchStatusSummary);
          }
          
          let allBookings = data.bookings || data.data || [];
          console.log(`📋 Raw bookings from API:`, allBookings.length);
          
          if (allBookings.length === 0 && data) {
            if (Array.isArray(data)) {
              allBookings = data;
              console.log(`📋 Data is directly an array with ${allBookings.length} bookings`);
            }
          }
          
          const statusCounts: {[key: string]: number} = {};
          allBookings.forEach((b: any) => {
            const status = b.bookingStatus || 'Unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
          console.log('📊 Booking statuses:', statusCounts);
          
          allBookings = allBookings.map((b: any) => {
            const bookingBranch = b.branch || b.branchName || '';
            const normalizedBranch = normalizeBranchName(bookingBranch);
            return { ...b, branch: normalizedBranch, branchName: normalizedBranch };
          });
          
          setAllBookingsCache(allBookings);
          localStorage.setItem('allBookingsCache', JSON.stringify(allBookings));
          
          const branchCountsData: {[key: string]: number} = {};
          allBookings.forEach((b: any) => {
            const br = b.branch || b.branchName || 'Unknown';
            branchCountsData[br] = (branchCountsData[br] || 0) + 1;
          });
          console.log('📊 Bookings per branch after normalization:', branchCountsData);
          
          // ✅ Filter bookings based on user role and branch selection
          if (user?.role === 'OWNER') {
            if (selectedBranch === 'all' || !selectedBranch) {
              bookings = allBookings;
              console.log(`📋 Owner: Showing ALL bookings: ${bookings.length}`);
            } else {
              bookings = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === selectedBranch;
              });
              console.log(`📋 Owner: Filtered bookings for ${selectedBranch}: ${bookings.length}`);
            }
          } else if (user?.role === 'MANAGER') {
            const userBranches = user?.branches || [];
            
            if (selectedBranch === 'all' || !selectedBranch) {
              if (userBranches.length > 1) {
                bookings = allBookings.filter((b: any) => {
                  const bookingBranch = b.branch || b.branchName || '';
                  return userBranches.includes(bookingBranch);
                });
                console.log(`📋 Manager: Showing bookings from all assigned branches: ${bookings.length}`);
              } else {
                const firstBranch = userBranches[0] || '';
                bookings = allBookings.filter((b: any) => {
                  const bookingBranch = b.branch || b.branchName || '';
                  return bookingBranch === firstBranch;
                });
                console.log(`📋 Manager: Filtered bookings for ${firstBranch}: ${bookings.length}`);
              }
            } else {
              bookings = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === selectedBranch;
              });
              console.log(`📋 Manager: Filtered bookings for ${selectedBranch}: ${bookings.length}`);
            }
          } else if (user?.role === 'VIEWER') {
            const userBranches = user?.branches || [];
            
            if (selectedBranch === 'all' || !selectedBranch) {
              bookings = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return userBranches.includes(bookingBranch);
              });
              console.log(`📋 Viewer: Showing bookings from assigned branches: ${bookings.length}`);
            } else {
              if (userBranches.includes(selectedBranch)) {
                bookings = allBookings.filter((b: any) => {
                  const bookingBranch = b.branch || b.branchName || '';
                  return bookingBranch === selectedBranch;
                });
                console.log(`📋 Viewer: Filtered bookings for ${selectedBranch}: ${bookings.length}`);
              } else {
                const firstBranch = userBranches[0] || '';
                bookings = allBookings.filter((b: any) => {
                  const bookingBranch = b.branch || b.branchName || '';
                  return bookingBranch === firstBranch;
                });
                console.log(`📋 Viewer: Fallback to first assigned branch ${firstBranch}: ${bookings.length}`);
              }
            }
          } else {
            if (selectedBranch && selectedBranch !== 'all') {
              bookings = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === selectedBranch;
              });
            } else {
              bookings = allBookings;
            }
          }
          
          localStorage.setItem('bookings', JSON.stringify(bookings));
          
        } else if (allBookingsResponse.status === 401) {
          console.log('⚠️ Unauthorized - Token expired');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        } else {
          console.error('❌ Failed to fetch bookings. Status:', allBookingsResponse.status);
          const errorText = await allBookingsResponse.text();
          console.error('❌ Error response:', errorText);
        }
      } catch (err) {
        console.error('Error fetching bookings:', err);
        setError('Failed to fetch bookings from server. Please check if the server is running.');
      }

      // ✅ If no bookings from API, try local storage
      if (bookings.length === 0) {
        try {
          const cachedAllBookings = localStorage.getItem('allBookingsCache');
          if (cachedAllBookings) {
            const parsedCache = JSON.parse(cachedAllBookings);
            if (parsedCache.length > 0) {
              console.log(`📋 Found ${parsedCache.length} bookings in allBookingsCache`);
              
              let filteredCache = [];
              if (user?.role === 'OWNER') {
                if (selectedBranch === 'all' || !selectedBranch) {
                  filteredCache = parsedCache;
                } else {
                  filteredCache = parsedCache.filter((b: any) => {
                    const bookingBranch = b.branch || b.branchName || '';
                    return bookingBranch === selectedBranch;
                  });
                }
              } else {
                if (selectedBranch && selectedBranch !== 'all') {
                  filteredCache = parsedCache.filter((b: any) => {
                    const bookingBranch = b.branch || b.branchName || '';
                    return bookingBranch === selectedBranch;
                  });
                } else {
                  filteredCache = parsedCache;
                }
              }
              
              if (filteredCache.length > 0) {
                bookings = filteredCache;
                setIsLocalMode(true);
                console.log(`📋 Using ${bookings.length} bookings from cache for branch ${selectedBranch || 'all'}`);
              }
            }
          }
          
          if (bookings.length === 0) {
            const localBookings = JSON.parse(localStorage.getItem('bookings') || '[]');
            if (localBookings.length > 0) {
              console.log(`📋 Found ${localBookings.length} bookings in local storage`);
              
              const normalizedLocal = localBookings.map((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                const normalizedBranch = normalizeBranchName(bookingBranch);
                return { ...b, branch: normalizedBranch, branchName: normalizedBranch };
              });
              
              let filteredLocal = [];
              if (user?.role === 'VIEWER') {
                const userBranches = user?.branches || [];
                if (selectedBranch === 'all' || !selectedBranch) {
                  filteredLocal = normalizedLocal.filter((b: any) => {
                    const bookingBranch = b.branch || b.branchName || '';
                    return userBranches.includes(bookingBranch);
                  });
                } else {
                  filteredLocal = normalizedLocal.filter((b: any) => {
                    const bookingBranch = b.branch || b.branchName || '';
                    return bookingBranch === selectedBranch;
                  });
                }
              } else if (user?.role === 'MANAGER') {
                const userBranches = user?.branches || [];
                if (selectedBranch === 'all' || !selectedBranch) {
                  if (userBranches.length > 1) {
                    filteredLocal = normalizedLocal.filter((b: any) => {
                      const bookingBranch = b.branch || b.branchName || '';
                      return userBranches.includes(bookingBranch);
                    });
                  } else {
                    const firstBranch = userBranches[0] || '';
                    filteredLocal = normalizedLocal.filter((b: any) => {
                      const bookingBranch = b.branch || b.branchName || '';
                      return bookingBranch === firstBranch;
                    });
                  }
                } else {
                  filteredLocal = normalizedLocal.filter((b: any) => {
                    const bookingBranch = b.branch || b.branchName || '';
                    return bookingBranch === selectedBranch;
                  });
                }
              } else {
                if (selectedBranch && selectedBranch !== 'all') {
                  filteredLocal = normalizedLocal.filter((b: any) => {
                    const bookingBranch = b.branch || b.branchName || '';
                    return bookingBranch === selectedBranch;
                  });
                } else {
                  filteredLocal = normalizedLocal;
                }
              }
              
              if (filteredLocal.length > 0) {
                bookings = filteredLocal;
                setIsLocalMode(true);
                console.log(`📋 Using ${bookings.length} bookings from local storage for branch ${selectedBranch || 'all'}`);
              }
            }
          }
        } catch (e) {
          console.error('Error loading local bookings:', e);
        }
      }

      console.log(`📋 Final bookings count for ${selectedBranch || 'all'}: ${bookings.length}`);
      console.log('📋 Sample booking:', bookings.length > 0 ? bookings[0] : 'No bookings');

      // ✅ Calculate capacity based on branch
      let capacityTotal = 0;
      
      if (selectedBranch && selectedBranch !== 'all') {
        try {
          const capacityRes = await fetch(`${API_URL}/room-capacity/branch/${selectedBranch}`, {
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
          } else {
            capacityTotal = 65;
            setTotalRooms(65);
            console.log('⚠️ Could not fetch branch capacity, using default 65');
          }
        } catch (err) {
          console.log('⚠️ Could not fetch branch capacity, using default 65');
          capacityTotal = 65;
          setTotalRooms(65);
        }
      } else {
        let branchesToCheck: string[] = [];
        
        if (user?.role === 'OWNER') {
          branchesToCheck = ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'];
        } else if (user?.role === 'MANAGER' || user?.role === 'VIEWER') {
          branchesToCheck = user?.branches || [];
        } else {
          branchesToCheck = ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'];
        }
        
        if (branchesToCheck.length === 0) {
          branchesToCheck = ['Pokhara'];
        }
        
        let totalCapacity = 0;
        for (const b of branchesToCheck) {
          try {
            const capacityRes = await fetch(`${API_URL}/room-capacity/branch/${b}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
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
        console.log('🏨 Total capacity:', capacityTotal);
      }

      calculateStats(bookings, capacityTotal);
      
      const sortedBookings = [...bookings].sort((a, b) => {
        return new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime();
      });
      setRecentBookings(sortedBookings.slice(0, 10));
      setFilteredBookings(sortedBookings.slice(0, 10));
      
      calculateChartData(bookings);
      calculateBranchStats(bookings);
      calculateCheckoutInfo(bookings);
      
      setRefreshing(false);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
      setRefreshing(false);
    }
  };

  // ✅ Calculate checkout information
  const calculateCheckoutInfo = (bookings: any[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayCheckouts = bookings.filter((b: any) => {
      const checkOut = new Date(b.checkOut);
      checkOut.setHours(0, 0, 0, 0);
      const isCheckoutToday = checkOut.getTime() === today.getTime();
      const isCheckedOut = b.bookingStatus === 'CheckedOut';
      const isCheckingOutToday = isCheckoutToday && (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn');
      return isCheckedOut || isCheckingOutToday;
    });
    
    console.log(`📋 Today's checkouts: ${todayCheckouts.length}`);
    
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentCheckoutsList = bookings.filter((b: any) => {
      const checkOut = new Date(b.checkOut);
      return b.bookingStatus === 'CheckedOut' && checkOut >= sevenDaysAgo && checkOut <= today;
    }).sort((a: any, b: any) => {
      return new Date(b.checkOut).getTime() - new Date(a.checkOut).getTime();
    }).slice(0, 10);
    
    setRecentCheckouts(recentCheckoutsList);
    setCheckedOutGuests(todayCheckouts);
    
    const occupied = bookings.filter((b: any) => {
      const checkIn = new Date(b.checkIn);
      checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(b.checkOut);
      checkOut.setHours(0, 0, 0, 0);
      const isActive = b.bookingStatus === 'Confirm' || 
                       b.bookingStatus === 'Confirmed' || 
                       b.bookingStatus === 'CheckedIn';
      return isActive && checkIn <= today && checkOut > today;
    });
    const occupiedRooms = occupied.reduce((sum: number, b: any) => sum + (b.roomsCount || 1), 0);
    const vacantRoomsCount = Math.max(0, totalRooms - occupiedRooms);
    setVacantRooms(vacantRoomsCount);
  };

  const calculateStats = (bookings: any[], capacity: number) => {
    const confirmed = bookings.filter((b: any) => 
      b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed'
    );
    const pending = bookings.filter((b: any) => 
      b.bookingStatus === 'Pending'
    );
    const checkedOut = bookings.filter((b: any) => 
      b.bookingStatus === 'CheckedOut'
    );
    const checkedIn = bookings.filter((b: any) => 
      b.bookingStatus === 'CheckedIn'
    );
    
    let totalRevenue = 0;
    const revenueBookings = bookings.filter((b: any) => 
      b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || 
      b.bookingStatus === 'CheckedIn' || b.bookingStatus === 'CheckedOut'
    );
    revenueBookings.forEach((b: any) => {
      totalRevenue += (Number(b.totalCost) || Number(b.roomCharges) || Number(b.price) || 0);
    });
    
    const uniqueCustomers = new Set();
    bookings.forEach((b: any) => {
      if (b.agentName) uniqueCustomers.add(b.agentName);
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const occupied = bookings.filter((b: any) => {
      const checkIn = new Date(b.checkIn);
      checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(b.checkOut);
      checkOut.setHours(0, 0, 0, 0);
      const isActive = b.bookingStatus === 'Confirm' || 
                       b.bookingStatus === 'Confirmed' || 
                       b.bookingStatus === 'CheckedIn';
      return isActive && checkIn <= today && checkOut > today;
    });
    
    const occupiedRooms = occupied.reduce((sum: number, b: any) => sum + (b.roomsCount || 1), 0);
    const availableRooms = Math.max(0, capacity - occupiedRooms);
    const occupancyRate = capacity > 0 ? Math.round((occupiedRooms / capacity) * 100) : 0;
    
    const todayStr = today.toDateString();
    const todayCheckIns = bookings.filter((b: any) => {
      const checkIn = new Date(b.checkIn);
      return checkIn.toDateString() === todayStr && 
             (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn');
    }).length;

    const todayCheckOuts = bookings.filter((b: any) => {
      const checkOut = new Date(b.checkOut);
      return checkOut.toDateString() === todayStr && 
             (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn' || b.bookingStatus === 'CheckedOut');
    }).length;
    
    const displayBranch = selectedBranch === 'all' ? 'All Branches' : selectedBranch;
    console.log(`📊 Calculated Stats for ${displayBranch}:`, {
      totalBookings: bookings.length,
      totalCustomers: uniqueCustomers.size,
      totalRevenue,
      occupiedRooms,
      availableRooms,
      occupancyRate,
      confirmed: confirmed.length,
      pending: pending.length,
      checkedOut: checkedOut.length,
      checkedIn: checkedIn.length
    });
    
    setStats({
      totalCustomers: uniqueCustomers.size,
      totalBookings: bookings.length,
      availableRooms: availableRooms,
      occupiedRooms: occupiedRooms,
      totalRevenue: totalRevenue,
      averageBookingValue: revenueBookings.length > 0 ? totalRevenue / revenueBookings.length : 0,
      occupancyRate: occupancyRate,
      todayCheckIns: todayCheckIns,
      todayCheckOuts: todayCheckOuts,
      activeBookings: occupied.length,
      pendingBookings: pending.length,
      confirmedBookings: confirmed.length + checkedIn.length,
    });
  };

  const calculateBranchStats = (bookings: any[]) => {
    const branchData: {[key: string]: {bookings: number, revenue: number, rooms: number}} = {};
    
    bookings.forEach((b: any) => {
      const branch = b.branch || b.branchName || 'Unknown';
      const rooms = b.roomsCount || 1;
      
      if (!branchData[branch]) {
        branchData[branch] = { bookings: 0, revenue: 0, rooms: 0 };
      }
      
      branchData[branch].bookings += 1;
      branchData[branch].rooms += rooms;
      
      if (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn' || b.bookingStatus === 'CheckedOut') {
        branchData[branch].revenue += (Number(b.totalCost) || Number(b.roomCharges) || Number(b.price) || 0);
      }
    });
    
    setBranchStats(branchData);
  };

  const calculateChartData = (bookings: any[]) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyBookings = new Array(12).fill(0);
    const monthlyCheckIns = new Array(12).fill(0);
    
    let confirmed = 0, pending = 0, checkedIn = 0, checkedOut = 0, cancelled = 0;
    
    const revenueByMonth = new Array(6).fill(0);
    const currentMonth = new Date().getMonth();
    
    bookings.forEach((b: any) => {
      const checkInDate = new Date(b.checkIn);
      const month = checkInDate.getMonth();
      
      monthlyBookings[month] += 1;
      
      if (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn') {
        monthlyCheckIns[month] += 1;
      }
      
      switch (b.bookingStatus) {
        case 'Confirm':
        case 'Confirmed':
          confirmed++;
          break;
        case 'Pending':
          pending++;
          break;
        case 'CheckedIn':
          checkedIn++;
          break;
        case 'CheckedOut':
          checkedOut++;
          break;
        case 'Cancelled':
          cancelled++;
          break;
      }
      
      for (let i = 0; i < 6; i++) {
        const targetMonth = (currentMonth - i + 12) % 12;
        if (month === targetMonth && (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn' || b.bookingStatus === 'CheckedOut')) {
          revenueByMonth[5 - i] += (Number(b.totalCost) || Number(b.roomCharges) || Number(b.price) || 0);
        }
      }
    });
    
    setMonthlyData({
      labels: months,
      bookings: monthlyBookings,
      checkIns: monthlyCheckIns,
    });
    
    setStatusData({
      labels: ['Confirmed', 'Pending', 'Checked In', 'Checked Out', 'Cancelled'],
      values: [confirmed, pending, checkedIn, checkedOut, cancelled],
    });
    
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const idx = (currentMonth - i + 12) % 12;
      last6Months.push(months[idx]);
    }
    
    setRevenueTrend({
      labels: last6Months,
      values: revenueByMonth,
    });
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
    setTimeout(() => {
      refreshAllData();
    }, 300);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedBranch');
    localStorage.removeItem('bookings');
    localStorage.removeItem('allBookingsCache');
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

  // ✅ Format currency
  const formatCurrency = (amount: number) => {
    if (!amount || amount === 0) return 'Rs. 0';
    if (amount >= 100000) {
      return `Rs. ${(amount / 100000).toFixed(0)}L`;
    }
    if (amount >= 1000) {
      return `Rs. ${(amount / 1000).toFixed(0)}K`;
    }
    return `Rs. ${amount.toFixed(0)}`;
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-100 text-purple-800';
      case 'MANAGER': return 'bg-blue-100 text-blue-800';
      case 'VIEWER': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER': return '👑';
      case 'MANAGER': return '📋';
      case 'VIEWER': return '👁️';
      default: return '👤';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'checkin_today': return '🔔';
      case 'checkin_tomorrow': return '📅';
      case 'checkout_today': return '📤';
      case 'checkout_tomorrow': return '📅';
      case 'checkout_2days': return '📅';
      case 'checkout_3days': return '📅';
      case 'auto_checkin': return '🔄';
      case 'auto_checkout': return '🔄';
      case 'booking_created': return '📋';
      default: return '📌';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'checkin_today': return 'border-green-500 bg-green-50';
      case 'checkin_tomorrow': return 'border-blue-500 bg-blue-50';
      case 'checkout_today': return 'border-red-500 bg-red-50';
      case 'checkout_tomorrow': return 'border-orange-500 bg-orange-50';
      case 'auto_checkin': return 'border-purple-500 bg-purple-50';
      case 'auto_checkout': return 'border-pink-500 bg-pink-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 12,
          },
          boxWidth: typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 20,
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: {
            size: typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 11,
          },
        },
      },
      x: {
        ticks: {
          font: {
            size: typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 11,
          },
        },
      },
    },
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 12,
          },
          boxWidth: typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 20,
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return 'Rs. ' + value.toLocaleString();
          },
          font: {
            size: typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 11,
          },
        },
      },
      x: {
        ticks: {
          font: {
            size: typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 11,
          },
        },
      },
    },
  };

  const barChartData = {
    labels: monthlyData.labels,
    datasets: [
      {
        label: 'Bookings',
        data: monthlyData.bookings,
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Check-ins',
        data: monthlyData.checkIns,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const statusChartData = {
    labels: statusData.labels,
    datasets: [
      {
        label: 'Booking Status',
        data: statusData.values,
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(107, 114, 128, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(234, 179, 8, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(107, 114, 128, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const revenueLineData = {
    labels: revenueTrend.labels,
    datasets: [
      {
        label: 'Revenue Trend',
        data: revenueTrend.values,
        borderColor: 'rgba(139, 92, 246, 1)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(139, 92, 246, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: typeof window !== 'undefined' && window.innerWidth < 640 ? 2 : 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // ✅ Calculate branch-wise monthly revenue
  const calculateBranchMonthlyRevenue = (branchName: string) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    let monthlyRevenue = 0;
    allBookingsCache.forEach((b: any) => {
      const date = new Date(b.checkIn);
      const bookingBranch = b.branch || b.branchName || '';
      
      if (bookingBranch === branchName &&
          date.getMonth() === currentMonth && 
          date.getFullYear() === currentYear &&
          (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || 
           b.bookingStatus === 'CheckedIn' || b.bookingStatus === 'CheckedOut')) {
        monthlyRevenue += (Number(b.totalCost) || Number(b.roomCharges) || Number(b.price) || 0);
      }
    });
    return monthlyRevenue;
  };

  // ✅ Calculate monthly revenue for the current selected branch
  const monthlyRevenueDisplay = selectedBranch === 'all' 
    ? allBookingsCache.reduce((total, b: any) => {
        const date = new Date(b.checkIn);
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        if (date.getMonth() === currentMonth && 
            date.getFullYear() === currentYear &&
            (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || 
             b.bookingStatus === 'CheckedIn' || b.bookingStatus === 'CheckedOut')) {
          return total + (Number(b.totalCost) || Number(b.roomCharges) || Number(b.price) || 0);
        }
        return total;
      }, 0)
    : calculateBranchMonthlyRevenue(selectedBranch);

  // ✅ Format monthly revenue display
  const formatMonthlyRevenue = (amount: number) => {
    if (!amount || amount === 0) return 'Rs. 0';
    if (amount >= 100000) {
      return `Rs. ${(amount / 100000).toFixed(0)}L`;
    }
    if (amount >= 1000) {
      return `Rs. ${(amount / 1000).toFixed(0)}K`;
    }
    return `Rs. ${amount.toFixed(0)}`;
  };

  // ✅ Get filtered branches for viewer
  const getAvailableBranches = () => {
    if (isViewer) {
      return user?.branches || [];
    }
    if (isManager) {
      return user?.branches || [];
    }
    return branches;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!branches || branches.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">No Branches Assigned</h2>
          <p className="text-gray-600 mt-2">You don't have any branches assigned to your account.</p>
          <button onClick={handleLogout} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            Logout
          </button>
        </div>
      </div>
    );
  }

  const displayBranchName = selectedBranch === 'all' ? 'All Branches' : selectedBranch;
  const availableRoomsCount = stats.availableRooms || 0;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ✅ Sidebar - COMPLETE */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-indigo-800 text-white transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:relative lg:flex-shrink-0 overflow-y-auto`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-indigo-700 bg-indigo-900/30">
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                <Image
                  src="/mahadev-logo.png"
                  alt="Mahadev Inn"
                  width={48}
                  height={48}
                  className="object-contain rounded-lg"
                  priority
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-wide truncate">Mahadev Inn</h1>
                <p className="text-[8px] sm:text-[10px] text-indigo-300 tracking-wider truncate">HOTEL MANAGEMENT</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-indigo-300 hover:text-white transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Section */}
          <div className="p-3 sm:p-4 border-b border-indigo-700">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <FiUser className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate text-sm sm:text-base">{user?.username || 'User'}</p>
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${getRoleBadgeColor(user?.role)} truncate`}>
                    {user?.role || 'Guest'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowProfileModal(true)}
                className="text-indigo-300 hover:text-white transition-colors flex-shrink-0"
                title="View Profile"
              >
                <FiUserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1">
            <Link href="/dashboard" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-indigo-700 text-white transition-colors text-sm sm:text-base">
              <FiHome className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Dashboard</span>
            </Link>
            
            <Link href="/bookings" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiBookOpen className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Bookings</span>
            </Link>
            
            <Link href="/dashboard/booking-history" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiClock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Booking History</span>
            </Link>
            
            <Link href="/dashboard/download-history" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiDownload className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Download History</span>
            </Link>

            {/* Owner-only links */}
            {user?.role === 'OWNER' && (
              <>
                <Link href="/dashboard/room-pricing" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
                  <FiDollarSign className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="truncate">Room Pricing</span>
                </Link>

                <Link href="/dashboard/room-capacity" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
                  <FiGrid className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="truncate">Room Capacity</span>
                </Link>
              </>
            )}
            
            <Link href="/dashboard/reports" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiPieChart className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Reports</span>
            </Link>
          </nav>

          {/* Logout Button */}
          <div className="p-3 sm:p-4 border-t border-indigo-700">
            <button onClick={handleLogout} className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 w-full rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiLogOut className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-4">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <button 
                onClick={() => setSidebarOpen(true)} 
                className="lg:hidden text-gray-600 hover:text-gray-900 flex-shrink-0"
              >
                <FiMenu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl font-semibold text-gray-800 truncate">Dashboard</h2>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  Welcome back, {user?.username || 'User'}!
                  {branchInfo && (
                    <span className="ml-2 text-indigo-600">
                      <FiMapPin className="inline w-3 h-3" /> {branchInfo.currentBranch || displayBranchName}
                    </span>
                  )}
                </p>
                {isLocalMode && (
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                    📝 Offline Mode
                  </span>
                )}
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                  <FiRadio className="w-3 h-3 text-green-500 animate-pulse" />
                  <span>Real-time updates: {lastUpdate || 'Waiting...'}</span>
                  <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-4 flex-shrink-0">
              {/* Branch Dropdown */}
              <div className="relative">
                <select
                  value={selectedBranch || (getAvailableBranches().length > 0 ? getAvailableBranches()[0] : '')}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="text-xs sm:text-sm border-2 border-indigo-300 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white min-w-[120px] sm:min-w-[160px] font-medium text-gray-700 hover:border-indigo-400 cursor-pointer shadow-sm"
                >
                  {(isOwner || isManager) && (
                    <option value="all" className="font-bold text-indigo-600">🌐 All Branches</option>
                  )}
                  {getAvailableBranches().map((branch) => {
                    return (
                      <option key={branch} value={branch} className="py-1">
                        🏨 {branch}
                        {branchCounts[branch] !== undefined && (
                          <span className="text-xs text-gray-400 ml-1">({branchCounts[branch]})</span>
                        )}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-indigo-600 transition-colors"
                >
                  <FiBell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                      <span className="font-semibold text-sm">Notifications</span>
                      <div className="flex gap-2">
                        {unreadCount > 0 && (
                          <button 
                            onClick={markAllNotificationsRead}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotificationHistory(!showNotificationHistory)}
                          className="text-xs text-purple-600 hover:text-purple-800"
                        >
                          {showNotificationHistory ? 'Hide History' : 'Show History'}
                        </button>
                      </div>
                    </div>
                    
                    {showNotificationHistory ? (
                      notificationHistory.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">No notification history</div>
                      ) : (
                        notificationHistory.slice(0, 10).map((n) => (
                          <div key={n.id} className={`p-3 border-b border-gray-100 ${getNotificationColor(n.type)}`}>
                            <div className="flex items-start gap-2">
                              <span className="text-lg">{getNotificationIcon(n.type)}</span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">{n.title}</p>
                                <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {n.branch} • {new Date(n.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">No new notifications</div>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <div 
                            key={n.id} 
                            className={`p-3 border-b hover:bg-gray-50 transition-colors cursor-pointer ${!n.isRead ? 'bg-blue-50' : ''} ${getNotificationColor(n.type)}`}
                            onClick={() => markNotificationRead(n.id)}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-lg">{getNotificationIcon(n.type)}</span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">{n.title}</p>
                                <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{n.branch} • {new Date(n.createdAt).toLocaleTimeString()}</p>
                              </div>
                              {!n.isRead && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></span>
                              )}
                            </div>
                          </div>
                        ))
                      )
                    )}
                    
                    {notifications.length > 5 && !showNotificationHistory && (
                      <div className="p-2 text-center border-t">
                        <button
                          onClick={() => setShowNotificationHistory(true)}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          View all notifications →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={refreshAllData}
                disabled={refreshing}
                className="bg-indigo-100 text-indigo-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-indigo-200 transition-colors flex items-center space-x-1 disabled:opacity-50"
              >
                <FiRefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="text-[10px] sm:text-sm hidden xs:inline">{refreshing ? '...' : 'Refresh'}</span>
              </button>
              <button
                onClick={() => setShowProfileModal(true)}
                className="bg-indigo-100 text-indigo-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-indigo-200 transition-colors flex items-center space-x-1"
              >
                <FiUser className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-sm hidden sm:inline">Profile</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
          {/* Real-time Notification Alerts */}
          {todayCheckins.length > 0 && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <FiWatch className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">
                    🕐 {todayCheckins.length} guest(s) checking in TODAY
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {getSortedTodayCheckins(todayCheckins).map((b: any) => {
                      const checkInDate = new Date(b.checkIn);
                      const hasTime = checkInDate.getHours() !== 0 || checkInDate.getMinutes() !== 0;
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
                      return (
                        <span key={b.id} className="inline-block bg-green-100 px-2 py-0.5 rounded mr-1 mb-1">
                          {b.agentName} 
                          {hasTime && ` 🕐 ${dateStr} ${timeStr}`}
                          ({b.roomType})
                        </span>
                      );
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tomorrowCheckins.length > 0 && (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <FiCalendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">
                    📅 {tomorrowCheckins.length} guest(s) checking in TOMORROW
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {tomorrowCheckins.map((b: any) => {
                      const checkInDate = new Date(b.checkIn);
                      const dateStr = checkInDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });
                      return (
                        <span key={b.id} className="inline-block bg-blue-100 px-2 py-0.5 rounded mr-1 mb-1">
                          {b.agentName} ({b.roomType}) - {dateStr}
                        </span>
                      );
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {todayCheckoutsList.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <FiAlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    📤 {todayCheckoutsList.length} guest(s) checking out TODAY
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {todayCheckoutsList.map((b: any) => (
                      <span key={b.id} className="inline-block bg-red-100 px-2 py-0.5 rounded mr-1 mb-1">
                        {b.agentName} ({b.roomType})
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {overdueCheckouts.length > 0 && (
            <div className="bg-red-100 border border-red-400 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <FiXCircle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">
                    ⚠️ {overdueCheckouts.length} guest(s) have OVERDUE checkout!
                  </p>
                  <p className="text-xs text-red-800 mt-0.5">
                    {overdueCheckouts.map((b: any) => (
                      <span key={b.id} className="inline-block bg-red-200 px-2 py-0.5 rounded mr-1 mb-1">
                        {b.agentName} ({new Date(b.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded mb-3 sm:mb-4 text-sm">
              ⚠️ {error}
              <button onClick={() => setError('')} className="float-right font-bold">×</button>
            </div>
          )}

          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold flex items-center flex-wrap">
                  <span className="mr-2">👋</span> Welcome to Mahadev Inn
                  {isOwner && (
                    <span className="ml-3 text-xs bg-white/20 px-2 py-1 rounded-full">👑 Owner</span>
                  )}
                  {isManager && (
                    <span className="ml-3 text-xs bg-blue-400/30 px-2 py-1 rounded-full">📋 Manager</span>
                  )}
                  {isViewer && (
                    <span className="ml-3 text-xs bg-green-500/30 px-2 py-1 rounded-full">👁️ Viewer</span>
                  )}
                </h2>
              </div>
              <div className="mt-2 md:mt-0">
                <span className="px-2 sm:px-3 py-1 bg-white/20 rounded-full text-[10px] sm:text-sm font-medium inline-block">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mt-4 sm:mt-6">
              <div className="bg-white/10 rounded-lg p-2 sm:p-3 backdrop-blur-sm">
                <p className="text-[10px] sm:text-sm text-indigo-100">User</p>
                <p className="font-semibold text-sm sm:text-lg truncate">{user?.username || 'Unknown'}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 sm:p-3 backdrop-blur-sm">
                <p className="text-[10px] sm:text-sm text-indigo-100">Role</p>
                <p className="font-semibold text-sm sm:text-lg truncate">{user?.role || 'Unknown'}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 sm:p-3 backdrop-blur-sm hidden xs:block">
                <p className="text-[10px] sm:text-sm text-indigo-100">Branch</p>
                <p className="font-semibold text-sm sm:text-lg truncate">{displayBranchName}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 sm:p-3 backdrop-blur-sm">
                <p className="text-[10px] sm:text-sm text-indigo-100">Active Bookings</p>
                <p className="font-semibold text-sm sm:text-lg">{stats.activeBookings}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20 gap-2">
              <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
                <span className="text-[10px] sm:text-sm text-indigo-100">Selected Branch:</span>
                <span className="font-medium text-white bg-white/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-sm">
                  {displayBranchName}
                </span>
                <span className="text-[10px] sm:text-sm text-green-300 flex items-center">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-1"></span>
                  Active
                </span>
                <span className="text-[10px] sm:text-sm text-indigo-200">
                  🔄 Auto-refresh every 15s
                </span>
              </div>
              <button
                onClick={() => setShowProfileModal(true)}
                className="text-[10px] sm:text-sm bg-white/20 hover:bg-white/30 px-2 sm:px-4 py-1 sm:py-2 rounded-lg transition-colors flex items-center space-x-1 sm:space-x-2"
              >
                <FiUserCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">View Profile</span>
              </button>
            </div>
          </div>

          {/* Today's Check-ins */}
          {todayCheckins.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border-l-4 border-green-500">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                <FiWatch className="w-4 h-4 mr-2 text-green-500" />
                Today's Check-ins ({todayCheckins.length}) 
                <span className="ml-2 text-xs font-normal text-gray-400">
                  Sorted by check-in time
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Guest Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Check-in Date & Time</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getSortedTodayCheckins(todayCheckins).map((booking) => {
                      const checkInDate = new Date(booking.checkIn);
                      const hasTime = checkInDate.getHours() !== 0 || checkInDate.getMinutes() !== 0;
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
                      return (
                        <tr key={booking.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900 font-medium">{booking.agentName}</td>
                          <td className={`px-3 py-2 text-sm ${getCheckInTimeColor(booking)}`}>
                            {hasTime ? (
                              <>
                                <FiWatch className="inline w-3 h-3 mr-1" />
                                {dateStr} {timeStr}
                              </>
                            ) : (
                              <span className="text-gray-400">{dateStr} (Time not set)</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">{booking.roomType}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(booking.bookingStatus)}`}>
                              {booking.bookingStatus === 'CheckedIn' ? '✅ Checked In' : '📋 Confirmed'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-6">
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-gray-500 truncate">Total Customers</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">{stats.totalCustomers}</p>
                </div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiUsers className="w-4 h-4 sm:w-6 sm:h-6 text-blue-500" />
                </div>
              </div>
              <div className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-gray-500">Unique guests in {displayBranchName}</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border-l-4 border-green-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-gray-500 truncate">Total Bookings</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">{stats.totalBookings}</p>
                </div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiBookOpen className="w-4 h-4 sm:w-6 sm:h-6 text-green-500" />
                </div>
              </div>
              <div className="mt-1 sm:mt-2 text-[10px] sm:text-sm flex flex-wrap gap-1 sm:gap-2">
                <span className="text-green-600">✓ {stats.confirmedBookings}</span>
                <span className="text-yellow-600">⏳ {stats.pendingBookings}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border-l-4 border-yellow-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-gray-500 truncate">Available Rooms</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">{availableRoomsCount}</p>
                </div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiHome className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-500" />
                </div>
              </div>
              <div className="mt-1 sm:mt-2 text-[10px] sm:text-sm">
                <span className="text-gray-500">{stats.occupiedRooms} occupied out of {totalRooms}</span>
              </div>
              <div className="mt-1 sm:mt-2 w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                <div 
                  className={`${getOccupancyBgColor(stats.occupancyRate)} h-1.5 sm:h-2 rounded-full transition-all duration-500`} 
                  style={{ width: `${Math.min(stats.occupancyRate, 100)}%` }}
                />
              </div>
              <div className="mt-0.5 sm:mt-1 text-[8px] sm:text-xs text-gray-400">
                Occupancy: <span className={`font-bold ${getOccupancyColor(stats.occupancyRate)}`}>{stats.occupancyRate}%</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border-l-4 border-purple-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-sm text-gray-500 truncate">
                    {selectedBranch === 'all' ? 'Total Monthly Revenue' : `${displayBranchName} Revenue`}
                  </p>
                  <p className="text-lg sm:text-3xl font-bold text-gray-800 truncate">
                    {formatMonthlyRevenue(monthlyRevenueDisplay)}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiDollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-purple-500" />
                </div>
              </div>
              <div className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-gray-500 truncate">
                {selectedBranch === 'all' ? 'All branches combined' : `${displayBranchName} branch only`}
              </div>
              <div className="mt-0.5 text-[8px] text-gray-400">
                {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} revenue
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                <FiBarChart2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600 flex-shrink-0" />
                <span className="truncate">Monthly Bookings & Check-ins</span>
              </h3>
              <div className="h-48 sm:h-64">
                <Bar data={barChartData} options={barChartOptions} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                <FiPieChart className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-green-600 flex-shrink-0" />
                <span className="truncate">Booking Status Distribution</span>
              </h3>
              <div className="h-48 sm:h-64">
                <Bar data={statusChartData} options={barChartOptions} />
              </div>
            </div>
          </div>

          {/* Revenue Trend */}
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
              <FiTrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-purple-600 flex-shrink-0" />
              <span className="truncate">Revenue Trend (Last 6 Months)</span>
            </h3>
            <div className="h-48 sm:h-64">
              <Line data={revenueLineData} options={lineChartOptions} />
            </div>
          </div>

          {/* Branch Performance */}
          {Object.keys(branchStats).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 mb-4 sm:mb-6">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">🏪 Branch Performance</h3>
              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                {Object.entries(branchStats).map(([branch, data]) => {
                  const branchMonthlyRevenue = calculateBranchMonthlyRevenue(branch);
                  return (
                    <div key={branch} className="p-3 sm:p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-gray-700 truncate">{branch}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500">{data.bookings} bookings</p>
                        </div>
                        <span className={`text-[8px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ${
                          data.rooms > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {data.rooms} rooms
                        </span>
                      </div>
                      <div className="mt-1 sm:mt-2">
                        <p className="text-base sm:text-xl font-bold text-indigo-600 truncate">
                          {formatCurrency(branchMonthlyRevenue)}
                        </p>
                        <div className="flex justify-between text-[8px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                          <span>Monthly Revenue</span>
                          <span>{monthlyRevenueDisplay > 0 ? Math.round((branchMonthlyRevenue / monthlyRevenueDisplay) * 100) : 0}%</span>
                        </div>
                      </div>
                      <div className="mt-1 sm:mt-2 w-full bg-gray-200 rounded-full h-1 sm:h-1.5">
                        <div 
                          className={`${data.rooms > 0 ? 'bg-indigo-500' : 'bg-gray-300'} h-1 sm:h-1.5 rounded-full transition-all duration-500`} 
                          style={{ width: `${Math.min((data.rooms / totalRooms) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Today's Activity */}
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 border-l-4 border-blue-500">
              <p className="text-[10px] sm:text-sm text-gray-500">Today's Check-ins</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">+{stats.todayCheckIns}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 border-l-4 border-green-500">
              <p className="text-[10px] sm:text-sm text-gray-500">Active Bookings</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{stats.activeBookings}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 border-l-4 border-purple-500">
              <p className="text-[10px] sm:text-sm text-gray-500">Monthly Revenue</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600">
                {formatMonthlyRevenue(monthlyRevenueDisplay)}
              </p>
            </div>
          </div>

          {/* ✅ Updated Recent Bookings with Search Bar and Individual Check-In/Out */}
          {recentBookings.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3">
                <h3 className="text-sm sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                  📋 Recent Bookings
                  <span className="text-xs font-normal text-gray-400">
                    ({filteredBookings.length} shown)
                  </span>
                </h3>
                <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 w-full sm:w-auto">
                  {/* ✅ Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="🔍 Search guest, booking no..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-shrink-0">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>
                      Live: {lastUpdate || 'Waiting...'}
                    </span>
                    <span className="text-gray-300 hidden sm:inline">|</span>
                    <span className="text-green-600 font-medium hidden sm:inline">
                      🕐 Latest: {recentBookings.length > 0 ? formatCheckInDisplay(recentBookings[0]) : 'No bookings'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Success/Error Messages */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg mb-3 text-sm flex items-center justify-between">
                  <span>{successMessage}</span>
                  <button onClick={() => setSuccessMessage('')} className="text-green-500 hover:text-green-700">
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              )}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-3 text-sm flex items-center justify-between">
                  <span>{errorMessage}</span>
                  <button onClick={() => setErrorMessage('')} className="text-red-500 hover:text-red-700">
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase">Booking No</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase">Guest</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase hidden xs:table-cell">Branch</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Check-in Date & Time</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase">Actions</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Booked At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBookings.map((booking) => {
                      const checkInDate = new Date(booking.checkIn);
                      const now = new Date();
                      const diffMs = now.getTime() - checkInDate.getTime();
                      const diffMinutes = Math.floor(diffMs / (1000 * 60));
                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                      
                      const isRecent = diffMinutes < 60;
                      const isToday = checkInDate.toDateString() === now.toDateString();
                      
                      let relativeTime = '';
                      if (diffMinutes < 1) relativeTime = 'Just now';
                      else if (diffMinutes < 60) relativeTime = `${diffMinutes}m ago`;
                      else if (diffHours < 24) relativeTime = `${diffHours}h ago`;
                      else if (diffDays < 7) relativeTime = `${diffDays}d ago`;
                      else relativeTime = checkInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      
                      const displayDate = checkInDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });
                      const displayTime = checkInDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      });
                      
                      // ✅ Show search match highlight
                      const isMatch = searchTerm && (
                        booking.agentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        booking.bookingNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        booking.email?.toLowerCase().includes(searchTerm.toLowerCase())
                      );
                      
                      return (
                        <tr key={booking.id} className={`hover:bg-gray-50 transition-colors ${isRecent ? 'bg-green-50' : ''} ${isMatch ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
                          <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-sm font-medium text-indigo-600 truncate max-w-[60px] sm:max-w-none">{booking.bookingNo}</td>
                          <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-sm text-gray-900 truncate max-w-[60px] sm:max-w-none">
                            {booking.agentName}
                            {isMatch && <span className="ml-1 text-[8px] text-yellow-600 bg-yellow-100 px-1 py-0.5 rounded">🔍</span>}
                          </td>
                          <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-sm text-gray-500 hidden xs:table-cell truncate max-w-[60px]">{booking.branch || 'N/A'}</td>
                          <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-sm hidden sm:table-cell">
                            <span className={`${isRecent ? 'text-green-600 font-semibold' : isToday ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                              {displayDate} {displayTime}
                              {isRecent && (
                                <span className="ml-1 text-[8px] text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-full">🆕 New</span>
                              )}
                              {isToday && !isRecent && (
                                <span className="ml-1 text-[8px] text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full">📅 Today</span>
                              )}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-1.5 sm:py-2">
                            <span className={`px-1 sm:px-2 py-0.5 sm:py-1 text-[7px] sm:text-xs rounded-full ${getStatusColor(booking.bookingStatus)} whitespace-nowrap`}>
                              {booking.bookingStatus === 'CheckedOut' ? '📤 CheckedOut' : booking.bookingStatus}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-1.5 sm:py-2">
                            <div className="flex items-center gap-1 sm:gap-2">
                              {/* ✅ Individual Check-In Button */}
                              {canCheckIn(booking) && (
                                <button
                                  onClick={() => handleIndividualCheckIn(booking.id)}
                                  disabled={processingBookingId === booking.id}
                                  className={`px-1.5 sm:px-3 py-0.5 sm:py-1 text-[8px] sm:text-xs font-medium rounded transition-colors flex items-center gap-0.5 sm:gap-1 whitespace-nowrap ${
                                    processingBookingId === booking.id
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-green-500 hover:bg-green-600 text-white'
                                  }`}
                                  title="Check in this guest"
                                >
                                  {processingBookingId === booking.id ? (
                                    <>
                                      <span className="animate-spin rounded-full h-2 w-2 sm:h-3 sm:w-3 border-b-2 border-white"></span>
                                      <span className="hidden xs:inline">Processing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <FiCheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                                      <span className="hidden xs:inline">Check-In</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* ✅ Individual Check-Out Button */}
                              {canCheckOut(booking) && (
                                <button
                                  onClick={() => handleIndividualCheckOut(booking.id)}
                                  disabled={processingBookingId === booking.id}
                                  className={`px-1.5 sm:px-3 py-0.5 sm:py-1 text-[8px] sm:text-xs font-medium rounded transition-colors flex items-center gap-0.5 sm:gap-1 whitespace-nowrap ${
                                    processingBookingId === booking.id
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                                  }`}
                                  title="Check out this guest"
                                >
                                  {processingBookingId === booking.id ? (
                                    <>
                                      <span className="animate-spin rounded-full h-2 w-2 sm:h-3 sm:w-3 border-b-2 border-white"></span>
                                      <span className="hidden xs:inline">Processing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <FiClock className="w-3 h-3 sm:w-4 sm:h-4" />
                                      <span className="hidden xs:inline">Check-Out</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Status indicator for already checked out/cancelled */}
                              {!canCheckIn(booking) && !canCheckOut(booking) && (
                                <span className="text-[8px] sm:text-xs text-gray-400">
                                  {booking.bookingStatus === 'CheckedOut' ? '✅ Done' : booking.bookingStatus === 'Cancelled' ? '❌ Cancelled' : '—'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-xs text-gray-400 hidden md:table-cell">
                            <span className="flex items-center gap-1">
                              {relativeTime}
                              {isRecent && <span className="text-green-500">🟢</span>}
                              {isToday && !isRecent && <span className="text-blue-400">🔵</span>}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Search results summary */}
              {searchTerm && (
                <div className="mt-3 text-center text-xs text-gray-500">
                  Found {filteredBookings.length} booking(s) matching "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-2 text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {stats.totalBookings > 10 && (
                <div className="mt-3 sm:mt-4 text-center">
                  <Link href="/bookings" className="text-indigo-600 hover:underline text-[10px] sm:text-sm">
                    View all {stats.totalBookings} bookings →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ✅ QUICK ACTIONS - Only New Booking button remains */}
          <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 sm:gap-4">
            {isOwner || isManager ? (
              <button
                onClick={handleNewBooking}
                className="bg-indigo-600 text-white rounded-xl shadow-sm p-2 sm:p-4 hover:bg-indigo-700 transition-colors text-center"
              >
                <FiPlus className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                <p className="text-[10px] sm:text-sm font-medium">New Booking</p>
              </button>
            ) : (
              <Link href="/dashboard/reports" className="bg-purple-600 text-white rounded-xl shadow-sm p-2 sm:p-4 hover:bg-purple-700 transition-colors text-center col-span-4">
                <FiFileText className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                <p className="text-[10px] sm:text-sm font-medium">Reports</p>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {toastMessage && (
        <NotificationToast 
          message={toastMessage} 
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-4 sm:p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                  {getRoleIcon(user?.role)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate">{user?.username}</h3>
                  <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${getRoleBadgeColor(user?.role)} inline-block`}>
                    {user?.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-gray-100">
                <span className="text-[10px] sm:text-sm text-gray-500">Username</span>
                <span className="text-[10px] sm:text-sm font-medium text-gray-800 truncate ml-2">{user?.username}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-gray-100">
                <span className="text-[10px] sm:text-sm text-gray-500">Role</span>
                <span className="text-[10px] sm:text-sm font-medium text-gray-800">{user?.role}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-gray-100">
                <span className="text-[10px] sm:text-sm text-gray-500">Branches</span>
                <span className="text-[10px] sm:text-sm font-medium text-gray-800 truncate ml-2 text-right">{user?.branches?.join(', ') || 'None'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-gray-100">
                <span className="text-[10px] sm:text-sm text-gray-500">Selected Branch</span>
                <span className="text-[10px] sm:text-sm font-medium text-gray-800">{displayBranchName}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 sm:py-2">
                <span className="text-[10px] sm:text-sm text-gray-500">Status</span>
                <span className="text-[10px] sm:text-sm font-medium text-green-600">✅ Active</span>
              </div>
              {isViewer && (
                <div className="flex items-center justify-between py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-sm text-gray-500">Permission</span>
                  <span className="text-[10px] sm:text-sm font-medium text-purple-600">🔍 View Only</span>
                </div>
              )}
            </div>

            <div className="mt-4 sm:mt-6 flex flex-col xs:flex-row space-y-2 xs:space-y-0 xs:space-x-3">
              <Link
                href="/dashboard/profile"
                className="flex-1 bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-center text-sm sm:text-base"
              >
                <FiEdit2 className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                Edit Profile
              </Link>
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}