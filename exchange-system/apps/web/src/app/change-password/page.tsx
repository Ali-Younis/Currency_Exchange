'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Check } from 'lucide-react';
import api from '@/lib/api';

const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

const RULES = [
  { label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /\d/.test(p) },
  { label: 'Special character (@$!%*?&)', test: (p: string) => /[@$!%*?&]/.test(p) },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
      setError('Password does not meet all requirements');
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
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e] focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Password complexity checklist */}
          {newPassword.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
              {RULES.map((rule) => {
                const ok = rule.test(newPassword);
                return (
                  <li key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                    <Check size={13} className={`shrink-0 ${ok ? 'text-green-500' : 'text-gray-300'}`} />
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e] focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

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
