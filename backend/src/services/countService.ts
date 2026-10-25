import { db } from '../database/excelDb.js';
import { getKolkataDateString, getKolkataTimestamp } from '../utils/dateUtils.js';
import { AuditService } from './auditService.js';
import type {
  LocationCountSummary,
  DashboardSummary,
  CountAdjustment,
} from '../models/types.js';

export class CountService {
  /**
   * Get calculated count for a location on a specific date
   */
  public static getLocationCount(
    locationId: number,
    dateStr: string = getKolkataDateString()
  ): {
    total: number;
    automaticCount: number;
    manualAdjustment: number;
  } {
    const events = db.getEventsByLocationAndDate(locationId, dateStr);
    const automaticCount = events.length;

    const adjustments = db.getAdjustmentsByLocationAndDate(locationId, dateStr);
    const manualAdjustment = adjustments.reduce((sum, adj) => sum + adj.adjustment, 0);

    const total = Math.max(0, automaticCount + manualAdjustment);

    return {
      total,
      automaticCount,
      manualAdjustment,
    };
  }

  /**
   * Get entire dashboard summary for a date
   */
  public static getDashboardSummary(dateStr: string = getKolkataDateString()): DashboardSummary {
    const locations = db.getLocations().filter((l) => l.active === 1);
    const cameras = db.getCameras();

    const locationSummaries: LocationCountSummary[] = locations.map((loc) => {
      const counts = this.getLocationCount(loc.id, dateStr);
      const latestEvent = db.getLatestEventByLocation(loc.id);
      const cam = cameras.find((c) => c.location_id === loc.id);

      return {
        locationId: loc.id,
        locationName: loc.name,
        todayCount: counts.total,
        automaticCount: counts.automaticCount,
        manualAdjustment: counts.manualAdjustment,
        lastDetectionTime: latestEvent ? latestEvent.event_timestamp : null,
        cameraStatus: cam ? cam.status : 'offline',
        detectionActive: cam ? cam.detection_enabled === 1 : false,
      };
    });

    const totalTrucksToday = locationSummaries.reduce((sum, loc) => sum + loc.todayCount, 0);

    // Get 10 recent vehicle events across all locations
    const allEvents = db
      .getVehicleEvents()
      .sort((a, b) => b.event_timestamp.localeCompare(a.event_timestamp))
      .slice(0, 10)
      .map((e) => {
        const loc = locations.find((l) => l.id === e.location_id);
        return {
          id: e.id,
          locationName: loc ? loc.name : `Location #${e.location_id}`,
          timestamp: e.event_timestamp,
          source: e.detection_source,
        };
      });

    return {
      date: dateStr,
      totalTrucksToday,
      locations: locationSummaries,
      recentEvents: allEvents,
    };
  }

  /**
   * Get hourly truck movement for today or a specific date
   */
  public static getHourlyCounts(
    dateStr: string = getKolkataDateString(),
    locationId?: number
  ): Array<{ hour: string; ghazipur: number; okhla: number; bhalaswa: number; total: number }> {
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const allEvents = db.getVehicleEvents().filter((e) => e.event_timestamp.startsWith(dateStr));

    const result = hours.map((hour) => {
      const hourPrefix = `${dateStr} ${hour}:`;

      const ghazipurEvents = allEvents.filter(
        (e) => e.location_id === 1 && e.event_timestamp.startsWith(hourPrefix)
      ).length;

      const okhlaEvents = allEvents.filter(
        (e) => e.location_id === 2 && e.event_timestamp.startsWith(hourPrefix)
      ).length;

      const bhalaswaEvents = allEvents.filter(
        (e) => e.location_id === 3 && e.event_timestamp.startsWith(hourPrefix)
      ).length;

      const total = ghazipurEvents + okhlaEvents + bhalaswaEvents;

      return {
        hour: `${hour}:00`,
        ghazipur: ghazipurEvents,
        okhla: okhlaEvents,
        bhalaswa: bhalaswaEvents,
        total,
      };
    });

    return result;
  }

  /**
   * Record manual count adjustment by Master Admin
   */
  public static adjustCount(params: {
    locationId: number;
    reportDate: string;
    newCount: number;
    reason: string;
    adminUserId: number;
  }): CountAdjustment {
    const { locationId, reportDate, newCount, reason, adminUserId } = params;

    const loc = db.getLocationById(locationId);
    if (!loc) {
      throw new Error(`Location ID ${locationId} not found`);
    }

    if (newCount < 0) {
      throw new Error('Truck count cannot be negative');
    }

    const currentData = this.getLocationCount(locationId, reportDate);
    const previousTotal = currentData.total;
    const diff = newCount - previousTotal;

    const adjustment = db.recordCountAdjustment({
      location_id: locationId,
      report_date: reportDate,
      adjustment: diff,
      previous_total: previousTotal,
      corrected_total: newCount,
      reason,
      modified_by: adminUserId,
      created_at: getKolkataTimestamp(),
    });

    // Record audit log
    AuditService.log(adminUserId, 'COUNT_ADJUSTMENT', {
      locationId,
      locationName: loc.name,
      reportDate,
      previousTotal,
      newCount,
      difference: diff,
      reason,
    });

    return adjustment;
  }
}
