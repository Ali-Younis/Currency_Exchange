'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  ClipboardList, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  BookOpen, BarChart2, Settings, LogOut, Users, Coins, TrendingUp, Landmark, Activity, Info,
} from 'lucide-react';

interface NavItem {
  key: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: <ClipboardList size={18} /> },
  { key: 'buy', href: '/buy', icon: <ArrowDownCircle size={18} /> },
  { key: 'sell', href: '/sell', icon: <ArrowUpCircle size={18} /> },
  { key: 'cross', href: '/cross', icon: <ArrowLeftRight size={18} /> },
  { key: 'ledger', href: '/ledger', icon: <BookOpen size={18} /> },
  { key: 'reports', href: '/reports', icon: <BarChart2 size={18} /> },
  { key: 'balances', href: '/balances', icon: <Landmark size={18} />, adminOnly: true },
  { key: 'currentBalances', href: '/current-balances', icon: <Activity size={18} />, adminOnly: true },
  { key: 'rates', href: '/rates', icon: <TrendingUp size={18} />, adminOnly: true },
  { key: 'currencies', href: '/currencies', icon: <Coins size={18} />, adminOnly: true },
  { key: 'users', href: '/users', icon: <Users size={18} />, adminOnly: true },
  { key: 'about', href: '/about', icon: <Info size={18} /> },
];

export function Sidebar() {
  const t = useTranslations('nav');
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === 'ADMIN';
  const [locale, setLocale] = useState<'en' | 'ar'>('en');
  const [logoB64, setLogoB64] = useState<string | null>(null);

  useEffect(() => {
    const stored = document.cookie
      .split('; ')
      .find((r) => r.startsWith('locale='))
      ?.split('=')[1];
    if (stored === 'en' || stored === 'ar') setLocale(stored);
  }, []);

  useEffect(() => {
    fetch('/api/v1/app-settings/public/logo')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.value) setLogoB64(d.value); })
      .catch(() => {});
  }, []);

  function switchLocale(l: 'en' | 'ar') {
    document.cookie = `locale=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-[#0a146e] text-white shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        {logoB64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoB64} alt="Logo" className="h-10 object-contain" />
        ) : (
          <>
            <div className="text-xl font-bold tracking-tight">Exchange</div>
            <div className="text-xs text-white/50 mt-0.5">Manager</div>
          </>
        )}
      </div>

      {/* User info */}
      <div className="px-6 py-4 border-b border-white/10">
        <div className="text-sm font-medium">{user?.fullName}</div>
        <div className="text-xs text-white/50 capitalize">{user?.role?.toLowerCase()}</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-0.5 px-3">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                {t(item.key as Parameters<typeof t>[0])}
              </Link>
            );
          })}
      </nav>

      {/* Settings + Logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        {/* Language switcher — visible to all roles */}
        <div className="flex gap-1 p-1 bg-white/10 rounded-lg mb-2">
          {(['en', 'ar'] as const).map((l) => (
            <button
              key={l}
              onClick={() => switchLocale(l)}
              className={`flex-1 text-xs py-1 rounded-md transition-colors ${
                locale === l ? 'bg-white text-[#0a146e] font-semibold' : 'text-white/70 hover:text-white'
              }`}
            >
              {l === 'en' ? 'EN' : 'عربية'}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Settings size={18} />
            {t('settings')}
          </Link>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          {t('logout')}
        </button>
      </div>
    </aside>
  );
}
