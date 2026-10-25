import React, { useState, useEffect } from 'react';
import { Sliders, Camera as CameraIcon, Shield, CheckCircle, AlertTriangle, RefreshCw, Play, Square, Crosshair } from 'lucide-react';
import { cameraService } from '../services/api.js';
import { StatusBadge } from '../components/StatusBadge.js';
import type { Camera } from '../types/index.js';

export const CameraSettingsPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields
  const [rtspUrl, setRtspUrl] = useState<string>('');
  const [detectionEnabled, setDetectionEnabled] = useState<boolean>(true);
  const [roiX, setRoiX] = useState<number>(20);
  const [roiY, setRoiY] = useState<number>(35);
  const [roiW, setRoiW] = useState<number>(60);
  const [roiH, setRoiH] = useState<number>(45);
  const [sensitivity, setSensitivity] = useState<number>(65);
  const [minDurationMs, setMinDurationMs] = useState<number>(1200);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(5);

  const fetchCameras = async () => {
    try {
      setIsLoading(true);
      const res = await cameraService.getCameras();
      setCameras(res.cameras || []);

      const activeCam = res.cameras.find((c) => c.id === selectedCameraId) || res.cameras[0];
      if (activeCam) {
        populateForm(activeCam);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const populateForm = (cam: Camera) => {
    setSelectedCameraId(cam.id);
    let config: any = {};
    try {
      config = JSON.parse(cam.connection_configuration);
    } catch {
      config = {};
    }
    setRtspUrl(config.rtspUrl || '');
    setDetectionEnabled(cam.detection_enabled === 1);

    const s = cam.parsedSettings || {
      roi: { x: 20, y: 35, width: 60, height: 45 },
      sensitivity: 65,
      minDurationMs: 1200,
      cooldownSeconds: 5,
    };
    setRoiX(s.roi?.x ?? 20);
    setRoiY(s.roi?.y ?? 35);
    setRoiW(s.roi?.width ?? 60);
    setRoiH(s.roi?.height ?? 45);
    setSensitivity(s.sensitivity ?? 65);
    setMinDurationMs(s.minDurationMs ?? 1200);
    setCooldownSeconds(s.cooldownSeconds ?? 5);
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleSelectCamera = (id: number) => {
    const cam = cameras.find((c) => c.id === id);
    if (cam) {
      populateForm(cam);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await cameraService.updateSettings(selectedCameraId, {
        rtspUrl,
        detection_enabled: detectionEnabled,
        roi: { x: roiX, y: roiY, width: roiW, height: roiH },
        sensitivity,
        minDurationMs,
        cooldownSeconds,
      });

      setSuccessMsg('Camera settings & motion detection zone updated successfully.');
      await fetchCameras();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to update camera settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setSuccessMsg('Pinging camera feed...');
      const res = await cameraService.testConnection(selectedCameraId);
      setSuccessMsg(res.message);
    } catch {
      setErrorMsg('Camera connection test failed.');
    }
  };

  const activeCam = cameras.find((c) => c.id === selectedCameraId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Sliders className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
            Camera & Detection Settings
          </h1>
        </div>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Master Admin configuration for RTSP camera feeds, wheel-wash detection zone (ROI), motion sensitivity, and cooldown
        </p>
      </div>

      {/* Camera Location Selector Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        {cameras.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelectCamera(c.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
              selectedCameraId === c.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>CAM 0{c.id}: {c.locationName}</span>
            <StatusBadge status={c.status} showText={false} />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <form onSubmit={handleSave} className="space-y-5">
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

            {/* Camera Connection URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  RTSP Camera Feed URL
                </label>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Test Connection
                </button>
              </div>
              <input
                type="text"
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                placeholder="rtsp://admin:password@192.168.1.101:554/live/ch0"
                className="w-full text-xs font-mono rounded-lg border-slate-300 border px-3 py-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Backend connects directly via FFmpeg or in-memory gateway. Browser receives WebRTC/WebSocket frames.
              </span>
            </div>

            {/* Toggle Automatic Detection */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-800 block">Automatic Vehicle Detection</span>
                <span className="text-[11px] text-slate-500 block">
                  Automatically count vehicles passing through the wheel-wash zone
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={detectionEnabled}
                  onChange={(e) => setDetectionEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            {/* Detection Zone (ROI Coordinates %) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-blue-600" />
                Wheel-Wash Region of Interest (ROI % Bounds)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">X Offset (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={roiX}
                    onChange={(e) => setRoiX(Number(e.target.value))}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Y Offset (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={roiY}
                    onChange={(e) => setRoiY(Number(e.target.value))}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Width (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={roiW}
                    onChange={(e) => setRoiW(Number(e.target.value))}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Height (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={roiH}
                    onChange={(e) => setRoiH(Number(e.target.value))}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Sensitivity & Duration Sliders */}
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Motion Sensitivity Threshold ({sensitivity}%)</span>
                  <span className="font-mono text-blue-600">{sensitivity} / 100</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Higher threshold filters out rain, water spray reflections, and small birds.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Minimum Duration in Zone ({minDurationMs} ms)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="300"
                    max="5000"
                    value={minDurationMs}
                    onChange={(e) => setMinDurationMs(Number(e.target.value))}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Duration vehicle must stay in zone before triggering +1 event.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Duplicate Cooldown ({cooldownSeconds} sec)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={cooldownSeconds}
                    onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Wait period after zone clears before next vehicle can be counted.
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {isSaving ? 'Saving Camera Settings...' : 'Save Camera Settings'}
            </button>
          </form>
        </div>

        {/* Visual ROI Preview Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
            <CameraIcon className="w-4 h-4 text-blue-600" />
            Detection Area (ROI) Preview
          </h3>

          <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
            {/* Simulation of camera background */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950 opacity-90" />

            {/* Concrete bay line */}
            <div className="absolute bottom-10 left-0 right-0 h-16 bg-slate-700/40 border-t-2 border-dashed border-amber-400" />

            {/* ROI Bounding Box Overlay */}
            <div
              style={{
                left: `${roiX}%`,
                top: `${roiY}%`,
                width: `${roiW}%`,
                height: `${roiH}%`,
              }}
              className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/15 rounded flex items-center justify-center transition-all duration-150"
            >
              <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                COUNT ZONE
              </span>
            </div>

            <div className="absolute top-2 left-2 text-[10px] font-mono text-slate-400 bg-black/60 px-2 py-0.5 rounded">
              CAM 0{selectedCameraId} PREVIEW
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 block">Single Lane Passage Advice</span>
            <p className="text-[11px] text-slate-500">
              Motion detection cannot reliably distinguish truck classes. Position the ROI directly over the concrete wheel spray grates where passage is single-file.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
