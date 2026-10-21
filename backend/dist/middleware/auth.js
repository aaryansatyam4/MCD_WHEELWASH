import { verifyToken } from '../utils/jwtUtils.js';
import { db } from '../database/excelDb.js';
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Authentication required. No token provided.' });
        return;
    }
    const payload = verifyToken(token);
    if (!payload) {
        res.status(403).json({ error: 'Invalid or expired token.' });
        return;
    }
    const user = db.getUserById(payload.userId);
    if (!user || user.active !== 1) {
        res.status(403).json({ error: 'User account is inactive or no longer exists.' });
        return;
    }
    req.user = user;
    next();
}
/**
 * Middleware to restrict endpoints to specific roles
 */
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized. Please login.' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                error: `Permission denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
            });
            return;
        }
        next();
    };
}
/**
 * Middleware to enforce location-level access
 * Master Admin and Central Monitoring can access all locations.
 * Operators can ONLY access their assigned location.
 */
export function requireLocationAccess(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized.' });
        return;
    }
    // Admin and Monitoring can view/access all locations
    if (req.user.role === 'admin' || req.user.role === 'monitoring') {
        next();
        return;
    }
    // Operator must only access their assigned location
    const locationIdParam = req.params.locationId || req.query.locationId || req.body.locationId;
    if (locationIdParam) {
        const requestedLocId = parseInt(String(locationIdParam), 10);
        if (req.user.assigned_location_id !== requestedLocId) {
            res.status(403).json({
                error: `Access denied. You only have permission to access location ID ${req.user.assigned_location_id}.`,
            });
            return;
        }
    }
    next();
}
