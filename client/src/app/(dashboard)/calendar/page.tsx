// 'use client';
// import React, { useEffect, useState } from 'react';
// import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
// import api from '../../../../lib/api';
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import * as XLSX from 'xlsx';

// export default function CalendarPage(){
//   const [month,setMonth]=useState(format(new Date(),'yyyy-MM'));
//   const [ownerBranch,setOwnerBranch]=useState<'all'|string>('all');
//   const [summary,setSummary]=useState<Record<string,{bookings:number;rooms:number;occupancyPercent:number}>>({});
//   const [loading,setLoading]=useState(true);
//   const [selectedDate,setSelectedDate]=useState<string|null>(null);
//   const [dayRows,setDayRows]=useState<any[]>([]);
//   const branches=['Kathmandu-1','Kathmandu-2','Pokhara','Bhairawaha'];

//   async function loadSummary(){
//     setLoading(true);
//     const params:any={ month };
//     if(ownerBranch!=='all') params.branch = ownerBranch;
//     const { data } = await api.get('/bookings/summary',{ params });
//     setSummary(data); setLoading(false);
//   }
//   useEffect(()=>{ loadSummary(); },[month,ownerBranch]);

//   async function openDay(dateStr:string){
//     const params:any={ date: dateStr };
//     if(ownerBranch!=='all') params.branch = ownerBranch;
//     const { data } = await api.get('/bookings/by-date',{ params });
//     setDayRows(data); setSelectedDate(dateStr);
//   }

//   function color(p:number){ if(p>=70) return 'bg-red-200'; if(p>=40) return 'bg-orange-200'; return 'bg-green-100'; }

//   const start = startOfMonth(new Date(`${month}-01`));
//   const end = endOfMonth(start);
//   const days = eachDayOfInterval({ start, end });

//   // Exports with full hierarchy filenames
//   function exportDayPDF(){ if(!selectedDate) return;
//     const doc=new jsPDF(); doc.text(`Mahadev Inn — Bookings ${ownerBranch}_${selectedDate}`,14,15);
//     autoTable(doc,{ head:[["Booking No","Agent","Contact","Rooms","Type","Facility","Meal","Price"]],
//       body: dayRows.map((b:any)=>[b.bookingNo,b.agentName,b.agentContact,b.roomsCount,b.roomType,b.facility,b.mealPlan,b.price??'-']), startY:25 });
//     doc.save(`MahadevInn_Bookings_${ownerBranch}_${selectedDate}.pdf`);
//   }
//   function exportDayXLS(){ if(!selectedDate) return;
//     const ws=XLSX.utils.json_to_sheet(dayRows); const wb=XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(wb,ws,'Bookings');
//     XLSX.writeFile(wb,`MahadevInn_Bookings_${ownerBranch}_${selectedDate}.xlsx`);
//   }
//   function exportMonthPDF(){
//     const doc=new jsPDF(); doc.text(`Mahadev Inn — Monthly Summary ${ownerBranch}_${month}`,14,15);
//     autoTable(doc,{ head:[["Date","Bookings","Rooms","Occupancy"]],
//       body: Object.entries(summary).map(([d,info])=>[d,info.bookings,info.rooms,`${info.occupancyPercent}%`]), startY:25 });
//     doc.save(`MahadevInn_Summary_${ownerBranch}_${month}.pdf`);
//   }
//   function exportMonthXLS(){
//     const rows=Object.entries(summary).map(([d,info])=>({Date:d,Bookings:info.bookings,Rooms:info.rooms,Occupancy:info.occupancyPercent+"%"}));
//     const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(wb,ws,'Monthly Summary');
//     XLSX.writeFile(wb,`MahadevInn_Summary_${ownerBranch}_${month}.xlsx`);
//   }

//   return (
//     <div className="p-6">
//       <div className="flex items-center justify-between mb-4">
//         <h1 className="text-2xl font-bold text-indigo-700">Booking Calendar — {month}</h1>
//         <div className="flex gap-2">
//           <button onClick={exportMonthPDF} className="px-3 py-2 rounded bg-red-600 text-white">Export Month PDF</button>
//           <button onClick={exportMonthXLS} className="px-3 py-2 rounded bg-green-600 text-white">Export Month Excel</button>
//         </div>
//       </div>

//       <div className="flex items-center gap-3 mb-4">
//         <label className="font-medium">Month:</label>
//         <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="border rounded px-2 py-1" />
//         <label className="font-medium">Branch:</label>
//         <select value={ownerBranch} onChange={e=>setOwnerBranch(e.target.value)} className="border rounded px-2 py-1">
//           <option value="all">All Branches</option>
//           {branches.map(b=> <option key={b} value={b}>{b}</option>)}
//         </select>
//         <div className="ml-auto text-xs flex gap-2 items-center">
//           <span className="w-3 h-3 bg-green-100 inline-block rounded"/> Low &lt;40%
//           <span className="w-3 h-3 bg-orange-200 inline-block rounded ml-3"/> Med 40–70%
//           <span className="w-3 h-3 bg-red-200 inline-block rounded ml-3"/> High &gt;70%
//         </div>
//       </div>

//       {loading ? <p>Loading…</p> : (
//         <div className="grid grid-cols-7 gap-2">
//           {days.map(d=>{
//             const key=format(d,'yyyy-MM-dd'); const s=summary[key]||{bookings:0,rooms:0,occupancyPercent:0};
//             return (
//               <button key={key} onClick={()=>openDay(key)} className={`border rounded-lg p-2 text-center hover:shadow ${color(s.occupancyPercent)}`}>
//                 <div className="font-semibold">{format(d,'d')}</div>
//                 <div className="text-xs text-slate-600">{format(d,'EEE')}</div>
//                 <div className="mt-1 text-sm">{s.bookings} bookings</div>
//                 <div className="text-xs text-slate-700">{s.rooms} rooms</div>
//                 <div className="text-xs font-bold text-slate-800">{s.occupancyPercent}%</div>
//               </button>
//             );
//           })}
//         </div>
//       )}

//       {selectedDate && (
//         <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
//           <div className="bg-white rounded-lg shadow-lg w-11/12 md:w-3/4 p-6">
//             <div className="flex items-center justify-between mb-3">
//               <h2 className="text-xl font-semibold text-indigo-700">Bookings on {selectedDate} ({ownerBranch})</h2>
//               <div className="flex gap-2">
//                 <button onClick={exportDayPDF} className="px-3 py-2 rounded bg-red-600 text-white">Export PDF</button>
//                 <button onClick={exportDayXLS} className="px-3 py-2 rounded bg-green-600 text-white">Export Excel</button>
//                 <button onClick={()=>setSelectedDate(null)} className="px-3 py-2 rounded bg-indigo-600 text-white">Close</button>
//               </div>
//             </div>
//             <div className="overflow-x-auto">
//               <table className="min-w-full text-sm">
//                 <thead><tr className="bg-indigo-50 text-indigo-900">
//                   <th className="p-2 text-left">Booking No</th>
//                   <th className="p-2 text-left">Agent</th>
//                   <th className="p-2 text-left">Contact</th>
//                   <th className="p-2 text-left">Rooms</th>
//                   <th className="p-2 text-left">Type</th>
//                   <th className="p-2 text-left">Facility</th>
//                   <th className="p-2 text-left">Meal</th>
//                   <th className="p-2 text-left">Price</th>
//                 </tr></thead>
//                 <tbody>
//                   {dayRows.length===0 ? (
//                     <tr><td className="p-3 text-slate-500" colSpan={8}>No bookings.</td></tr>
//                   ) : dayRows.map((b:any)=>(
//                     <tr key={b.id} className="border-t">
//                       <td className="p-2">{b.bookingNo}</td>
//                       <td className="p-2">{b.agentName}</td>
//                       <td className="p-2">{b.agentContact}</td>
//                       <td className="p-2">{b.roomsCount}</td>
//                       <td className="p-2">{b.roomType}</td>
//                       <td className="p-2">{b.facility}</td>
//                       <td className="p-2">{b.mealPlan}</td>
//                       <td className="p-2">{b.price??'-'}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
