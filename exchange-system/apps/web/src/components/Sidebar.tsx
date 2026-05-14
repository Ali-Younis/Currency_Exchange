'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle,
  BookOpen, BarChart2, Settings, LogOut, Users, Coins, TrendingUp, Scale,
} from 'lucide-react';

interface NavItem {
  key: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { key: 'buy', href: '/buy', icon: <ArrowDownCircle size={18} /> },
  { key: 'sell', href: '/sell', icon: <ArrowUpCircle size={18} /> },
  { key: 'ledger', href: '/ledger', icon: <BookOpen size={18} /> },
  { key: 'reports', href: '/reports', icon: <BarChart2 size={18} /> },
  { key: 'balances', href: '/balances', icon: <Scale size={18} />, adminOnly: true },
  { key: 'rates', href: '/rates', icon: <TrendingUp size={18} />, adminOnly: true },
  { key: 'currencies', href: '/currencies', icon: <Coins size={18} />, adminOnly: true },
  { key: 'users', href: '/users', icon: <Users size={18} />, adminOnly: true },
];

export function Sidebar() {
  const t = useTranslations('nav');
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-[#0a146e] text-white shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-xl font-bold tracking-tight">Exchange</div>
        <div className="text-xs text-white/50 mt-0.5">Manager</div>
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
