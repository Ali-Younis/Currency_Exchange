'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import api from '@/lib/api';
import type {
  SessionReport,
  ProfitReport,
  VolumeReport,
  TopCustomersReport,
  RateHistoryReport,
  EndOfDayReport,
} from '@exchange/shared';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CurrencyDto } from '@exchange/shared';

// ─── helpers ──────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];
const thirtyDaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()].map((c) =>
    String.fromCodePoint(0x1f1e0 + c.charCodeAt(0) - 65),
  ).join('');
}

type Tab = 'session' | 'profit' | 'volume' | 'customers' | 'rates' | 'audit' | 'eod';

// ─── small shared components ──────────────────────────────────────────────────

function DateRangeBar({
  startDate,
  endDate,
  onStart,
  onEnd,
}: {
  startDate: string;
  endDate: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  const t = useTranslations('report');
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <label className="text-sm text-gray-600">
        {t('startDate')}
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => onStart(e.target.value)}
          className="ms-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
        />
      </label>
      <label className="text-sm text-gray-600">
        {t('endDate')}
        <input
          type="date"
          value={endDate}
          min={startDate}
          max={today()}
          onChange={(e) => onEnd(e.target.value)}
          className="ms-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
        />
      </label>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0a146e] border-t-transparent" />
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#0a146e]">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Tab: Session Summary ─────────────────────────────────────────────────────

function SessionTab() {
  const t = useTranslations('report');
  const [date, setDate] = useState(today());

  const { data: report, isLoading } = useQuery<SessionReport>({
    queryKey: ['session-report', date],
    queryFn: () => api.get(`/reports/session?date=${date}`).then((r) => r.data),
  });

  async function handleExportPdf() {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Session Report – ${date}`, 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Currency', 'Opening', 'Total Buys', 'Total Sells', 'Closing']],
      body:
        report?.rows.map((r) => [
          r.currencyCode,
          r.openingBalance,
          r.totalBuys,
          r.totalSells,
          r.closingBalance,
        ]) ?? [],
    });
    doc.save(`session-report-${date}.pdf`);
  }

  async function handleExportExcel() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      report?.rows.map((r) => ({
        Currency: r.currencyCode,
        Opening: r.openingBalance,
        'Total Buys': r.totalBuys,
        'Total Sells': r.totalSells,
        Closing: r.closingBalance,
      })) ?? [],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Session');
    XLSX.writeFile(wb, `session-report-${date}.xlsx`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="date"
          value={date}
          max={today()}
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
          onClick={handleExportExcel}
          className="bg-green-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
        >
          {t('exportExcel')}
        </button>
        <button
          onClick={() => window.print()}
          className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t('print')}
        </button>
      </div>

      {isLoading ? (
        <Spinner />
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
                      <span className="text-xl me-2">{countryFlag(row.countryCode)}</span>
                      <span className="font-bold text-gray-900">{row.currencyCode}</span>
                      <span className="text-gray-400 text-xs ms-2">({row.currencyNameEn})</span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.openingBalance}</td>
                    <td className="px-5 py-3 text-right text-green-600 font-medium">
                      {row.totalBuys}
                    </td>
                    <td className="px-5 py-3 text-right text-red-600 font-medium">
                      {row.totalSells}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-bold text-lg ${
                        parseFloat(row.closingBalance) < 0 ? 'text-red-600' : 'text-gray-900'
                      }`}
                    >
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
    </div>
  );
}

// ─── Tab: P&L Analysis ────────────────────────────────────────────────────────

function ProfitTab() {
  const t = useTranslations('report');
  const [startDate, setStartDate] = useState(thirtyDaysAgo());
  const [endDate, setEndDate] = useState(today());

  const { data, isLoading } = useQuery<ProfitReport>({
    queryKey: ['profit-report', startDate, endDate],
    queryFn: () =>
      api.get(`/reports/profit?startDate=${startDate}&endDate=${endDate}`).then((r) => r.data),
  });

  async function handleExportExcel() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      data?.rows.map((r) => ({
        Currency: r.currencyCode,
        Transactions: r.totalTransactions,
        'Volume GBP': r.totalVolumeGbp,
        'Profit GBP': r.totalProfitGbp,
        'Avg Profit/Txn': r.avgProfitPerTxnGbp,
      })) ?? [],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'P&L');
    XLSX.writeFile(wb, `pl-report-${startDate}-to-${endDate}.xlsx`);
  }

  return (
    <div>
      <DateRangeBar
        startDate={startDate}
        endDate={endDate}
        onStart={setStartDate}
        onEnd={setEndDate}
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <KpiCard
              label={t('totalProfit')}
              value={`£${parseFloat(data?.grandTotalProfitGbp ?? '0').toFixed(2)}`}
            />
            <KpiCard
              label={t('totalVolume')}
              value={`£${parseFloat(data?.grandTotalVolumeGbp ?? '0').toLocaleString()}`}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Profit by Currency (GBP)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.rows ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="currencyCode" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `£${Number(v).toFixed(4)}`} />
                <Legend />
                <Bar dataKey="totalProfitGbp" name="Profit (GBP)" fill="#0a146e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalVolumeGbp" name="Volume (GBP)" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-end mb-3">
            <button
              onClick={handleExportExcel}
              className="bg-green-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
            >
              {t('exportExcel')}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a146e] text-white text-xs uppercase">
                  <th className="text-left px-5 py-4">{t('currency')}</th>
                  <th className="text-right px-5 py-4">{t('transactions')}</th>
                  <th className="text-right px-5 py-4">{t('totalVolume')}</th>
                  <th className="text-right px-5 py-4">{t('totalProfit')}</th>
                  <th className="text-right px-5 py-4">{t('avgProfit')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((row) => (
                  <tr key={row.currencyId} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 font-bold text-gray-900">{row.currencyCode}</td>
                    <td className="px-5 py-3 text-right">{row.totalTransactions}</td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      £{parseFloat(row.totalVolumeGbp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-green-600 font-semibold">
                      £{parseFloat(row.totalProfitGbp).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">
                      £{parseFloat(row.avgProfitPerTxnGbp).toFixed(4)}
                    </td>
                  </tr>
                ))}
                {!data?.rows.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-12">
                      No data for selected range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Volume Trends ───────────────────────────────────────────────────────

function VolumeTab() {
  const t = useTranslations('report');
  const [startDate, setStartDate] = useState(thirtyDaysAgo());
  const [endDate, setEndDate] = useState(today());
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const { data, isLoading } = useQuery<VolumeReport>({
    queryKey: ['volume-report', startDate, endDate, groupBy],
    queryFn: () =>
      api
        .get(`/reports/volume?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`)
        .then((r) => r.data),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <DateRangeBar
          startDate={startDate}
          endDate={endDate}
          onStart={setStartDate}
          onEnd={setEndDate}
        />
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
        >
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <KpiCard
              label={t('transactions')}
              value={String(data?.totalTransactions ?? 0)}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Transaction Volume (GBP)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.trendPoints ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="volumeGbp"
                  name="Volume (GBP)"
                  stroke="#0a146e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="count"
                  name="# Transactions"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Buys vs Sells</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.trendPoints ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="buys" name="Buys" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sells" name="Sells" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Top Customers ───────────────────────────────────────────────────────

function CustomersTab() {
  const t = useTranslations('report');
  const [startDate, setStartDate] = useState(thirtyDaysAgo());
  const [endDate, setEndDate] = useState(today());

  const { data, isLoading } = useQuery<TopCustomersReport>({
    queryKey: ['customers-report', startDate, endDate],
    queryFn: () =>
      api
        .get(`/reports/customers?startDate=${startDate}&endDate=${endDate}&limit=25`)
        .then((r) => r.data),
  });

  async function handleExportExcel() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      data?.customers.map((c) => ({
        Rank: c.rank,
        Customer: c.customerName,
        Transactions: c.totalTransactions,
        'Volume GBP': c.totalVolumeGbp,
        'Profit GBP': c.totalProfitGbp,
      })) ?? [],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Top Customers');
    XLSX.writeFile(wb, `top-customers-${startDate}-to-${endDate}.xlsx`);
  }

  return (
    <div>
      <DateRangeBar
        startDate={startDate}
        endDate={endDate}
        onStart={setStartDate}
        onEnd={setEndDate}
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <button
              onClick={handleExportExcel}
              className="bg-green-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
            >
              {t('exportExcel')}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a146e] text-white text-xs uppercase">
                  <th className="text-center px-4 py-4 w-12">{t('rank')}</th>
                  <th className="text-left px-5 py-4">{t('customer')}</th>
                  <th className="text-right px-5 py-4">{t('transactions')}</th>
                  <th className="text-right px-5 py-4">{t('totalVolume')}</th>
                  <th className="text-right px-5 py-4">{t('totalProfit')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.customers.map((c) => (
                  <tr key={c.rank} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          c.rank === 1
                            ? 'bg-yellow-400 text-white'
                            : c.rank === 2
                            ? 'bg-gray-400 text-white'
                            : c.rank === 3
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.rank}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{c.customerName}</td>
                    <td className="px-5 py-3 text-right">{c.totalTransactions}</td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      £{parseFloat(c.totalVolumeGbp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-green-600 font-semibold">
                      £{parseFloat(c.totalProfitGbp).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {!data?.customers.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-12">
                      No data for selected range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Rate History ────────────────────────────────────────────────────────

function RatesTab() {
  const t = useTranslations('report');
  const [currencyId, setCurrencyId] = useState('');
  const [startDate, setStartDate] = useState(thirtyDaysAgo());
  const [endDate, setEndDate] = useState(today());

  const { data: currencies } = useQuery<CurrencyDto[]>({
    queryKey: ['currencies'],
    queryFn: () => api.get('/currencies').then((r) => r.data),
  });

  const { data, isLoading } = useQuery<RateHistoryReport>({
    queryKey: ['rates-history', currencyId, startDate, endDate],
    queryFn: () =>
      api
        .get(`/reports/rates-history?currencyId=${currencyId}&startDate=${startDate}&endDate=${endDate}`)
        .then((r) => r.data),
    enabled: !!currencyId,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={currencyId}
          onChange={(e) => setCurrencyId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
        >
          <option value="">Select Currency</option>
          {currencies
            ?.filter((c) => c.code !== 'GBP')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} – {c.nameEn}
              </option>
            ))}
        </select>
        <DateRangeBar
          startDate={startDate}
          endDate={endDate}
          onStart={setStartDate}
          onEnd={setEndDate}
        />
      </div>

      {!currencyId ? (
        <p className="text-gray-400 text-center py-12">Select a currency to view rate history</p>
      ) : isLoading ? (
        <Spinner />
      ) : (
        <>
          {data && data.history.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Buy / Sell Rate Over Time</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="effectiveDate"
                    tickFormatter={(v) => new Date(v).toLocaleDateString()}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(l) => new Date(l).toLocaleString()}
                    formatter={(v: number) => v.toFixed(6)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="buyRate"
                    name={t('buyRate')}
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sellRate"
                    name={t('sellRate')}
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="spread"
                    name={t('spread')}
                    stroke="#f59e0b"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a146e] text-white text-xs uppercase">
                  <th className="text-left px-5 py-4">{t('date')}</th>
                  <th className="text-right px-5 py-4">{t('buyRate')}</th>
                  <th className="text-right px-5 py-4">{t('sellRate')}</th>
                  <th className="text-right px-5 py-4">{t('spread')}</th>
                  <th className="text-left px-5 py-4">{t('setBy')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.history.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(row.effectiveDate).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-green-600">{parseFloat(row.buyRate).toFixed(6)}</td>
                    <td className="px-5 py-3 text-right text-red-600">{parseFloat(row.sellRate).toFixed(6)}</td>
                    <td className="px-5 py-3 text-right text-amber-600">{parseFloat(row.spread).toFixed(6)}</td>
                    <td className="px-5 py-3 text-gray-600">{row.setBy.fullName}</td>
                  </tr>
                ))}
                {!data?.history.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-12">
                      No rate history found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Audit Trail ─────────────────────────────────────────────────────────

function AuditTab() {
  const t = useTranslations('report');
  const [startDate, setStartDate] = useState(thirtyDaysAgo());
  const [endDate, setEndDate] = useState(today());
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-trail', startDate, endDate, action, page],
    queryFn: () =>
      api
        .get(
          `/reports/audit?startDate=${startDate}&endDate=${endDate}&action=${action}&page=${page}&pageSize=30`,
        )
        .then((r) => r.data),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <DateRangeBar
          startDate={startDate}
          endDate={endDate}
          onStart={setStartDate}
          onEnd={setEndDate}
        />
        <input
          type="text"
          placeholder="Filter by action (e.g. LOGIN)"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a146e] text-white text-xs uppercase">
                  <th className="text-left px-5 py-4">Timestamp</th>
                  <th className="text-left px-5 py-4">User</th>
                  <th className="text-left px-5 py-4">{t('action')}</th>
                  <th className="text-left px-5 py-4">{t('entity')}</th>
                  <th className="text-left px-5 py-4">{t('ipAddress')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row: { id: string; createdAt: string; user?: { fullName: string }; userId?: string; action: string; entity?: string; entityId?: string; ipAddress?: string }) => (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-gray-800">
                      {row.user?.fullName ?? row.userId ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-[#0a146e]/10 text-[#0a146e] text-xs font-mono px-2 py-0.5 rounded">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {row.entity ? `${row.entity}${row.entityId ? ` #${row.entityId.slice(0, 8)}` : ''}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{row.ipAddress ?? '—'}</td>
                  </tr>
                ))}
                {!data?.data.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-12">
                      No audit entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > 30 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>
                Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, data.total)} of {data.total}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <button
                  disabled={page * 30 >= data.total}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: End of Day ─────────────────────────────────────────────────────────

function EndOfDayTab() {
  const t = useTranslations('report');
  const [date, setDate] = useState(today());

  const { data, isLoading } = useQuery<EndOfDayReport>({
    queryKey: ['eod-report', date],
    queryFn: () => api.get(`/reports/end-of-day?date=${date}`).then((r) => r.data),
  });

  async function handleExportPdf() {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`End of Day Report – ${date}`, 14, 20);
    doc.setFontSize(11);
    doc.text(`Total Transactions: ${data?.totalTransactions}`, 14, 32);
    doc.text(`Total Volume (GBP): £${data?.totalVolumeGbp}`, 14, 40);
    doc.text(`Total Profit (GBP): £${data?.totalProfitGbp}`, 14, 48);
    autoTable(doc, {
      startY: 58,
      head: [['Currency', 'Opening', 'Buys', 'Sells', 'Closing']],
      body:
        data?.balances.map((r) => [
          r.currencyCode,
          r.openingBalance,
          r.totalBuys,
          r.totalSells,
          r.closingBalance,
        ]) ?? [],
    });
    doc.save(`eod-report-${date}.pdf`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="date"
          value={date}
          max={today()}
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
          onClick={() => window.print()}
          className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t('print')}
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard label={t('transactions')} value={String(data?.totalTransactions ?? 0)} />
            <KpiCard
              label={t('voidedTxns')}
              value={String(data?.voidedTransactions ?? 0)}
            />
            <KpiCard
              label={t('totalVolume')}
              value={`£${parseFloat(data?.totalVolumeGbp ?? '0').toLocaleString()}`}
            />
            <KpiCard
              label={t('totalProfit')}
              value={`£${parseFloat(data?.totalProfitGbp ?? '0').toFixed(2)}`}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                {data?.balances.map((row) => (
                  <tr key={row.currencyId} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="text-xl me-2">{countryFlag(row.countryCode)}</span>
                      <span className="font-bold text-gray-900">{row.currencyCode}</span>
                      <span className="text-gray-400 text-xs ms-2">({row.currencyNameEn})</span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.openingBalance}</td>
                    <td className="px-5 py-3 text-right text-green-600 font-medium">
                      {row.totalBuys}
                    </td>
                    <td className="px-5 py-3 text-right text-red-600 font-medium">
                      {row.totalSells}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-bold text-lg ${
                        parseFloat(row.closingBalance) < 0 ? 'text-red-600' : 'text-gray-900'
                      }`}
                    >
                      {row.closingBalance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────

const TABS: { id: Tab; labelKey: string }[] = [
  { id: 'session', labelKey: 'tabSession' },
  { id: 'profit', labelKey: 'tabProfit' },
  { id: 'volume', labelKey: 'tabVolume' },
  { id: 'customers', labelKey: 'tabCustomers' },
  { id: 'rates', labelKey: 'tabRates' },
  { id: 'audit', labelKey: 'tabAudit' },
  { id: 'eod', labelKey: 'tabEndOfDay' },
];

export default function ReportsPage() {
  const t = useTranslations('report');
  const [activeTab, setActiveTab] = useState<Tab>('session');

  return (
    <AppShell>
      <PageHeader title={t('session')} />

      {/* Tab Bar */}
      <div className="flex overflow-x-auto gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#0a146e] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t(tab.labelKey as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'session' && <SessionTab />}
      {activeTab === 'profit' && <ProfitTab />}
      {activeTab === 'volume' && <VolumeTab />}
      {activeTab === 'customers' && <CustomersTab />}
      {activeTab === 'rates' && <RatesTab />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'eod' && <EndOfDayTab />}
    </AppShell>
  );
}

