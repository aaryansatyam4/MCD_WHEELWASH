import React, { useState, useEffect } from 'react';
import { ScrollText, Search, RefreshCw, ShieldAlert } from 'lucide-react';
import { auditService } from '../services/api.js';
import type { AuditLog } from '../types/index.js';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const res = await auditService.getLogs();
      setLogs(res.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.username && l.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              System Audit History
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Complete non-repudiation audit trail of manual adjustments, logins, parameter updates, and system operations
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by action, admin username, or keyword..."
          className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase">Timestamp (IST)</th>
              <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase">Actor</th>
              <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase">Action Code</th>
              <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase">Event Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                    {log.created_at}
                  </td>
                  <td className="px-5 py-3 font-sans font-bold text-slate-800">
                    {log.username || 'SYSTEM'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.action.includes('COUNT_ADJUSTMENT')
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : log.action.includes('FAILED')
                          ? 'bg-rose-100 text-rose-800'
                          : log.action.includes('SUCCESS')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-sans text-slate-700 text-xs break-all">
                    {log.details}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400 font-sans">
                  No matching audit records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
