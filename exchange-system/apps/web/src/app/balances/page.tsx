'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import api from '@/lib/api';
import { CurrencyDto, OpeningBalanceDto } from '@exchange/shared';
import { CurrencyLabel } from '@/components/CurrencyLabel';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

interface HistoryEntry {
  id: string;
  createdAt: string;
  payload?: { currencyId?: string; amount?: string; sessionDate?: string } | null;
  user?: { username: string; fullName: string } | null;
}

export default function BalancesPage() {
  const t = useTranslations('balance');
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data: currencies } = useQuery<CurrencyDto[]>({
    queryKey: ['currencies'],
    queryFn: () => api.get('/currencies?active=true').then((r) => r.data),
  });

  const { data: balances } = useQuery<OpeningBalanceDto[]>({
    queryKey: ['opening-balances', date],
    queryFn: () => api.get(`/balances?date=${date}`).then((r) => r.data),
    select: (data) => data as OpeningBalanceDto[],
  });

  const { data: history } = useQuery<HistoryEntry[]>({
    queryKey: ['balances-history'],
    queryFn: () => api.get('/balances/history').then((r) => r.data),
    enabled: isAdmin,
  });

  const mutation = useMutation({
    mutationFn: (entries: Array<{ currencyId: string; amount: string }>) =>
      Promise.all(
        entries.map((e) =>
          api.post('/balances', { currencyId: e.currencyId, amount: e.amount, sessionDate: date }),
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opening-balances', date] });
      qc.invalidateQueries({ queryKey: ['balances-history'] });
      setAmounts({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function getExisting(currencyId: string) {
    const bal = balances?.find((b) => b.currencyId === currencyId);
    return bal?.amount ?? '';
  }

  function handleExportBalances() {
    const rows = currencies?.map((c) => ({
      Currency: c.code,
      Name: c.nameEn,
      Amount: amounts[c.id] ?? getExisting(c.id) ?? '0',
    })) ?? [];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Initial Balances');
    XLSX.writeFile(wb, `initial-balances-${date}.xlsx`);
  }

  function handleExportHistory() {
    const rows = (history ?? []).map((h) => {
      const ccy = currencies?.find((c) => c.id === h.payload?.currencyId);
      return {
        Date: new Date(h.createdAt).toLocaleString(),
        'Session Date': h.payload?.sessionDate ?? '—',
        Currency: ccy?.code ?? h.payload?.currencyId ?? '—',
        Amount: h.payload?.amount ?? '—',
        'Set By': h.user?.fullName ?? h.user?.username ?? '—',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Change History');
    XLSX.writeFile(wb, `balance-history.xlsx`);
  }

  function handleSave() {
    const entries = Object.entries(amounts)
      .filter(([currencyId, v]) => v !== '' && v !== getExisting(currencyId))
      .map(([currencyId, amount]) => ({ currencyId, amount }));
    if (entries.length > 0) mutation.mutate(entries);
  }

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        actions={
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
          />
        }
      />

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {t('saved')}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {currencies?.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <div className="w-44 text-sm text-gray-700 text-right">
                <CurrencyLabel code={c.code} nameEn={c.nameEn} countryCode={c.countryCode} />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amounts[c.id] ?? getExisting(c.id)}
                onChange={(e) => setAmounts((p) => ({ ...p, [c.id]: e.target.value }))}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="bg-[#0a146e] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#070e57] transition-colors disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save Balances'}
        </button>
        <button
          onClick={handleExportBalances}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          Export Excel
        </button>
      </div>

      {/* Change History (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mt-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Change History</h3>
            <button
              onClick={handleExportHistory}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Export Excel
            </button>
          </div>
          {history && history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <th className="text-left px-5 py-3">Date</th>
                    <th className="text-left px-5 py-3">Session Date</th>
                    <th className="text-left px-5 py-3">Currency</th>
                    <th className="text-right px-5 py-3">Amount</th>
                    <th className="text-left px-5 py-3">Set By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => {
                    const ccy = currencies?.find((c) => c.id === h.payload?.currencyId);
                    return (
                      <tr key={h.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-600">
                          {new Date(h.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{h.payload?.sessionDate ?? '—'}</td>
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {ccy?.code ?? h.payload?.currencyId ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">
                          {h.payload?.amount ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {h.user?.fullName ?? h.user?.username ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No history available.</p>
          )}
        </div>
      )}
    </AppShell>
  );
}
