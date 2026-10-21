export type CameraStatus = 'online' | 'offline' | 'reconnecting' | 'error';

export type DetectionStage = 'IDLE' | 'ENTERED_ZONE' | 'IN_PASSAGE' | 'COOLDOWN';

export interface MotionDetectionConfig {
  roi: {
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    width: number; // percentage 0-100
    height: number; // percentage 0-100
  };
  sensitivity: number; // 1-100 (threshold for pixel difference)
  minDurationMs: number; // minimum time inside ROI to qualify as vehicle
  cooldownSeconds: number; // minimum wait after passage before next event
}

export interface StreamFrame {
  locationId: number;
  cameraId: number;
  timestamp: string;
  frameBase64: string; // data:image/jpeg;base64,... or binary
  motionScore: number;
  isVehicleDetected: boolean;
  stage: DetectionStage;
}
