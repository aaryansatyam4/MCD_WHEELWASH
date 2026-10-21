import { CountService } from '../services/countService.js';
import { db } from '../database/excelDb.js';
import { getKolkataDateString } from '../utils/dateUtils.js';
export class DashboardController {
    static async getSummary(req, res) {
        try {
            const user = req.user;
            const dateStr = req.query.date || getKolkataDateString();
            const fullSummary = CountService.getDashboardSummary(dateStr);
            // If user is location operator, filter down to their assigned location
            if (user.role === 'operator' && user.assigned_location_id) {
                const filteredLocations = fullSummary.locations.filter((l) => l.locationId === user.assigned_location_id);
                const filteredEvents = fullSummary.recentEvents.filter((e) => {
                    const loc = db.getLocationById(user.assigned_location_id);
                    return loc && e.locationName === loc.name;
                });
                const operatorTotal = filteredLocations.reduce((sum, l) => sum + l.todayCount, 0);
                res.json({
                    date: dateStr,
                    totalTrucksToday: operatorTotal,
                    locations: filteredLocations,
                    recentEvents: filteredEvents,
                });
                return;
            }
            // Admin and Monitoring see all locations & combined total
            res.json(fullSummary);
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to fetch dashboard summary.' });
        }
    }
    static async getHourly(req, res) {
        try {
            const user = req.user;
            const dateStr = req.query.date || getKolkataDateString();
            const locationId = user.role === 'operator' && user.assigned_location_id
                ? user.assigned_location_id
                : req.query.locationId
                    ? parseInt(String(req.query.locationId), 10)
                    : undefined;
            const hourlyData = CountService.getHourlyCounts(dateStr, locationId);
            res.json({ date: dateStr, hourly: hourlyData });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to fetch hourly counts.' });
        }
    }
    static async getLocations(req, res) {
        try {
            const user = req.user;
            let locations = db.getLocations().filter((l) => l.active === 1);
            if (user.role === 'operator' && user.assigned_location_id) {
                locations = locations.filter((l) => l.id === user.assigned_location_id);
            }
            res.json({ locations });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to fetch locations.' });
        }
    }
}
