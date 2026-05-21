'use client';

import { AppShell } from '@/components/AppShell';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import api from '@/lib/api';
import { SessionReport } from '@exchange/shared';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const todayStr = () => new Date().toISOString().split('T')[0];

interface CurrentBalanceRow {
  currencyId: string;
  currencyCode: string;
  currentBalance: string;
}

export default function DashboardPage() {
  const t = useTranslations();
  const today = todayStr();

  const { data: report, isLoading } = useQuery<SessionReport>({
    queryKey: ['session-report', today],
    queryFn: () => api.get(`/reports/session?date=${today}`).then((r) => r.data),
  });

  const { data: currentBalances } = useQuery<CurrentBalanceRow[]>({
    queryKey: ['current-balances'],
    queryFn: () => api.get('/balances/current').then((r) => r.data),
    refetchInterval: 10_000,
  });

  const currentBalanceMap = useMemo(
    () => new Map(currentBalances?.map((b) => [b.currencyId, b.currentBalance]) ?? []),
    [currentBalances],
  );

  function exportToExcel() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const rows = report?.rows.map((row) => ({
      Currency: row.currencyCode,
      'Buys (Today)': row.totalBuys,
      'Sells (Today)': row.totalSells,
      'Current Balance': currentBalanceMap.get(row.currencyId) ?? '0.00',
    })) ?? [];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Today's Transactions");
    XLSX.writeFile(wb, `Today-Transactions-${datePart}-${timePart}.xlsx`);
  }

  return (
    <AppShell permission="dashboard">
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0a146e] border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FileSpreadsheet size={13} />
              {t('dashboard.exportExcel')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="text-left px-5 py-3">Currency</th>
                  <th className="text-right px-5 py-3 text-green-600">Buys</th>
                  <th className="text-right px-5 py-3 text-red-600">Sells</th>
                  <th className="text-right px-5 py-3">Current Balance</th>
                </tr>
              </thead>
              <tbody>
                {report?.rows.map((row) => {
                  const currentBal = currentBalanceMap.get(row.currencyId) ?? '0.00';
                  return (
                  <tr key={row.currencyId} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{row.currencyCode}</td>
                    <td className="px-5 py-3 text-right text-green-600">{row.totalBuys}</td>
                    <td className="px-5 py-3 text-right text-red-600">{row.totalSells}</td>
                    <td
                      className={`px-5 py-3 text-right font-bold ${
                        parseFloat(currentBal) >= 0 ? 'text-gray-900' : 'text-red-600'
                      }`}
                    >
                      {currentBal}
                    </td>
                  </tr>
                  );
                })}
                {!report?.rows.length && (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 py-8">
                      No data for today
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

