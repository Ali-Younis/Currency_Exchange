'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function TotpEnrollPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [enrollToken, setEnrollToken] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('enrollToken') ?? '';
    if (!token) { router.replace('/login'); return; }

    api.get(`/auth/totp/setup?enrollToken=${token}`)
      .then(({ data }) => {
        setQrDataUrl(data.qrDataUrl);
        setSecret(data.secret);
        setEnrollToken(data.enrollToken); // fresh token returned by setup endpoint
        sessionStorage.setItem('enrollToken', data.enrollToken);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setFetching(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/totp/enroll', { enrollToken, code });
      sessionStorage.removeItem('enrollToken');

      // Response is AuthResponse — store token + user
      if ('accessToken' in data) {
        setAuth(data.accessToken, data.user);
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a146e]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a146e]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-[#0a146e] mb-1">Set Up Authenticator</div>
          <div className="text-sm text-gray-400">
            Scan this QR code with Microsoft Authenticator or any TOTP app
          </div>
        </div>

        {qrDataUrl && (
          <div className="flex justify-center mb-4">
            <Image src={qrDataUrl} alt="TOTP QR Code" width={200} height={200} unoptimized />
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mb-4">
          Manual entry key: <span className="font-mono font-semibold tracking-widest">{secret}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enter the 6-digit code from your app
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              placeholder="000000"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-[#0a146e] hover:bg-[#070e57] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? '...' : 'Enable 2FA'}
          </button>
        </form>
      </div>
    </div>
  );
}
