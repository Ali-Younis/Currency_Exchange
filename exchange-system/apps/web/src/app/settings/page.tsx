'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useState, useEffect, useRef } from 'react';

type Locale = 'en' | 'ar';

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((r) => r.startsWith(`${name}=`))
    ?.split('=')[1];
}

const API = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function getSetting(key: string): Promise<string | null> {
  const r = await fetch(`${API}/app-settings/${key}`, { headers: authHeaders() });
  if (!r.ok) return null;
  const d = await r.json();
  return d?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await fetch(`${API}/app-settings/${key}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ value }),
  });
}

export default function SettingsPage() {
  const [locale, setLocale] = useState<Locale>('en');

  // Logo
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // SMTP
  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', pass: '', from: '' });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    const stored = getCookie('locale') as Locale | undefined;
    if (stored === 'en' || stored === 'ar') setLocale(stored);
  }, []);

  useEffect(() => {
    getSetting('logo_base64').then((v) => { if (v) setLogoPreview(v); });
    Promise.all([
      getSetting('smtp_host'),
      getSetting('smtp_port'),
      getSetting('smtp_user'),
      getSetting('smtp_from'),
    ]).then(([host, port, user, from]) => {
      setSmtp((s) => ({
        ...s,
        host: host ?? '',
        port: port ?? '587',
        user: user ?? '',
        from: from ?? '',
      }));
    });
  }, []);

  function handleLocaleChange(l: Locale) {
    setLocale(l);
    setCookie('locale', l);
    window.location.reload();
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function saveLogo() {
    if (!logoPreview) return;
    setLogoSaving(true);
    await setSetting('logo_base64', logoPreview);
    setLogoSaving(false);
  }

  function removeLogo() {
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function saveSmtp() {
    setSmtpSaving(true);
    setSmtpMsg('');
    await Promise.all([
      setSetting('smtp_host', smtp.host),
      setSetting('smtp_port', smtp.port),
      setSetting('smtp_user', smtp.user),
      setSetting('smtp_pass', smtp.pass),
      setSetting('smtp_from', smtp.from),
    ]);
    setSmtpMsg('SMTP settings saved.');
    setSmtpSaving(false);
  }

  async function sendTestEmail() {
    setTestMsg('');
    const r = await fetch(`${API}/app-settings/email/test`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ to: testEmail }),
    });
    setTestMsg(r.ok ? 'Test email sent!' : 'Failed to send test email.');
  }

  return (
    <AppShell>
      <PageHeader title="Settings" />

      <div className="max-w-2xl space-y-6">
        {/* Language */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Display Language / لغة العرض</h3>
          <div className="flex gap-3">
            {(['en', 'ar'] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLocaleChange(l)}
                className={`flex-1 py-3 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  locale === l
                    ? 'border-[#0a146e] bg-[#0a146e] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-[#0a146e]'
                }`}
              >
                {l === 'en' ? 'English' : 'العربية'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Page will reload to apply the new language.
          </p>
        </div>

        {/* Logo */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Company Logo</h3>
          {logoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Logo preview" className="h-16 object-contain mb-4 border border-gray-100 rounded p-1" />
          )}
          <div className="flex gap-3 items-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleLogoFile}
              className="text-sm text-gray-600"
            />
            <button
              onClick={saveLogo}
              disabled={!logoPreview || logoSaving}
              className="px-4 py-2 text-sm bg-[#0a146e] text-white rounded-lg disabled:opacity-50"
            >
              {logoSaving ? 'Saving…' : 'Save Logo'}
            </button>
            {logoPreview && (
              <button onClick={removeLogo} className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">
                Remove
              </button>
            )}
          </div>
        </div>

        {/* SMTP */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">SMTP / Email Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'SMTP Host', key: 'host' as const },
              { label: 'SMTP Port', key: 'port' as const },
              { label: 'SMTP Username', key: 'user' as const },
              { label: 'From Address', key: 'from' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="text"
                  value={smtp[key]}
                  onChange={(e) => setSmtp((s) => ({ ...s, [key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">SMTP Password</label>
              <input
                type="password"
                value={smtp.pass}
                onChange={(e) => setSmtp((s) => ({ ...s, pass: e.target.value }))}
                placeholder="Leave blank to keep existing"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4 items-center">
            <button
              onClick={saveSmtp}
              disabled={smtpSaving}
              className="px-4 py-2 text-sm bg-[#0a146e] text-white rounded-lg disabled:opacity-50"
            >
              {smtpSaving ? 'Saving…' : 'Save SMTP'}
            </button>
            {smtpMsg && <span className="text-xs text-green-600">{smtpMsg}</span>}
          </div>

          {/* Test email */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Send a test email to verify SMTP settings:</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={sendTestEmail}
                disabled={!testEmail}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 disabled:opacity-50"
              >
                Send Test
              </button>
            </div>
            {testMsg && <p className="text-xs mt-2 text-blue-600">{testMsg}</p>}
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
          <dl className="text-sm space-y-1 text-gray-600">
            <div className="flex gap-2"><dt className="text-gray-400 w-32">System</dt><dd>Exchange Manager</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-32">Version</dt><dd>1.0.0</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-32">Base Currency</dt><dd>GBP (£)</dd></div>
          </dl>
        </div>
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    const stored = getCookie('locale') as Locale | undefined;
    if (stored === 'en' || stored === 'ar') setLocale(stored);
  }, []);

  function handleLocaleChange(l: Locale) {
    setLocale(l);
    setCookie('locale', l);
    window.location.reload();
  }

  return (
    <AppShell>
      <PageHeader title="Settings" />

      <div className="max-w-lg space-y-6">
        {/* Language */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Display Language / لغة العرض</h3>
          <div className="flex gap-3">
            {(['en', 'ar'] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLocaleChange(l)}
                className={`flex-1 py-3 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  locale === l
                    ? 'border-[#0a146e] bg-[#0a146e] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-[#0a146e]'
                }`}
              >
                {l === 'en' ? 'English' : 'العربية'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Page will reload to apply the new language.
          </p>
        </div>

        {/* About */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
          <dl className="text-sm space-y-1 text-gray-600">
            <div className="flex gap-2"><dt className="text-gray-400 w-32">System</dt><dd>Exchange Manager</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-32">Version</dt><dd>1.0.0</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-32">Base Currency</dt><dd>GBP (£)</dd></div>
          </dl>
        </div>
      </div>
    </AppShell>
  );
}
