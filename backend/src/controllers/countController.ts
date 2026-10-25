import { Response } from 'express';
import { CountService } from '../services/countService.js';
import { db } from '../database/excelDb.js';
import { getKolkataDateString } from '../utils/dateUtils.js';
import { broadcastCountAdjusted, broadcastCountUpdated } from '../sockets/socketServer.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class CountController {
  public static async getToday(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const todayStr = getKolkataDateString();
      const user = req.user!;
      const summary = CountService.getDashboardSummary(todayStr);

      if (user.role === 'operator' && user.assigned_location_id) {
        const filtered = summary.locations.filter((l) => l.locationId === user.assigned_location_id);
        res.json({ date: todayStr, counts: filtered });
        return;
      }

      res.json({ date: todayStr, counts: summary.locations, totalTrucksToday: summary.totalTrucksToday });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch counts.' });
    }
  }

  public static async getByLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const locationId = parseInt(req.params.locationId, 10);
      const dateStr = (req.query.date as string) || getKolkataDateString();

      // Check permission for operators
      if (req.user?.role === 'operator' && req.user.assigned_location_id !== locationId) {
        res.status(403).json({ error: 'Access denied to this location.' });
        return;
      }

      const loc = db.getLocationById(locationId);
      if (!loc) {
        res.status(404).json({ error: 'Location not found.' });
        return;
      }

      const counts = CountService.getLocationCount(locationId, dateStr);
      res.json({
        locationId,
        locationName: loc.name,
        date: dateStr,
        ...counts,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch location count.' });
    }
  }

  public static async adjust(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { locationId, reportDate, newCount, reason } = req.body;

      if (!locationId || reportDate === undefined || newCount === undefined || !reason) {
        res.status(400).json({
          error: 'Missing required parameters: locationId, reportDate, newCount, and reason are mandatory.',
        });
        return;
      }

      const locId = parseInt(locationId, 10);
      const countNum = parseInt(newCount, 10);

      if (isNaN(countNum) || countNum < 0) {
        res.status(400).json({ error: 'New truck count must be a non-negative number.' });
        return;
      }

      if (typeof reason !== 'string' || reason.trim().length < 3) {
        res.status(400).json({ error: 'Please provide a valid descriptive reason for the manual adjustment.' });
        return;
      }

      const adjustment = CountService.adjustCount({
        locationId: locId,
        reportDate,
        newCount: countNum,
        reason: reason.trim(),
        adminUserId: req.user!.id,
      });

      // Fetch fresh dashboard data to broadcast
      const updatedSummary = CountService.getDashboardSummary(reportDate);

      // Broadcast real-time adjustments to all connected operators and monitors
      broadcastCountAdjusted({
        adjustmentId: adjustment.id,
        locationId: locId,
        reportDate,
        previousTotal: adjustment.previous_total,
        correctedTotal: adjustment.corrected_total,
        difference: adjustment.adjustment,
        reason: adjustment.reason,
        adminUsername: req.user!.username,
      });

      broadcastCountUpdated(updatedSummary);

      res.json({
        message: 'Truck count adjusted successfully.',
        adjustment,
        newReportedCount: countNum,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to adjust count.' });
    }
  }

  public static async getAdjustments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      let adjustments = db.getCountAdjustments();
      const locations = db.getLocations();
      const users = db.getUsers();

      // Location operators see only their location adjustments
      if (user.role === 'operator' && user.assigned_location_id) {
        adjustments = adjustments.filter((a) => a.location_id === user.assigned_location_id);
      }

      const enriched = adjustments
        .map((a) => {
          const loc = locations.find((l) => l.id === a.location_id);
          const u = users.find((usr) => usr.id === a.modified_by);
          return {
            ...a,
            locationName: loc ? loc.name : `Location ${a.location_id}`,
            adminUsername: u ? u.username : 'admin',
          };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      res.json({ adjustments: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch adjustments.' });
    }
  }
}
