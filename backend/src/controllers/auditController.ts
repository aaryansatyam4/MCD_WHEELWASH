import { Response } from 'express';
import { db } from '../database/excelDb.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class AuditController {
  public static async getLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch audit logs.' });
    }
  }
}
