'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { CurrencyDto, TransactionDto } from '@exchange/shared';
import { useState } from 'react';

interface FormData {
  customerName: string;
  currencyInId: string;
  amountIn: string;
  currencyOutId: string;
  amountOut: string;
  rateApplied: string;
  notes: string;
}

function TransactionForm({ type }: { type: 'BUY' | 'SELL' }) {
  const t = useTranslations('transaction');
  const { user } = useAuth();
  const qc = useQueryClient();
  const [lastReceipt, setLastReceipt] = useState<TransactionDto | null>(null);
  const today = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  const { data: currencies } = useQuery<CurrencyDto[]>({
    queryKey: ['currencies'],
    queryFn: () => api.get('/currencies?active=true').then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post<TransactionDto>('/transactions', { ...data, type, sessionDate: today }).then((r) => r.data),
    onSuccess: (tx) => {
      setLastReceipt(tx);
      reset();
      qc.invalidateQueries({ queryKey: ['session-report'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  return (
    <div className="max-w-2xl">
      {/* Success receipt banner */}
      {lastReceipt && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <div className="font-semibold text-green-800">{t('success')}</div>
            <div className="text-sm text-green-600">{t('receiptNumber')}: {lastReceipt.receiptNumber}</div>
          </div>
          <button
            onClick={() => window.print()}
            className="text-xs border border-green-600 text-green-700 rounded px-3 py-1.5 hover:bg-green-100"
          >
            {t('receipt')}
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
      >
        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('customerName')}</label>
          <input
            autoFocus
            {...register('customerName', { required: true })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
          />
          {errors.customerName && <p className="text-xs text-red-500 mt-1">Required</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Currency In */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('currencyIn')}</label>
            <select
              {...register('currencyInId', { required: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            >
              <option value="">Select…</option>
              {currencies?.map((c) => (
                <option key={c.id} value={c.id}>{c.code} – {c.nameEn}</option>
              ))}
            </select>
          </div>

          {/* Amount In */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('amountIn')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register('amountIn', { required: true, min: 0.01 })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            />
          </div>

          {/* Currency Out */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('currencyOut')}</label>
            <select
              {...register('currencyOutId', { required: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            >
              <option value="">Select…</option>
              {currencies?.map((c) => (
                <option key={c.id} value={c.id}>{c.code} – {c.nameEn}</option>
              ))}
            </select>
          </div>

          {/* Amount Out */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('amountOut')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register('amountOut', { required: true, min: 0.01 })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            />
          </div>
        </div>

        {/* Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('rate')}</label>
          <input
            type="number"
            step="0.000001"
            min="0"
            {...register('rateApplied', { required: true })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
          <input
            {...register('notes')}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
          />
        </div>

        {mutation.isError && (
          <div className="text-red-600 text-sm">Failed to record transaction. Please try again.</div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className={`w-full font-semibold py-3 rounded-lg text-white transition-colors disabled:opacity-60 ${
            type === 'BUY'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {mutation.isPending ? 'Processing…' : t('confirm')}
        </button>
      </form>
    </div>
  );
}

export function BuyPage() {
  const t = useTranslations();
  return (
    <AppShell>
      <PageHeader
        title={t('transaction.buy')}
        subtitle="Record a buy transaction — agency receives foreign currency"
      />
      <TransactionForm type="BUY" />
    </AppShell>
  );
}

export function SellPage() {
  const t = useTranslations();
  return (
    <AppShell>
      <PageHeader
        title={t('transaction.sell')}
        subtitle="Record a sell transaction — agency gives foreign currency"
      />
      <TransactionForm type="SELL" />
    </AppShell>
  );
}
