// src/app/bookings/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import jsPDF from 'jspdf';

const API_URL = 'http://localhost:4000/api';
const NPR_TO_INR = 1.6;

const ROOM_TYPES = ['Single', 'Double', 'Triple', 'Quard'];
const MEAL_PLANS = ['EP', 'CP', 'MAP', 'AP'];
const CURRENCIES = ['NPR', 'INR'];

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

export default function NewBookingPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<string[]>([]);
  const [branchLocked, setBranchLocked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pricing, setPricing] = useState(DEFAULT_PRICES);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bookingCreated, setBookingCreated] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [notifiedUsers, setNotifiedUsers] = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState('NPR');

  const [form, setForm] = useState({
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

  // ✅ Auto-set today's date
  useEffect(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (!form.checkIn) {
      setForm(prev => ({ ...prev, checkIn: todayStr }));
    }
    if (!form.checkOut) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setForm(prev => ({ ...prev, checkOut: tomorrow.toISOString().split('T')[0] }));
    }
  }, []);

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

        if (userData.role === 'VIEWER') {
          alert('You do not have permission to create bookings.');
          router.push('/dashboard');
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

        const savedBranch = localStorage.getItem('selectedBranch');

        if (savedBranch && savedBranch !== 'all' && userBranches.includes(savedBranch)) {
          setForm((prev) => ({ ...prev, branch: savedBranch }));
          setBranchLocked(true);
        } else if (userBranches.length === 1) {
          setForm((prev) => ({ ...prev, branch: userBranches[0] }));
          setBranchLocked(true);
        } else {
          setForm((prev) => ({ ...prev, branch: userBranches[0] || '' }));
          setBranchLocked(false);
        }
      } catch (e) {
        console.error('Error parsing user:', e);
        router.push('/login');
      }
    }
  }, [router]);

  useEffect(() => {
    if (form.branch) fetchPricing(form.branch);
  }, [form.branch]);

  useEffect(() => {
    if (bookingCreated && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (bookingCreated && redirectCountdown === 0) {
      router.push('/bookings?refresh=true');
    }
  }, [bookingCreated, redirectCountdown, router]);

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
      const checkIn = new Date(form.checkIn);
      const checkOut = new Date(form.checkOut);
      if (!isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())) {
        const diff = checkOut.getTime() - checkIn.getTime();
        nights = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
      }
    }

    const roomsCount = Number(form.roomsCount) || 0;
    const extraPersons = Number(form.extraPersons) || 0;

    const baseCostNPR = roomPriceNPR * roomsCount * nights;
    const extraCostNPR = extraPersonPriceNPR * extraPersons;
    const totalNPR = baseCostNPR + extraCostNPR;
    const totalINR = totalNPR * NPR_TO_INR;

    setCostBreakdown({
      nights,
      roomPriceNPR,
      extraPersonPriceNPR,
      baseCostNPR,
      extraCostNPR,
      totalNPR,
      totalINR,
    });
  }, [pricing, form.roomType, form.roomsCount, form.extraPersons, form.checkIn, form.checkOut]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const formatCurrency = (amountNPR: number, currency: string = 'NPR') => {
    if (currency === 'INR') {
      const amountINR = amountNPR * NPR_TO_INR;
      return `Rs. ${amountINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    }
    return `Rs. ${amountNPR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const fmtNPR = (n: number) => `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const fmtINR = (n: number) => `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const validateForm = () => {
    if (!form.agentName.trim()) return 'Guest name is required.';
    if (!form.email.trim()) return 'Guest email is required for the confirmation.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
    if (!/^\d{10}$/.test(form.phoneNumber.trim())) return 'Phone number must be exactly 10 digits.';
    if (!form.branch) return 'Please select a branch.';
    if (!form.checkIn) return 'Check-in date is required.';
    if (!form.checkOut) return 'Check-out date is required.';
    
    const checkInDate = new Date(form.checkIn);
    const checkOutDate = new Date(form.checkOut);
    
    if (isNaN(checkInDate.getTime())) return 'Invalid check-in date.';
    if (isNaN(checkOutDate.getTime())) return 'Invalid check-out date.';
    
    if (checkOutDate <= checkInDate) {
      return 'Check-out date must be after check-in date.';
    }
    
    if (Number(form.roomsCount) < 1) return 'Rooms count must be at least 1.';
    return '';
  };

  // ✅ FIXED: Professional PDF Receipt - No Garbled Text
  const generateReceiptPDF = (booking: any) => {
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // ✅ Use standard helvetica font for clean text
    doc.setFont('helvetica', 'normal');
    
    let y = 20;
    
    // ===== HEADER =====
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('MAHADEV INN', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`Booking Confirmation - ${booking.branch || 'Pokhara'}`, pageWidth / 2, y, { align: 'center' });
    y += 12;
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
    
    // ===== BOOKING INFORMATION =====
    const leftCol = 30;
    const rightCol = 120;
    const rowHeight = 9;
    
    const addInfoRow = (label: string, value: string, isStatus: boolean = false, isBookingNo: boolean = false) => {
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(label + ':', leftCol, y);
      
      if (isBookingNo) {
        doc.setTextColor(79, 70, 229);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('#' + value, rightCol, y);
      } else if (isStatus) {
        const statusColor = value === 'Confirm' || value === 'Confirmed' 
          ? [34, 197, 94] 
          : value === 'Pending' 
            ? [234, 179, 8] 
            : [107, 114, 128];
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(value, rightCol, y);
      } else {
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), rightCol, y);
      }
      y += rowHeight;
    };
    
    // Booking Details
    addInfoRow('Booking No', booking.bookingNo || 'N/A', false, true);
    addInfoRow('Status', booking.bookingStatus || 'Pending', true);
    addInfoRow('Guest Name', booking.agentName || 'N/A');
    addInfoRow('Contact', booking.agentContact || 'N/A');
    addInfoRow('Email', booking.email || 'N/A');
    
    const checkInDisplay = new Date(booking.checkIn).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    addInfoRow('Check-In', checkInDisplay);
    
    const checkOutDisplay = new Date(booking.checkOut).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    addInfoRow('Check-Out', checkOutDisplay);
    addInfoRow('Rooms', `${booking.roomsCount || 1} (${booking.roomType || 'Single'})`);
    addInfoRow('Nights', String(costBreakdown.nights || 0));
    addInfoRow('Heads', String(booking.heads || Number(booking.roomsCount) || 1));
    
    y += 4;
    
    // ===== COST BREAKDOWN =====
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;
    
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Cost Breakdown', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    // Table headers
    doc.setFillColor(245, 245, 255);
    doc.rect(25, y - 4, pageWidth - 50, 10, 'F');
    
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 35, y + 2);
    doc.text('Details', 120, y + 2);
    y += 12;
    
    // Table data
    const tableData = [
      { label: 'Room Type', value: booking.roomType || 'Single' },
      { label: 'Facility', value: booking.facility || 'Standard' },
      { label: 'Meal Plan', value: booking.mealPlan || 'EP' },
      { label: 'Remarks', value: booking.remark || 'None' },
    ];
    
    tableData.forEach((row, index) => {
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 255);
        doc.rect(25, y - 3, pageWidth - 50, 8, 'F');
      }
      
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(row.label, 35, y + 2);
      doc.text(row.value, 120, y + 2);
      y += 9;
    });
    
    y += 4;
    
    // ===== PRICE SUMMARY =====
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
    
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Price Summary', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    const displayCurrency = selectedCurrency || 'NPR';
    const totalAmount = displayCurrency === 'INR' 
      ? (costBreakdown.totalNPR || 0) * NPR_TO_INR 
      : (costBreakdown.totalNPR || 0);
    const currencySymbol = 'Rs.';
    
    // Room Charge
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Room Charge:', 35, y);
    
    const roomChargeDisplay = displayCurrency === 'INR' 
      ? (costBreakdown.baseCostNPR || 0) * NPR_TO_INR 
      : (costBreakdown.baseCostNPR || 0);
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${currencySymbol} ${roomChargeDisplay.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 140, y);
    y += 9;
    
    if (costBreakdown.extraCostNPR > 0) {
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Extra Person Charge:', 35, y);
      
      const extraChargeDisplay = displayCurrency === 'INR' 
        ? (costBreakdown.extraCostNPR || 0) * NPR_TO_INR 
        : (costBreakdown.extraCostNPR || 0);
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`${currencySymbol} ${extraChargeDisplay.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 140, y);
      y += 9;
    }
    
    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(35, y - 2, pageWidth - 25, y - 2);
    y += 4;
    
    // Total
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', 35, y);
    
    doc.setTextColor(236, 72, 153);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${currencySymbol} ${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 140, y);
    y += 12;
    
    if (displayCurrency === 'INR') {
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`* Exchange rate: 1 NPR = ${NPR_TO_INR} INR`, 35, y);
      y += 6;
    }
    
    // ===== FOOTER =====
    y += 10;
    
    // Divider
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);
    y += 12;
    
    // Thank You Message
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Thank You!', pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('For choosing Mahadev Inn. We look forward to welcoming you!', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    // Contact info
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Email: info@mahadevinn.com | Phone: +977-9800000000', pageWidth / 2, y, { align: 'center' });
    
    // ===== GENERATE PDF =====
    const fileName = `Receipt_${booking.bookingNo || 'booking'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // ✅ Updated handleSubmit with currency support
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const priceKey = ROOM_TYPE_PRICE_KEY[form.roomType] || 'singlePrice';
      const roomCharges = (pricing as any)[priceKey] || 0;
      const totalCostNPR = costBreakdown.totalNPR;
      const totalCostINR = totalCostNPR * NPR_TO_INR;

      const bookingNo = `BKG-${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 1000)}`;

      // ✅ Get current time
      const currentTime = new Date().toISOString();

      const payload = {
        bookingNo: bookingNo,
        agentName: form.agentName.trim(),
        agentContact: `${form.countryCode}${form.phoneNumber.trim()}`,
        email: form.email.trim(),
        branch: form.branch,
        roomType: form.roomType,
        roomsCount: Number(form.roomsCount) || 1,
        mealPlan: form.mealPlan,
        facility: form.facility.trim() || undefined,
        checkIn: currentTime,
        checkOut: form.checkOut,
        bookingStatus: form.bookingStatus,
        roomCharges: roomCharges,
        extraPersonCharges: costBreakdown.extraCostNPR,
        currency: selectedCurrency,
        totalCost: selectedCurrency === 'INR' ? totalCostINR : totalCostNPR,
        totalCostNPR: totalCostNPR,
        totalCostINR: totalCostINR,
        heads: Number(form.roomsCount) + Number(form.extraPersons),
        remark: form.remark.trim() || undefined,
        bookedAt: currentTime,
      };

      console.log('📋 Creating booking with payload:', payload);
      console.log(`🕐 Booking time: ${new Date(currentTime).toLocaleString()}`);
      console.log(`💰 Currency: ${selectedCurrency}`);
      console.log(`💰 Total (NPR): ${totalCostNPR}`);
      console.log(`💰 Total (INR): ${totalCostINR}`);

      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const booking = data.data || data;
        const notifiedUsersCount = data.notifiedUsers || 0;

        setNotifiedUsers(notifiedUsersCount);

        const timeStr = new Date(currentTime).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const displayTotal = selectedCurrency === 'INR' 
          ? `Rs. ${totalCostINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
          : `Rs. ${totalCostNPR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

        setSuccess(
          booking.bookingStatus === 'Pending'
            ? `✅ Booking request created at ${timeStr}! Total: ${displayTotal} (${selectedCurrency})`
            : `✅ Booking confirmed at ${timeStr}! Total: ${displayTotal} (${selectedCurrency})`
        );

        // ✅ Generate and download PDF receipt
        generateReceiptPDF(booking);

        localStorage.removeItem('bookings');
        localStorage.removeItem('allBookingsCache');
        localStorage.setItem('forceRefresh', Date.now().toString());
        
        const eventDetail = {
          branch: booking.branch,
          bookingNo: booking.bookingNo,
          agentName: booking.agentName,
          timestamp: new Date().toISOString(),
          notifiedUsers: notifiedUsersCount,
          checkInTime: currentTime,
          currency: selectedCurrency
        };
        
        window.dispatchEvent(new CustomEvent('bookingCreated', { detail: eventDetail }));
        
        localStorage.setItem('bookingUpdated', JSON.stringify({
          branch: booking.branch,
          bookingNo: booking.bookingNo,
          timestamp: Date.now(),
          checkInTime: currentTime,
          currency: selectedCurrency
        }));
        
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'bookingUpdated',
          newValue: JSON.stringify({
            branch: booking.branch,
            bookingNo: booking.bookingNo,
            timestamp: Date.now(),
            checkInTime: currentTime,
            currency: selectedCurrency
          })
        }));

        setBookingCreated(true);
        setRedirectCountdown(3);
        
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
      } else {
        let errorMessage = 'Failed to create booking. Please try again.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error('Server error details:', errorData);
        } catch (parseError) {
          const text = await response.text();
          if (text) {
            errorMessage = text;
            console.error('Server error text:', text);
          }
        }
        setError(`❌ Error ${response.status}: ${errorMessage}`);
      }
    } catch (err: any) {
      console.error('❌ Error creating booking:', err);
      setError(`❌ Failed to create booking: ${err.message || 'Please check if the server is running.'}`);
    } finally {
      setLoading(false);
    }
  };

  const displayBranchName = form.branch || 'No branch selected';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/bookings" className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm sm:text-base">
              <span className="mr-1 sm:mr-2">←</span>
              Back to Bookings
            </Link>
            <h2 className="text-base sm:text-xl font-semibold text-gray-800">New Booking</h2>
          </div>
          <div className="flex items-center space-x-3">
            {currentUser && (
              <div className="text-xs text-gray-500 hidden sm:block">
                👤 {currentUser.name || currentUser.email}
              </div>
            )}
            <div className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
              📍 {displayBranchName}
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">❌</span>
              <div>
                <p className="font-semibold">Error creating booking</p>
                <p className="text-xs mt-1">{error}</p>
                <p className="text-xs text-red-500 mt-1">Please check all fields and try again.</p>
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
                <p className="text-xs text-green-600 mt-1">
                  📧 A confirmation email has been sent to the guest. PDF receipt has been downloaded automatically.
                </p>
                <p className="text-xs text-green-600 mt-1">
                  📍 This booking is stored in branch: <strong>{form.branch}</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  💰 Currency: <strong>{selectedCurrency}</strong>
                </p>
                {notifiedUsers > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    🔔 {notifiedUsers} user(s) in this branch have been notified in real-time.
                  </p>
                )}
                <p className="text-xs text-green-600 mt-1">
                  ⏳ Redirecting to bookings list in {redirectCountdown} seconds...
                </p>
              </div>
            </div>
          </div>
        )}

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
              {branchLocked ? (
                <div className="w-full border border-gray-200 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 flex items-center justify-between">
                  <span>🏨 {form.branch || 'No branch assigned'}</span>
                  <span className="text-[10px] text-gray-400">🔒 Locked to current branch</span>
                </div>
              ) : (
                <select 
                  name="branch" 
                  value={form.branch} 
                  onChange={handleChange} 
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  {branches.length === 0 && <option value="">No branches available</option>}
                  {branches.map((b) => (
                    <option key={b} value={b} className="py-1">
                      🏨 {b}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[10px] text-gray-400 mt-1">
                📍 All data will be stored in this branch only
              </p>
              <p className="text-[10px] text-green-600 mt-1">
                🔔 All managers in this branch will be notified in real-time
              </p>
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
              <div className="text-[10px] mt-1">
                <span className="text-green-600 font-medium">
                  🕐 Booking will be recorded at: {new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                📅 System will auto-checkin on this date
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
              <p className="text-[10px] text-gray-400 mt-1">
                📅 System will send reminders and auto-checkout on this date
              </p>
              {form.checkIn && form.checkOut && (
                <p className="text-[10px] text-green-600 mt-1">
                  ✅ {costBreakdown.nights} night(s) stay
                </p>
              )}
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

          {/* ✅ Currency Selection */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-purple-900 mb-1">
                  💰 Select Currency
                </label>
                <p className="text-[10px] text-purple-600">
                  Choose the currency for this booking
                </p>
              </div>
              <div className="flex gap-2">
                {CURRENCIES.map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => setSelectedCurrency(currency)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                      selectedCurrency === currency
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-purple-50'
                    }`}
                  >
                    {currency}
                    <span className="text-[8px] block text-gray-400">
                      {currency === 'NPR' ? 'Nepalese Rupee' : 'Indian Rupee'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 text-[10px] text-purple-600">
              {selectedCurrency === 'INR' ? (
                <span>💱 Exchange rate: 1 NPR = {NPR_TO_INR} INR</span>
              ) : (
                <span>💱 Showing prices in Nepalese Rupees (NPR)</span>
              )}
            </div>
          </div>

          {/* ✅ Price Summary */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-indigo-900 mb-2">💰 Price Summary (Auto-calculated)</h4>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-700">
              <span>Nights</span>
              <span className="text-right font-medium">{costBreakdown.nights}</span>
              <span>Room Charge ({form.roomsCount} × {costBreakdown.nights} nights)</span>
              <span className="text-right font-medium">
                {selectedCurrency === 'INR' 
                  ? fmtNPR(costBreakdown.baseCostNPR * NPR_TO_INR)
                  : fmtNPR(costBreakdown.baseCostNPR)}
              </span>
              <span>Extra Person Charge ({form.extraPersons} persons)</span>
              <span className="text-right font-medium">
                {selectedCurrency === 'INR'
                  ? fmtNPR(costBreakdown.extraCostNPR * NPR_TO_INR)
                  : fmtNPR(costBreakdown.extraCostNPR)}
              </span>
              <span className="pt-1 border-t border-indigo-200 mt-1 font-semibold text-indigo-900">
                Total ({selectedCurrency})
              </span>
              <span className="text-right pt-1 border-t border-indigo-200 mt-1 font-bold text-indigo-900">
                {selectedCurrency === 'INR'
                  ? fmtNPR(costBreakdown.totalNPR * NPR_TO_INR)
                  : fmtNPR(costBreakdown.totalNPR)}
              </span>
              {selectedCurrency === 'INR' && (
                <>
                  <span className="text-[8px] text-gray-400">Equivalent NPR</span>
                  <span className="text-right text-[8px] text-gray-400">{fmtNPR(costBreakdown.totalNPR)}</span>
                </>
              )}
              {selectedCurrency === 'NPR' && (
                <>
                  <span className="text-[8px] text-gray-400">Equivalent INR</span>
                  <span className="text-right text-[8px] text-gray-400">{fmtNPR(costBreakdown.totalNPR * NPR_TO_INR)}</span>
                </>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Exchange rate used: 1 NPR = {NPR_TO_INR} INR</p>
            
            <div className="mt-3 pt-3 border-t border-indigo-200">
              <p className="text-[10px] text-indigo-600 flex items-center gap-1">
                <span>📍</span>
                <span>This booking will be stored in: <strong>{displayBranchName}</strong></span>
              </p>
              <p className="text-[10px] text-indigo-600 flex items-center gap-1 mt-1">
                <span>🕐</span>
                <span>Booking time: <strong>{new Date().toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}</strong></span>
              </p>
              <p className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
                <span>🔔</span>
                <span>Real-time: All managers in this branch will be notified instantly</span>
              </p>
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

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Creating...
                </>
              ) : (
                `Create Booking in ${displayBranchName} (${selectedCurrency})`
              )}
            </button>
            <Link 
              href="/bookings" 
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
            >
              Cancel
            </Link>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <div className="flex items-start gap-2">
              <span className="text-blue-500 text-lg">🔔</span>
              <div className="text-xs text-blue-700">
                <p className="font-semibold">Automated Booking Features:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>🕐 <strong>Booking time auto-captured at creation</strong></li>
                  <li>💱 <strong>Dual currency support: NPR and INR</strong></li>
                  <li>📧 Confirmation email sent instantly with PDF receipt</li>
                  <li>📅 Auto check-in on arrival date</li>
                  <li>🔔 Checkout reminders at 3, 2, and 1 day before</li>
                  <li>📤 Auto check-out at 12:00 PM on departure date</li>
                  <li>📍 All data is branch-specific and isolated</li>
                  <li>🔔 Real-time notifications to all branch managers</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}