import React, { useState, useEffect } from 'react';
import { Users, UserPlus, KeyRound, Check, X, Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { userService } from '../services/api.js';
import type { UserSafe } from '../types/index.js';

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<UserSafe[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New User Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newRole, setNewRole] = useState<'admin' | 'operator' | 'monitoring'>('operator');
  const [newAssignedLoc, setNewAssignedLoc] = useState<number>(1);

  // Reset Password State
  const [resetModalUserId, setResetModalUserId] = useState<number | null>(null);
  const [resetPassValue, setResetPassValue] = useState('123456');

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await userService.getUsers();
      setUsers(res.users || []);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to fetch users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await userService.createUser({
        username: newUsername,
        password: newPassword,
        role: newRole,
        assigned_location_id: newRole === 'operator' ? newAssignedLoc : null,
      });

      setSuccessMsg(`User "${newUsername}" created successfully.`);
      setCreateModalOpen(false);
      setNewUsername('');
      await fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to create user.');
    }
  };

  const handleToggleActive = async (u: UserSafe) => {
    if (u.username === 'admin') {
      alert('Master admin cannot be deactivated.');
      return;
    }
    try {
      await userService.updateUser(u.id, { active: u.active === 1 ? 0 : 1 });
      await fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to toggle status.');
    }
  };

  const handleResetPassword = async () => {
    if (!resetModalUserId) return;
    try {
      await userService.resetPassword(resetModalUserId, resetPassValue);
      setSuccessMsg(`Password reset to "${resetPassValue}". User must change password upon next login.`);
      setResetModalUserId(null);
      await fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to reset password.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              User Management & Access Control
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Role-based authorization for Master Admin, Ghazipur/Okhla/Bhalaswa Operators, and Central Monitoring
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Create User Account
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase">Username</th>
              <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase">Role</th>
              <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase">Assigned Location</th>
              <th className="px-5 py-3 text-center font-bold text-slate-600 uppercase">Status</th>
              <th className="px-5 py-3 text-center font-bold text-slate-600 uppercase">Password Status</th>
              <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase">Last Login</th>
              <th className="px-5 py-3 text-right font-bold text-slate-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-5 py-3.5 font-bold text-slate-900">{u.username}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      u.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : u.role === 'monitoring'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-700 font-medium">
                  {u.assigned_location_name || (u.role === 'admin' || u.role === 'monitoring' ? 'All Locations (Central)' : '—')}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <button
                    onClick={() => handleToggleActive(u)}
                    disabled={u.username === 'admin'}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                      u.active === 1
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {u.active === 1 ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-center">
                  {u.must_change_password === 1 ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Must Change
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                      Secured
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                  {u.last_login ? u.last_login.split(' ')[1] : 'Never'}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => {
                      setResetModalUserId(u.id);
                      setResetPassValue('123456');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Reset Pass
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6">
            <h3 className="font-bold text-base text-slate-900 mb-4">Create New Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. shift_supervisor"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Initial Password</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Default: 123456"
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 font-medium"
                >
                  <option value="operator">Operator (Single Location Access)</option>
                  <option value="monitoring">Monitoring (All Locations, Read-Only)</option>
                  <option value="admin">Master Admin (Full System Control)</option>
                </select>
              </div>

              {newRole === 'operator' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assigned Location</label>
                  <select
                    value={newAssignedLoc}
                    onChange={(e) => setNewAssignedLoc(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 font-medium"
                  >
                    <option value={1}>GHAZIPUR</option>
                    <option value={2}>OKHLA</option>
                    <option value={3}>BHALASWA</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6">
            <h3 className="font-bold text-base text-slate-900 mb-2">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter a temporary password. The user will be required to change it on their next login.
            </p>
            <input
              type="text"
              value={resetPassValue}
              onChange={(e) => setResetPassValue(e.target.value)}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetModalUserId(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
