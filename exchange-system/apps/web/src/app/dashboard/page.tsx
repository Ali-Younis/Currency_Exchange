'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, useMemo } from 'react';
import api from '@/lib/api';
import { SessionReport, EndOfDayReport, VolumeReport } from '@exchange/shared';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const todayStr = () => new Date().toISOString().split('T')[0];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

type TimeRange = '7D' | '30D' | '90D';
const TIME_RANGES: { label: TimeRange; days: number; groupBy: 'day' | 'week' | 'month' }[] = [
  { label: '7D', days: 6, groupBy: 'day' },
  { label: '30D', days: 29, groupBy: 'day' },
  { label: '90D', days: 89, groupBy: 'week' },
];

interface CurrencyOption { id: string; code: string; }

export default function DashboardPage() {
  const t = useTranslations();
  const today = todayStr();

  const [timeRange, setTimeRange] = useState<TimeRange>('7D');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('all');

  const rangeConfig = TIME_RANGES.find((r) => r.label === timeRange)!;
  const startDate = daysAgo(rangeConfig.days);
  const prevStart = daysAgo(rangeConfig.days * 2 + 1);
  const prevEnd = daysAgo(rangeConfig.days + 1);

  const { data: report, isLoading } = useQuery<SessionReport>({
    queryKey: ['session-report', today],
    queryFn: () => api.get(`/reports/session?date=${today}`).then((r) => r.data),
  });

  const { data: eod } = useQuery<EndOfDayReport>({
    queryKey: ['eod-report', today],
    queryFn: () => api.get(`/reports/end-of-day?date=${today}`).then((r) => r.data),
  });

  // Active currencies for the filter dropdown
  const { data: currencies } = useQuery<CurrencyOption[]>({
    queryKey: ['currencies-active'],
    queryFn: () =>
      api.get('/currencies').then((r) =>
        (r.data as { id: string; code: string; isActive: boolean }[])
          .filter((c) => c.isActive && c.code !== 'GBP')
          .map((c) => ({ id: c.id, code: c.code })),
      ),
  });

  const currencyParam = selectedCurrencyId !== 'all' ? `&currencyId=${selectedCurrencyId}` : '';

  const { data: volumeData } = useQuery<VolumeReport>({
    queryKey: ['volume-report', startDate, today, rangeConfig.groupBy, selectedCurrencyId],
    queryFn: () =>
      api
        .get(`/reports/volume?startDate=${startDate}&endDate=${today}&groupBy=${rangeConfig.groupBy}${currencyParam}`)
        .then((r) => r.data),
  });

  // Previous period — to compute trend
  const { data: prevVolumeData } = useQuery<VolumeReport>({
    queryKey: ['volume-report-prev', prevStart, prevEnd, rangeConfig.groupBy, selectedCurrencyId],
    queryFn: () =>
      api
        .get(`/reports/volume?startDate=${prevStart}&endDate=${prevEnd}&groupBy=${rangeConfig.groupBy}${currencyParam}`)
        .then((r) => r.data),
  });

  const currentTotal = useMemo(
    () =>
      volumeData?.trendPoints.reduce((s, p) => s + parseFloat(p.volumeGbp), 0) ?? 0,
    [volumeData],
  );
  const prevTotal = useMemo(
    () =>
      prevVolumeData?.trendPoints.reduce((s, p) => s + parseFloat(p.volumeGbp), 0) ?? 0,
    [prevVolumeData],
  );

  const trendPct = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : null;

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
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label={t('dashboard.todayBuys')} value={`£${totalBuysGbp}`} colorClass="text-green-600" />
            <StatCard label={t('dashboard.todaySells')} value={`£${totalSellsGbp}`} colorClass="text-red-600" />
            <StatCard label={t('dashboard.activeCurrencies')} value={String(activeCurrencies)} />
            <StatCard label={t('dashboard.todayProfit')} value={todayProfit} colorClass="text-[#0a146e]" />
          </div>

          {/* Volume trend sparkline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-8">
            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-gray-800 text-sm">{t('dashboard.volumeTrend')}</h2>
                {/* Trend badge */}
                {trendPct !== null && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      trendPct > 0
                        ? 'bg-green-50 text-green-700'
                        : trendPct < 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {trendPct > 0 ? (
                      <TrendingUp size={12} />
                    ) : trendPct < 0 ? (
                      <TrendingDown size={12} />
                    ) : (
                      <Minus size={12} />
                    )}
                    {trendPct > 0 ? '+' : ''}{trendPct.toFixed(1)}% vs prev period
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Currency filter */}
                <select
                  value={selectedCurrencyId}
                  onChange={(e) => setSelectedCurrencyId(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#0a146e]"
                >
                  <option value="all">All Currencies</option>
                  {currencies?.map((c) => (
                    <option key={c.id} value={c.id}>{c.code}</option>
                  ))}
                </select>

                {/* Time range tabs */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {TIME_RANGES.map(({ label }) => (
                    <button
                      key={label}
                      onClick={() => setTimeRange(label)}
                      className={`text-xs px-3 py-1.5 transition-colors ${
                        timeRange === label
                          ? 'bg-[#0a146e] text-white font-medium'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {volumeData && volumeData.trendPoints.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={volumeData.trendPoints} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Date(v + 'T12:00:00').toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `£${Number(v).toLocaleString()}`}
                    width={90}
                  />
                  <Tooltip
                    formatter={(v: number) => [`£${Number(v).toLocaleString()}`, 'Volume (GBP)']}
                    labelFormatter={(v) =>
                      new Date(v + 'T12:00:00').toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                  />
                  <Line type="monotone" dataKey="volumeGbp" stroke="#0a146e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                No volume data for this period
              </div>
            )}
          </div>

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

