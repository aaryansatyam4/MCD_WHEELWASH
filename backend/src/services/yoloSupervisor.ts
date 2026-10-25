import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { isYoloAvailable } from './yoloDetector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const yoloDir = path.resolve(__dirname, '..', '..', 'yolo');

let yoloProc: ChildProcess | null = null;

/**
 * Ensures the YOLO26 FastAPI detection sidecar is running on port 5002.
 * If already active (e.g. started via Docker, PM2, or manually), it reuses it.
 * Otherwise, it automatically spawns and supervises python3 detect_server.py.
 */
export async function ensureYoloService(): Promise<boolean> {
  const alreadyUp = await isYoloAvailable();
  if (alreadyUp) {
    logger.info('YOLO26 detection sidecar is online and healthy on port 5002.');
    return true;
  }

  logger.info('YOLO26 sidecar not detected. Automatically launching managed YOLO process...');
  try {
    yoloProc = spawn('python3', ['detect_server.py'], {
      cwd: yoloDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '5002' },
    });

    yoloProc.stdout?.on('data', (data: Buffer) => {
      logger.info(`[yolo] ${data.toString().trim()}`);
    });

    yoloProc.stderr?.on('data', (data: Buffer) => {
      logger.debug(`[yolo:log] ${data.toString().trim()}`);
    });

    yoloProc.on('exit', (code) => {
      logger.warn(`YOLO sidecar process exited with code ${code}`);
      yoloProc = null;
    });

    // Poll health endpoint for up to 6 seconds until model weights load
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (await isYoloAvailable()) {
        logger.info('YOLO26 sidecar model warm and verified healthy on port 5002.');
        return true;
      }
    }
  } catch (err) {
    logger.warn(`Failed to auto-spawn python3 detect_server.py: ${(err as Error).message}`);
  }

  return false;
}

export function stopYoloService(): void {
  if (yoloProc) {
    try {
      yoloProc.kill('SIGTERM');
      const forceTimer = setTimeout(() => {
        try {
          if (yoloProc && !yoloProc.killed) yoloProc.kill('SIGKILL');
        } catch {
          // ignore
        }
      }, 2000);
      forceTimer.unref();
    } catch (e) {
      logger.debug(`Error stopping YOLO process: ${(e as Error).message}`);
    }
    yoloProc = null;
  }
}
