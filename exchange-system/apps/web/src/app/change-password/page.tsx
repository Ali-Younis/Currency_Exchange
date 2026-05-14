'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('preAuthToken') ?? '';
    if (!token) router.replace('/login');
    setPreAuthToken(token);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!POLICY.test(newPassword)) {
      setError('Min 12 chars, uppercase, lowercase, digit & special character (@$!%*?&)');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password', { preAuthToken, newPassword });
      sessionStorage.removeItem('preAuthToken');

      if ('requiresEnrollment' in data) {
        sessionStorage.setItem('enrollToken', data.enrollToken);
        router.push('/totp-enroll');
      } else if ('requiresTotp' in data) {
        sessionStorage.setItem('preAuthToken', data.preAuthToken);
        router.push('/totp-verify');
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a146e]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-[#0a146e] mb-1">Change Password</div>
          <div className="text-sm text-gray-400">You must set a new password before continuing</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            />
          </div>

          <p className="text-xs text-gray-400">
            Min 12 chars · uppercase · lowercase · digit · special char (@$!%*?&)
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0a146e] hover:bg-[#070e57] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? '...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
