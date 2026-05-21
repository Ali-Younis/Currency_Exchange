'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-gray-500">
      <span className="text-xs">{new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <span className="font-mono text-sm font-semibold text-[#0a146e] bg-[#0a146e]/5 px-2.5 py-0.5 rounded-md tracking-wider">{time}</span>
    </div>
  );
}

export function AppShell({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push('/login'); return; }
    // Block tellers from sections they don't have permission for
    if (permission && user.role !== 'ADMIN' && !user.permissions?.includes(permission)) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router, permission]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0a146e] border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-end px-6 py-2.5 border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <LiveClock />
        </header>
        <div className="flex-1 p-6 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
