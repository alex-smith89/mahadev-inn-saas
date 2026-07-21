// src/app/bookings/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const API_URL = 'http://localhost:4000/api';
const NPR_TO_INR = 1.6;
const VAT_RATE = 0.13; // 13% VAT

// ROOM_TYPES
const ROOM_TYPES = ['Single', 'Double', 'Triple', 'Quard', 'Suite'];
const MEAL_PLANS = ['EP', 'CP', 'MAP', 'AP'];
const CURRENCIES = ['NPR', 'INR'];

// Room capacity mapping
const ROOM_CAPACITY: Record<string, number> = {
  Single: 1,
  Double: 2,
  Triple: 3,
  Quard: 4,
  Suite: 4,
};

// DEFAULT_PRICES (fallback if API fails)
const DEFAULT_PRICES = {
  singlePrice: 2000,
  doublePrice: 3000,
  triplePrice: 4500,
  quardPrice: 5500,
  suitePrice: 8000,
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
  const [isOwner, setIsOwner] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<number | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const [form, setForm] = useState({
    agentName: '',
    email: '',
    countryCode: '+977',
    phoneNumber: '',
    branch: '',
    roomType: 'Single',
    roomsCount: 1,
    heads: 1,
    childrenBelow10: 0,
    mealPlan: MEAL_PLANS[0],
    facility: '',
    checkIn: '',
    checkOut: '',
    bookingStatus: 'Confirm',
    remark: '',
    kitchenCharges: 0,
    diningCharges: 0,
    breakfastCharges: 0,
  });

  const [costBreakdown, setCostBreakdown] = useState({
    nights: 0,
    roomPriceNPR: 0,
    extraPersonPriceNPR: 0,
    baseCostNPR: 0,
    extraCostNPR: 0,
    kitchenChargesNPR: 0,
    diningChargesNPR: 0,
    breakfastChargesNPR: 0,
    subtotalNPR: 0,
    vatAmountNPR: 0,
    totalNPR: 0,
    totalINR: 0,
    roomCapacity: 0,
    totalCapacity: 0,
    extraPersons: 0,
    childrenBelow10: 0,
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

  // Auto-set today's date
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
        
        setIsOwner(userData.role === 'OWNER');
        setIsManager(userData.role === 'MANAGER');
        setIsViewer(userData.role === 'VIEWER');

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

        if (userData.role === 'OWNER' || userData.role === 'MANAGER') {
          if (savedBranch && savedBranch !== 'all' && userBranches.includes(savedBranch)) {
            setForm((prev) => ({ ...prev, branch: savedBranch }));
            setBranchLocked(false);
          } else if (userBranches.length > 0) {
            setForm((prev) => ({ ...prev, branch: userBranches[0] }));
            setBranchLocked(false);
          }
        } else {
          if (savedBranch && savedBranch !== 'all' && userBranches.includes(savedBranch)) {
            setForm((prev) => ({ ...prev, branch: savedBranch }));
            setBranchLocked(true);
          } else if (userBranches.length === 1) {
            setForm((prev) => ({ ...prev, branch: userBranches[0] }));
            setBranchLocked(true);
          } else {
            setForm((prev) => ({ ...prev, branch: userBranches[0] || '' }));
            setBranchLocked(true);
          }
        }
      } catch (e) {
        console.error('Error parsing user:', e);
        router.push('/login');
      }
    }
  }, [router]);

  // ✅ Fetch pricing when branch changes
  useEffect(() => {
    if (form.branch) {
      fetchPricing(form.branch);
    }
  }, [form.branch]);

  // Check room availability when form changes
  useEffect(() => {
    const checkAvailability = async () => {
      if (!form.branch || !form.checkIn || !form.checkOut || !form.roomType) {
        setAvailableRooms(null);
        setAvailabilityMessage('');
        return;
      }

      setIsCheckingAvailability(true);
      try {
        const token = localStorage.getItem('token');
        const roomsNeeded = Number(form.roomsCount) || 1;
        
        const res = await fetch(
          `${API_URL}/room-capacity/check-availability?branch=${encodeURIComponent(form.branch)}&roomType=${encodeURIComponent(form.roomType)}&checkIn=${form.checkIn}&checkOut=${form.checkOut}&roomsNeeded=${roomsNeeded}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (res.ok) {
          const data = await res.json();
          const available = data.available || 0;
          setAvailableRooms(available);
          
          if (available === 0) {
            setAvailabilityMessage(`No ${form.roomType} rooms available in ${form.branch} for these dates`);
            setError(`No ${form.roomType} rooms available in ${form.branch}. Only 0 left.`);
          } else if (available < roomsNeeded) {
            setAvailabilityMessage(`Only ${available} ${form.roomType} room(s) available. You requested ${roomsNeeded}.`);
            setError(`Only ${available} ${form.roomType} room(s) available. Please reduce the number of rooms.`);
          } else {
            setAvailabilityMessage(`${available} ${form.roomType} room(s) available`);
            setError('');
          }
          
          if (available > 0 && roomsNeeded > available) {
            setForm(prev => ({ ...prev, roomsCount: available }));
          }
        } else {
          setAvailableRooms(null);
          setAvailabilityMessage('');
        }
      } catch (err) {
        console.error('Error checking availability:', err);
        setAvailableRooms(null);
        setAvailabilityMessage('');
      } finally {
        setIsCheckingAvailability(false);
      }
    };

    const timer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timer);
  }, [form.branch, form.checkIn, form.checkOut, form.roomType, form.roomsCount]);

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

  // ✅ Fetch pricing from the server
  const fetchPricing = async (branch: string) => {
    setPricingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/room-pricing/current?branch=${encodeURIComponent(branch)}`, {
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Pricing data from server:', data);
        
        let pricingData = data;
        if (data.pricing) {
          const pricingMap: any = {};
          data.pricing.forEach((p: any) => {
            const priceKey = p.roomType.toLowerCase() + 'Price';
            pricingMap[priceKey] = p.currentPrice;
          });
          const extraPersonPrice = data.rawPricing?.extraPersonPrice || 500;
          
          setPricing({
            singlePrice: pricingMap.singlePrice || DEFAULT_PRICES.singlePrice,
            doublePrice: pricingMap.doublePrice || DEFAULT_PRICES.doublePrice,
            triplePrice: pricingMap.triplePrice || DEFAULT_PRICES.triplePrice,
            quardPrice: pricingMap.quardPrice || DEFAULT_PRICES.quardPrice,
            suitePrice: pricingMap.suitePrice || DEFAULT_PRICES.suitePrice,
            extraPersonPrice: extraPersonPrice,
          });
        } else {
          setPricing({
            singlePrice: Number(data.singlePrice) || DEFAULT_PRICES.singlePrice,
            doublePrice: Number(data.doublePrice) || DEFAULT_PRICES.doublePrice,
            triplePrice: Number(data.triplePrice) || DEFAULT_PRICES.triplePrice,
            quardPrice: Number(data.quardPrice) || DEFAULT_PRICES.quardPrice,
            suitePrice: Number(data.suitePrice) || DEFAULT_PRICES.suitePrice,
            extraPersonPrice: Number(data.extraPersonPrice) || DEFAULT_PRICES.extraPersonPrice,
          });
        }
        
        setError('');
      } else {
        console.error('Failed to fetch pricing, using defaults');
        setPricing(DEFAULT_PRICES);
      }
    } catch (err) {
      console.error('Error fetching pricing:', err);
      setPricing(DEFAULT_PRICES);
    } finally {
      setPricingLoading(false);
    }
  };

  // Updated useEffect to handle room price
  useEffect(() => {
    const priceKey = form.roomType.toLowerCase() + 'Price';
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
    const heads = Number(form.heads) || 1;
    const childrenBelow10 = Number(form.childrenBelow10) || 0;
    
    const adults = heads - childrenBelow10;
    const roomCapacity = ROOM_CAPACITY[form.roomType] || 1;
    const totalCapacity = roomCapacity * roomsCount;
    const extraPersons = Math.max(0, adults - totalCapacity);
    
    const baseCostNPR = roomPriceNPR * roomsCount * nights;
    const extraCostNPR = extraPersonPriceNPR * extraPersons * nights;
    const kitchenChargesNPR = Number(form.kitchenCharges) || 0;
    const diningChargesNPR = Number(form.diningCharges) || 0;
    const breakfastChargesNPR = Number(form.breakfastCharges) || 0;
    
    const subtotalNPR = baseCostNPR + extraCostNPR + kitchenChargesNPR + diningChargesNPR + breakfastChargesNPR;
    const vatAmountNPR = subtotalNPR * VAT_RATE;
    const totalNPR = subtotalNPR + vatAmountNPR;
    const totalINR = totalNPR * NPR_TO_INR;

    setCostBreakdown({
      nights,
      roomPriceNPR,
      extraPersonPriceNPR,
      baseCostNPR,
      extraCostNPR,
      kitchenChargesNPR,
      diningChargesNPR,
      breakfastChargesNPR,
      subtotalNPR,
      vatAmountNPR,
      totalNPR,
      totalINR,
      roomCapacity,
      totalCapacity,
      extraPersons,
      childrenBelow10,
    });
  }, [pricing, form.roomType, form.roomsCount, form.heads, form.childrenBelow10, form.checkIn, form.checkOut, form.kitchenCharges, form.diningCharges, form.breakfastCharges]);

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
    if (Number(form.heads) < 1) return 'Heads must be at least 1.';
    
    const childrenBelow10 = Number(form.childrenBelow10) || 0;
    const heads = Number(form.heads) || 1;
    if (childrenBelow10 > heads) {
      return 'Children below 10 cannot exceed total heads.';
    }
    
    const adults = heads - childrenBelow10;
    if (adults < 1 && heads > 0) {
      return `Total heads (${heads}) must include at least 1 adult. Please reduce children below 10 or increase total heads.`;
    }

    if (availableRooms !== null && Number(form.roomsCount) > availableRooms) {
      return `Only ${availableRooms} ${form.roomType} room(s) available. Please reduce the number of rooms.`;
    }
    
    return '';
  };

  // ✅ Enhanced PDF Generator with Logo
  const generateReceiptPDF = async (booking: any) => {
    try {
      console.log('📄 Generating PDF for booking:', booking.bookingNo);
      
      // Format dates
      const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });

      // Calculate totals
      const totalCost = booking.totalCost || 0;
      const vatAmount = totalCost * 0.13;
      const subtotal = totalCost - vatAmount;

      // Create HTML content with logo
      const receiptHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: Arial, Helvetica, sans-serif;
                margin: 0;
                padding: 0;
                background: white;
              }
              .receipt {
                width: 700px;
                margin: 0 auto;
                padding: 40px;
                background: white;
              }
              .header {
                text-align: center;
                border-bottom: 3px solid #4f46e5;
                padding-bottom: 20px;
                margin-bottom: 20px;
              }
              .logo-container {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 8px;
                gap: 20px;
              }
              .logo-image {
                width: 80px;
                height: 80px;
                object-fit: contain;
              }
              .logo-text-container {
                text-align: left;
              }
              .logo-text {
                font-size: 32px;
                font-weight: bold;
                color: #4f46e5;
                letter-spacing: 4px;
                margin: 0;
                line-height: 1.2;
              }
              .logo-sub {
                font-size: 11px;
                color: #6b7280;
                letter-spacing: 5px;
                margin-top: 2px;
                font-weight: 500;
              }
              .title {
                font-size: 18px;
                color: #4f46e5;
                margin: 10px 0 4px 0;
                font-weight: bold;
                letter-spacing: 2px;
              }
              .branch {
                font-size: 12px;
                color: #6b7280;
                margin: 0;
                font-weight: 500;
              }
              .info-box {
                background: #f5f5ff;
                border: 1px solid #4f46e5;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px 20px;
              }
              .info-item {
                font-size: 11px;
                color: #1a1a1a;
              }
              .info-item strong {
                color: #6b7280;
                font-weight: bold;
              }
              .status {
                color: #22c55e;
                font-weight: bold;
              }
              .section-title {
                font-size: 14px;
                font-weight: bold;
                color: #4f46e5;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 8px;
                margin: 20px 0 10px 0;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
              }
              table thead {
                background: #4f46e5;
                color: white;
              }
              table th {
                padding: 8px 12px;
                text-align: left;
                font-weight: bold;
              }
              table td {
                padding: 6px 12px;
                border-bottom: 1px solid #e5e7eb;
              }
              .label-col {
                color: #6b7280;
                font-weight: bold;
              }
              .value-col {
                text-align: right;
                color: #1a1a1a;
              }
              .price-box {
                background: #f5f5ff;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
              }
              .price-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 11px;
              }
              .price-row.total {
                border-top: 2px solid #4f46e5;
                margin-top: 8px;
                padding-top: 10px;
                font-size: 16px;
                font-weight: bold;
                color: #4f46e5;
              }
              .remarks-box {
                margin: 15px 0;
              }
              .remarks-label {
                color: #6b7280;
                font-weight: bold;
                font-size: 11px;
                margin-bottom: 4px;
              }
              .remarks-text {
                font-size: 11px;
                color: #1a1a1a;
                background: #f9fafb;
                padding: 8px 12px;
                border-radius: 4px;
                margin: 0;
              }
              .footer {
                text-align: center;
                border-top: 2px solid #4f46e5;
                padding-top: 20px;
                margin-top: 20px;
              }
              .footer-title {
                color: #4f46e5;
                font-size: 18px;
                font-weight: bold;
                margin: 0;
              }
              .footer-text {
                color: #6b7280;
                font-size: 11px;
                margin: 4px 0;
              }
              .footer-small {
                color: #6b7280;
                font-size: 9px;
                margin: 4px 0;
              }
              .footer-contact {
                color: #6b7280;
                font-size: 8px;
                margin: 4px 0;
              }
            </style>
          </head>
          <body>
            <div class="receipt">
              <!-- Header with Logo -->
              <div class="header">
                <div class="logo-container">
                  <img src="/mahadev-logo.png" alt="Mahadev Inn Logo" class="logo-image" />
                  <div class="logo-text-container">
                    <div class="logo-text">MAHADEV INN</div>
                    <div class="logo-sub">LUXURY HOTEL & SUITES</div>
                  </div>
                </div>
                <div class="title">BOOKING CONFIRMATION</div>
                <div class="branch">Branch: ${booking.branch || 'N/A'}</div>
              </div>

              <!-- Booking Info -->
              <div class="info-box">
                <div class="info-item"><strong>Booking No:</strong> ${booking.bookingNo || 'N/A'}</div>
                <div class="info-item"><strong>Status:</strong> <span class="status">✅ ${booking.bookingStatus || 'Confirm'}</span></div>
                <div class="info-item"><strong>Guest Name:</strong> ${booking.agentName || 'N/A'}</div>
                <div class="info-item"><strong>Check-In:</strong> ${checkInDate}</div>
                <div class="info-item"><strong>Contact:</strong> ${booking.agentContact || 'N/A'}</div>
                <div class="info-item"><strong>Check-Out:</strong> ${checkOutDate}</div>
                <div class="info-item"><strong>Email:</strong> ${booking.email || 'N/A'}</div>
                <div class="info-item"><strong>Rooms:</strong> ${booking.roomsCount || 1} (${booking.roomType || 'N/A'})</div>
                <div class="info-item"><strong>Total Heads:</strong> ${booking.heads || 1}</div>
              </div>

              <!-- Booking Details -->
              <div class="section-title">📋 BOOKING DETAILS</div>
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: right;">Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="label-col">Room Type</td>
                    <td class="value-col">${booking.roomType || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td class="label-col">Facility</td>
                    <td class="value-col">${booking.facility || 'Standard'}</td>
                  </tr>
                  <tr>
                    <td class="label-col">Meal Plan</td>
                    <td class="value-col">${booking.mealPlan || 'EP'}</td>
                  </tr>
                  <tr>
                    <td class="label-col">No. of Rooms</td>
                    <td class="value-col">${booking.roomsCount || 1}</td>
                  </tr>
                  <tr>
                    <td class="label-col">Total Heads</td>
                    <td class="value-col">${booking.heads || 1}</td>
                  </tr>
                  <tr>
                    <td class="label-col">Extra Persons</td>
                    <td class="value-col">${booking.extraPersons || 0} ${booking.extraPersons > 0 ? `(Charge: Rs. ${(booking.extraPersonCharges || 0).toFixed(2)})` : ''}</td>
                  </tr>
                  <tr>
                    <td class="label-col">Children Below 10</td>
                    <td class="value-col">${booking.childrenBelow10 || 0} ${booking.childrenBelow10 > 0 ? '(FREE)' : ''}</td>
                  </tr>
                  <tr>
                    <td class="label-col">Room Charges</td>
                    <td class="value-col">Rs. ${(booking.roomCharges || 0).toFixed(2)} × ${booking.roomsCount || 1} × ${booking.nights || 1} nights</td>
                  </tr>
                </tbody>
              </table>

              <!-- Price Summary -->
              <div class="price-box">
                <div class="price-row">
                  <span>Subtotal:</span>
                  <span>Rs. ${subtotal.toFixed(2)}</span>
                </div>
                <div class="price-row">
                  <span>VAT (13%):</span>
                  <span>Rs. ${vatAmount.toFixed(2)}</span>
                </div>
                <div class="price-row total">
                  <span>Total Amount:</span>
                  <span>Rs. ${totalCost.toFixed(2)}</span>
                </div>
              </div>

              <!-- Remarks -->
              ${booking.remark ? `
                <div class="remarks-box">
                  <div class="remarks-label">Remarks:</div>
                  <p class="remarks-text">${booking.remark}</p>
                </div>
              ` : ''}

              <!-- Footer -->
              <div class="footer">
                <div class="footer-title">Thank You!</div>
                <div class="footer-text">For choosing Mahadev Inn. We look forward to welcoming you!</div>
                <div class="footer-small">This is a system-generated confirmation. Please keep it for your records.</div>
                <div class="footer-contact">+977 1 4785959 | info@mahadevin.com | www.mahadevin.com</div>
              </div>
            </div>
          </body>
        </html>
      `;

      // Create a temporary div
      const div = document.createElement('div');
      div.innerHTML = receiptHTML;
      div.style.position = 'fixed';
      div.style.top = '-9999px';
      div.style.left = '-9999px';
      div.style.zIndex = '-9999';
      document.body.appendChild(div);

      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture as canvas
      const canvas = await html2canvas(div, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 700,
        height: div.scrollHeight,
        allowTaint: true,
        useCORS: true,
      });

      // Remove temp div
      document.body.removeChild(div);

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      // Save PDF
      const fileName = `Booking_${booking.bookingNo || 'booking'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      console.log('✅ PDF generated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      return false;
    }
  };

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (availableRooms !== null && Number(form.roomsCount) > availableRooms) {
      setError(`Only ${availableRooms} ${form.roomType} room(s) available. Please reduce the number of rooms.`);
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      if (isViewer) {
        setError('Viewers cannot create bookings. Please contact the owner for permission.');
        setLoading(false);
        return;
      }

      const priceKey = form.roomType.toLowerCase() + 'Price';
      const roomCharges = (pricing as any)[priceKey] || 0;
      const totalCostNPR = costBreakdown.totalNPR;
      const totalCostINR = totalCostNPR * NPR_TO_INR;
      const vatAmountNPR = costBreakdown.vatAmountNPR;
      const subtotalNPR = costBreakdown.subtotalNPR;
      const extraPersons = costBreakdown.extraPersons;
      const childrenBelow10 = Number(form.childrenBelow10) || 0;

      const bookingNo = `BKG-${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 1000)}`;
      const currentTime = new Date().toISOString();

      const payload = {
        bookingNo: bookingNo,
        agentName: form.agentName.trim(),
        agentContact: `${form.countryCode}${form.phoneNumber.trim()}`,
        email: form.email.trim(),
        branch: form.branch,
        roomType: form.roomType,
        roomsCount: Number(form.roomsCount) || 1,
        heads: Number(form.heads) || 1,
        childrenBelow10: childrenBelow10,
        mealPlan: form.mealPlan,
        facility: form.facility?.trim() || null,
        checkIn: currentTime,
        checkOut: form.checkOut,
        bookingStatus: form.bookingStatus,
        roomCharges: roomCharges,
        extraPersonCharges: costBreakdown.extraCostNPR,
        extraPersons: extraPersons,
        kitchenCharges: Number(form.kitchenCharges) || 0,
        diningCharges: Number(form.diningCharges) || 0,
        breakfastCharges: Number(form.breakfastCharges) || 0,
        currency: selectedCurrency,
        subtotal: selectedCurrency === 'INR' ? subtotalNPR * NPR_TO_INR : subtotalNPR,
        vatAmount: selectedCurrency === 'INR' ? vatAmountNPR * NPR_TO_INR : vatAmountNPR,
        vatRate: VAT_RATE * 100,
        totalCost: selectedCurrency === 'INR' ? totalCostINR : totalCostNPR,
        totalCostNPR: totalCostNPR,
        totalCostINR: totalCostINR,
        remark: form.remark?.trim() || null,
        bookedAt: currentTime,
        roomCapacity: costBreakdown.roomCapacity,
        totalCapacity: costBreakdown.totalCapacity,
        createdBy: currentUser?.username || 'Unknown',
        createdByRole: currentUser?.role || 'Unknown',
      };

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
          ? `₹ ${totalCostINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
          : `Rs. ${totalCostNPR.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

        const childrenMsg = childrenBelow10 > 0 ? ` 👶 ${childrenBelow10} children below 10 (FREE)` : '';
        const extraPersonMsg = extraPersons > 0 ? ` 👤 ${extraPersons} extra person(s) charged` : '';
        const roomCapacityMsg = ` (Room capacity: ${costBreakdown.roomCapacity} per room, Total: ${costBreakdown.totalCapacity} persons)`;

        setSuccess(
          `✅ Booking confirmed at ${timeStr}! Total: ${displayTotal} (incl. 13% VAT)${extraPersonMsg}${childrenMsg}${roomCapacityMsg}`
        );

        // ✅ Generate PDF receipt automatically (async)
        const pdfGenerated = await generateReceiptPDF(booking);
        if (pdfGenerated) {
          setSuccess(prev => prev + ' 📄 PDF receipt downloaded automatically.');
        }

        localStorage.removeItem('bookings');
        localStorage.removeItem('allBookingsCache');
        localStorage.setItem('forceRefresh', Date.now().toString());

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
        } catch (parseError) {
          const text = await response.text();
          if (text) errorMessage = text;
        }
        setError(`Error ${response.status}: ${errorMessage}`);
      }
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(`Failed to create booking: ${err.message || 'Please check if the server is running.'}`);
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
                {isOwner && '👑 '}
                {isManager && '📋 '}
                {isViewer && '👁️ '}
                {currentUser.name || currentUser.email}
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
                {availableRooms !== null && (
                  <p className="text-xs text-red-500 mt-1">
                    Available: {availableRooms} {form.roomType} room(s) | Requested: {form.roomsCount} room(s)
                  </p>
                )}
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
                  📧 A confirmation email has been sent to the guest.
                </p>
                <p className="text-xs text-green-600 mt-1">
                  📍 This booking is stored in branch: <strong>{form.branch}</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  👤 Created by: <strong>{currentUser?.username}</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  🏠 Room Type: <strong>{form.roomType}</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  💰 Room Rate: <strong>{fmtNPR(costBreakdown.roomPriceNPR)} / night</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  ⏳ Redirecting to bookings list in {redirectCountdown} seconds...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Availability Status Bar */}
        {availableRooms !== null && !error && !success && (
          <div className={`px-4 py-2 rounded-lg mb-4 text-sm ${
            availableRooms === 0 ? 'bg-red-50 border border-red-200 text-red-700' :
            availableRooms < Number(form.roomsCount) ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' :
            'bg-green-50 border border-green-200 text-green-700'
          }`}>
            <div className="flex items-center justify-between">
              <span>
                {isCheckingAvailability ? '⏳ Checking availability...' : availabilityMessage}
              </span>
              {!isCheckingAvailability && availableRooms > 0 && (
                <span className="font-bold">
                  {availableRooms} room(s) available
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Guest Name */}
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

            {/* Guest Email */}
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

            {/* Contact Number */}
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

            {/* Branch */}
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
            </div>

            {/* Room Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
              <select 
                name="roomType" 
                value={form.roomType} 
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                {ROOM_TYPES.map((t) => {
                  const capacity = ROOM_CAPACITY[t] || 1;
                  const priceKey = t.toLowerCase() + 'Price';
                  const price = (pricing as any)[priceKey] || 0;
                  return (
                    <option key={t} value={t}>
                      {t} (Capacity: {capacity} person{capacity > 1 ? 's' : ''}) - {fmtNPR(price)}/night
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                {pricingLoading ? 'Loading price…' : `Rate: ${fmtNPR(costBreakdown.roomPriceNPR)} / night`}
              </p>
              <p className="text-[10px] text-blue-600 mt-1">
                Capacity: {ROOM_CAPACITY[form.roomType] || 1} person(s) per room
              </p>
            </div>

            {/* Number of Rooms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Rooms <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                name="roomsCount" 
                min={1} 
                max={availableRooms || 99}
                value={form.roomsCount} 
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${
                  availableRooms !== null && Number(form.roomsCount) > availableRooms 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-gray-300'
                }`}
              />
              <div className="flex justify-between mt-1">
                <p className="text-[10px] text-gray-400">
                  Total capacity: {costBreakdown.totalCapacity || 0} persons
                </p>
                {availableRooms !== null && (
                  <p className={`text-[10px] font-medium ${
                    Number(form.roomsCount) > availableRooms ? 'text-red-600' : 'text-green-600'
                  }`}>
                    Max available: {availableRooms}
                  </p>
                )}
              </div>
            </div>

            {/* Total Heads */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Heads <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                name="heads" 
                min={1} 
                value={form.heads} 
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
              <div className="text-[10px] mt-1">
                {costBreakdown.extraPersons > 0 ? (
                  <span className="text-orange-600 font-medium">
                    ⚠️ {costBreakdown.extraPersons} extra adult(s) will be charged
                  </span>
                ) : (
                  <span className="text-green-600 font-medium">
                    ✅ All adults accommodated in rooms
                  </span>
                )}
              </div>
            </div>

            {/* Children Below 10 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <label className="block text-sm font-medium text-green-800 mb-1">
                👶 Children Below 10 <span className="text-green-600">(FREE)</span>
              </label>
              <input 
                type="number" 
                name="childrenBelow10" 
                min={0} 
                value={form.childrenBelow10} 
                onChange={handleChange}
                className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white" 
                placeholder="0" 
              />
              <p className="text-[10px] text-green-600 mt-1">
                ✅ No charges for children below 10 years
              </p>
              <p className="text-[10px] text-green-600">
                👶 {form.childrenBelow10 || 0} children will stay FREE
              </p>
            </div>

            {/* Meal Plan */}
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

            {/* Check In Date */}
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
              <p className="text-[10px] text-gray-400 mt-1">
                📅 System will auto-checkin on this date
              </p>
            </div>

            {/* Check Out Date */}
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
              {form.checkIn && form.checkOut && (
                <p className="text-[10px] text-green-600 mt-1">
                  ✅ {costBreakdown.nights} night(s) stay
                </p>
              )}
            </div>

            {/* Booking Status */}
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

            {/* Facility */}
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

          {/* Kitchen & Dining Charges */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">🍳 Kitchen & Dining Charges</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kitchen Charges
                </label>
                <input 
                  type="number" 
                  name="kitchenCharges" 
                  min={0} 
                  value={form.kitchenCharges} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="0" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dining Charges
                </label>
                <input 
                  type="number" 
                  name="diningCharges" 
                  min={0} 
                  value={form.diningCharges} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="0" 
                />
              </div>
            </div>
          </div>

          {/* Breakfast Charges */}
          <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
            <h4 className="text-sm font-semibold text-orange-800 mb-2">🍳 Breakfast Charges</h4>
            <p className="text-[10px] text-orange-600 mb-3">
              Add breakfast charges if breakfast is provided to guests
            </p>
            <div>
              <label className="block text-sm font-medium text-orange-700 mb-1">
                Breakfast Charges (Total)
              </label>
              <input 
                type="number" 
                name="breakfastCharges" 
                min={0} 
                value={form.breakfastCharges} 
                onChange={handleChange}
                className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white" 
                placeholder="0" 
              />
              <p className="text-[10px] text-orange-600 mt-1">
                💡 Enter total breakfast charges for all guests
              </p>
              <p className="text-[10px] text-orange-600">
                👶 Children below 10 are FREE for breakfast (no charges)
              </p>
            </div>
          </div>

          {/* Currency Selection */}
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
          </div>

          {/* Price Summary */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-indigo-900 mb-2">💰 Price Summary</h4>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-700">
              <span>Nights</span>
              <span className="text-right font-medium">{costBreakdown.nights}</span>
              <span>Room Type</span>
              <span className="text-right font-medium">{form.roomType}</span>
              <span>Room Rate</span>
              <span className="text-right font-medium">{fmtNPR(costBreakdown.roomPriceNPR)} / night</span>
              <span>Room Capacity</span>
              <span className="text-right font-medium">{costBreakdown.roomCapacity} per room</span>
              <span>Rooms</span>
              <span className="text-right font-medium">{form.roomsCount}</span>
              <span>Total Capacity</span>
              <span className="text-right font-medium">{costBreakdown.totalCapacity}</span>
              <span>Total Heads</span>
              <span className="text-right font-medium">{form.heads}</span>
              <span className="text-green-600 font-medium">👶 Children Below 10</span>
              <span className="text-right text-green-600 font-medium">{costBreakdown.childrenBelow10} (FREE)</span>
              <span className="text-orange-600 font-medium">Extra Adults</span>
              <span className="text-right text-orange-600 font-medium">{costBreakdown.extraPersons}</span>
              <span>Room Charges</span>
              <span className="text-right font-medium">
                {selectedCurrency === 'INR' 
                  ? fmtNPR(costBreakdown.baseCostNPR * NPR_TO_INR)
                  : fmtNPR(costBreakdown.baseCostNPR)}
              </span>
              <span>Subtotal</span>
              <span className="text-right border-t border-gray-200 pt-1 mt-1">
                {selectedCurrency === 'INR'
                  ? fmtNPR(costBreakdown.subtotalNPR * NPR_TO_INR)
                  : fmtNPR(costBreakdown.subtotalNPR)}
              </span>
              <span className="text-indigo-600 font-semibold">VAT (13%)</span>
              <span className="text-right text-indigo-600 font-semibold">
                {selectedCurrency === 'INR'
                  ? fmtNPR(costBreakdown.vatAmountNPR * NPR_TO_INR)
                  : fmtNPR(costBreakdown.vatAmountNPR)}
              </span>
              <span className="pt-1 border-t-2 border-indigo-200 mt-1 font-bold text-indigo-900">
                Total ({selectedCurrency})
              </span>
              <span className="text-right pt-1 border-t-2 border-indigo-200 mt-1 font-bold text-indigo-900">
                {selectedCurrency === 'INR'
                  ? fmtNPR(costBreakdown.totalNPR * NPR_TO_INR)
                  : fmtNPR(costBreakdown.totalNPR)}
              </span>
            </div>
          </div>

          {/* Remark */}
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
              disabled={
                loading || 
                (availableRooms !== null && availableRooms === 0) ||
                (availableRooms !== null && Number(form.roomsCount) > availableRooms)
              }
              className={`flex-1 text-white px-4 py-2.5 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                (availableRooms !== null && availableRooms === 0) ||
                (availableRooms !== null && Number(form.roomsCount) > availableRooms)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : loading
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Creating...
                </>
              ) : (availableRooms !== null && availableRooms === 0) ? (
                '❌ No Rooms Available'
              ) : (availableRooms !== null && Number(form.roomsCount) > availableRooms) ? (
                '⚠️ Reduce Rooms'
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
        </form>
      </div>
    </div>
  );
}