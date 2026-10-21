type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatTimestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[${formatTimestamp()}] [INFO] ${message}`, meta !== undefined ? meta : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[${formatTimestamp()}] [WARN] ${message}`, meta !== undefined ? meta : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[${formatTimestamp()}] [ERROR] ${message}`, error !== undefined ? error : '');
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${formatTimestamp()}] [DEBUG] ${message}`, meta !== undefined ? meta : '');
    }
  },
};
