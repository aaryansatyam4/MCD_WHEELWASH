import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Calculator, FileText } from 'lucide-react';
import { countService } from '../services/api.js';

interface EditCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialLocationId?: number;
  initialDate?: string;
  currentCount?: number;
}

export const EditCountModal: React.FC<EditCountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialLocationId = 1,
  initialDate = new Date().toISOString().split('T')[0],
  currentCount = 0,
}) => {
  const [locationId, setLocationId] = useState<number>(initialLocationId);
  const [reportDate, setReportDate] = useState<string>(initialDate);
  const [reportedCount, setReportedCount] = useState<number>(currentCount);
  const [newCount, setNewCount] = useState<string>(String(currentCount));
  const [reason, setReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocationId(initialLocationId);
      setReportDate(initialDate);
      fetchCurrentCount(initialLocationId, initialDate);
      setError(null);
    }
  }, [isOpen, initialLocationId, initialDate]);

  const fetchCurrentCount = async (locId: number, dateStr: string) => {
    try {
      const data = await countService.getByLocation(locId, dateStr);
      setReportedCount(data.total);
      setNewCount(String(data.total));
    } catch {
      // Fallback
      setReportedCount(currentCount);
      setNewCount(String(currentCount));
    }
  };

  const handleLocationChange = (locId: number) => {
    setLocationId(locId);
    fetchCurrentCount(locId, reportDate);
  };

  const handleDateChange = (date: string) => {
    setReportDate(date);
    fetchCurrentCount(locationId, date);
  };

  if (!isOpen) return null;

  const parsedNewCount = parseInt(newCount, 10);
  const isValidNumber = !isNaN(parsedNewCount) && parsedNewCount >= 0;
  const difference = isValidNumber ? parsedNewCount - reportedCount : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidNumber) {
      setError('Please enter a valid non-negative truck count.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setError('Please provide a descriptive reason for this adjustment.');
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
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to apply manual count adjustment.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="font-bold text-base text-white">Edit Truck Count</h2>
              <p className="text-xs text-slate-400">Master Admin Manual Override & Audit Logging</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Location & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Location Selection
              </label>
              <select
                value={locationId}
                onChange={(e) => handleLocationChange(Number(e.target.value))}
                className="w-full text-sm rounded-lg border-slate-300 border px-3 py-2 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value={1}>GHAZIPUR</option>
                <option value={2}>OKHLA</option>
                <option value={3}>BHALASWA</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Date Selection
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full text-sm rounded-lg border-slate-300 border px-3 py-2 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Current Count vs New Count */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-3 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Current Reported</span>
              <div className="text-xl font-black text-slate-800 font-mono mt-1">
                {reportedCount}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">New Target Count</span>
              <div className="mt-1">
                <input
                  type="number"
                  min="0"
                  value={newCount}
                  onChange={(e) => setNewCount(e.target.value)}
                  className="w-20 text-center font-mono font-bold text-xl px-2 py-0.5 border border-blue-400 rounded bg-white text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Difference</span>
              <div
                className={`text-xl font-black font-mono mt-1 ${
                  difference > 0
                    ? 'text-emerald-600'
                    : difference < 0
                    ? 'text-rose-600'
                    : 'text-slate-500'
                }`}
              >
                {difference > 0 ? `+${difference}` : difference}
              </div>
            </div>
          </div>

          {/* Reason for Editing */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Reason for Editing (Mandatory for Audit Trail)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. CCTV maintenance between 14:00-15:00, manual logbook shows 15 trucks passed uncounted."
              className="w-full text-sm rounded-lg border-slate-300 border p-3 bg-white font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Information Notice */}
          <div className="text-[11px] text-slate-500 bg-blue-50/70 border border-blue-100 rounded-lg p-3">
            Automatic detection events in the database are permanently preserved. This change records a timestamped adjustment entry with your Master Admin ID and updates all live counters and reports immediately.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {isLoading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
