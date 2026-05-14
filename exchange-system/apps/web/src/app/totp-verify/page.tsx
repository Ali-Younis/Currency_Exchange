'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function TotpVerifyPage() {
  const router = useRouter();
  const [preAuthToken, setPreAuthToken] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('preAuthToken') ?? '';
    if (!token) router.replace('/login');
    setPreAuthToken(token);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/totp/verify', { preAuthToken, code });
      sessionStorage.removeItem('preAuthToken');

      if ('accessToken' in data) {
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Invalid code. Please try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a146e]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-[#0a146e] mb-1">Two-Factor Authentication</div>
          <div className="text-sm text-gray-400">
            Enter the 6-digit code from your authenticator app
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            placeholder="000000"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-[#0a146e] hover:bg-[#070e57] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? '...' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => { sessionStorage.clear(); router.push('/login'); }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
          >
            ← Back to login
          </button>
        </form>
      </div>
    </div>
  );
}
