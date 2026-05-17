'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { CurrencyLabel } from '@/components/CurrencyLabel';

interface CurrentBalanceRow {
  currencyId: string;
  currencyCode: string;
  currencyNameEn: string;
  currencyNameAr: string;
  symbol: string;
  countryCode: string | null;
  openingBalance: string;
  totalBuys: string;
  totalSells: string;
  currentBalance: string;
}

function BalanceCell({ value }: { value: string }) {
  const num = parseFloat(value);
  return (
    <span className={num < 0 ? 'text-red-600' : 'text-gray-800'}>
      {formatNumber(num)}
    </span>
  );
}

export default function CurrentBalancesPage() {
  const today = new Date().toISOString().split('T')[0];

  const { data, isLoading, dataUpdatedAt } = useQuery<CurrentBalanceRow[]>({
    queryKey: ['current-balances', today],
    queryFn: () => api.get('/balances/current').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-GB')
    : '—';

  return (
    <AppShell>
      <PageHeader title="Current Balances" />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Session: {today}</p>
        <p className="text-xs text-gray-400">
          Auto-refreshes every 30s · Last updated: {lastUpdated}
        </p>
      </div>

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
                <th className="text-right px-5 py-3">Opening</th>
                <th className="text-right px-5 py-3">+ Buys</th>
                <th className="text-right px-5 py-3">− Sells</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-700">Current</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => (
                <tr key={row.currencyId} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <CurrencyLabel code={row.currencyCode} nameEn={row.currencyNameEn} countryCode={row.countryCode} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <BalanceCell value={row.openingBalance} />
                  </td>
                  <td className="px-5 py-3 text-right text-green-700">
                    + {formatNumber(parseFloat(row.totalBuys))}
                  </td>
                  <td className="px-5 py-3 text-right text-red-600">
                    − {formatNumber(parseFloat(row.totalSells))}
                  </td>
                  <td className="px-5 py-3 text-right font-bold">
                    <BalanceCell value={row.currentBalance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
