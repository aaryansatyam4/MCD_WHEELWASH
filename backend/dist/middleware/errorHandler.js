import { logger } from '../utils/logger.js';
export function errorHandler(err, req, res, next) {
    logger.error(`Unhandled error on ${req.method} ${req.url}:`, err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
}
