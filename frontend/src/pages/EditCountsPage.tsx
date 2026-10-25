import React, { useState, useEffect } from 'react';
import { Edit3, History, CheckCircle, AlertTriangle, RefreshCw, Calculator, FileText } from 'lucide-react';
import { countService } from '../services/api.js';
import type { CountAdjustment } from '../types/index.js';

export const EditCountsPage: React.FC = () => {
  const [locationId, setLocationId] = useState<number>(1);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentCount, setCurrentCount] = useState<number>(0);
  const [newCount, setNewCount] = useState<string>('0');
  const [reason, setReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<CountAdjustment[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  // Fetch current count for selected location and date
  const fetchCurrentCount = async () => {
    try {
      const data = await countService.getByLocation(locationId, reportDate);
      setCurrentCount(data.total);
      setNewCount(String(data.total));
    } catch {
      setCurrentCount(0);
      setNewCount('0');
    }
  };

  // Fetch adjustments history
  const fetchAdjustments = async () => {
    try {
      setIsHistoryLoading(true);
      const data = await countService.getAdjustments();
      setAdjustments(data.adjustments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentCount();
  }, [locationId, reportDate]);

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const parsedNewCount = parseInt(newCount, 10);
  const isValidNumber = !isNaN(parsedNewCount) && parsedNewCount >= 0;
  const difference = isValidNumber ? parsedNewCount - currentCount : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!isValidNumber) {
      setErrorMsg('Please enter a valid non-negative truck count.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg('Please specify a valid operational reason for the manual adjustment.');
      return;
    }

    try {
      setIsLoading(true);
      await countService.adjustCount({
        locationId,
        reportDate,
        newCount: parsedNewCount,
        reason: reason.trim(),
      });

      setSuccessMsg(
        `Truck count successfully updated to ${parsedNewCount} (${difference > 0 ? `+${difference}` : difference}). Recorded in audit log.`
      );
      setReason('');
      await fetchCurrentCount();
      await fetchAdjustments();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to adjust count.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Edit3 className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
            Admin Manual Truck Count Editing
          </h1>
        </div>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Master Admin manual override interface. Set exact counts, calculate differences, and preserve complete audit trails.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Count Adjustment Form */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-sm text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            Adjustment Parameters
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Location Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Location Selection
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(Number(e.target.value))}
                className="w-full text-sm rounded-lg border-slate-300 border px-3 py-2 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value={1}>GHAZIPUR (Location 1)</option>
                <option value={2}>OKHLA (Location 2)</option>
                <option value={3}>BHALASWA (Location 3)</option>
              </select>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date Selection
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full text-sm rounded-lg border-slate-300 border px-3 py-2 bg-slate-50 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Current Count vs Target Count Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase">Current Count:</span>
                <span className="text-lg font-black font-mono text-slate-900">{currentCount}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  New Exact Count:
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCount}
                  onChange={(e) => setNewCount(e.target.value)}
                  className="w-full text-base font-mono font-bold px-3 py-1.5 border border-blue-400 rounded-lg bg-white text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-600 uppercase">Difference:</span>
                <span
                  className={`text-base font-black font-mono ${
                    difference > 0
                      ? 'text-emerald-600'
                      : difference < 0
                      ? 'text-rose-600'
                      : 'text-slate-400'
                  }`}
                >
                  {difference > 0 ? `+${difference}` : difference}
                </span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Reason for Adjustment (Mandatory)
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Verified against physical barrier entry logbook"
                className="w-full text-xs rounded-lg border-slate-300 border p-2.5 bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {isLoading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Audit History of Adjustments */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Manual Corrections & Audit History
              </h3>
            </div>
            <button
              onClick={fetchAdjustments}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isHistoryLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase">Date & Time</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase">Location</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600 uppercase">Previous</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600 uppercase">Corrected</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600 uppercase">Diff</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase">Reason</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {adjustments.length > 0 ? (
                  adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 text-[11px] whitespace-nowrap">
                        {adj.created_at}
                      </td>
                      <td className="px-4 py-3 font-sans font-bold text-slate-800">
                        {adj.locationName}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 font-medium">
                        {adj.previous_total}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900">
                        {adj.corrected_total}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded ${
                            adj.adjustment > 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : adj.adjustment < 0
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {adj.adjustment > 0 ? `+${adj.adjustment}` : adj.adjustment}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-700 max-w-xs truncate" title={adj.reason}>
                        {adj.reason}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-sans font-medium">
                        {adj.adminUsername || 'admin'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                      No manual count adjustments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
