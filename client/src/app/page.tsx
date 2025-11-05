'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const countryCodes = [
  { code: '+977', name: 'Nepal (+977)' },
  { code: '+91', name: 'India (+91)' },
  { code: '+1', name: 'USA/Canada (+1)' },
  { code: '+44', name: 'UK (+44)' },
  { code: '+61', name: 'Australia (+61)' },
  { code: '+86', name: 'China (+86)' },
  { code: '+81', name: 'Japan (+81)' },
  { code: '+82', name: 'South Korea (+82)' },
  { code: '+966', name: 'Saudi Arabia (+966)' },
  { code: '+971', name: 'UAE (+971)' },
];

interface Booking {
  id: string;
  bookingNo: string;
  agentName: string;
  agentContact: string;
  roomsCount: number;
  roomType: string;
  facility: string;
  price?: number | null;
  mealPlan: string;
  selfCooking?: number | null;
  checkIn: string;
  checkOut: string;
  remark?: string;
  branch: string;
  bookingStatus: string;
  total?: number;
}

type InventoryTotals = Record<
  string,
  { singleTotal: number; doubleTotal: number; tripleTotal: number; quardTotal: number }
>;
function BranchCapacityRow({
  branch,
  inv,
  occupiedSingle,
  occupiedDouble,
  onSave,
}: {
  branch: string;
  inv: { singleTotal: number; doubleTotal: number };
  occupiedSingle: number;
  occupiedDouble: number;
  onSave: (branch: string, singleCap: number, doubleCap: number) => void;
}) {
  const [singleTemp, setSingleTemp] = useState(inv.singleTotal);
  const [doubleTemp, setDoubleTemp] = useState(inv.doubleTotal);
  

  return (
    <tr className="border-t">
      <td className="py-2 px-4 font-medium">{branch}</td>
      <td className="py-2 px-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <span>{occupiedSingle} /</span>
          <input
            type="number"
            min="0"
            className="w-16 border rounded px-2 py-1 text-center"
            value={singleTemp}
            onChange={(e) => setSingleTemp(Number(e.target.value))}
          />
        </div>
      </td>
      <td className="py-2 px-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <span>{occupiedDouble} /</span>
          <input
            type="number"
            min="0"
            className="w-16 border rounded px-2 py-1 text-center"
            value={doubleTemp}
            onChange={(e) => setDoubleTemp(Number(e.target.value))}
          />
        </div>
      </td>
      <td className="py-2 px-4 text-center">
        <button
          onClick={() => onSave(branch, singleTemp, doubleTemp)}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded"
        >
          Save
        </button>
      </td>
    </tr>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [allBookings, setAllBookings] = useState<Booking[]>([]); // for occupancy
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [showBookingForm, setShowBookingForm] = useState<boolean>(false);
  const formRef = useRef<HTMLDivElement>(null);

  // 🔹 PREVIEW modals state
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewSrc, setPdfPreviewSrc] = useState<string | null>(null);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [excelPreviewRows, setExcelPreviewRows] = useState<any[][]>([]);

  // 🔹 Day-specific booking modal
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayBookings, setDayBookings] = useState<Booking[]>([]);
  const [showTrialSignup, setShowTrialSignup] = useState(false);
const [trialSignup, setTrialSignup] = useState({
  username: '',
  email: '',
  phoneNumber: '',
  companyName: '',
  branches: '',
});


  // 🔹 Owner selects, Manager/Viewer fixed
  const [selectedBranch, setSelectedBranch] = useState<string>(
    user?.branches?.[0] || 'Kathmandu1'
  );
  const [form, setForm] = useState({
    agentName: '',
    countryCode: '+977',
    agentContact: '',
    roomsCount: 1,
    roomType: 'Single',
    facility: 'AC',
    price: '',
    mealPlan: 'BB',
    selfCooking: '',
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    bookingStatus: 'Confirm',
    remark: '',
    branch: selectedBranch,
  });

  // ---- Default Inventory (fallback) ----
  const defaultInventory: InventoryTotals = {
    Kathmandu1: { singleTotal: 10, doubleTotal: 10, tripleTotal: 10, quardTotal: 10 },
    Kathmandu2: { singleTotal: 10, doubleTotal: 10, tripleTotal: 10, quardTotal: 10 },
    Pokhara: { singleTotal: 10, doubleTotal: 10, tripleTotal: 10, quardTotal: 10 },
    Bhairawaha: { singleTotal: 10, doubleTotal: 10, tripleTotal: 10, quardTotal: 10 },
  };

  const [inventory, setInventory] = useState<InventoryTotals>({});

  function nightsBetween(checkIn: string, checkOut: string) {
    return Math.max(
      1,
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
      (1000 * 60 * 60 * 24)
    );
  }
  async function loadCapacities() {
    try {
      const res = await api.get('/branch-capacity');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const data = res.data.reduce((acc: any, item: any) => {
          acc[item.branch] = {
            singleTotal: item.singleCap ?? 10,
            doubleTotal: item.doubleCap ?? 10,
            tripleTotal: 0,
            quardTotal: 0,
          };
          return acc;
        }, {});
        setInventory({ ...defaultInventory, ...data });

      } else {
        setInventory(defaultInventory);
      }
    } catch (err) {
      console.error('Failed to load capacities', err);
      setInventory(defaultInventory);
    }
  }

  // ---- Load ----
  useEffect(() => {
    if (user) {
      if (user.role !== 'Owner') setSelectedBranch(user.branches[0]);
      load();
      loadCapacities();
    }
  }, [user, selectedBranch]);

  async function load() {
    if (!user) return;
    const addTotal = (b: Booking) => ({
      ...b,
      total:
        (b.roomsCount * (b.price || 0) * nightsBetween(b.checkIn, b.checkOut)) +
        (b.mealPlan === "EPKitchen" ? (b.selfCooking || 0) : 0),
    });

    const params: any = {};
    if (selectedBranch) params.branch = selectedBranch;
    if (filterFrom && filterTo) {
      params.from = filterFrom;
      params.to = filterTo;
    }

    if (user.role === "Owner") {
      const all = await api.get("/bookings");
      setAllBookings(Array.isArray(all.data) ? all.data.map(addTotal) : []);
      const branchRes = await api.get("/bookings", { params });
      setBookings(Array.isArray(branchRes.data) ? branchRes.data.map(addTotal) : []);
    } else {
      const res = await api.get("/bookings", { params });
      const withTotal = Array.isArray(res.data) ? res.data.map(addTotal) : [];
      setBookings(withTotal);
      setAllBookings(withTotal);
    }
    //setInventory(defaultInventory);
  }
  async function saveCapacity(branch: string, singleCap: number, doubleCap: number) {
    try {
      await api.put(`/branch-capacity/${branch}`, { singleCap, doubleCap });
      await loadCapacities();
      await load();
    } catch (err) {
      alert('Error saving capacity');
    }
  }


  async function save() {
    if (!/^\d{10}$/.test(form.agentContact)) {
      alert('Contact number must be exactly 10 digits.');
      return;
    }
    if (
      form.mealPlan === 'EPKitchen' &&
      (!form.selfCooking || isNaN(Number(form.selfCooking)))
    ) {
      alert('Self Cooking is required for EPKitchen meal plan.');
      return;
    }
    // --- NEW: Capacity check
  const branchData = inventory[selectedBranch];
  if (!branchData) {
    alert('Invalid branch or capacity data missing.');
    return;
  }
  const occupiedSingle = allBookings.filter(b =>
    b.branch === selectedBranch &&
    b.roomType === 'Single' &&
    new Date(b.checkIn) <= new Date(form.checkIn) &&
    new Date(b.checkOut) > new Date(form.checkIn) &&
    (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed')
  ).reduce((a, b) => a + b.roomsCount, 0);

  const occupiedDouble = allBookings.filter(b =>
    b.branch === selectedBranch &&
    b.roomType === 'Double' &&
    new Date(b.checkIn) <= new Date(form.checkIn) &&
    new Date(b.checkOut) > new Date(form.checkIn) &&
    (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed')
  ).reduce((a, b) => a + b.roomsCount, 0);

  if (form.roomType === 'Single' && occupiedSingle + Number(form.roomsCount) > branchData.singleTotal) {
    alert(`Cannot book ${form.roomsCount} single rooms — only ${branchData.singleTotal - occupiedSingle} left!`);
    return;
  }
  if (form.roomType === 'Double' && occupiedDouble + Number(form.roomsCount) > branchData.doubleTotal) {
    alert(`Cannot book ${form.roomsCount} double rooms — only ${branchData.doubleTotal - occupiedDouble} left!`);
    return;
  }
    const payload = {
      ...form,
      branch: selectedBranch,
      price: form.price ? Number(form.price) : null,
      selfCooking: form.mealPlan === 'EPKitchen' ? Number(form.selfCooking) : null,
      bookingStatus: form.bookingStatus,
      agentContact: form.countryCode + form.agentContact,
    };
    if (editingId) {
      await api.put(`/bookings/${editingId}`, payload);
      setEditingId(null);
    } else {
      try {
        await api.post('/bookings', { ...payload, bookingNo: 'BKG' + Date.now() });
        await load();
        resetForm();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Booking failed: room limit exceeded.');
      }

    }
    await load();
    resetForm();
  }

  function resetForm() {
    setForm({
      agentName: '',
      countryCode: '+977',
      agentContact: '',
      roomsCount: 1,
      roomType: 'Single',
      facility: 'AC',
      price: '',
      mealPlan: 'BB',
      selfCooking: '',
      checkIn: new Date().toISOString().slice(0, 10),
      checkOut: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      bookingStatus: 'Confirm',
      remark: '',
      branch: selectedBranch,
    });
    setEditingId(null);
  }

  async function remove(id: string) {
    await api.delete(`/bookings/${id}`);
    await load();
  }

  function editBooking(b: Booking) {
    setEditingId(b.id);
    setShowBookingForm(true);
    let countryCode = '+977';
    let agentContact = b.agentContact || '';
    for (const cc of countryCodes) {
      if (b.agentContact?.startsWith(cc.code)) {
        countryCode = cc.code;
        agentContact = b.agentContact.slice(cc.code.length);
        break;
      }
    }
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    setForm({
      agentName: b.agentName || '',
      countryCode,
      agentContact,
      roomsCount: b.roomsCount || 1,
      roomType: b.roomType || 'Single',
      facility: b.facility || 'AC',
      price: b.price?.toString() || '',
      mealPlan: b.mealPlan || 'BB',
      selfCooking: b.selfCooking?.toString() || '',
      checkIn: b.checkIn?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      checkOut: b.checkOut?.slice(0, 10) || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      bookingStatus: b.bookingStatus || 'Confirm',
      remark: b.remark || '',
      branch: b.branch || selectedBranch,
    });
  }

  function printBooking(b: Booking) {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`
      <html><head><meta charset='utf-8'/><title>Booking ${b.id}</title>
      <style>
        body{font-family:Arial;padding:24px;background:#fafafa}
        h1{color:#4f46e5} table{width:100%;border-collapse:collapse;margin-top:12px}
        td,th{border:1px solid #ddd;padding:8px} th{background:#4f46e5;color:#fff}
      </style></head><body>
        <img src="/mahadev-logo.png" alt="Mahadev Inn Logo" style="width:80px;height:80px;margin-bottom:12px"/>
        <h1>Mahadev Inn — Booking</h1>
        <div>Branch: ${b.branch} | Generated: ${new Date().toLocaleString()}</div> 
        <table>
          <tr><th>Agent</th><td>${b.agentName}</td></tr>
          <tr><th>Agent Contact</th><td>${b.agentContact}</td></tr>
          <tr><th>Booking No</th><td>${b.bookingNo}</td></tr>
          <tr><th>Rooms</th><td>${b.roomsCount}</td></tr>
          <tr><th>Room Type</th><td>${b.roomType}</td></tr>
          <tr><th>Price</th><td>${b.price ?? '-'}</td></tr>
          <tr><th>Meal Plan</th><td>${b.mealPlan}</td></tr>
          ${b.mealPlan === 'EPKitchen'
        ? `<tr><th>Self Cooking Price</th><td>${b.selfCooking ?? '-'}</td></tr>`
        : ''
      }
          <tr><th>Check-In</th><td>${b.checkIn}</td></tr>
          <tr><th>Check-Out</th><td>${b.checkOut}</td></tr>
          <tr><th>Nights</th><td>${nightsBetween(b.checkIn, b.checkOut)}</td></tr>
          <tr><th>Status</th><td>${b.bookingStatus}</td></tr>
          <tr><th>Remark</th><td>${b.remark ?? '-'}</td></tr>
          <tr><th>Total</th><td>${b.total ?? 0}</td></tr>
        </table>
        <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  function occupancyFor(branch: string) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    let totalOccupied = 0;
    let tomorrowCheckOuts = 0;
    for (const b of allBookings) {
      if (b.branch === branch) {
        const statusOk = b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed';
        const inToday = new Date(b.checkIn) <= today;
        const outLater = new Date(b.checkOut) > today;
        if (statusOk && inToday && outLater) {
          totalOccupied += b.roomsCount;
        }
        if (b.checkOut.slice(0, 10) === tomorrow.toISOString().slice(0, 10)) {
          tomorrowCheckOuts += b.roomsCount;
        }
      }
    }
    const tot = inventory[branch] || { singleTotal: 0, doubleTotal: 0, tripleTotal: 0, quardTotal: 0 };
    const cap = tot.singleTotal + tot.doubleTotal + tot.tripleTotal + tot.quardTotal || 1;
    const occupancyPercent = Math.round((totalOccupied / cap) * 100);
    return { totalOccupied, occupancyPercent, tomorrowCheckOuts };
  }

  function StatCard({
    title,
    v,
    showPercent = true,
  }: {
    title: string;
    v: { occupied: number; total: number; percent: number };
    showPercent?: boolean;
  }) {
    return (
      <section className="rounded-xl shadow-lg p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm">
          {v.occupied}/{v.total} occupied
          {showPercent && ` (${v.percent}%)`}
        </p>
        <div className="w-full h-3 bg-white/30 rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-white"
            style={{ width: `${showPercent ? v.percent : (v.total ? (v.occupied / v.total) * 100 : 0)}%` }}
          />
        </div>
      </section>
    );
  }

  // ---- Role-based filtering ----
  const role = user?.role || 'Viewer';
  const canEdit = role === 'Owner' || role === 'Manager';
  const filteredBookings = useMemo(
    () => (role === 'Owner' ? bookings : bookings.filter((b) => b.branch === selectedBranch)),
    [bookings, role, selectedBranch]
  );

  // ---- Calendar Logic ----
  const today = new Date();
  const [viewingMonth, setViewingMonth] = useState<number>(today.getMonth());
  const [viewingYear, setViewingYear] = useState<number>(today.getFullYear());
  const { calendarDays, weeks } = useMemo(() => {
    const firstDayOfMonth = new Date(viewingYear, viewingMonth, 1);
    const lastDayOfMonth = new Date(viewingYear, viewingMonth + 1, 0);
    const startingDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    const daysInPrevMonth = new Date(viewingYear, viewingMonth, 0).getDate();
    const calendarDays: Array<{ date: number; month: number; year: number; isCurrentMonth: boolean }> = [];
    let dayCounter = 1;
    for (let i = 0; i < startingDay; i++) {
      const prevMonth = viewingMonth === 0 ? 11 : viewingMonth - 1;
      const prevYear = viewingMonth === 0 ? viewingYear - 1 : viewingYear;
      calendarDays.push({
        date: daysInPrevMonth - startingDay + 1 + i,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
      });
    }
    while (dayCounter <= daysInMonth) {
      calendarDays.push({
        date: dayCounter,
        month: viewingMonth,
        year: viewingYear,
        isCurrentMonth: true,
      });
      dayCounter++;
    }
    const weeks = Math.ceil(calendarDays.length / 7);
    return { calendarDays, weeks };
  }, [viewingMonth, viewingYear]);

  const bookingsPerDay = useMemo(() => {
    const result: Record<string, number> = {};
    filteredBookings
      .filter(b => b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed')
      .forEach((booking) => {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        const currentDate = new Date(checkIn);
        while (currentDate < checkOut) {
          const key = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
          result[key] = (result[key] || 0) + booking.roomsCount;
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
    return result;
  }, [filteredBookings]);

  const getDayData = (date: number, month: number, year: number) => {
    const key = `${year}-${month + 1}-${date}`;
    return bookingsPerDay[key] || 0;
  };

  // ---- Export Helpers ----
  function buildExcelRows() {
    return [
      ['Agent', 'BookingNo', 'Branch', 'Rooms', 'Type', 'Price', 'Meal', 'Check-In', 'Check-Out', 'Nights', 'Status', 'Total'],
      ...filteredBookings.map(b => [
        b.agentName,
        b.bookingNo,
        b.branch,
        b.roomsCount,
        b.roomType,
        b.price ?? '-',
        b.mealPlan,
        b.checkIn,
        b.checkOut,
        nightsBetween(b.checkIn, b.checkOut),
        b.bookingStatus,
        b.total ?? 0,
      ])
    ];
  }

  async function openExcelPreview() {
    setExcelPreviewRows(buildExcelRows());
    setShowExcelPreview(true);
  }

  async function confirmDownloadExcel() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelPreviewRows.length ? excelPreviewRows : buildExcelRows());
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, `bookings_${selectedBranch}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setShowExcelPreview(false);
  }

  async function openPdfPreview() {
    const element = document.getElementById('bookings-table');
    element.classList.add('pdf-hide-actions');
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
    const dataUrl = canvas.toDataURL('image/png');
    setPdfPreviewSrc(dataUrl);
    setShowPdfPreview(true);
    element.classList.remove('pdf-hide-actions');
  }

  async function confirmDownloadPDF() {
    const element = document.getElementById('bookings-table');
    if (!element) return;
    element.classList.add('pdf-hide-actions');
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`bookings_${selectedBranch}_${new Date().toISOString().slice(0, 10)}.pdf`);
    setShowPdfPreview(false);
    element.classList.remove('pdf-hide-actions');
  }
  // 🗓️ Open day bookings modal
  function openDayBookings(date: number, month: number, year: number) {
    const target = new Date(Date.UTC(year, month, date));

    const dayStr = target.toISOString().slice(0, 10);

    const bookingsForDay = filteredBookings.filter(b => {
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(b.checkOut);
      return new Date(b.checkIn) <= target && new Date(b.checkOut) > target;

    });

    setSelectedDay(dayStr);
    setDayBookings(bookingsForDay);
  }

  // ---- UI ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 p-6">
      <style jsx>{`
        .pdf-hide-actions th:last-child,
        .pdf-hide-actions td:last-child {
          display: none !important;
        }
      `}</style>
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold text-indigo-700">Mahadev Inn — Dashboard</h1>
          <p className="text-sm text-slate-600 py-1">
            Logged in as <b>{user?.username}</b> ({role}) — Branches: <b>{user?.branches?.join(', ')}</b>
          </p>
        </header>
        
        {/* Occupancy Overview */}
        {role === 'Owner' && (
          <section className="bg-white shadow-md rounded-xl p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-indigo-600">
              Branch Occupancy Overview
            </h2>

            {/* Responsive wrapper */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm table-auto border-collapse">
                <thead>
                  <tr className="border-b bg-indigo-50 text-indigo-900">
                    <th className="py-2 px-3 sm:px-4 text-left whitespace-nowrap">Branch</th>
                    <th className="py-2 px-3 sm:px-4 text-center whitespace-nowrap">Total Occupied</th>
                    <th className="py-2 px-3 sm:px-4 text-center whitespace-nowrap">Occupancy %</th>
                    <th className="py-2 px-3 sm:px-4 text-center whitespace-nowrap">Tomorrow Check-outs</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(inventory).map((br) => {
                    const o = occupancyFor(br);
                    return (
                      <tr key={br} className="border-t hover:bg-gray-50">
                        <td className="py-2 px-3 sm:px-4">{br}</td>
                        <td className="py-2 px-3 sm:px-4 text-center">{o.totalOccupied}</td>
                        <td className="py-2 px-3 sm:px-4 text-center">{o.occupancyPercent}%</td>
                        <td className="py-2 px-3 sm:px-4 text-center">{o.tomorrowCheckOuts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Room Capacity Management for Owner */}
        {role === 'Owner' && (
          <section className="bg-white shadow-md rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-indigo-600">
              Room Capacity Management
            </h2>
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-indigo-50 text-indigo-900">
                  <th className="py-2 px-4 text-left">Branch</th>
                  <th className="py-2 px-4 text-center">Single Rooms</th>
                  <th className="py-2 px-4 text-center">Double Rooms</th>
                  <th className="py-2 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(inventory).map((branch) => {
                  let occupiedSingle = 0;
                  let occupiedDouble = 0;
                  const today = new Date();

                  for (const b of allBookings) {
                    if (
                      b.branch === branch &&
                      (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed') &&
                      new Date(b.checkIn) <= today &&
                      new Date(b.checkOut) > today
                    ) {
                      if (b.roomType === 'Single') occupiedSingle += b.roomsCount;
                      else if (b.roomType === 'Double') occupiedDouble += b.roomsCount;
                    }
                  }

                  const inv = inventory[branch] || { singleTotal: 0, doubleTotal: 0 };
                  return (
                    <BranchCapacityRow
                      key={branch}
                      branch={branch}
                      inv={inv}
                      occupiedSingle={occupiedSingle}
                      occupiedDouble={occupiedDouble}
                      onSave={saveCapacity}
                    />
                  );
                })}
              </tbody>

            </table>
          </section>
        )}

        {/* Branch selector for Owner */}
        {role === 'Owner' && (
          <div className="mb-4">
            <label className="block text-lg font-medium py-2">Select Branch</label>
            <select
              className="border rounded px-3 py-2"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              {user?.branches?.map((b: string) => <option key={b}>{b}</option>)}
            </select>
          </div>
        )}

        {/* StatCards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {(() => {
            const o = occupancyFor(selectedBranch);
            const tot = inventory[selectedBranch];
            const cap =
              (tot?.singleTotal || 0) +
              (tot?.doubleTotal || 0) +
              (tot?.tripleTotal || 0) +
              (tot?.quardTotal || 0);
            return (
              <>
                <StatCard
                  title="Total Occupied Rooms"
                  v={{ occupied: o.totalOccupied, total: cap, percent: 0 }}
                  showPercent={false}
                />
                <StatCard
                  title="Occupancy %"
                  v={{ occupied: o.occupancyPercent, total: 100, percent: o.occupancyPercent }}
                  showPercent={true}
                />
                <StatCard
                  title="Tomorrow Check-outs"
                  v={{ occupied: o.tomorrowCheckOuts, total: cap, percent: 0 }}
                  showPercent={false}
                />
              </>
            );
          })()}
        </section>

        {/* Calendar View */}
        <section className="bg-white shadow rounded-xl p-4 sm:p-6 mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-indigo-700 mb-4">
            Monthly Booking Calendar
          </h2>

          {/* Navigation buttons */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <button
              onClick={() => {
                if (viewingMonth === 0) {
                  setViewingMonth(11);
                  setViewingYear(viewingYear - 1);
                } else {
                  setViewingMonth(viewingMonth - 1);
                }
              }}
              className="w-full sm:w-auto px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm sm:text-base"
            >
              ← Previous Month
            </button>

            <h3 className="text-center text-base sm:text-lg font-semibold">
              {new Date(viewingYear, viewingMonth).toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </h3>

            <div className="flex justify-between sm:justify-end gap-2">
              <button
                onClick={() => {
                  setViewingMonth(today.getMonth());
                  setViewingYear(today.getFullYear());
                }}
                className="px-3 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
              >
                Today
              </button>
              <button
                onClick={() => {
                  if (viewingMonth === 11) {
                    setViewingMonth(0);
                    setViewingYear(viewingYear + 1);
                  } else {
                    setViewingMonth(viewingMonth + 1);
                  }
                }}
                className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm sm:text-base"
              >
                Next Month →
              </button>
            </div>
          </div>

          {/* Responsive calendar table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse border">
              <thead>
                <tr className="bg-indigo-50 text-indigo-900">
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                    <th key={day} className="p-2 text-center border whitespace-nowrap">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: weeks }).map((_, weekIndex) => (
                  <tr key={weekIndex}>
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const dayIndexInMonth = weekIndex * 7 + dayIndex;
                      const day = calendarDays[dayIndexInMonth];
                      if (!day) return <td key={`empty-${dayIndex}`} className="p-2 border"></td>;
                      const isCurrentMonth = day.isCurrentMonth;
                      const count = getDayData(day.date, day.month, day.year);
                      const isToday =
                        day.date === today.getDate() &&
                        day.month === today.getMonth() &&
                        day.year === today.getFullYear();
                      return (
                        <td
                          key={dayIndexInMonth}
                          className={`p-2 border relative ${isCurrentMonth
                              ? isToday
                                ? 'bg-blue-100 font-bold'
                                : 'hover:bg-gray-50 cursor-pointer'
                              : 'text-gray-400'
                            }`}
                          style={{ fontSize: '1.1rem' }}
                        >
                          <div className="text-center">{day.date}</div>
                          {count > 0 && (
                            <div
                              onClick={() => openDayBookings(day.date, day.month, day.year)}
                              className={`absolute bottom-0.5 right-0.5 flex items-center justify-center
                                 w-4 h-4 sm:w-6 sm:h-6 text-[10px] sm:text-xs font-bold text-white rounded-full shadow cursor-pointer 
                                 ${count <= 2 ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                              title={`${count} room(s) booked`}
                            >
                              {count}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Booking Form Toggle */}
        {canEdit && (
          <section className="mb-6">
            {!showBookingForm ? (
              <button
                onClick={() => {
                  setShowBookingForm(true);
                  setTimeout(() => {
                    if (formRef.current) {
                      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow transition"
              >
                + New Booking
              </button>
            ) : (
              <div className="bg-white shadow rounded-xl p-6" ref={formRef}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-indigo-700">
                    {editingId ? 'Edit Booking' : 'New Booking'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowBookingForm(false);
                      if (editingId) {
                        setEditingId(null);
                        resetForm();
                      }
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Agent Name</label>
                    <input
                      className="border rounded px-3 py-2 w-full"
                      value={form.agentName}
                      onChange={(e) =>
                        setForm({ ...form, agentName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Agent Contact</label>
                    <div className="flex gap-2">
                      <select
                        className="border rounded px-3 py-2 w-1/3"
                        value={form.countryCode}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            countryCode: e.target.value,
                          })
                        }
                      >
                        {countryCodes.map((cc) => (
                          <option key={cc.code} value={cc.code}>
                            {cc.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className={`border rounded px-3 py-2 w-2/3 ${form.agentContact && !/^\d{10}$/.test(form.agentContact)
                            ? "border-red-500"
                            : "border-gray-300"
                          }`}
                        placeholder="10-digit number"
                        value={form.agentContact}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            agentContact: e.target.value.replace(/[^0-9]/g, ''),
                          })
                        }
                      />
                    </div>
                    {form.agentContact && !/^\d{10}$/.test(form.agentContact) && (
                      <p className="text-xs text-red-600 mt-1">
                        Contact number must be exactly 10 digits (without country code).
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Rooms</label>
                    <input
                      type="number"
                      min={1}
                      className="border rounded px-3 py-2 w-full"
                      value={form.roomsCount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          roomsCount: Math.max(1, parseInt(e.target.value || '1')),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Room Type</label>
                    <select
                      className="border rounded px-3 py-2 w-full"
                      value={form.roomType}
                      onChange={(e) =>
                        setForm({ ...form, roomType: e.target.value })
                      }
                    >
                      {['Single', 'Double', 'Triple', 'Quard'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Facility</label>
                    <select
                      className="border rounded px-3 py-2 w-full"
                      value={form.facility}
                      onChange={(e) =>
                        setForm({ ...form, facility: e.target.value })
                      }
                    >
                      {['AC', 'NonAC'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Meal Plan</label>
                    <select
                      className="border rounded px-3 py-2 w-full"
                      value={form.mealPlan}
                      onChange={(e) =>
                        setForm({ ...form, mealPlan: e.target.value })
                      }
                    >
                      {['BB', 'MAP', 'AP', 'EP', 'EPKitchen'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  {form.mealPlan === 'EPKitchen' && (
                    <div>
                      <label className="block text-sm font-medium">
                        Self Cooking
                      </label>
                      <input
                        className="border rounded px-3 py-2 w-full"
                        value={form.selfCooking}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            selfCooking: e.target.value.replace(/[^0-9]/g, ''),
                          })
                        }
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium">Price</label>
                    <input
                      className="border rounded px-3 py-2 w-full"
                      value={form.price}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          price: e.target.value.replace(/[^0-9]/g, ''),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Check-In</label>
                    <input
                      type="date"
                      className="border rounded px-3 py-2 w-full"
                      value={form.checkIn}
                      onChange={(e) =>
                        setForm({ ...form, checkIn: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Check-Out</label>
                    <input
                      type="date"
                      className="border rounded px-3 py-2 w-full"
                      value={form.checkOut}
                      onChange={(e) =>
                        setForm({ ...form, checkOut: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Booking Status
                    </label>
                    <select
                      className="border rounded px-3 py-2 w-full"
                      value={form.bookingStatus}
                      onChange={(e) =>
                        setForm({ ...form, bookingStatus: e.target.value })
                      }
                    >
                      {['Confirm', 'Hold'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Remark</label>
                    <textarea
                      className="border rounded px-3 py-2 w-full"
                      value={form.remark}
                      onChange={(e) =>
                        setForm({ ...form, remark: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={save}
                    className="px-4 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    {editingId ? 'Update Booking' : 'Save Booking'}
                  </button>
                  {editingId && (
                    <button
                      onClick={() => {
                        setEditingId(null);
                        resetForm();
                      }}
                      className="px-4 py-2 rounded text-white bg-gray-500 hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  )}
                  {!editingId && (
                    <button
                      onClick={() => {
                        setShowBookingForm(false);
                        resetForm();
                      }}
                      className="px-4 py-2 rounded text-white bg-gray-500 hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Bookings table */}
        <section className="mt-6 bg-white shadow rounded-xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-indigo-700 mb-4">
            Bookings ({selectedBranch})
          </h2>

          {/* Filter section */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 mb-4">
            <label className="text-sm sm:text-base font-medium">Filter by Date Range:</label>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
              <span className="text-sm">to</span>
              <input
                type="date"
                className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(filterFrom || filterTo) && (
                <button
                  onClick={() => {
                    setFilterFrom("");
                    setFilterTo("");
                    load();
                  }}
                  className="px-3 py-1 bg-gray-200 text-sm rounded hover:bg-gray-300 w-full sm:w-auto"
                >
                  Clear
                </button>
              )}
              <button
                onClick={load}
                className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 w-full sm:w-auto"
              >
                Apply
              </button>
            </div>

            {/* Download buttons */}
            <div className="flex flex-wrap gap-2 sm:ml-auto w-full sm:w-auto justify-start sm:justify-end mt-2 sm:mt-0">
              <button
                onClick={openExcelPreview}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 w-full sm:w-auto"
              >
                📥 Download Excel
              </button>
              <button
                onClick={openPdfPreview}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 w-full sm:w-auto"
              >
                📄 Download PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table id="bookings-table" className="min-w-full text-sm">
              <thead>
                <tr className="bg-indigo-50 text-indigo-900">
                  <th className="p-2 text-left">Agent</th>
                  <th className="p-2 text-left">Agent Number</th>
                  <th className="p-2 text-left">BookingNo</th>
                  <th className="p-2 text-left">Branch</th>
                  <th className="p-2 text-left">Rooms</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Price</th>
                  <th className="p-2 text-left">Meal</th>
                  <th className="p-2 text-left">Check-In</th>
                  <th className="p-2 text-left">Check-Out</th>
                  <th className="p-2 text-left">Nights</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Total</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={13}>
                      No bookings yet.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="p-2">{b.agentName}</td>
                      <td className="p-2">{` ${b.agentContact}`}</td>
                      {/* <td className="p-2">{`${b.countryCode} ${b.agentContact}`}</td> */}
                      <td className="p-2">{b.bookingNo}</td>
                      <td className="p-2">{b.branch}</td>
                      <td className="p-2">{b.roomsCount}</td>
                      <td className="p-2">{b.roomType}</td>
                      <td className="p-2">{b.price ?? '-'}</td>
                      <td className="p-2">{b.mealPlan}</td>
                      <td className="p-2">{b.checkIn.slice(0, 10)}</td>
                      <td className="p-2">{b.checkOut.slice(0, 10)}</td>
                      <td className="p-2">
                        {nightsBetween(b.checkIn, b.checkOut)}
                      </td>
                      <td className="p-2">{b.bookingStatus}</td>
                      <td className="p-2 font-semibold text-indigo-700">
                        {b.total ?? 0}
                      </td>
                      <td className="p-2 flex gap-2">
                        <button
                          onClick={() => printBooking(b)}
                          className="px-2 py-1 rounded bg-indigo-600 text-white"
                        >
                          PDF
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => editBooking(b)}
                            className="px-2 py-1 rounded bg-yellow-500 text-white"
                          >
                            Edit
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => remove(b.id)}
                            className="px-2 py-1 rounded bg-red-600 text-white"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* PDF PREVIEW MODAL */}
      {showPdfPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">PDF Preview — Bookings ({selectedBranch})</h3>
              <button onClick={() => setShowPdfPreview(false)} className="text-gray-600 hover:text-black">✕</button>
            </div>
            <div className="p-4 overflow-auto bg-gray-50">
              {pdfPreviewSrc ? (
                <img src={pdfPreviewSrc} alt="PDF Preview" className="w-full h-auto rounded border" />
              ) : (
                <div className="text-center text-sm text-gray-500">Generating preview…</div>
              )}
            </div>
            <div className="px-4 py-3 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowPdfPreview(false)}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDownloadPDF}
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL PREVIEW MODAL */}
      {showExcelPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">Excel Preview — Bookings ({selectedBranch})</h3>
              <button onClick={() => setShowExcelPreview(false)} className="text-gray-600 hover:text-black">✕</button>
            </div>
            <div className="p-4 overflow-auto">
              <table className="min-w-full text-sm border">
                <thead>
                  <tr className="bg-gray-100">
                    {excelPreviewRows[0]?.map((h: any, i: number) => (
                      <th key={i} className="p-2 border text-left">{String(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelPreviewRows.slice(1).map((row, rIdx) => (
                    <tr key={rIdx} className="border-t">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2 border">{String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                  {excelPreviewRows.length <= 1 && (
                    <tr>
                      <td className="p-3 text-center text-gray-500" colSpan={excelPreviewRows[0]?.length || 1}>
                        No data to preview
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowExcelPreview(false)}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDownloadExcel}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Download Excel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🗓️ Day Bookings Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-indigo-50">
              <h3 className="font-semibold text-indigo-700">
                Bookings on {selectedDay}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="text-gray-600 hover:text-black">✕</button>
            </div>

            <div className="p-4 overflow-auto">
              {dayBookings.length === 0 ? (
                <p className="text-sm text-gray-500">No bookings found.</p>
              ) : (
                <table className="min-w-full text-sm border">
                  <thead>
                    <tr className="bg-indigo-50 text-indigo-900">
                      <th className="p-2 text-left">Agent</th>
                      <th className="p-2 text-left">Contact</th>
                      <th className="p-2 text-left">Booking No</th>
                      <th className="p-2 text-left">Rooms</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Meal</th>
                      <th className="p-2 text-left">Check-In</th>
                      <th className="p-2 text-left">Check-Out</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBookings.map((b) => (
                      <tr key={b.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">{b.agentName}</td>
                        <td className="p-2">{b.agentContact}</td>
                        <td className="p-2">{b.bookingNo}</td>
                        <td className="p-2 text-center">{b.roomsCount}</td>
                        <td className="p-2">{b.roomType}</td>
                        <td className="p-2">{b.mealPlan}</td>
                        <td className="p-2">{b.checkIn.slice(0, 10)}</td>
                        <td className="p-2">{b.checkOut.slice(0, 10)}</td>
                        <td className="p-2">{b.bookingStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-4 py-3 border-t flex gap-2 justify-end">
              <button
                onClick={() => setSelectedDay(null)}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Close
              </button>
              {dayBookings.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      const ws = XLSX.utils.json_to_sheet(dayBookings);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "DayBookings");
                      XLSX.writeFile(wb, `Bookings_${selectedDay}.xlsx`);
                    }}
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Excel
                  </button>
                  <button
                    onClick={() => {
                      const doc = new jsPDF();
                      doc.text(`Bookings — ${selectedDay}`, 14, 15);
                      const rows = dayBookings.map(b => [
                        b.agentName,
                        b.bookingNo,
                        b.roomsCount,
                        b.roomType,
                        b.mealPlan,
                        b.checkIn.slice(0, 10),
                        b.checkOut.slice(0, 10),
                      ]);
                      autoTable(doc, {
                        head: [['Agent', 'BookingNo', 'Rooms', 'Type', 'Meal', 'Check-In', 'Check-Out']],
                        body: rows,
                        startY: 25,
                      });
                      doc.save(`Bookings_${selectedDay}.pdf`);

                    }}
                    className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    PDF
                  </button>
                </>
              )}
            </div>
            
          </div>
          
        </div>
        
      )}
  
    </div>
    
  );
}