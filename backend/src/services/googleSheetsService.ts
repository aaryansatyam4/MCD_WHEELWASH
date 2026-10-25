import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { db } from '../database/excelDb.js';
import { CountService } from './countService.js';
import { getKolkataTimestamp } from '../utils/dateUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '..', '.env');

export class GoogleSheetsService {
  private static webhookUrl: string = process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
  private static lastSyncTime: string | null = null;
  private static lastSyncStatus: 'success' | 'error' | null = null;
  private static lastError: string | null = null;
  private static syncedPassageCount: number = 0;

  private static ensureUrl(): string {
    if (!this.webhookUrl && process.env.GOOGLE_SHEET_WEBHOOK_URL) {
      this.webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL.trim();
    }
    return this.webhookUrl;
  }

  public static isConfigured(): boolean {
    const url = this.ensureUrl();
    return Boolean(url && url.startsWith('https://script.google.com/'));
  }

  public static getWebhookUrl(): string {
    return this.ensureUrl();
  }

  public static getStatus() {
    const url = this.ensureUrl();
    return {
      configured: this.isConfigured(),
      webhookUrlMasked: url
        ? url.replace(/(macros\/s\/)[^/]+(\/exec)/, '$1••••••••$2')
        : null,
      lastSyncTime: this.lastSyncTime,
      lastSyncStatus: this.lastSyncStatus,
      lastError: this.lastError,
      syncedPassageCount: this.syncedPassageCount,
    };
  }

  public static async setWebhookUrl(url: string): Promise<{ success: boolean; message: string }> {
    const trimmed = url.trim();
    if (!trimmed) {
      this.webhookUrl = '';
      this.persistEnvVariable('GOOGLE_SHEET_WEBHOOK_URL', '');
      return { success: true, message: 'Google Sheets integration disabled.' };
    }

    if (!trimmed.startsWith('https://script.google.com/')) {
      throw new Error(
        'Invalid Google Apps Script Webhook URL. It must start with "https://script.google.com/macros/s/..."'
      );
    }

    // Test ping to verify the Google Apps Script endpoint is online and responding
    try {
      const response = await fetch(trimmed, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_ping', timestamp: getKolkataTimestamp() }),
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 401) {
        throw new Error(
          'Google returned HTTP 401 Unauthorized. In Apps Script, click "Deploy" > "Manage deployments" > Edit (Pencil), and change "Who has access" to "Anyone", then click Deploy.'
        );
      }

      if (!response.ok && response.status !== 302 && response.status !== 200) {
        throw new Error(`Google Sheet returned HTTP status ${response.status}`);
      }

      this.webhookUrl = trimmed;
      this.lastSyncTime = getKolkataTimestamp();
      this.lastSyncStatus = 'success';
      this.lastError = null;
      this.persistEnvVariable('GOOGLE_SHEET_WEBHOOK_URL', trimmed);

      // Perform initial full sync automatically so all existing data appears in the sheet
      this.syncFullDatabase().catch((err) => {
        logger.debug(`Initial Google Sheets background sync notice: ${(err as Error).message}`);
      });

      return {
        success: true,
        message: 'Connected to Google Sheets successfully! Initial data sync started.',
      };
    } catch (err: any) {
      this.lastError = err.message || 'Failed to connect to Google Sheets Webhook.';
      this.lastSyncStatus = 'error';
      throw new Error(this.lastError || 'Failed to connect to Google Sheets Webhook.');
    }
  }

  /**
   * Real-time sync when a vehicle passage is confirmed by CCTV / Motion Detector
   */
  public static async syncVehiclePassage(event: {
    id: number;
    timestamp: string;
    locationName: string;
    cameraId: number;
    detectionSource: string;
  }): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      await fetch(this.ensureUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vehicle_event',
          data: event,
        }),
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });

      this.syncedPassageCount++;
      this.lastSyncTime = getKolkataTimestamp();
      this.lastSyncStatus = 'success';
      logger.info(`[GOOGLE SHEETS] Synced vehicle event ID ${event.id} to Google Sheet`);
    } catch (err: any) {
      this.lastSyncStatus = 'error';
      this.lastError = err.message;
      logger.debug(`[GOOGLE SHEETS] Sync error on vehicle passage: ${err.message}`);
    }
  }

  /**
   * Real-time sync when an admin records a count adjustment
   */
  public static async syncCountAdjustment(adj: {
    id: number;
    reportDate: string;
    locationName: string;
    adjustment: number;
    previousTotal: number;
    correctedTotal: number;
    reason: string;
    modifiedBy: string;
    createdAt: string;
  }): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      await fetch(this.ensureUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'count_adjustment',
          data: adj,
        }),
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });

      this.lastSyncTime = getKolkataTimestamp();
      this.lastSyncStatus = 'success';
      logger.info(`[GOOGLE SHEETS] Synced count adjustment ID ${adj.id} to Google Sheet`);
    } catch (err: any) {
      this.lastSyncStatus = 'error';
      this.lastError = err.message;
      logger.debug(`[GOOGLE SHEETS] Sync error on count adjustment: ${err.message}`);
    }
  }

  /**
   * Real-time sync when an audit log is written
   */
  public static async syncAuditLog(log: {
    id: number;
    createdAt: string;
    userId: number | null;
    actionName: string;
    details: string;
  }): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      await fetch(this.ensureUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'audit_log',
          data: log,
        }),
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
    } catch (err: any) {
      logger.debug(`[GOOGLE SHEETS] Sync error on audit log: ${err.message}`);
    }
  }

  /**
   * Full database push: Synchronizes all locations, summary, passages, adjustments, and logs
   */
  public static async syncFullDatabase(): Promise<{
    success: boolean;
    message: string;
    rowsSynced: number;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Google Sheets integration is not configured. Provide a Webhook URL first.');
    }

    const summary = CountService.getDashboardSummary();
    const locations = db.getLocations();
    const locMap = new Map(locations.map((l) => [l.id, l.name]));

    const events = db.getVehicleEvents().map((e) => ({
      ...e,
      locationName: locMap.get(e.location_id) || `Location ${e.location_id}`,
    }));

    const adjustments = db.getCountAdjustments().map((a) => ({
      ...a,
      locationName: locMap.get(a.location_id) || `Location ${a.location_id}`,
    }));

    const auditLogs = db.getAuditLogs();

    const totalRows = (summary.locations?.length || 0) + events.length + adjustments.length + auditLogs.length;

    try {
      logger.info(`[GOOGLE SHEETS] Pushing full database (${totalRows} total records) to Google Sheets...`);
      const response = await fetch(this.ensureUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full_sync',
          data: {
            summary,
            events,
            adjustments,
            auditLogs,
          },
        }),
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 401) {
        throw new Error(
          'Google returned HTTP 401 Unauthorized. In Apps Script, click "Deploy" > "Manage deployments" > Edit (Pencil), and change "Who has access" to "Anyone", then click Deploy.'
        );
      }

      if (!response.ok && response.status !== 302 && response.status !== 200) {
        throw new Error(`Google Sheets responded with HTTP status ${response.status}`);
      }

      this.lastSyncTime = getKolkataTimestamp();
      this.lastSyncStatus = 'success';
      this.lastError = null;

      logger.info(`[GOOGLE SHEETS] Full database sync complete! Synced ${totalRows} rows.`);

      return {
        success: true,
        message: `Successfully synchronized ${totalRows} records into your Google Sheet tabs.`,
        rowsSynced: totalRows,
      };
    } catch (err: any) {
      this.lastSyncStatus = 'error';
      this.lastError = err.message || 'Full sync failed';
      throw new Error(`Full sync to Google Sheets failed: ${this.lastError}`);
    }
  }

  private static persistEnvVariable(key: string, val: string): void {
    try {
      let content = '';
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf8');
      }

      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${val}`);
      } else {
        content += (content.endsWith('\n') || !content ? '' : '\n') + `${key}=${val}\n`;
      }

      fs.writeFileSync(envPath, content, 'utf8');
    } catch (err) {
      logger.debug(`Could not update .env file: ${(err as Error).message}`);
    }
  }
}
