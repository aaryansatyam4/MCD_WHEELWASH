import { db } from '../database/excelDb.js';
import { getKolkataTimestamp } from '../utils/dateUtils.js';
import type { AuditLog } from '../models/types.js';

export class AuditService {
  public static log(userId: number | null, action: string, details: any): AuditLog {
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
    return db.recordAuditLog({
      user_id: userId,
      action,
      details: detailsStr,
      created_at: getKolkataTimestamp(),
    });
  }

  public static getLogs(limit = 100): AuditLog[] {
    const all = db.getAuditLogs();
    return all.slice(0, limit);
  }
}
