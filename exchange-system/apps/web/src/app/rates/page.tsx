'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import api from '@/lib/api';
import { CurrencyDto } from '@exchange/shared';
import { CurrencyLabel } from '@/components/CurrencyLabel';

interface RateRow {
  currency: CurrencyDto;
  rate: { buyRate: string; sellRate: string; effectiveDate: string } | null;
}

export default function RatesPage() {
  const t = useTranslations();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { buyRate: string; sellRate: string }>>({});
  const [saved, setSaved] = useState(false);

  const { data: rateData, isLoading } = useQuery<RateRow[]>({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get('/exchange-rates').then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (entries: Array<{ currencyId: string; buyRate: string; sellRate: string }>) =>
      Promise.all(entries.map((e) => api.post('/exchange-rates', e))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exchange-rates'] });
      setEdits({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSave() {
    const entries = Object.entries(edits)
      .filter(([, v]) => v.buyRate && v.sellRate)
      .map(([currencyId, v]) => ({ currencyId, ...v }));
    if (entries.length > 0) mutation.mutate(entries);
  }

  return (
    <AppShell>
      <PageHeader title={t('nav.rates')} />

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm">
          Rates saved successfully
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0a146e] border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-200">
                <th className="text-left px-5 py-3">Currency</th>
                <th className="text-right px-5 py-3 text-green-600">Buy Rate</th>
                <th className="text-right px-5 py-3 text-blue-600">Sell Rate</th>
                <th className="text-right px-5 py-3">Spread</th>
                <th className="px-5 py-3 text-gray-400">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {rateData?.filter(({ currency }) => currency.code !== 'GBP').map(({ currency, rate }) => {
                const edit = edits[currency.id];
                const buyDisplay = edit?.buyRate ?? rate?.buyRate ?? '';
                const sellDisplay = edit?.sellRate ?? rate?.sellRate ?? '';
                const spread = buyDisplay && sellDisplay
                  ? (parseFloat(sellDisplay) - parseFloat(buyDisplay)).toFixed(6)
                  : '—';
                return (
                  <tr key={currency.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <CurrencyLabel code={currency.code} nameEn={currency.nameEn} countryCode={currency.countryCode} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={edit?.buyRate ?? rate?.buyRate ?? ''}
                        onChange={(e) =>
                          setEdits((p) => ({
                            ...p,
                            [currency.id]: { buyRate: e.target.value, sellRate: edit?.sellRate ?? rate?.sellRate ?? '' },
                          }))
                        }
                        className="w-32 text-right border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0a146e]"
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={edit?.sellRate ?? rate?.sellRate ?? ''}
                        onChange={(e) =>
                          setEdits((p) => ({
                            ...p,
                            [currency.id]: { buyRate: edit?.buyRate ?? rate?.buyRate ?? '', sellRate: e.target.value },
                          }))
                        }
                        className="w-32 text-right border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0a146e]"
                      />
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-600">{spread}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {rate ? new Date(rate.effectiveDate).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={mutation.isPending || Object.keys(edits).length === 0}
              className="bg-[#0a146e] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#070e57] transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? 'Saving…' : 'Save Rates'}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
