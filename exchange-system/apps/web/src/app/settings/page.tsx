'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useState, useEffect } from 'react';

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
            Changing language will reload the page and apply RTL layout for Arabic.
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
