import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/excelDb.js';
import { getKolkataTimestamp } from '../utils/dateUtils.js';
import { AuditService } from '../services/auditService.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { UserSafe } from '../models/types.js';

export class UserController {
  public static async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const users = db.getUsers();
      const locations = db.getLocations();

      const safeUsers: UserSafe[] = users.map((u) => {
        const loc = u.assigned_location_id ? locations.find((l) => l.id === u.assigned_location_id) : null;
        return {
          id: u.id,
          username: u.username,
          role: u.role,
          assigned_location_id: u.assigned_location_id,
          assigned_location_name: loc ? loc.name : null,
          active: u.active,
          must_change_password: u.must_change_password,
          created_at: u.created_at,
          last_login: u.last_login,
        };
      });

      res.json({ users: safeUsers });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch users.' });
    }
  }

  public static async createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { username, password, role, assigned_location_id } = req.body;

      if (!username || !password || !role) {
        res.status(400).json({ error: 'Username, password, and role are required.' });
        return;
      }

      const existing = db.getUserByUsername(username);
      if (existing) {
        res.status(400).json({ error: `Username "${username}" already exists.` });
        return;
      }

      if (role === 'operator' && !assigned_location_id) {
        res.status(400).json({ error: 'Operators must be assigned to a location.' });
        return;
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const newUser = db.createUser({
        username: username.toLowerCase().trim(),
        password_hash: passwordHash,
        role,
        assigned_location_id: role === 'operator' ? Number(assigned_location_id) : null,
        active: 1,
        must_change_password: 0,
        created_at: getKolkataTimestamp(),
        last_login: null,
      });

      AuditService.log(req.user!.id, 'CREATE_USER', {
        createdUserId: newUser.id,
        createdUsername: newUser.username,
        role: newUser.role,
      });

      res.status(201).json({
        message: 'User created successfully.',
        user: {
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
          assigned_location_id: newUser.assigned_location_id,
          active: newUser.active,
          must_change_password: newUser.must_change_password,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create user.' });
    }
  }

  public static async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { role, active, assigned_location_id } = req.body;

      const user = db.getUserById(id);
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      // Prevent disabling master admin
      if (user.username === 'admin' && active === 0) {
        res.status(400).json({ error: 'Master Admin account cannot be deactivated.' });
        return;
      }

      const updates: any = {};
      if (role !== undefined) updates.role = role;
      if (active !== undefined) updates.active = active ? 1 : 0;
      if (assigned_location_id !== undefined) {
        updates.assigned_location_id = assigned_location_id ? Number(assigned_location_id) : null;
      }

      const updated = db.updateUser(id, updates);

      AuditService.log(req.user!.id, 'UPDATE_USER', {
        targetUserId: id,
        targetUsername: user.username,
        updates,
      });

      res.json({
        message: 'User updated successfully.',
        user: updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update user.' });
    }
  }

  public static async resetPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { newPassword } = req.body;

      const user = db.getUserById(id);
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const passwordToSet = newPassword || '123456';
      const passwordHash = bcrypt.hashSync(passwordToSet, 10);

      db.updateUser(id, {
        password_hash: passwordHash,
        must_change_password: 0,
      });

      AuditService.log(req.user!.id, 'RESET_PASSWORD', {
        targetUserId: id,
        targetUsername: user.username,
      });

      res.json({
        message: `Password reset successfully for user "${user.username}" to 123456.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reset password.' });
    }
  }
}
