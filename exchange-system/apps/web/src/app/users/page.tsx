'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';
import { UserSummary, CreateUserDto } from '@exchange/shared';

const TELLER_PERMISSIONS = ['buy', 'sell', 'ledger', 'reports'] as const;

function UserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateUserDto & { password: string }>({  username: '',
    password: '',
    fullName: '',
    receiptAlias: '',
    role: 'TELLER',
    email: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/users', data),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to create user'));
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Create User</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Username</label>
            <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Full Name</label>
            <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Receipt Alias <span className="text-gray-400 normal-case">(shown on receipts — defaults to Full Name)</span></label>
            <input value={form.receiptAlias ?? ''} onChange={(e) => setForm((p) => ({ ...p, receiptAlias: e.target.value }))}
              placeholder={form.fullName || 'e.g. Ali Y.'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Role</label>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as 'ADMIN' | 'TELLER' }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]">
              <option value="TELLER">Teller</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}
            className="bg-[#0a146e] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#070e57] disabled:opacity-60">
            {mutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPanel({
  user,
  onClose,
  onSaved,
}: {
  user: UserSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [permissions, setPermissions] = useState<string[]>(user.permissions ?? []);
  const [forcePasswordChange, setForcePasswordChange] = useState(user.forcePasswordChange ?? false);
  const [email, setEmail] = useState(user.email ?? '');
  const [msg, setMsg] = useState('');

  const mutation = useMutation({
    mutationFn: (data: { permissions: string[]; forcePasswordChange: boolean; email?: string }) =>
      api.patch(`/users/${user.id}`, data),
    onSuccess: () => {
      setMsg('Saved!');
      onSaved();
      setTimeout(onClose, 800);
    },
  });

  const resetTotp = useMutation({
    mutationFn: () => api.patch(`/users/${user.id}`, { totpEnabled: false, totpSecret: null }),
    onSuccess: () => { setMsg('TOTP reset — user will re-enroll on next login.'); onSaved(); },
  });

  function togglePerm(p: string) {
    setPermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Edit: {user.fullName}</h2>
        <p className="text-xs text-gray-400 mb-4">@{user.username} · {user.role}</p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
          />
        </div>

        {user.role === 'TELLER' && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Section Access</p>
            <div className="grid grid-cols-2 gap-2">
              {TELLER_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p)}
                    onChange={() => togglePerm(p)}
                    className="rounded border-gray-300 text-[#0a146e] focus:ring-[#0a146e]"
                  />
                  <span className="capitalize">{p}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={forcePasswordChange}
              onChange={() => setForcePasswordChange((v) => !v)}
              className="rounded border-gray-300 text-[#0a146e] focus:ring-[#0a146e]"
            />
            Force password change on next login
          </label>
        </div>

        {user.totpEnabled && (
          <div className="mb-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">TOTP is enabled for this user.</p>
            <button
              onClick={() => resetTotp.mutate()}
              className="text-xs text-red-600 hover:underline"
            >
              Reset TOTP (user will re-enroll on next login)
            </button>
          </div>
        )}

        {msg && <p className="text-xs text-green-600 mb-3">{msg}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => mutation.mutate({ permissions, forcePasswordChange, email: email || undefined })}
            disabled={mutation.isPending}
            className="bg-[#0a146e] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#070e57] disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<UserSummary | null>(null);

  const { data: users, isLoading } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/users/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <AppShell>
      <PageHeader
        title="Users"
        actions={
          <button onClick={() => setShowAdd(true)}
            className="bg-[#0a146e] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#070e57]">
            + Add User
          </button>
        }
      />

      {showAdd && (
        <UserModal onClose={() => setShowAdd(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })} />
      )}
      {editUser && (
        <EditPanel
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0a146e] border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-200">
                <th className="text-left px-5 py-3">Username</th>
                <th className="text-left px-5 py-3">Full Name</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">TOTP</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono">{u.username}</td>
                  <td className="px-5 py-3">{u.fullName}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.email ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.totpEnabled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {u.totpEnabled ? 'Enrolled' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right flex gap-3 justify-end">
                    <button
                      onClick={() => setEditUser(u)}
                      className="text-xs text-[#0a146e] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

