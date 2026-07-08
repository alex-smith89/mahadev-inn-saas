'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Calendar from 'react-calendar';
import 'react-calendar';
import '../calendar.css'; 
import { format } from 'date-fns';
import axios from 'axios';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

export default function CalendarPage() {
  const [date, setDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:4000/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(response.data.bookings || []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const tileClassName = ({ date: tileDate }: { date: Date }) => {
    const dateStr = format(tileDate, 'yyyy-MM-dd');
    const hasBooking = bookings.some(b => 
      format(new Date(b.checkIn), 'yyyy-MM-dd') <= dateStr && 
      format(new Date(b.checkOut), 'yyyy-MM-dd') >= dateStr
    );
    if (hasBooking) {
      return 'bg-indigo-100 text-indigo-700 rounded-full font-semibold';
    }
    return '';
  };

  const tileContent = ({ date: tileDate }: { date: Date }) => {
    const dateStr = format(tileDate, 'yyyy-MM-dd');
    const dayBookings = bookings.filter(b => 
      format(new Date(b.checkIn), 'yyyy-MM-dd') <= dateStr && 
      format(new Date(b.checkOut), 'yyyy-MM-dd') >= dateStr
    );
    if (dayBookings.length > 0) {
      return (
        <div className="flex justify-center items-center mt-1">
          <span className="inline-block w-1 h-1 bg-indigo-500 rounded-full"></span>
          <span className="inline-block w-1 h-1 bg-indigo-500 rounded-full ml-0.5"></span>
          <span className="inline-block w-1 h-1 bg-indigo-500 rounded-full ml-0.5"></span>
        </div>
      );
    }
    return null;
  };

  const onDateChange = (value: Value) => {
    if (value instanceof Date) {
      setDate(value);
    } else if (Array.isArray(value) && value[0] instanceof Date) {
      setDate(value[0]);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Get bookings for selected date
  const selectedDateStr = format(date, 'yyyy-MM-dd');
  const selectedDateBookings = bookings.filter(b => 
    format(new Date(b.checkIn), 'yyyy-MM-dd') <= selectedDateStr && 
    format(new Date(b.checkOut), 'yyyy-MM-dd') >= selectedDateStr
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800 flex items-center">
              <span className="mr-2">←</span>
              Back to Dashboard
            </Link>
            <h2 className="text-xl font-semibold text-gray-800">Calendar</h2>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <Calendar
            onChange={onDateChange}
            value={date}
            tileClassName={tileClassName}
            tileContent={tileContent}
            className="rounded-lg border-0 shadow-inner w-full"
            prevLabel={<span className="text-indigo-600 text-xl">‹</span>}
            nextLabel={<span className="text-indigo-600 text-xl">›</span>}
            prev2Label={<span className="text-indigo-600 text-xl">«</span>}
            next2Label={<span className="text-indigo-600 text-xl">»</span>}
          />
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Selected: <span className="font-semibold">{format(date, 'MMMM dd, yyyy')}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {selectedDateBookings.length} bookings on this date
            </p>
          </div>
          
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-indigo-500 rounded-full mr-1"></span>
              <span>Has Bookings</span>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-white border border-gray-300 rounded-full mr-1"></span>
              <span>Available</span>
            </div>
          </div>
        </div>

        {/* Bookings on selected date */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Bookings on {format(date, 'MMMM dd, yyyy')}
          </h3>
          {selectedDateBookings.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No bookings on this date</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Booking No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedDateBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-indigo-600">{booking.bookingNo}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{booking.agentName}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{booking.roomType}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          booking.bookingStatus === 'Confirmed' || booking.bookingStatus === 'Confirm'
                            ? 'bg-green-100 text-green-800'
                            : booking.bookingStatus === 'Pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
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
        </div>
      </div>
    </div>
  );
}