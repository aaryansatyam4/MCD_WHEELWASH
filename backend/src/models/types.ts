export type UserRole = 'admin' | 'operator' | 'monitoring';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  assigned_location_id: number | null;
  active: number;
  must_change_password: number;
  created_at: string;
  last_login: string | null;
}

export interface UserSafe {
  id: number;
  username: string;
  role: UserRole;
  assigned_location_id: number | null;
  assigned_location_name?: string | null;
  active: number;
  must_change_password: number;
  created_at: string;
  last_login: string | null;
}

export interface Location {
  id: number;
  name: string;
  active: number;
}

export interface CameraSettings {
  roi: { x: number; y: number; width: number; height: number }; // Percentage 0-100 or pixels
  sensitivity: number; // 1-100
  minDurationMs: number;
  cooldownSeconds: number;
  direction?: 'left-to-right' | 'right-to-left' | 'any';
}

export interface CameraConfig {
  rtspUrl?: string;
  ip?: string;
  port?: number;
  username?: string;
  password?: string;
  channel?: number;
  streamType?: 'rtsp' | 'synthetic' | 'http';
}

export interface Camera {
  id: number;
  location_id: number;
  connection_configuration: string; // JSON string of CameraConfig
  detection_enabled: number;
  status: 'online' | 'offline' | 'reconnecting' | 'error';
  detection_settings: string; // JSON string of CameraSettings
}

export interface VehicleEvent {
  id: number;
  location_id: number;
  camera_id: number;
  event_timestamp: string; // YYYY-MM-DD HH:mm:ss in Asia/Kolkata
  detection_source: 'automatic' | 'demo_simulated';
}

export interface CountAdjustment {
  id: number;
  location_id: number;
  report_date: string; // YYYY-MM-DD
  adjustment: number; // e.g. +15 or -10
  previous_total: number;
  corrected_total: number;
  reason: string;
  modified_by: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  details: string;
  created_at: string;
}

export interface LocationCountSummary {
  locationId: number;
  locationName: string;
  todayCount: number;
  automaticCount: number;
  manualAdjustment: number;
  lastDetectionTime: string | null;
  cameraStatus: 'online' | 'offline' | 'reconnecting' | 'error';
  detectionActive: boolean;
}

export interface DashboardSummary {
  date: string;
  totalTrucksToday: number;
  locations: LocationCountSummary[];
  recentEvents: Array<{
    id: number;
    locationName: string;
    timestamp: string;
    source: string;
  }>;
}
