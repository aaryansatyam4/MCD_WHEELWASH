import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '../utils/jwtUtils.js';
import { logger } from '../utils/logger.js';
let io = null;
// Callback registered by cameraManager to handle device camera frames
let onDeviceFrameHandler = null;
let onDeviceDisconnectHandler = null;
export function registerDeviceCameraHandlers(onFrame, onDisconnect) {
    onDeviceFrameHandler = onFrame;
    onDeviceDisconnectHandler = onDisconnect;
}
export function initSocketServer(httpServer, corsOrigin) {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: '*', // Allow connections from frontend dev server or production host
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        maxHttpBufferSize: 1e7, // 10MB to accommodate high-res camera frames
    });
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
        if (token) {
            const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            const payload = verifyToken(cleanToken);
            if (payload) {
                socket.user = payload;
            }
        }
        next();
    });
    io.on('connection', (socket) => {
        const user = socket.user;
        logger.info(`Socket client connected: ${socket.id} (${user ? user.username : 'anonymous'})`);
        // Receive live frame uploaded from a browser device camera (USB / Bluetooth / Webcam / Mobile)
        socket.on('camera:ingest_frame', (data) => {
            if (data && data.locationId && data.frameBase64) {
                if (onDeviceFrameHandler) {
                    onDeviceFrameHandler(data.locationId, data.frameBase64);
                }
            }
        });
        socket.on('camera:disconnect_device', (data) => {
            if (data && data.locationId && onDeviceDisconnectHandler) {
                onDeviceDisconnectHandler(data.locationId);
            }
        });
        socket.on('join:location', (locationId) => {
            socket.join(`location_${locationId}`);
        });
        socket.on('leave:location', (locationId) => {
            socket.leave(`location_${locationId}`);
        });
        socket.on('disconnect', () => {
            logger.info(`Socket client disconnected: ${socket.id}`);
        });
    });
    return io;
}
export function getIO() {
    return io;
}
/**
 * Broadcast real-time camera video frame
 */
export function broadcastCameraFrame(frame) {
    if (!io)
        return;
    io.emit('camera:frame', frame);
}
/**
 * Broadcast vehicle detection event
 */
export function broadcastVehicleDetected(event) {
    if (!io)
        return;
    io.emit('vehicle:detected', event);
}
/**
 * Broadcast count updated event
 */
export function broadcastCountUpdated(data) {
    if (!io)
        return;
    io.emit('count:updated', data);
}
export function broadcastCountAdjusted(data) {
    if (!io)
        return;
    io.emit('count:adjusted', data);
}
/**
 * Broadcast camera status change (online/offline/reconnecting)
 */
export function broadcastCameraStatus(data) {
    if (!io)
        return;
    io.emit('camera:status', data);
}
