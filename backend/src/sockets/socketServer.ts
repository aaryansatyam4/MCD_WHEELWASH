import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from '../utils/jwtUtils.js';
import { logger } from '../utils/logger.js';
import type { StreamFrame } from '../camera/types.js';

let io: SocketIOServer | null = null;

// Callback registered by cameraManager to handle device camera frames
let onDeviceFrameHandler: ((
  locationId: number,
  frameBase64: string,
  clientMetrics?: {
    motionScore?: number;
    spatialMassPercent?: number;
    isHumanProfile?: boolean;
  }
) => void) | null = null;
let onDeviceDisconnectHandler: ((locationId: number) => void) | null = null;

export function registerDeviceCameraHandlers(
  onFrame: (
    locationId: number,
    frameBase64: string,
    clientMetrics?: {
      motionScore?: number;
      spatialMassPercent?: number;
      isHumanProfile?: boolean;
    }
  ) => void,
  onDisconnect: (locationId: number) => void
) {
  onDeviceFrameHandler = onFrame;
  onDeviceDisconnectHandler = onDisconnect;
}

export function initSocketServer(httpServer: HttpServer, corsOrigin: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Allow connections from frontend dev server or production host
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e7, // 10MB to accommodate high-res camera frames
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
    if (token) {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const payload = verifyToken(cleanToken);
      if (payload) {
        (socket as any).user = payload;
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`Socket client connected: ${socket.id} (${user ? user.username : 'anonymous'})`);

    // Receive live frame uploaded from a browser device camera (USB / Bluetooth / Webcam / Mobile)
    socket.on(
      'camera:ingest_frame',
      (data: {
        locationId: number;
        frameBase64: string;
        motionScore?: number;
        spatialMassPercent?: number;
        isHumanProfile?: boolean;
      }) => {
        if (data && data.locationId && data.frameBase64) {
          if (onDeviceFrameHandler) {
            onDeviceFrameHandler(data.locationId, data.frameBase64, {
              motionScore: data.motionScore,
              spatialMassPercent: data.spatialMassPercent,
              isHumanProfile: data.isHumanProfile,
            });
          }
        }
      }
    );

    socket.on('camera:disconnect_device', (data: { locationId: number }) => {
      if (data && data.locationId && onDeviceDisconnectHandler) {
        onDeviceDisconnectHandler(data.locationId);
      }
    });

    socket.on('join:location', (locationId: number) => {
      socket.join(`location_${locationId}`);
    });

    socket.on('leave:location', (locationId: number) => {
      socket.leave(`location_${locationId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast real-time camera video frame
 */
export function broadcastCameraFrame(frame: StreamFrame): void {
  if (!io) return;
  io.emit('camera:frame', frame);
}

/**
 * Broadcast vehicle detection event
 */
export function broadcastVehicleDetected(event: {
  locationId: number;
  locationName: string;
  timestamp: string;
  todayCount: number;
}): void {
  if (!io) return;
  io.emit('vehicle:detected', event);
}

/**
 * Broadcast count updated event
 */
export function broadcastCountUpdated(data: any): void {
  if (!io) return;
  io.emit('count:updated', data);
}

export function broadcastCountAdjusted(data: any): void {
  if (!io) return;
  io.emit('count:adjusted', data);
}

/**
 * Broadcast camera status change (online/offline/reconnecting)
 */
export function broadcastCameraStatus(data: {
  cameraId: number;
  locationId: number;
  status: string;
  source?: string;
}): void {
  if (!io) return;
  io.emit('camera:status', data);
}
