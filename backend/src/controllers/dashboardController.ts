import { Response } from 'express';
import { CountService } from '../services/countService.js';
import { db } from '../database/excelDb.js';
import { getKolkataDateString } from '../utils/dateUtils.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class DashboardController {
  public static async getSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const dateStr = (req.query.date as string) || getKolkataDateString();
      const fullSummary = CountService.getDashboardSummary(dateStr);

      // If user is location operator, filter down to their assigned location
      if (user.role === 'operator' && user.assigned_location_id) {
        const filteredLocations = fullSummary.locations.filter(
          (l) => l.locationId === user.assigned_location_id
        );
        const filteredEvents = fullSummary.recentEvents.filter(
          (e) => {
            const loc = db.getLocationById(user.assigned_location_id!);
            return loc && e.locationName === loc.name;
          }
        );
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
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch dashboard summary.' });
    }
  }

  public static async getHourly(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const dateStr = (req.query.date as string) || getKolkataDateString();
      const locationId = user.role === 'operator' && user.assigned_location_id
        ? user.assigned_location_id
        : req.query.locationId
        ? parseInt(String(req.query.locationId), 10)
        : undefined;

      const hourlyData = CountService.getHourlyCounts(dateStr, locationId);
      res.json({ date: dateStr, hourly: hourlyData });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch hourly counts.' });
    }
  }

  public static async getLocations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      let locations = db.getLocations().filter((l) => l.active === 1);

      if (user.role === 'operator' && user.assigned_location_id) {
        locations = locations.filter((l) => l.id === user.assigned_location_id);
      }

      res.json({ locations });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch locations.' });
    }
  }
}
