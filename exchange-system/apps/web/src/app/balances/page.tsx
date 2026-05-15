'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import api from '@/lib/api';
import { CurrencyDto, OpeningBalanceDto } from '@exchange/shared';

function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()].map((c) =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65),
  ).join('');
}

export default function BalancesPage() {
  const t = useTranslations('balance');
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

  const mutation = useMutation({
    mutationFn: (entries: Array<{ currencyId: string; amount: string }>) =>
      Promise.all(
        entries.map((e) =>
          api.post('/balances', { currencyId: e.currencyId, amount: e.amount, sessionDate: date }),
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opening-balances', date] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function getExisting(currencyId: string) {
    const bal = balances?.find((b) => b.currencyId === currencyId);
    return bal?.amount ?? '';
  }

  function handleSave() {
    const entries = Object.entries(amounts)
      .filter(([, v]) => v !== '')
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
              <div className="w-36 text-sm font-bold text-gray-700 text-right">
                <span className="me-1">{countryFlag(c.countryCode)}</span>{c.code}
                <span className="font-normal text-gray-500 ms-1">({c.nameEn})</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={getExisting(c.id) || '0.00'}
                value={amounts[c.id] ?? ''}
                onChange={(e) => setAmounts((p) => ({ ...p, [c.id]: e.target.value }))}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={mutation.isPending || Object.keys(amounts).length === 0}
          className="bg-[#0a146e] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#070e57] transition-colors disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save Balances'}
        </button>
      </div>
    </AppShell>
  );
}
