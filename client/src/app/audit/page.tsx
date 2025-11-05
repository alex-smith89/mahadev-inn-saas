'use client';
import { useEffect, useState } from 'react';
import { fetchAuditLogs } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

interface AuditLog {
  id: string;
  timestamp: string;
  username: string | null;
  branch: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: any;
  ip: string | null;
  userAgent: string | null;
}

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState({
    user: '',
    branch: '',
    action: '',
    from: '',
    to: '',
    page: 1,
    limit: 20,  
  });
  const [total, setTotal] = useState(0);

  async function load() {
    const res = await fetchAuditLogs(filters);
    setLogs(res.logs);
    setTotal(res.total);
  }

  useEffect(() => {
    load();
  }, [filters]);

  return (
    <section className="bg-white shadow rounded-xl p-6 mt-6">
      <h2 className="text-lg font-semibold text-indigo-700 mb-4">
        Audit Logs
      </h2>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <input
          placeholder="User"
          className="border px-2 py-1 rounded"
          value={filters.user}
          onChange={(e) => setFilters({ ...filters, user: e.target.value })}
        />
        <input
          placeholder="Branch"
          className="border px-2 py-1 rounded"
          value={filters.branch}
          onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
        />
        <input
          placeholder="Action"
          className="border px-2 py-1 rounded"
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
        />
        <input
          type="date"
          className="border px-2 py-1 rounded"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
        <input
          type="date"
          className="border px-2 py-1 rounded"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-indigo-50 text-indigo-900">
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Branch</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">Entity</th>
              
              <th className="p-2 text-left">Details</th>
              <th className="p-2 text-left">IP</th>
              <th className="p-2 text-left">User Agent</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-3 text-slate-500 text-center">
                  No logs yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-2">{log.username || '-'}</td>
                  <td className="p-2">{log.branch || '-'}</td>
                  <td className="p-2">{log.action}</td>
                  <td className="p-2">{log.entity || '-'}</td>
                 
                  <td className="p-2 max-w-xs">
                    <pre className="whitespace-pre-wrap text-xs text-gray-600 overflow-x-auto">
                      {log.details ? JSON.stringify(log.details, null, 2) : '-'}
                    </pre>
                  </td>
                  <td className="p-2 text-xs max-w-[120px] truncate" title={log.ip || ''}>
                    {log.ip || '-'}
                  </td>
                  <td className="p-2 text-xs max-w-[200px] truncate" title={log.userAgent || ''}>
                    {log.userAgent?.substring(0, 30) + (log.userAgent?.length > 30 ? '...' : '') || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <button
          disabled={filters.page === 1}
          onClick={() =>
            setFilters({ ...filters, page: filters.page - 1 })
          }
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Prev
        </button>
        <span>
          Page {filters.page} of {Math.ceil(total / filters.limit)}
        </span>
        <button
          disabled={filters.page >= Math.ceil(total / filters.limit)}
          onClick={() =>
            setFilters({ ...filters, page: filters.page + 1 })
          }
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
}