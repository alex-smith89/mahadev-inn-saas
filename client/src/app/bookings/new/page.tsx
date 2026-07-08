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
  FiInfo, FiBell, FiAlertCircle, FiCheck
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
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
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
  
  // ✅ New state for checkout information
  const [checkedOutGuests, setCheckedOutGuests] = useState<any[]>([]);
  const [vacantRooms, setVacantRooms] = useState<number>(0);
  const [recentCheckouts, setRecentCheckouts] = useState<any[]>([]);
  
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
      }
    } catch (err) {
      console.error('Error loading upcoming checkouts:', err);
    }
  };

  // ✅ Run Auto Checkout - Properly updates status and creates notifications
  const runAutoCheckout = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Please login first');
        return;
      }

      // ✅ Get all bookings
      const response = await fetch(`${API_URL}/bookings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      const allBookings = data.bookings || data.data || [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // ✅ Get notified bookings from localStorage to prevent duplicate notifications
      const notifiedBookings = JSON.parse(localStorage.getItem('notifiedCheckouts') || '{}');

      let processed = 0;
      let newNotifications = 0;
      let skippedDuplicates = 0;
      let errors = 0;

      // ✅ Find bookings that need checkout (check-out date is today or in the past)
      // Only process if status is Confirm, Confirmed, or CheckedIn
      const bookingsToCheckout = allBookings.filter((b: any) => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        
        const isActive = b.bookingStatus === 'Confirm' || 
                         b.bookingStatus === 'Confirmed' || 
                         b.bookingStatus === 'CheckedIn';
        
        // Check if checkout date is today or in the past
        const isCheckoutToday = checkOut.getTime() <= today.getTime();
        
        return isActive && isCheckoutToday;
      });

      console.log(`📋 Found ${bookingsToCheckout.length} bookings to process`);

      if (bookingsToCheckout.length === 0) {
        alert('✅ No bookings to checkout today.');
        return;
      }

      // ✅ Process each booking
      for (const booking of bookingsToCheckout) {
        try {
          const bookingId = booking.id;
          const guestName = booking.agentName;
          const branch = booking.branch || 'Unknown';
          const roomType = booking.roomType || 'Unknown';
          const bookingNo = booking.bookingNo;
          const checkOutDate = new Date(booking.checkOut);
          const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          console.log(`📋 Processing booking: ${bookingNo} - ${guestName} (${daysUntilCheckout} days)`);

          // ✅ Check if this booking has already been notified
          const alreadyNotified = notifiedBookings[bookingId];

          let notificationTitle = '';
          let notificationMessage = '';
          let shouldNotify = false;
          let shouldUpdateStatus = false;

          // ✅ Check if checkout is overdue (today or past)
          if (daysUntilCheckout < 0) {
            // ✅ Overdue checkout - Auto Checkout
            notificationTitle = 'Automated Checkout Completed';
            notificationMessage = `Guest ${guestName} has been automatically checked out from ${roomType} (${branch}). Room is now vacant and requires cleaning.`;
            shouldNotify = true;
            shouldUpdateStatus = true;
            
            // ✅ Update booking status to CheckedOut
            const updateResponse = await fetch(`${API_URL}/bookings/${bookingId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                bookingStatus: 'CheckedOut',
                actualCheckOut: new Date().toISOString(),
              }),
            });

            if (updateResponse.ok) {
              processed++;
              console.log(`✅ Booking ${bookingNo} checked out successfully`);
              
              // ✅ Remove from notified list since it's now checked out
              delete notifiedBookings[bookingId];
            } else {
              const errorData = await updateResponse.json();
              console.error(`❌ Failed to update booking ${bookingNo}:`, errorData);
              errors++;
              continue;
            }
            
          } else if (daysUntilCheckout === 0 && !alreadyNotified) {
            // ✅ Checkout today - Send reminder
            notificationTitle = 'Checkout Reminder - Today';
            notificationMessage = `Guest ${guestName} (Booking #${bookingNo}) is checking out TODAY from ${roomType} (${branch}). Please prepare for checkout.`;
            shouldNotify = true;
            
            // ✅ Mark as notified
            notifiedBookings[bookingId] = {
              notifiedAt: new Date().toISOString(),
              notificationType: 'checkout_today',
              daysUntil: 0,
              guestName: guestName,
              bookingNo: bookingNo,
            };
            
          } else if (daysUntilCheckout === 1 && !alreadyNotified) {
            // ✅ Checkout tomorrow
            notificationTitle = 'Checkout Reminder - 1 day left';
            notificationMessage = `Guest ${guestName} (Booking #${bookingNo}) has checkout in 1 day from ${roomType} (${branch}).`;
            shouldNotify = true;
            
            // ✅ Mark as notified
            notifiedBookings[bookingId] = {
              notifiedAt: new Date().toISOString(),
              notificationType: 'checkout_1day',
              daysUntil: 1,
              guestName: guestName,
              bookingNo: bookingNo,
            };
            
          } else if (daysUntilCheckout === 2 && !alreadyNotified) {
            // ✅ Checkout in 2 days
            notificationTitle = 'Checkout Reminder - 2 days left';
            notificationMessage = `Guest ${guestName} (Booking #${bookingNo}) has checkout in 2 days from ${roomType} (${branch}).`;
            shouldNotify = true;
            
            // ✅ Mark as notified
            notifiedBookings[bookingId] = {
              notifiedAt: new Date().toISOString(),
              notificationType: 'checkout_2days',
              daysUntil: 2,
              guestName: guestName,
              bookingNo: bookingNo,
            };
            
          } else if (daysUntilCheckout === 3 && !alreadyNotified) {
            // ✅ Checkout in 3 days
            notificationTitle = 'Checkout Reminder - 3 days left';
            notificationMessage = `Guest ${guestName} (Booking #${bookingNo}) has checkout in 3 days from ${roomType} (${branch}).`;
            shouldNotify = true;
            
            // ✅ Mark as notified
            notifiedBookings[bookingId] = {
              notifiedAt: new Date().toISOString(),
              notificationType: 'checkout_3days',
              daysUntil: 3,
              guestName: guestName,
              bookingNo: bookingNo,
            };
            
          } else if (alreadyNotified) {
            // ✅ Already notified, skip
            console.log(`⏭️ Skipping ${guestName} - Already notified for booking #${bookingNo}`);
            skippedDuplicates++;
            continue;
          }

          // ✅ Create notification if needed
          if (shouldNotify) {
            try {
              const notificationResponse = await fetch(`${API_URL}/notifications`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  title: notificationTitle,
                  message: notificationMessage,
                  branch: branch,
                  bookingId: bookingId,
                  type: daysUntilCheckout < 0 ? 'auto_checkout' : 'checkout_reminder',
                }),
              });

              if (notificationResponse.ok) {
                newNotifications++;
                console.log(`✅ Notification created for ${guestName}`);
              } else {
                console.error(`❌ Failed to create notification for ${guestName}`);
              }
            } catch (err) {
              console.error(`❌ Error creating notification for ${guestName}:`, err);
            }
          }
        } catch (err) {
          console.error('Error processing booking:', err);
          errors++;
        }
      }

      // ✅ Save updated notified bookings to localStorage
      localStorage.setItem('notifiedCheckouts', JSON.stringify(notifiedBookings));

      // ✅ Also trigger storage event for cross-tab communication
      localStorage.setItem('forceRefresh', Date.now().toString());

      // ✅ Show summary
      let summaryMessage = `✅ Auto Checkout Summary:\n`;
      summaryMessage += `📋 Processed checkouts: ${processed}\n`;
      summaryMessage += `📋 New notifications: ${newNotifications}\n`;
      summaryMessage += `⏭️ Skipped duplicates: ${skippedDuplicates}`;
      if (errors > 0) {
        summaryMessage += `\n❌ Errors: ${errors}`;
      }
      
      alert(summaryMessage);
      
      // ✅ Refresh all data
      await loadDashboardData(true);
      await loadNotifications();
      await loadUpcomingCheckouts();
      
    } catch (err) {
      console.error('Error running auto checkout:', err);
      alert('❌ Error running auto checkout. Please check if the server is running.');
    }
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

  // ✅ Edit Booking Handler
  const handleEditBooking = (booking: any) => {
    router.push(`/bookings/edit/${booking.id}`);
  };

  // ✅ Delete Booking Handler
  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        alert('✅ Booking deleted successfully!');
        loadDashboardData(true);
      } else {
        alert('❌ Error deleting booking');
      }
    } catch (err) {
      console.error('Error deleting booking:', err);
      alert('❌ Error deleting booking');
    }
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
        console.log('📋 Selected branch:', selectedBranch || 'none');
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
        loadDashboardData(true);
      }, 500);
    }
  }, [selectedBranch, user]);

  // ✅ Listen for storage changes (cross-tab communication)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'forceRefresh' || e.key === 'bookings' || e.key === 'allBookingsCache') {
        console.log('📦 Storage changed, refreshing data...');
        if (selectedBranch && user) {
          localStorage.removeItem('bookings');
          localStorage.removeItem('allBookingsCache');
          setTimeout(() => {
            loadDashboardData(true);
          }, 300);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    // ✅ Also listen for custom event from same window
    const handleBookingCreated = () => {
      console.log('📢 Booking created event received!');
      if (selectedBranch && user) {
        localStorage.removeItem('bookings');
        localStorage.removeItem('allBookingsCache');
        setTimeout(() => {
          loadDashboardData(true);
        }, 300);
      }
    };
    
    window.addEventListener('bookingCreated', handleBookingCreated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingCreated', handleBookingCreated);
    };
  }, [selectedBranch, user]);

  useEffect(() => {
    if (!loading && selectedBranch && user) {
      console.log('🔄 Loading dashboard data for branch:', selectedBranch);
      loadDashboardData(false);
      loadNotifications();
      loadUpcomingCheckouts();
    }
  }, [selectedBranch, loading]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedBranch && user) {
        console.log('👁️ Page became visible, auto-refreshing data...');
        loadDashboardData(true);
        loadNotifications();
        loadUpcomingCheckouts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedBranch, user]);

  useEffect(() => {
    const handleFocus = () => {
      if (selectedBranch && user) {
        console.log('🔲 Window focused, auto-refreshing data...');
        loadDashboardData(true);
        loadNotifications();
        loadUpcomingCheckouts();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedBranch, user]);

  useEffect(() => {
    if (!selectedBranch || !user) return;

    const interval = setInterval(() => {
      console.log('⏰ Auto-refresh timer triggered for dashboard...');
      loadDashboardData(true);
      loadNotifications();
      loadUpcomingCheckouts();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedBranch, user]);

  // ✅ loadDashboardData - Fetches and filters bookings with force refresh
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

      const branch = selectedBranch || user?.branches?.[0] || '';
      console.log('📊 Loading dashboard data for branch:', branch);
      console.log('👤 User role:', user?.role);
      console.log('📍 API URL:', API_URL);

      let bookings: any[] = [];

      try {
        const url = `${API_URL}/bookings`;
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
          
          let allBookings = data.bookings || data.data || [];
          console.log(`📋 Raw bookings from API:`, allBookings.length);
          
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
          
          const branchCounts: {[key: string]: number} = {};
          allBookings.forEach((b: any) => {
            const br = b.branch || b.branchName || 'Unknown';
            branchCounts[br] = (branchCounts[br] || 0) + 1;
          });
          console.log('📊 Bookings per branch after normalization:', branchCounts);
          
          if (user?.role === 'OWNER') {
            if (branch === 'all') {
              bookings = allBookings;
              console.log(`📋 Owner: Showing ALL bookings: ${bookings.length}`);
            } else {
              bookings = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === branch;
              });
              console.log(`📋 Owner: Filtered bookings for ${branch}: ${bookings.length}`);
            }
          } else {
            if (branch) {
              bookings = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === branch;
              });
              console.log(`📋 ${user?.role}: Filtered bookings for ${branch}: ${bookings.length}`);
            } else {
              const firstBranch = user?.branches?.[0] || '';
              bookings = allBookings.filter((b: any) => {
                const bookingBranch = b.branch || b.branchName || '';
                return bookingBranch === firstBranch;
              });
              console.log(`📋 ${user?.role}: Filtered bookings for ${firstBranch}: ${bookings.length}`);
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
        }
      } catch (err) {
        console.error('Error fetching bookings:', err);
        setError('Failed to fetch bookings from server. Please check if the server is running.');
      }

      if (bookings.length === 0) {
        try {
          const localBookings = JSON.parse(localStorage.getItem('bookings') || '[]');
          if (localBookings.length > 0) {
            console.log(`📋 Found ${localBookings.length} bookings in local storage`);
            
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
              bookings = filteredLocal;
              setIsLocalMode(true);
              console.log(`📋 Using ${bookings.length} bookings from local storage for branch ${branch}`);
            }
          }
        } catch (e) {
          console.error('Error loading local bookings:', e);
        }
      }

      console.log(`📋 Final bookings count for ${branch}: ${bookings.length}`);

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
        const branchesToCheck = user?.branches || ['Pokhara', 'Kathmandu1', 'Kathmandu2', 'Bhairawaha'];
        for (const b of branchesToCheck) {
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

      calculateStats(bookings, capacityTotal);
      
      const sortedBookings = [...bookings].sort((a, b) => {
        return new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime();
      });
      setRecentBookings(sortedBookings.slice(0, 10));
      
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
      loadDashboardData(true);
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

  const formatCurrency = (amount: number) => {
    if (!amount || amount === 0) return 'Rs. 0';
    if (amount >= 100000) {
      return `Rs. ${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `Rs. ${(amount / 1000).toFixed(1)}K`;
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
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-indigo-800 text-white transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:relative lg:flex-shrink-0 overflow-y-auto`}
      >
        <div className="flex flex-col h-full">
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

            {user?.role === 'OWNER' && (
              <Link href="/dashboard/room-pricing" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
                <FiDollarSign className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="truncate">Room Pricing</span>
              </Link>
            )}

            {user?.role === 'OWNER' && (
              <Link href="/dashboard/room-capacity" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
                <FiGrid className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="truncate">Room Capacity</span>
              </Link>
            )}
            
            <Link href="/dashboard/reports" className="flex items-center space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base">
              <FiPieChart className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Reports</span>
            </Link>
          </nav>

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
                <p className="text-xs sm:text-sm text-gray-500 truncate">Welcome back, {user?.username || 'User'}!</p>
                {isLocalMode && (
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                    📝 Offline Mode
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-4 flex-shrink-0">
              {/* Branch Dropdown */}
              <div className="relative">
                <select
                  value={selectedBranch || (branches.length > 0 ? branches[0] : '')}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="text-xs sm:text-sm border-2 border-indigo-300 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white min-w-[120px] sm:min-w-[160px] font-medium text-gray-700 hover:border-indigo-400 cursor-pointer shadow-sm"
                >
                  {isOwner && (
                    <option value="all" className="font-bold text-indigo-600">🌐 All Branches</option>
                  )}
                  
                  {branches.map((branch) => (
                    <option key={branch} value={branch} className="py-1">
                      🏨 {branch}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
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
                      {unreadCount > 0 && (
                        <button 
                          onClick={() => {
                            notifications.forEach(n => !n.isRead && markNotificationRead(n.id));
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div 
                          key={n.id} 
                          className={`p-3 border-b hover:bg-gray-50 transition-colors cursor-pointer ${!n.isRead ? 'bg-blue-50' : ''}`}
                          onClick={() => markNotificationRead(n.id)}
                        >
                          <p className="text-sm font-medium text-gray-800">{n.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{n.branch} • {new Date(n.createdAt).toLocaleTimeString()}</p>
                        </div>
                      ))
                    )}
                    {notifications.length > 5 && (
                      <div className="p-2 text-center border-t">
                        <Link href="/dashboard/reports" className="text-xs text-indigo-600 hover:text-indigo-800">
                          View all notifications →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  localStorage.removeItem('bookings');
                  localStorage.removeItem('allBookingsCache');
                  loadDashboardData(true);
                }}
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

              {(isOwner || isManager) && (
                <button
                  onClick={runAutoCheckout}
                  className="bg-green-100 text-green-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-green-200 transition-colors flex items-center space-x-1 text-sm"
                >
                  <FiCheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-sm hidden xs:inline">Auto Checkout</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
          {/* Upcoming Checkouts Alert */}
          {upcomingCheckouts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <FiAlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">
                    📋 {upcomingCheckouts.length} guest(s) checking out in 24-48 hours
                  </p>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    {upcomingCheckouts.map((b: any) => (
                      <span key={b.id} className="inline-block mr-2">
                        {b.agentName} ({new Date(b.checkOut).toLocaleDateString()})
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

          {/* ✅ Checkout Information Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Available Rooms Card */}
            <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Available Rooms</p>
                  <p className="text-3xl font-bold text-green-600">{availableRoomsCount}</p>
                  <p className="text-xs text-gray-400">Out of {totalRooms} total rooms</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FiHome className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${(availableRoomsCount / totalRooms) * 100}%` }}
                />
              </div>
            </div>

            {/* Today's Checkouts Card */}
            <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Today's Checkouts</p>
                  <p className="text-3xl font-bold text-blue-600">{checkedOutGuests.length}</p>
                  <p className="text-xs text-gray-400">Guests checking out today</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiCheck className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              {checkedOutGuests.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  {checkedOutGuests.slice(0, 3).map((guest, index) => (
                    <span key={index} className="inline-block bg-blue-50 px-2 py-1 rounded mr-1 mb-1">
                      {guest.agentName} ({guest.roomType})
                    </span>
                  ))}
                  {checkedOutGuests.length > 3 && (
                    <span className="text-blue-500">+{checkedOutGuests.length - 3} more</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ✅ Recent Checkouts List */}
          {recentCheckouts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                <FiClock className="w-4 h-4 mr-2 text-gray-500" />
                Recent Checkouts (Last 7 Days)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Guest Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Checkout Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentCheckouts.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{booking.agentName}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{booking.roomType}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                            {booking.branch}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">{new Date(booking.checkOut).toLocaleDateString()}</td>
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
                  <p className="text-[10px] sm:text-sm text-gray-500 truncate">Revenue</p>
                  <p className="text-lg sm:text-3xl font-bold text-gray-800 truncate">{formatCurrency(stats.totalRevenue)}</p>
                </div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiDollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-purple-500" />
                </div>
              </div>
              <div className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-gray-500 truncate">
                Avg: {formatCurrency(stats.averageBookingValue)}
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
                {Object.entries(branchStats).map(([branch, data]) => (
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
                      <p className="text-base sm:text-xl font-bold text-indigo-600 truncate">{formatCurrency(data.revenue)}</p>
                      <div className="flex justify-between text-[8px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                        <span>Revenue</span>
                        <span>{stats.totalRevenue > 0 ? Math.round((data.revenue / stats.totalRevenue) * 100) : 0}%</span>
                      </div>
                    </div>
                    <div className="mt-1 sm:mt-2 w-full bg-gray-200 rounded-full h-1 sm:h-1.5">
                      <div 
                        className={`${data.rooms > 0 ? 'bg-indigo-500' : 'bg-gray-300'} h-1 sm:h-1.5 rounded-full transition-all duration-500`} 
                        style={{ width: `${Math.min((data.rooms / totalRooms) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
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
              <p className="text-[10px] sm:text-sm text-gray-500">Total Revenue</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>

          {/* Recent Bookings - Show all bookings including CheckedOut */}
          {recentBookings.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 mb-4 sm:mb-6">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">📋 Recent Bookings</h3>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase">Booking No</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase">Guest</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase hidden xs:table-cell">Branch</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Check In</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left text-[8px] sm:text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-sm font-medium text-indigo-600 truncate max-w-[60px] sm:max-w-none">{booking.bookingNo}</td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-sm text-gray-900 truncate max-w-[60px] sm:max-w-none">{booking.agentName}</td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-sm text-gray-500 hidden xs:table-cell truncate max-w-[60px]">{booking.branch || 'N/A'}</td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-sm text-gray-500 hidden sm:table-cell">{new Date(booking.checkIn).toLocaleDateString()}</td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2">
                          <span className={`px-1 sm:px-2 py-0.5 sm:py-1 text-[7px] sm:text-xs rounded-full ${getStatusColor(booking.bookingStatus)} whitespace-nowrap`}>
                            {booking.bookingStatus === 'CheckedOut' ? '📤 CheckedOut' : booking.bookingStatus}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2">
                          <div className="flex gap-1">
                            {isOwner && (
                              <>
                                <button
                                  onClick={() => handleEditBooking(booking)}
                                  className="px-2 py-1 bg-yellow-500 text-white rounded text-[8px] sm:text-xs hover:bg-yellow-600 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteBooking(booking.id)}
                                  className="px-2 py-1 bg-red-500 text-white rounded text-[8px] sm:text-xs hover:bg-red-600 transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {isManager && (
                              <button
                                onClick={() => handleEditBooking(booking)}
                                className="px-2 py-1 bg-yellow-500 text-white rounded text-[8px] sm:text-xs hover:bg-yellow-600 transition-colors"
                              >
                                Edit
                              </button>
                            )}
                            {isViewer && (
                              <span className="text-[8px] text-gray-400">View only</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {stats.totalBookings > 10 && (
                <div className="mt-3 sm:mt-4 text-center">
                  <Link href="/bookings" className="text-indigo-600 hover:underline text-[10px] sm:text-sm">
                    View all {stats.totalBookings} bookings →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ✅ Quick Actions - Updated for Viewer */}
          <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 sm:gap-4">
            {isOwner || isManager ? (
              <>
                <Link href="/bookings/new" className="bg-indigo-600 text-white rounded-xl shadow-sm p-2 sm:p-4 hover:bg-indigo-700 transition-colors text-center">
                  <FiPlus className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                  <p className="text-[10px] sm:text-sm font-medium">New Booking</p>
                </Link>
                <Link href="/dashboard/check-in" className="bg-green-600 text-white rounded-xl shadow-sm p-2 sm:p-4 hover:bg-green-700 transition-colors text-center">
                  <FiCheckCircle className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                  <p className="text-[10px] sm:text-sm font-medium">Check In</p>
                </Link>
                <button
                  onClick={runAutoCheckout}
                  className="bg-blue-600 text-white rounded-xl shadow-sm p-2 sm:p-4 hover:bg-blue-700 transition-colors text-center"
                >
                  <FiClock className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                  <p className="text-[10px] sm:text-sm font-medium">Auto Checkout</p>
                  <p className="text-[8px] opacity-75">Process checkouts</p>
                </button>
                <Link href="/dashboard/reports" className="bg-purple-600 text-white rounded-xl shadow-sm p-2 sm:p-4 hover:bg-purple-700 transition-colors text-center">
                  <FiFileText className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                  <p className="text-[10px] sm:text-sm font-medium">Reports</p>
                </Link>
              </>
            ) : (
              <Link href="/dashboard/reports" className="bg-purple-600 text-white rounded-xl shadow-sm p-2 sm:p-4 hover:bg-purple-700 transition-colors text-center col-span-4">
                <FiFileText className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                <p className="text-[10px] sm:text-sm font-medium">Reports</p>
              </Link>
            )}
          </div>
        </div>
      </div>

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