import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { Users, Shield, Plus, CheckCircle2, AlertTriangle, Key, UserCheck, ShieldAlert, X } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getUsers();
      setUsers(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.createUser({
        username: newUsername,
        email: newEmail || undefined,
        password: newPassword,
        role: newRole,
      });
      setSuccessMsg(`User '${newUsername}' successfully created with role '${newRole}'.`);
      setShowAddModal(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create user.');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              User & Access Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Enforce enterprise Role-Based Access Control (RBAC) across inventory operations and ledger audits.
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Role Definitions Cards (Fully Colored) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-gradient-to-br from-indigo-700 to-indigo-800 text-white border border-indigo-600/40 rounded-2xl shadow-md relative overflow-hidden">
          <div className="flex items-center gap-2.5 text-white font-bold mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center backdrop-blur-xs">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-base">Administrator Role</span>
          </div>
          <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
            Full operational authorization: Record stock inward, execute stock outward, perform balance adjustments,
            commit Excel workbook imports, and manage user accounts.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 bg-white/20 text-white border border-white/20 rounded-lg font-medium">Inward / Outward</span>
            <span className="px-2.5 py-1 bg-white/20 text-white border border-white/20 rounded-lg font-medium">Stock Adjustments</span>
            <span className="px-2.5 py-1 bg-white/20 text-white border border-white/20 rounded-lg font-medium">Excel Import</span>
            <span className="px-2.5 py-1 bg-white/20 text-white border border-white/20 rounded-lg font-medium">User CRUD</span>
          </div>
        </div>

        <div className="p-6 bg-gradient-to-br from-slate-700 to-slate-800 text-white border border-slate-600/40 rounded-2xl shadow-md relative overflow-hidden">
          <div className="flex items-center gap-2.5 text-white font-bold mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center backdrop-blur-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <span className="text-base">Viewer Role</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            Read-only analytical access: View catalogue, monitor dashboard KPIs, inspect stock summary tables, trace SKU
            transaction ledgers, and download CSV/XLSX export reports.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 bg-white/20 text-white border border-white/20 rounded-lg font-medium">Read Catalogue</span>
            <span className="px-2.5 py-1 bg-white/20 text-white border border-white/20 rounded-lg font-medium">Analytics & KPIs</span>
            <span className="px-2.5 py-1 bg-white/20 text-white border border-white/20 rounded-lg font-medium">Export Reports</span>
            <span className="px-2.5 py-1 bg-rose-500/30 text-rose-200 border border-rose-400/30 rounded-lg font-medium">Mutations Blocked</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            <span>Configured System Accounts</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono font-medium">{users.length} registered accounts</span>
        </div>

        {!isAdmin ? (
          <div className="p-12 text-center text-slate-500 text-xs sm:text-sm">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            You are currently logged in with the <strong>Viewer</strong> role. Only administrators can view the complete
            list of registered system users.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] uppercase font-semibold">
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">Loading user accounts...</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">#{u.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span>{u.username}</span>
                        {u.username === currentUser?.username && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 rounded-full font-semibold">
                            Current Session
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            u.role === 'admin'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>Active</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create User */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              <span>Create System User</span>
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Add a new authenticated operator or analytical viewer account.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="e.g. warehouse_manager"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="manager@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">System Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="viewer">Viewer (Read-only access)</option>
                  <option value="admin">Administrator (Full mutation & admin rights)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

