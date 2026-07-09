// src/app/bookings/edit/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import jsPDF from 'jspdf';

const API_URL = 'http://localhost:4000/api';
const NPR_TO_INR = 1.6;

const ROOM_TYPES = ['Single', 'Double', 'Triple', 'Quard'];
const MEAL_PLANS = ['EP', 'CP', 'MAP', 'AP'];

const ROOM_TYPE_PRICE_KEY: Record<string, string> = {
  Single: 'singlePrice',
  Double: 'doublePrice',
  Triple: 'triplePrice',
  Quard: 'quardPrice',
};

const DEFAULT_PRICES = {
  singlePrice: 2000,
  doublePrice: 3000,
  triplePrice: 4000,
  quardPrice: 5000,
  extraPersonPrice: 500,
};

export default function EditBookingPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pricing, setPricing] = useState(DEFAULT_PRICES);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [originalBookingTime, setOriginalBookingTime] = useState<string>('');

  const [form, setForm] = useState({
    id: '',
    bookingNo: '',
    agentName: '',
    email: '',
    countryCode: '+977',
    phoneNumber: '',
    branch: '',
    roomType: 'Single',
    roomsCount: 1,
    extraPersons: 0,
    mealPlan: MEAL_PLANS[0],
    facility: '',
    checkIn: '',
    checkOut: '',
    bookingStatus: 'Confirm',
    remark: '',
    roomCharges: 0,
    extraPersonCharges: 0,
    totalCost: 0,
  });

  const [costBreakdown, setCostBreakdown] = useState({
    nights: 0,
    roomPriceNPR: 0,
    extraPersonPriceNPR: 0,
    baseCostNPR: 0,
    extraCostNPR: 0,
    totalNPR: 0,
    totalINR: 0,
  });

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
        setCurrentUser(userData);
        setIsOwner(userData.role === 'OWNER');
        setIsManager(userData.role === 'MANAGER');
        setIsViewer(userData.role === 'VIEWER');

        if (userData.role === 'VIEWER') {
          alert('You do not have permission to edit bookings.');
          router.push('/bookings');
          return;
        }

        let userBranches: string[] = [];
        if (Array.isArray(userData.branches)) {
          userBranches = userData.branches;
        } else if (typeof userData.branches === 'string') {
          userBranches = userData.branches.split(',').map((b: string) => b.trim());
        } else if (userData.branches && typeof userData.branches === 'object') {
          userBranches = Object.values(userData.branches);
        }

        userBranches = userBranches.map((b) => normalizeBranchName(b));
        userBranches = [...new Set(userBranches)];
        setBranches(userBranches);

        console.log('✅ User loaded:', userData);
      } catch (e) {
        console.error('Error parsing user:', e);
        router.push('/login');
      }
    }

    if (bookingId) {
      fetchBooking(bookingId);
    }
  }, [router, bookingId]);

  const fetchBooking = async (id: string) => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const booking = data.data || data;
        console.log('📋 Fetched booking:', booking);

        // Store original booking time
        if (booking.checkIn) {
          setOriginalBookingTime(booking.checkIn);
        }

        let countryCode = '+977';
        let phoneNumber = '';
        if (booking.agentContact) {
          const contact = booking.agentContact.trim();
          if (contact.startsWith('+')) {
            const parts = contact.match(/^(\+\d+)(\d+)$/);
            if (parts) {
              countryCode = parts[1];
              phoneNumber = parts[2];
            } else {
              phoneNumber = contact;
            }
          } else {
            phoneNumber = contact;
          }
        }

        setForm({
          id: booking.id,
          bookingNo: booking.bookingNo || '',
          agentName: booking.agentName || '',
          email: booking.email || '',
          countryCode: countryCode,
          phoneNumber: phoneNumber,
          branch: booking.branch || '',
          roomType: booking.roomType || 'Single',
          roomsCount: booking.roomsCount || 1,
          extraPersons: booking.extraPersons || 0,
          mealPlan: booking.mealPlan || 'EP',
          facility: booking.facility || '',
          checkIn: booking.checkIn ? new Date(booking.checkIn).toISOString().split('T')[0] : '',
          checkOut: booking.checkOut ? new Date(booking.checkOut).toISOString().split('T')[0] : '',
          bookingStatus: booking.bookingStatus || 'Confirm',
          remark: booking.remark || '',
          roomCharges: booking.roomCharges || 0,
          extraPersonCharges: booking.extraPersonCharges || 0,
          totalCost: booking.totalCost || 0,
        });

        if (booking.branch) {
          await fetchPricing(booking.branch);
        }
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      } else if (response.status === 404) {
        setError('Booking not found. It may have been deleted.');
      } else {
        setError('Failed to fetch booking details.');
      }
    } catch (err) {
      console.error('Error fetching booking:', err);
      setError('Failed to fetch booking details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPricing = async (branch: string) => {
    setPricingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/room-pricing/branch/${branch}`, {
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
      });
      if (res.ok) {
        const data = await res.json();
        const d = data.data || data;
        setPricing({
          singlePrice: Number(d.singlePrice) || DEFAULT_PRICES.singlePrice,
          doublePrice: Number(d.doublePrice) || DEFAULT_PRICES.doublePrice,
          triplePrice: Number(d.triplePrice) || DEFAULT_PRICES.triplePrice,
          quardPrice: Number(d.quardPrice) || DEFAULT_PRICES.quardPrice,
          extraPersonPrice: Number(d.extraPersonPrice) || DEFAULT_PRICES.extraPersonPrice,
        });
      } else {
        setPricing(DEFAULT_PRICES);
      }
    } catch (err) {
      console.error('Error fetching pricing:', err);
      setPricing(DEFAULT_PRICES);
    } finally {
      setPricingLoading(false);
    }
  };

  useEffect(() => {
    const priceKey = ROOM_TYPE_PRICE_KEY[form.roomType] || 'singlePrice';
    const roomPriceNPR = (pricing as any)[priceKey] || 0;
    const extraPersonPriceNPR = pricing.extraPersonPrice || 0;

    let nights = 0;
    if (form.checkIn && form.checkOut) {
      const diff = new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime();
      nights = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
    }

    const roomsCount = Number(form.roomsCount) || 0;
    const extraPersons = Number(form.extraPersons) || 0;

    const baseCostNPR = roomPriceNPR * roomsCount * nights;
    const extraCostNPR = extraPersonPriceNPR * extraPersons;
    const totalNPR = baseCostNPR + extraCostNPR;

    setCostBreakdown({
      nights,
      roomPriceNPR,
      extraPersonPriceNPR,
      baseCostNPR,
      extraCostNPR,
      totalNPR,
      totalINR: totalNPR * NPR_TO_INR,
    });
  }, [pricing, form.roomType, form.roomsCount, form.extraPersons, form.checkIn, form.checkOut]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const fmtNPR = (n: number) => `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const fmtINR = (n: number) => `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const validateForm = () => {
    if (!form.agentName.trim()) return 'Guest name is required.';
    if (!form.email.trim()) return 'Guest email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
    if (!/^\d{10}$/.test(form.phoneNumber.trim())) return 'Phone number must be exactly 10 digits.';
    if (!form.branch) return 'Please select a branch.';
    if (!form.checkIn) return 'Check-in date is required.';
    if (!form.checkOut) return 'Check-out date is required.';
    if (new Date(form.checkOut) <= new Date(form.checkIn)) return 'Check-out date must be after check-in date.';
    if (Number(form.roomsCount) < 1) return 'Rooms count must be at least 1.';
    return '';
  };

  // ✅ Format time for display
  const formatTimeDisplay = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // ✅ Handle Submit - Updates time to current time
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // ✅ Get current time - THIS UPDATES THE BOOKING TIME
      const currentTime = new Date().toISOString();

      const payload = {
        agentName: form.agentName.trim(),
        agentContact: `${form.countryCode}${form.phoneNumber.trim()}`,
        email: form.email.trim(),
        branch: form.branch,
        roomType: form.roomType,
        roomsCount: Number(form.roomsCount) || 1,
        extraPersons: Number(form.extraPersons) || 0,
        mealPlan: form.mealPlan,
        facility: form.facility.trim() || undefined,
        checkIn: currentTime, // ✅ Update to current time on edit
        checkOut: form.checkOut,
        bookingStatus: form.bookingStatus,
        roomCharges: costBreakdown.baseCostNPR,
        extraPersonCharges: costBreakdown.extraCostNPR,
        totalCost: costBreakdown.totalNPR,
        remark: form.remark.trim() || undefined,
        lastUpdatedAt: currentTime,
        updatedBy: currentUser?.username || 'Unknown',
        previousCheckInTime: originalBookingTime, // Track previous time
      };

      console.log(`🕐 Booking time updated to: ${new Date(currentTime).toLocaleString()}`);
      console.log(`📋 Previous time was: ${originalBookingTime ? new Date(originalBookingTime).toLocaleString() : 'N/A'}`);

      const response = await fetch(`${API_URL}/bookings/${form.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const booking = data.data || data;
        
        const timeStr = new Date(currentTime).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
        setSuccess(`✅ Booking #${booking.bookingNo || form.bookingNo} updated successfully! New check-in time: ${timeStr}`);

        localStorage.removeItem('bookings');
        localStorage.removeItem('allBookingsCache');
        localStorage.setItem('forceRefresh', Date.now().toString());

        window.dispatchEvent(new CustomEvent('bookingUpdated', { 
          detail: { 
            branch: booking.branch,
            bookingNo: booking.bookingNo,
            action: 'updated',
            newTime: currentTime
          } 
        }));

        setTimeout(() => {
          router.push('/bookings?refresh=true');
        }, 2000);
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
      } else {
        let errorMessage = 'Failed to update booking.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          const text = await response.text();
          if (text) errorMessage = text;
        }
        setError(`❌ Error ${response.status}: ${errorMessage}`);
      }
    } catch (err: any) {
      console.error('❌ Error updating booking:', err);
      setError(`❌ Failed to update booking: ${err.message || 'Please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/bookings');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error && !form.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Booking Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Go to Dashboard
            </Link>
            <Link href="/bookings" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              View Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
            <Link href="/bookings" className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm sm:text-base">
              <span className="mr-1 sm:mr-2">←</span>
              Back to Bookings
            </Link>
            <h2 className="text-base sm:text-xl font-semibold text-gray-800">Edit Booking</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
              #{form.bookingNo}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isOwner && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">👑 Owner</span>
            )}
            {isManager && !isOwner && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">📋 Manager</span>
            )}
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">❌</span>
              <div>
                <p className="font-semibold">Error updating booking</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">✅</span>
              <div>
                {success}
                <p className="text-xs text-green-600 mt-1">Redirecting to bookings list...</p>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Show current booking time */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <span>🕐</span>
            <span>
              <strong>Current Booking Time:</strong> 
              {originalBookingTime ? formatTimeDisplay(originalBookingTime) : 'Not set'}
            </span>
            <span className="text-xs text-blue-500 ml-2">
              (This will be updated to current time when you save)
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guest Name <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                name="agentName" 
                value={form.agentName} 
                onChange={handleChange} 
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                placeholder="Enter guest name" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guest Email <span className="text-red-500">*</span>
              </label>
              <input 
                type="email" 
                name="email" 
                value={form.email} 
                onChange={handleChange} 
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                placeholder="guest@example.com" 
              />
              <p className="text-[10px] text-gray-400 mt-1">
                📧 Confirmation email will be sent to this address
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  name="countryCode" 
                  value={form.countryCode} 
                  onChange={handleChange}
                  className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="+977" 
                />
                <input 
                  type="tel" 
                  name="phoneNumber" 
                  value={form.phoneNumber} 
                  onChange={handleChange} 
                  required 
                  maxLength={10}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="10-digit number" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch <span className="text-red-500">*</span>
              </label>
              <select 
                name="branch" 
                value={form.branch} 
                onChange={handleChange} 
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                {branches.length === 0 && <option value="">No branches available</option>}
                {branches.map((b) => (
                  <option key={b} value={b}>
                    🏨 {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
              <select 
                name="roomType" 
                value={form.roomType} 
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                {pricingLoading ? 'Loading price…' : `Rate: ${fmtNPR(costBreakdown.roomPriceNPR)} / night`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Rooms</label>
              <input 
                type="number" 
                name="roomsCount" 
                min={1} 
                value={form.roomsCount} 
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Extra Persons</label>
              <input 
                type="number" 
                name="extraPersons" 
                min={0} 
                value={form.extraPersons} 
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Extra person rate: {fmtNPR(costBreakdown.extraPersonPriceNPR)} each (auto)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meal Plan</label>
              <select 
                name="mealPlan" 
                value={form.mealPlan} 
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                {MEAL_PLANS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check In Date <span className="text-red-500">*</span>
              </label>
              <input 
                type="date" 
                name="checkIn" 
                value={form.checkIn} 
                onChange={handleChange} 
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
              <p className="text-[10px] text-green-600 mt-1">
                🕐 Time will be updated to: {new Date().toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check Out <span className="text-red-500">*</span>
              </label>
              <input 
                type="date" 
                name="checkOut" 
                value={form.checkOut} 
                onChange={handleChange} 
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking Status</label>
              <select 
                name="bookingStatus" 
                value={form.bookingStatus} 
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="Confirm">Confirmed</option>
                <option value="Pending">Pending</option>
                <option value="CheckedIn">Checked In</option>
                <option value="CheckedOut">Checked Out</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facility</label>
              <input 
                type="text" 
                name="facility" 
                value={form.facility} 
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                placeholder="Optional" 
              />
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-indigo-900 mb-2">💰 Price Summary (Auto-calculated)</h4>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-700">
              <span>Nights</span>
              <span className="text-right font-medium">{costBreakdown.nights}</span>
              <span>Room Charge ({form.roomsCount} × {costBreakdown.nights} nights)</span>
              <span className="text-right font-medium">{fmtNPR(costBreakdown.baseCostNPR)}</span>
              <span>Extra Person Charge ({form.extraPersons} persons)</span>
              <span className="text-right font-medium">{fmtNPR(costBreakdown.extraCostNPR)}</span>
              <span className="pt-1 border-t border-indigo-200 mt-1 font-semibold text-indigo-900">Total (NPR)</span>
              <span className="text-right pt-1 border-t border-indigo-200 mt-1 font-bold text-indigo-900">{fmtNPR(costBreakdown.totalNPR)}</span>
              <span className="font-semibold text-indigo-900">Total (INR)</span>
              <span className="text-right font-bold text-indigo-900">{fmtINR(costBreakdown.totalINR)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remark</label>
            <textarea 
              name="remark" 
              value={form.remark} 
              onChange={handleChange} 
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="Optional notes" 
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-yellow-500 text-lg">⚠️</span>
              <div className="text-xs text-yellow-700">
                <p className="font-semibold">Time Update Notice:</p>
                <p>When you save this booking, the <strong>check-in time will be updated to the current time</strong> ({new Date().toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}).</p>
                <p className="text-[10px] text-yellow-600 mt-1">This tracks when the booking was last modified.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              type="submit" 
              disabled={saving || isViewer}
              className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Saving...
                </>
              ) : (
                '💾 Update Booking'
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}