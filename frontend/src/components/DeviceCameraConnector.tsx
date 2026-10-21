import React, { useState, useEffect, useRef } from 'react';
import { Camera, Bluetooth, Video, Play, Square, RefreshCw, X, Radio, CheckCircle, Smartphone } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext.js';

interface DeviceCameraConnectorProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: number;
  locationName: string;
}

export const DeviceCameraConnector: React.FC<DeviceCameraConnectorProps> = ({
  isOpen,
  onClose,
  locationId,
  locationName,
}) => {
  const { socket } = useSocket();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [fpsCount, setFpsCount] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const streamIntervalRef = useRef<any>(null);

  // Enumerate cameras (webcams, USB cams, Bluetooth cams, phone/continuity cams)
  const enumerateCameras = async () => {
    try {
      // Request initial permission to expose device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach((track) => track.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err: any) {
      setStreamError('Camera access permission denied or device not found.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      enumerateCameras();
    } else {
      stopStreaming();
    }
  }, [isOpen]);

  const startStreaming = async () => {
    setStreamError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId }, width: 640, height: 360 } : true,
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);

      // Canvas frame pump to backend via WebSockets
      const fps = 6;
      let framesSent = 0;
      const intervalMs = Math.round(1000 / fps);
      let prevRoiSampleBuffer: Uint8ClampedArray | null = null;

      streamIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current || !socket) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (video.videoWidth > 0 && video.videoHeight > 0 && ctx) {
          canvas.width = 640;
          canvas.height = 360;
          ctx.drawImage(video, 0, 0, 640, 360);

          // Optical Motion & Spatial Mass Analysis in the Wheel Wash Bay (ROI)
          // ROI: 20% to 80% horizontal, 30% to 80% vertical
          const roiX = 128;
          const roiY = 108;
          const roiW = 384;
          const roiH = 180;
          const step = 8; // 8px grid sampling

          const imgData = ctx.getImageData(roiX, roiY, roiW, roiH);
          const currentPixels = imgData.data;

          let movingCount = 0;
          let minX = roiW, maxX = 0, minY = roiH, maxY = 0;
          const totalSamples = (roiW / step) * (roiH / step);

          if (prevRoiSampleBuffer && prevRoiSampleBuffer.length === currentPixels.length) {
            for (let y = 0; y < roiH; y += step) {
              for (let x = 0; x < roiW; x += step) {
                const idx = (y * roiW + x) * 4;
                const rDiff = Math.abs(currentPixels[idx] - prevRoiSampleBuffer[idx]);
                const gDiff = Math.abs(currentPixels[idx + 1] - prevRoiSampleBuffer[idx + 1]);
                const bDiff = Math.abs(currentPixels[idx + 2] - prevRoiSampleBuffer[idx + 2]);
                const totalDiff = rDiff + gDiff + bDiff;

                // Threshold of change per pixel
                if (totalDiff > 45) {
                  movingCount++;
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }
          }

          // Save current buffer for next delta
          prevRoiSampleBuffer = new Uint8ClampedArray(currentPixels);

          let motionScore = 0;
          let spatialMassPercent = 0;
          let isHumanProfile = false;

          if (movingCount >= 6) {
            spatialMassPercent = Math.min(100, Math.round((movingCount / totalSamples) * 100));
            motionScore = Math.min(100, Math.round((movingCount / (totalSamples * 0.35)) * 100));

            const boxW = Math.max(1, maxX - minX);
            const boxH = Math.max(1, maxY - minY);
            const aspectRatio = boxW / boxH;

            // Strict Pedestrian vs Commercial Truck classification:
            // 1) Human: narrow/tall aspect ratio (< 0.85), small width (< 130px), or small area (< 28%)
            // 2) Truck: wide aspect ratio (>= 0.85), wide bounding span (>= 130px), and heavy mass (>= 28%)
            if (aspectRatio < 0.85 || spatialMassPercent < 28 || boxW < 130) {
              isHumanProfile = true;
            } else {
              isHumanProfile = false;
            }
          }

          const frameBase64 = canvas.toDataURL('image/jpeg', 0.65);

          // Emit to backend with optical classification telemetry
          socket.emit('camera:ingest_frame', {
            locationId,
            frameBase64,
            motionScore,
            spatialMassPercent,
            isHumanProfile,
          });

          framesSent++;
          setFpsCount(framesSent);
        }
      }, intervalMs);
    } catch (err: any) {
      setStreamError(err.message || 'Failed to start camera device.');
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (socket && isStreaming) {
      socket.emit('camera:disconnect_device', { locationId });
    }

    setIsStreaming(false);
    setFpsCount(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Connect Device Camera ({locationName})</h3>
              <p className="text-xs text-slate-400">
                Stream live from laptop webcam, USB, Bluetooth, or wireless camera
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopStreaming();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {streamError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {streamError}
            </div>
          )}

          {/* Device Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Select Video Source (Webcam / Bluetooth / USB)</span>
              <button
                type="button"
                onClick={enumerateCameras}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Scan Devices
              </button>
            </label>
            <select
              value={selectedDeviceId}
              disabled={isStreaming}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
            >
              {devices.length > 0 ? (
                devices.map((d, index) => (
                  <option key={d.deviceId || index} value={d.deviceId}>
                    {d.label || `Camera Device #${index + 1}`}
                  </option>
                ))
              ) : (
                <option value="">No cameras detected yet</option>
              )}
            </select>
          </div>

          {/* Live Video Preview Box */}
          <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${!isStreaming ? 'hidden' : ''}`}
            />

            {!isStreaming && (
              <div className="text-center text-slate-500 p-6">
                <Video className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-xs font-semibold text-slate-400">CAMERA PREVIEW READY</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Click 'Start Live Stream' to beam this camera to {locationName}
                </p>
              </div>
            )}

            {isStreaming && (
              <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  BEAMING TO {locationName}
                </span>
                <span className="px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                  {fpsCount} frames synced
                </span>
              </div>
            )}
          </div>

          {/* Hidden Canvas for Frame Processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Informational Banner */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900">
            <div className="font-bold flex items-center gap-1.5 mb-0.5">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              Live Control Room Synchronization
            </div>
            As soon as you start streaming, Master Admin and all monitoring dashboards will see your live camera view in <strong className="font-semibold">{locationName}</strong> automatically, and the in-memory motion detection will count passing trucks!
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {!isStreaming ? (
              <button
                type="button"
                onClick={startStreaming}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-4 h-4 fill-white" />
                Start Live Stream
              </button>
            ) : (
              <button
                type="button"
                onClick={stopStreaming}
                className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Square className="w-4 h-4 fill-white" />
                Stop Streaming (Revert to Virtual)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
