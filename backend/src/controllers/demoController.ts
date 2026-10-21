import { Response } from 'express';
import { cameraManager } from '../camera/cameraManager.js';
import { db } from '../database/excelDb.js';
import { AuditService } from '../services/auditService.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class DemoController {
  /**
   * Protected demo endpoint to trigger simulated vehicle passage
   */
  public static async triggerPassage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const locationId = parseInt(req.body.locationId || req.query.locationId || '1', 10);
      const loc = db.getLocationById(locationId);

      if (!loc) {
        res.status(404).json({ error: `Location ${locationId} not found.` });
        return;
      }

      // If user is operator, restrict to their assigned location
      if (req.user?.role === 'operator' && req.user.assigned_location_id !== locationId) {
        res.status(403).json({ error: 'Cannot trigger simulation for unauthorized location.' });
        return;
      }

      const success = cameraManager.triggerSimulatedPassage(locationId);
      if (!success) {
        res.status(500).json({ error: 'Failed to trigger simulated passage.' });
        return;
      }

      AuditService.log(req.user ? req.user.id : null, 'DEMO_SIMULATION_TRIGGERED', {
        locationId,
        locationName: loc.name,
      });

      res.json({
        success: true,
        message: `Simulated truck passage initiated at ${loc.name}. Detection engine will evaluate passage.`,
        locationId,
        locationName: loc.name,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Demo simulation error.' });
    }
  }

  /**
   * Protected demo endpoint to trigger simulated worker/pedestrian walk (should be ignored by counter)
   */
  public static async triggerHumanWalk(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const locationId = parseInt(req.body.locationId || req.query.locationId || '1', 10);
      const loc = db.getLocationById(locationId);

      if (!loc) {
        res.status(404).json({ error: `Location ${locationId} not found.` });
        return;
      }

      if (req.user?.role === 'operator' && req.user.assigned_location_id !== locationId) {
        res.status(403).json({ error: 'Cannot trigger simulation for unauthorized location.' });
        return;
      }

      const success = cameraManager.triggerSimulatedHumanWalk(locationId);
      if (!success) {
        res.status(500).json({ error: 'Failed to trigger simulated human walk.' });
        return;
      }

      AuditService.log(req.user ? req.user.id : null, 'HUMAN_WALK_SIMULATION_TRIGGERED', {
        locationId,
        locationName: loc.name,
      });

      res.json({
        success: true,
        message: `Simulated pedestrian walk initiated at ${loc.name}. AI filter should ignore counter.`,
        locationId,
        locationName: loc.name,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Demo simulation error.' });
    }
  }

  /**
   * Reload database from the Excel file on disk (if user edited Excel directly)
   */
  public static async reloadDatabase(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await db.loadFromDisk();
      AuditService.log(req.user!.id, 'DATABASE_RELOADED_FROM_EXCEL', 'Database reloaded from disk Excel file');
      res.json({
        message: 'Database successfully reloaded from Excel file.',
        counts: {
          users: db.getUsers().length,
          locations: db.getLocations().length,
          cameras: db.getCameras().length,
          events: db.getVehicleEvents().length,
          adjustments: db.getCountAdjustments().length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reload database from Excel file.' });
    }
  }
}
