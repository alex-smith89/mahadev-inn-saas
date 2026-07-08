'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiSearch, FiX, FiRefreshCw } from 'react-icons/fi';

export default function CheckOutPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [checkedOutGuest, setCheckedOutGuest] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError('');
      setRefreshing(true);
      
      const token = localStorage.getItem('token');
      let bookingsData: any[] = [];

      // ✅ Try to fetch from backend
      try {
        const response = await fetch('http://localhost:4000/bookings', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          bookingsData = data.bookings || [];
          // Save to localStorage
          localStorage.setItem('bookings', JSON.stringify(bookingsData));
          setIsLocalMode(false);
        } else {
          throw new Error('Backend returned error');
        }
      } catch (err) {
        console.log('📝 Backend not available, using local storage');
        setIsLocalMode(true);
        
        // Load from localStorage
        const savedBookings = localStorage.getItem('bookings');
        if (savedBookings) {
          bookingsData = JSON.parse(savedBookings);
        } else {
          bookingsData = [];
        }
      }

      setBookings(bookingsData);
      setFilteredBookings(bookingsData);
      setRefreshing(false);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setError('Failed to fetch bookings');
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ---------- SEARCH FUNCTION ----------
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    if (!term.trim()) {
      setFilteredBookings(bookings);
      return;
    }

    const lowerTerm = term.toLowerCase().trim();
    const filtered = bookings.filter((booking) => {
      const searchableFields = [
        booking.bookingNo?.toLowerCase() || '',
        booking.agentName?.toLowerCase() || '',
        booking.roomType?.toLowerCase() || '',
        booking.agentContact || '',
        booking.branch?.toLowerCase() || '',
      ];
      
      return searchableFields.some(field => 
        field.includes(lowerTerm)
      );
    });
    
    setFilteredBookings(filtered);
  };

  // ---------- SEND THANK YOU EMAIL ----------
  const sendThankYouEmail = async (booking: any) => {
    try {
      if (!booking.email) {
        console.log('📧 No email provided, skipping thank you email');
        return { success: false, message: 'No email provided' };
      }

      setSendingEmail(true);
      console.log('📧 Sending thank you email to:', booking.email);

      // Hotel link
      const hotelLink = 'https://www.mahadevhotels.com/mahadev-Inn-pokhara/';

      // ✅ Try to send via backend email endpoint
      try {
        const response = await fetch('http://localhost:4000/email/thank-you', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: booking.email,
            booking: {
              bookingNo: booking.bookingNo,
              agentName: booking.agentName,
              agentContact: booking.agentContact,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              roomType: booking.roomType,
              roomsCount: booking.roomsCount,
              totalCost: booking.totalCost || booking.roomCharges * booking.roomsCount || 0,
              currency: booking.currency || 'NPR',
              branch: booking.branch,
              mealPlan: booking.mealPlan,
              roomCharges: booking.roomCharges,
              heads: booking.heads,
              kitchenCharges: booking.kitchenCharges || 0,
              dinnerCharges: booking.dinnerCharges || 0,
              extraPersonCharges: booking.extraPersonCharges || 0,
              remark: booking.remark || '',
              hotelLink: hotelLink,
            }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log('✅ Thank you email sent successfully');
            setSendingEmail(false);
            return { success: true, message: 'Thank you email sent' };
          } else {
            throw new Error('Email service returned failure');
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (emailErr: any) {
        console.error('❌ Backend thank you email error:', emailErr);
        
        // ✅ Fallback: Open email client with pre-filled content
        const subject = `Thank You for Staying at Mahadev Inn - ${booking.bookingNo}`;
        const body = `
Dear ${booking.agentName},

Thank you for choosing Mahadev Inn!

We hope you had a wonderful stay with us. It was our pleasure to serve you.

Your Stay Details:
----------------
Booking No: ${booking.bookingNo}
Guest Name: ${booking.agentName}
Check-In: ${new Date(booking.checkIn).toLocaleDateString()}
Check-Out: ${new Date(booking.checkOut).toLocaleDateString()}
Room Type: ${booking.roomType}
Number of Rooms: ${booking.roomsCount}

🌟 We would love to welcome you back on your next visit to ${booking.branch}!

Visit our hotel page for more information:
${hotelLink}

Thank you once again for choosing Mahadev Inn!

Warm Regards,
Team Mahadev Inn
📞 +977-9841234567
        `;
        
        // Open Gmail compose
        const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(booking.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailLink, '_blank');
        
        console.log('📧 Gmail compose opened as fallback');
        setSendingEmail(false);
        return { success: true, message: 'Thank you email opened in Gmail' };
      }
    } catch (err) {
      console.error('❌ Error in thank you email process:', err);
      setSendingEmail(false);
      return { success: false, message: 'Failed to send thank you email' };
    }
  };

  // ---------- HANDLE CHECK OUT ----------
  const handleCheckOut = async (id: string) => {
    setProcessingId(id);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const booking = bookings.find(b => b.id === id);
      
      console.log('📤 Checking out booking:', id);
      
      // Try to update on backend
      try {
        await fetch(`http://localhost:4000/bookings/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bookingStatus: 'CheckedOut' }),
        });
      } catch (err) {
        console.log('📝 Backend update failed, updating local storage');
      }
      
      // ✅ Update local storage
      const updatedBookings = bookings.map((b: any) => 
        b.id === id ? { ...b, bookingStatus: 'CheckedOut' } : b
      );
      setBookings(updatedBookings);
      setFilteredBookings(updatedBookings);
      localStorage.setItem('bookings', JSON.stringify(updatedBookings));
      
      // Get the updated booking
      const updatedBooking = updatedBookings.find(b => b.id === id);
      
      // ✅ Set checked out guest for Thank You modal
      if (updatedBooking) {
        setCheckedOutGuest(updatedBooking);
        setShowThankYouModal(true);
      }
      
      let emailMessage = '';
      
      // ✅ Send Thank You email
      if (updatedBooking?.email) {
        const result = await sendThankYouEmail(updatedBooking);
        if (result.success) {
          emailMessage = ' Thank you email sent to guest!';
        } else {
          emailMessage = ' ⚠️ Email could not be sent.';
        }
      } else if (updatedBooking && !updatedBooking.email) {
        emailMessage = ' No email provided.';
      }
      
      setSuccess(`✅ Guest checked out successfully!${emailMessage}`);
      
      // Refresh the list
      await fetchBookings();
      setSearchTerm('');
      
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('❌ Error checking out:', err);
      setError('Failed to check out guest. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  // ---------- CLOSE THANK YOU MODAL ----------
  const closeThankYouModal = () => {
    setShowThankYouModal(false);
    setCheckedOutGuest(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Get checked-in bookings
  const checkedInBookings = filteredBookings.filter((b: any) => 
    b.bookingStatus === 'CheckedIn'
  );

  // Get today's date
  const today = new Date().toLocaleDateString();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800 flex items-center">
              <span className="mr-2">←</span>
              Back to Dashboard
            </Link>
            <h2 className="text-xl font-semibold text-gray-800">Check Out</h2>
            {isLocalMode && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                📝 Offline Mode
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={fetchBookings}
              disabled={refreshing}
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-1"
            >
              <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            ❌ {error}
            <button onClick={() => setError('')} className="float-right font-bold">×</button>
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            ✅ {success}
            {sendingEmail && (
              <div className="mt-1 text-sm text-blue-600">
                📧 Sending thank you email...
              </div>
            )}
            <button onClick={() => setSuccess('')} className="float-right font-bold">×</button>
          </div>
        )}

        {/* Date and Stats */}
        <div className="flex flex-wrap justify-between items-center mb-4">
          <div className="text-sm text-gray-500">
            📅 {today}
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-semibold text-orange-600">{checkedInBookings.length}</span> guests currently checked in
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by guest name, booking number, room type, contact..."
              className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => handleSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <FiX className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          
          {/* Search Stats */}
          <div className="mt-2 text-sm text-gray-500 flex flex-wrap gap-4">
            <span>
              <span className="font-semibold text-orange-600">{checkedInBookings.length}</span> checked-in bookings found
            </span>
            {searchTerm && (
              <span>
                Filtered by: <span className="font-medium text-gray-700">"{searchTerm}"</span>
              </span>
            )}
          </div>
        </div>

        {checkedInBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No matching bookings found' : 'No guests currently checked in'}
            </p>
            {searchTerm && (
              <button
                onClick={() => handleSearch('')}
                className="text-indigo-600 hover:underline mt-2 inline-block"
              >
                Clear search
              </button>
            )}
            {!searchTerm && (
              <Link href="/dashboard/check-in" className="text-indigo-600 hover:underline mt-2 inline-block">
                Go to Check In
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Booking No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Guest
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Room Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {checkedInBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                        {booking.bookingNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.agentName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.roomType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(booking.checkOut).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleCheckOut(booking.id)}
                          disabled={processingId === booking.id}
                          className={`px-4 py-2 rounded-lg text-white transition-colors ${
                            processingId === booking.id
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-orange-600 hover:bg-orange-700'
                          }`}
                        >
                          {processingId === booking.id ? (
                            <span className="flex items-center">
                              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Processing...
                            </span>
                          ) : (
                            'Check Out'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        {checkedInBookings.length > 0 && (
          <div className="mt-4 text-sm text-gray-500 flex flex-wrap justify-between items-center">
            <span>
              <span className="font-semibold">{checkedInBookings.length}</span> guests ready to check out
            </span>
            <span className="text-xs text-gray-400">
              📧 Thank you email will be sent automatically on check-out
            </span>
          </div>
        )}
      </div>

      {/* ✅ THANK YOU MODAL with Hotel Link */}
      {showThankYouModal && checkedOutGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-white text-xl font-bold flex items-center">
                <span className="mr-2">🎉</span> Checkout Successful!
              </h3>
              <button
                onClick={closeThankYouModal}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Guest Info */}
              <div className="mb-6">
                <p className="text-gray-600 mb-1">Dear <span className="font-semibold text-gray-800">{checkedOutGuest.agentName}</span>,</p>
                <p className="text-gray-600">
                  Thank you for choosing <span className="font-semibold text-orange-600">Mahadev Inn</span>!
                </p>
              </div>

              {/* Booking Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-700 mb-3">📋 Stay Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Booking No:</span>
                    <span className="ml-2 font-medium text-gray-800">{checkedOutGuest.bookingNo}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Room Type:</span>
                    <span className="ml-2 font-medium text-gray-800">{checkedOutGuest.roomType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Check-In:</span>
                    <span className="ml-2 font-medium text-gray-800">
                      {new Date(checkedOutGuest.checkIn).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Check-Out:</span>
                    <span className="ml-2 font-medium text-gray-800">
                      {new Date(checkedOutGuest.checkOut).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Branch:</span>
                    <span className="ml-2 font-medium text-gray-800">{checkedOutGuest.branch}</span>
                  </div>
                </div>
              </div>

              {/* Thank You Message with Hotel Link */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 text-2xl mr-3">🌟</div>
                  <div>
                    <p className="text-gray-700 text-sm">
                      We hope you had a wonderful stay with us! It was our pleasure to serve you.
                    </p>
                    <p className="text-gray-700 text-sm mt-1">
                      We would love to welcome you back on your next visit to <strong>{checkedOutGuest.branch}</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Hotel Link Card */}
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 border border-indigo-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 text-2xl mr-3">🏨</div>
                  <div>
                    <p className="font-semibold text-indigo-800 text-sm">Visit Mahadev Inn Hotel Page</p>
                    <a
                      href="https://www.mahadevhotels.com/mahadev-Inn-pokhara/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium underline break-all"
                    >
                      https://www.mahadevhotels.com/mahadev-Inn-pokhara/
                    </a>
                    <p className="text-xs text-gray-500 mt-1">
                      Click the link to learn more about our services and special offers!
                    </p>
                  </div>
                </div>
              </div>

              {/* Share Options */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('https://www.mahadevhotels.com/mahadev-Inn-pokhara/');
                    alert('Hotel link copied to clipboard!');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
                >
                  📋 Copy Hotel Link
                </button>
                <button
                  onClick={() => {
                    window.open('https://www.mahadevhotels.com/mahadev-Inn-pokhara/', '_blank');
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
                >
                  🔗 Visit Hotel Page
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={closeThankYouModal}
                className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}