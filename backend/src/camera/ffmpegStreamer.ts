import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class FFmpegStreamer {
  private locationId: number;
  private locationName: string;
  private rtspUrl: string;
  private process: ChildProcess | null = null;
  private isRunning: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private onFrameCallback?: (frameBuffer: Buffer) => void;
  private onStatusChangeCallback?: (status: 'online' | 'offline' | 'reconnecting' | 'error') => void;

  constructor(
    locationId: number,
    locationName: string,
    rtspUrl: string,
    onFrame?: (frameBuffer: Buffer) => void,
    onStatusChange?: (status: 'online' | 'offline' | 'reconnecting' | 'error') => void
  ) {
    this.locationId = locationId;
    this.locationName = locationName;
    this.rtspUrl = rtspUrl;
    this.onFrameCallback = onFrame;
    this.onStatusChangeCallback = onStatusChange;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.spawnFFmpeg();
  }

  private spawnFFmpeg(): void {
    if (!this.isRunning) return;

    logger.info(`Starting FFmpeg stream ingest for ${this.locationName} (${this.rtspUrl})`);
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback('reconnecting');
    }

    const args = [
      '-rtsp_transport', 'tcp',
      '-i', this.rtspUrl,
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-r', '5', // 5 frames per second
      '-q:v', '3',
      'pipe:1',
    ];

    try {
      this.process = spawn(config.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let buffer = Buffer.alloc(0);

      this.process.stdout?.on('data', (chunk: Buffer) => {
        if (this.onStatusChangeCallback) {
          this.onStatusChangeCallback('online');
        }

        buffer = Buffer.concat([buffer, chunk]);

        // Scan for JPEG SOI (0xFF, 0xD8) and EOI (0xFF, 0xD9) markers
        let startIndex = buffer.indexOf(Buffer.from([0xff, 0xd8]));
        while (startIndex !== -1) {
          const endIndex = buffer.indexOf(Buffer.from([0xff, 0xd9]), startIndex + 2);
          if (endIndex === -1) break;

          const frame = buffer.subarray(startIndex, endIndex + 2);
          if (this.onFrameCallback) {
            this.onFrameCallback(frame);
          }

          buffer = buffer.subarray(endIndex + 2);
          startIndex = buffer.indexOf(Buffer.from([0xff, 0xd8]));
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        logger.debug(`FFmpeg [${this.locationName}]: ${data.toString()}`);
      });

      this.process.on('close', (code) => {
        logger.warn(`FFmpeg process for ${this.locationName} exited with code ${code}`);
        if (this.onStatusChangeCallback) {
          this.onStatusChangeCallback('offline');
        }
        this.scheduleReconnect();
      });

      this.process.on('error', (err) => {
        logger.error(`FFmpeg process error for ${this.locationName}:`, err);
        if (this.onStatusChangeCallback) {
          this.onStatusChangeCallback('error');
        }
        this.scheduleReconnect();
      });
    } catch (err) {
      logger.error(`Failed to spawn FFmpeg for ${this.locationName}:`, err);
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback('error');
      }
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.isRunning) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    this.reconnectTimeout = setTimeout(() => {
      logger.info(`Attempting auto-reconnect for ${this.locationName} camera...`);
      this.spawnFFmpeg();
    }, 5000);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback('offline');
    }
  }
}
