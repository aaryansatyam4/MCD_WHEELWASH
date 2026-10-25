import React, { useState } from 'react';
import { Play, FileSpreadsheet, RefreshCw, CheckCircle, Info } from 'lucide-react';
import { demoService } from '../services/api.js';

interface DemoControlBarProps {
  onSimulationTriggered?: () => void;
  authorizedLocationId?: number | null;
}

export const DemoControlBar: React.FC<DemoControlBarProps> = ({
  onSimulationTriggered,
  authorizedLocationId,
}) => {
  const [loadingLoc, setLoadingLoc] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const handleTrigger = async (locId: number, locName: string) => {
    try {
      setLoadingLoc(locId);
      setMsg(null);
      await demoService.triggerPassage(locId);
      setMsg(`Simulated truck passing through ${locName} wheel-wash bay!`);
      if (onSimulationTriggered) onSimulationTriggered();
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg(err.response?.data?.error || 'Failed to trigger simulation.');
    } finally {
      setLoadingLoc(null);
    }
  };

  const handleTriggerHuman = async (locId: number, locName: string) => {
    try {
      setLoadingLoc(locId);
      setMsg(null);
      await demoService.triggerHumanWalk(locId);
      setMsg(`Worker/pedestrian walking across ${locName} bay — AI filter should ignore counter!`);
      if (onSimulationTriggered) onSimulationTriggered();
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg(err.response?.data?.error || 'Failed to trigger simulation.');
    } finally {
      setLoadingLoc(null);
    }
  };

  const handleDownloadExcel = () => {
    window.open('/public/database.xlsx', '_blank');
  };

  const handleReloadDb = async () => {
    try {
      setMsg('Reloading Excel database from disk...');
      const res = await demoService.reloadDatabase();
      setMsg(res.message);
      if (onSimulationTriggered) onSimulationTriggered();
      setTimeout(() => setMsg(null), 4000);
    } catch {
      setMsg('Failed to reload database.');
    }
  };

  const canShowLocation = (locId: number) => {
    if (!authorizedLocationId) return true;
    return authorizedLocationId === locId;
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-600 text-white text-[10px]">
            DEMO MODE ACTIVE
          </span>
          <span className="text-amber-900 font-medium hidden sm:inline">
            In-Memory CCTV Frame Synthesizer & Motion Detection Simulator
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-amber-800">Trigger Truck:</span>

          {canShowLocation(1) && (
            <button
              onClick={() => handleTrigger(1, 'Ghazipur')}
              disabled={loadingLoc !== null}
              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 shadow-xs transition-colors"
            >
              <Play className="w-3 h-3 fill-white" />
              Ghazipur (+1)
            </button>
          )}

          {canShowLocation(2) && (
            <button
              onClick={() => handleTrigger(2, 'Okhla')}
              disabled={loadingLoc !== null}
              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 shadow-xs transition-colors"
            >
              <Play className="w-3 h-3 fill-white" />
              Okhla (+1)
            </button>
          )}

          {canShowLocation(3) && (
            <button
              onClick={() => handleTrigger(3, 'Bhalaswa')}
              disabled={loadingLoc !== null}
              className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1 shadow-xs transition-colors"
            >
              <Play className="w-3 h-3 fill-white" />
              Bhalaswa (+1)
            </button>
          )}

          <div className="h-4 w-px bg-amber-300 mx-1 hidden sm:block" />

          {/* Test Pedestrian Filter Button */}
          <button
            onClick={() => handleTriggerHuman(authorizedLocationId || 1, 'Ghazipur')}
            disabled={loadingLoc !== null}
            title="Simulate a worker in safety vest walking across the bay. Counter will NOT increment!"
            className="px-2.5 py-1 rounded-md bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold flex items-center gap-1 border border-amber-400 shadow-xs transition-colors text-[11px]"
          >
            <span>🚶 Test Worker Walk (No Count)</span>
          </button>

          <div className="h-4 w-px bg-amber-300 mx-1 hidden sm:block" />

          {/* Excel Database Download Button */}
          <button
            onClick={handleDownloadExcel}
            title="Download backend/public/database.xlsx to inspect all sheets in Microsoft Excel"
            className="px-2.5 py-1 rounded-md bg-emerald-800 hover:bg-emerald-900 text-white font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
            Download Excel DB
          </button>

          {/* Reload from Excel button */}
          <button
            onClick={handleReloadDb}
            title="Sync changes if you edited the Excel file on disk"
            className="px-2 py-1 rounded-md bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold flex items-center gap-1 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-amber-700" />
            Reload DB
          </button>
        </div>
      </div>

      {msg && (
        <div className="mt-1.5 text-center text-xs font-semibold text-emerald-800 bg-emerald-100/80 py-1 px-3 rounded flex items-center justify-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          {msg}
        </div>
      )}
    </div>
  );
};
