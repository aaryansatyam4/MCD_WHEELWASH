import { db } from '../database/excelDb.js';
import { getKolkataTimestamp } from '../utils/dateUtils.js';
export class AuditService {
    static log(userId, action, details) {
        const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
        return db.recordAuditLog({
            user_id: userId,
            action,
            details: detailsStr,
            created_at: getKolkataTimestamp(),
        });
    }
    static getLogs(limit = 100) {
        const all = db.getAuditLogs();
        return all.slice(0, limit);
    }
}
