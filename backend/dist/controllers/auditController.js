import { db } from '../database/excelDb.js';
export class AuditController {
    static async getLogs(req, res) {
        try {
            const logs = db.getAuditLogs().filter((l) => l.action !== 'COUNT_ADJUSTMENT');
            const users = db.getUsers();
            const enriched = logs.map((l) => {
                const u = l.user_id ? users.find((usr) => usr.id === l.user_id) : null;
                return {
                    ...l,
                    username: u ? u.username : 'SYSTEM',
                };
            });
            res.json({ logs: enriched });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to fetch audit logs.' });
        }
    }
}
