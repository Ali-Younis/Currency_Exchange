'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import api from '@/lib/api';
import { SessionReport } from '@exchange/shared';

export default function ReportsPage() {
  const t = useTranslations('report');
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);

  const { data: report, isLoading } = useQuery<SessionReport>({
    queryKey: ['session-report', date],
    queryFn: () => api.get(`/reports/session?date=${date}`).then((r) => r.data),
  });

  async function handlePrint() {
    window.print();
  }

  async function handleExportPdf() {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Session Report – ${date}`, 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Currency', 'Opening', 'Total Buys', 'Total Sells', 'Closing']],
      body: report?.rows.map((r) => [
        r.currencyCode,
        r.openingBalance,
        r.totalBuys,
        r.totalSells,
        r.closingBalance,
      ]) ?? [],
    });
    doc.save(`session-report-${date}.pdf`);
  }

  return (
    <AppShell>
      <PageHeader
        title={t('session')}
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            />
            <button
              onClick={handleExportPdf}
              className="bg-[#0a146e] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#070e57] transition-colors"
            >
              {t('exportPdf')}
            </button>
            <button
              onClick={handlePrint}
              className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('print')}
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0a146e] border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a146e] text-white text-xs uppercase">
                  <th className="text-left px-5 py-4">{t('currency')}</th>
                  <th className="text-right px-5 py-4">{t('opening')}</th>
                  <th className="text-right px-5 py-4 text-green-300">{t('totalBuys')}</th>
                  <th className="text-right px-5 py-4 text-red-300">{t('totalSells')}</th>
                  <th className="text-right px-5 py-4">{t('closing')}</th>
                </tr>
              </thead>
              <tbody>
                {report?.rows.map((row) => (
                  <tr key={row.currencyId} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="font-bold text-gray-900">{row.currencyCode}</span>
                      <span className="text-gray-400 text-xs ms-2">{row.currencyNameEn}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.openingBalance}</td>
                    <td className="px-5 py-3 text-right text-green-600 font-medium">{row.totalBuys}</td>
                    <td className="px-5 py-3 text-right text-red-600 font-medium">{row.totalSells}</td>
                    <td className={`px-5 py-3 text-right font-bold text-lg ${
                      parseFloat(row.closingBalance) < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {row.closingBalance}
                    </td>
                  </tr>
                ))}
                {!report?.rows.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-12">
                      No data for {date}
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
