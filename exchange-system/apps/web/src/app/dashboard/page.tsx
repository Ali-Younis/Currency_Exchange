'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { SessionReport, EndOfDayReport, VolumeReport } from '@exchange/shared';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const todayStr = () => new Date().toISOString().split('T')[0];
const sevenDaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
};

export default function DashboardPage() {
  const t = useTranslations();
  const today = todayStr();

  const { data: report, isLoading } = useQuery<SessionReport>({
    queryKey: ['session-report', today],
    queryFn: () => api.get(`/reports/session?date=${today}`).then((r) => r.data),
  });

  const { data: eod } = useQuery<EndOfDayReport>({
    queryKey: ['eod-report', today],
    queryFn: () => api.get(`/reports/end-of-day?date=${today}`).then((r) => r.data),
  });

  const { data: weekVolume } = useQuery<VolumeReport>({
    queryKey: ['volume-report-week', sevenDaysAgo(), today, 'day'],
    queryFn: () =>
      api
        .get(`/reports/volume?startDate=${sevenDaysAgo()}&endDate=${today}&groupBy=day`)
        .then((r) => r.data),
  });

  const totalBuysGbp =
    report?.rows.reduce((sum, r) => sum + parseFloat(r.totalBuys), 0).toFixed(2) ?? '0.00';

  const totalSellsGbp =
    report?.rows.reduce((sum, r) => sum + parseFloat(r.totalSells), 0).toFixed(2) ?? '0.00';

  const activeCurrencies =
    report?.rows.filter(
      (r) => parseFloat(r.openingBalance) > 0 || parseFloat(r.totalBuys) > 0,
    ).length ?? 0;

  const todayProfit = eod?.totalProfitGbp
    ? `£${parseFloat(eod.totalProfitGbp).toFixed(2)}`
    : '£0.00';

  return (
    <AppShell>
      <PageHeader
        title={t('nav.dashboard')}
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0a146e] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* KPI cards — 4 in a row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              label={t('dashboard.todayBuys')}
              value={`£${totalBuysGbp}`}
              colorClass="text-green-600"
            />
            <StatCard
              label={t('dashboard.todaySells')}
              value={`£${totalSellsGbp}`}
              colorClass="text-red-600"
            />
            <StatCard
              label={t('dashboard.activeCurrencies')}
              value={String(activeCurrencies)}
            />
            <StatCard
              label={t('dashboard.todayProfit')}
              value={todayProfit}
              colorClass="text-[#0a146e]"
            />
          </div>

          {/* 7-day volume sparkline */}
          {weekVolume && weekVolume.trendPoints.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-8">
              <h2 className="font-semibold text-gray-800 mb-4 text-sm">
                {t('dashboard.volumeTrend')}
              </h2>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={weekVolume.trendPoints}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    }
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`£${Number(v).toLocaleString()}`, 'Volume']} />
                  <Line
                    type="monotone"
                    dataKey="volumeGbp"
                    stroke="#0a146e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Session summary table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Today&apos;s Position</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <th className="text-left px-5 py-3">Currency</th>
                    <th className="text-right px-5 py-3">Opening</th>
                    <th className="text-right px-5 py-3 text-green-600">Buys</th>
                    <th className="text-right px-5 py-3 text-red-600">Sells</th>
                    <th className="text-right px-5 py-3">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.rows.map((row) => (
                    <tr key={row.currencyId} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{row.currencyCode}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{row.openingBalance}</td>
                      <td className="px-5 py-3 text-right text-green-600">{row.totalBuys}</td>
                      <td className="px-5 py-3 text-right text-red-600">{row.totalSells}</td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          parseFloat(row.closingBalance) >= 0 ? 'text-gray-900' : 'text-red-600'
                        }`}
                      >
                        {row.closingBalance}
                      </td>
                    </tr>
                  ))}
                  {!report?.rows.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-400 py-8">
                        No data for today
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

