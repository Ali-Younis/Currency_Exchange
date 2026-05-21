'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { PaginatedResult, TransactionDto } from '@exchange/shared';

export default function LedgerPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data, isLoading } = useQuery<PaginatedResult<TransactionDto>>({
    queryKey: ['transactions', date],
    queryFn: () => api.get(`/transactions?date=${date}&pageSize=200`).then((r) => r.data),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/transactions/${id}/void`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', date] });
      setVoidId(null);
      setVoidReason('');
    },
  });

  const transactions = data?.data ?? [];
  const buys = transactions.filter((t) => t.type === 'BUY');
  const sells = transactions.filter((t) => t.type === 'SELL');
  const crosses = transactions.filter((t) => t.type === 'CROSS');

  return (
    <AppShell permission="ledger">
      <PageHeader
        title={t('nav.ledger')}
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

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0a146e] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Buys */}
          <LedgerTable
            title={t('transaction.buyTitle')}
            transactions={buys}
            colorClass="text-green-600"
            isAdmin={isAdmin}
            onVoid={(id) => setVoidId(id)}
          />
          {/* Sells */}
          <LedgerTable
            title={t('transaction.sellTitle')}
            transactions={sells}
            colorClass="text-red-600"
            isAdmin={isAdmin}
            onVoid={(id) => setVoidId(id)}
          />
          {/* Cross */}
          <LedgerTable
            title={t('transaction.crossTitle')}
            transactions={crosses}
            colorClass="text-purple-600"
            isAdmin={isAdmin}
            onVoid={(id) => setVoidId(id)}
          />
        </div>
      )}

      {/* Void modal */}
      {voidId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-bold text-gray-900 mb-4">{t('transaction.void')}</h2>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('transaction.voidReason')}
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e] mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => voidMutation.mutate({ id: voidId, reason: voidReason })}
                disabled={!voidReason || voidMutation.isPending}
                className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                Confirm Void
              </button>
              <button
                onClick={() => { setVoidId(null); setVoidReason(''); }}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function LedgerTable({
  title, transactions, colorClass, isAdmin, onVoid,
}: {
  title: string;
  transactions: TransactionDto[];
  colorClass: string;
  isAdmin: boolean;
  onVoid: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className={`font-semibold ${colorClass}`}>{title}</h2>
        <span className="text-xs text-gray-400">{transactions.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Receipt</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-right px-4 py-3">In</th>
              <th className="text-right px-4 py-3">Out</th>
              <th className="text-right px-4 py-3">Rate</th>
              <th className="text-right px-4 py-3">GBP Value</th>
              <th className="text-left px-4 py-3">Time</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className={`border-t border-gray-100 hover:bg-gray-50 ${tx.isVoided ? 'opacity-40 line-through' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{tx.receiptNumber}</td>
                <td className="px-4 py-3 text-gray-900">{tx.customerName}</td>
                <td className="px-4 py-3 text-right">
                  <span className="font-medium">{tx.amountIn}</span>{' '}
                  <span className="text-gray-400 text-xs">{tx.currencyInCode}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-medium">{tx.amountOut}</span>{' '}
                  <span className="text-gray-400 text-xs">{tx.currencyOutCode}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600 font-mono">{tx.rateApplied}</td>
                <td className="px-4 py-3 text-right font-semibold">£{tx.valueInGbp}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(tx.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    {!tx.isVoided && (
                      <button
                        onClick={() => onVoid(tx.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Void
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="text-center text-gray-400 py-8">
                  No transactions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
