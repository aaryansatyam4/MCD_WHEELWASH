import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';
import type { StreamFrame, DashboardSummary } from '../types/index.js';

interface PassageNotification {
  locationId: number;
  locationName: string;
  timestamp: string;
  todayCount: number;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  cameraFrames: Record<number, StreamFrame>;
  lastPassage: PassageNotification | null;
  latestSummary: DashboardSummary | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [cameraFrames, setCameraFrames] = useState<Record<number, StreamFrame>>({});
  const [lastPassage, setLastPassage] = useState<PassageNotification | null>(null);
  const [latestSummary, setLatestSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    // In dev mode (port 5173), connect directly to backend (5001) for rock-solid stability; in production connect to same origin
    const socketUrl = window.location.port === '5173' ? 'http://127.0.0.1:5001' : undefined;

    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: token ? `Bearer ${token}` : undefined },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // Receive live in-memory camera video frame
    socketInstance.on('camera:frame', (frame: StreamFrame) => {
      setCameraFrames((prev) => ({
        ...prev,
        [frame.locationId]: frame,
      }));
    });

    // Receive vehicle detection event
    socketInstance.on('vehicle:detected', (data: PassageNotification) => {
      setLastPassage(data);
      // Auto-clear notification after 4 seconds
      setTimeout(() => {
        setLastPassage((curr) => (curr?.timestamp === data.timestamp ? null : curr));
      }, 4000);
    });

    // Receive updated count / summary
    socketInstance.on('count:updated', (data: DashboardSummary) => {
      setLatestSummary(data);
    });

    socketInstance.on('count:adjusted', (data: any) => {
      // Real-time toast or trigger
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        cameraFrames,
        lastPassage,
        latestSummary,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
