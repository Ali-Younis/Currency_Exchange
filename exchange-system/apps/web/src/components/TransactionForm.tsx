'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { CurrencyDto, ExchangeRateDto, TransactionDto } from '@exchange/shared';
import { useState, useEffect } from 'react';

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

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } =
    useForm<FormData>();

  // Watch fields needed for auto-calculations
  const currencyInId = useWatch({ control, name: 'currencyInId' });
  const currencyOutId = useWatch({ control, name: 'currencyOutId' });
  const amountIn = useWatch({ control, name: 'amountIn' });
  const rateApplied = useWatch({ control, name: 'rateApplied' });

  const { data: currencies } = useQuery<CurrencyDto[]>({
    queryKey: ['currencies'],
    queryFn: () => api.get('/currencies?active=true').then((r) => r.data),
  });

  // Fetch all current exchange rates (one request, filter client-side)
  const { data: rates } = useQuery<ExchangeRateDto[]>({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get('/exchange-rates').then((r) => r.data),
  });

  // Auto-fill rate when currency pair changes
  useEffect(() => {
    if (!currencies || !rates) return;
    const gbp = currencies.find((c) => c.code === 'GBP');
    if (!gbp) return;

    // Determine the foreign currency based on transaction type and selected currencies
    let foreignCurrencyId: string | undefined;
    if (type === 'BUY') {
      // BUY: customer gives foreign currency (currencyIn), agency gives GBP (currencyOut)
      foreignCurrencyId = currencyInId && currencyInId !== gbp.id ? currencyInId : undefined;
    } else {
      // SELL: agency gives foreign currency (currencyOut), customer gives GBP (currencyIn)
      foreignCurrencyId = currencyOutId && currencyOutId !== gbp.id ? currencyOutId : undefined;
    }

    if (!foreignCurrencyId) return;

    // Find the latest rate for this currency
    const ratesForCurrency = rates
      .filter((r) => r.currencyId === foreignCurrencyId)
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

    if (ratesForCurrency.length === 0) return;
    const latest = ratesForCurrency[0];

    // For BUY: agency buys foreign → use buyRate. For SELL: agency sells foreign → use sellRate.
    const rate = type === 'BUY' ? latest.buyRate : latest.sellRate;
    setValue('rateApplied', rate, { shouldValidate: false });
  }, [currencyInId, currencyOutId, currencies, rates, type, setValue]);

  // Auto-calculate amountOut from amountIn and rate
  useEffect(() => {
    const amt = parseFloat(amountIn);
    const rate = parseFloat(rateApplied);
    if (isNaN(amt) || isNaN(rate) || rate <= 0) return;
    // rate is foreign units per 1 GBP (or GBP per 1 foreign unit, depending on schema convention)
    // For BUY: customer gives foreign currency, agency gives GBP → amountOut = amountIn / rate
    // For SELL: customer gives GBP, agency gives foreign currency → amountOut = amountIn * rate
    const amtOut = type === 'BUY' ? amt / rate : amt * rate;
    setValue('amountOut', amtOut.toFixed(2), { shouldValidate: false });
  }, [amountIn, rateApplied, type, setValue]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api
        .post<TransactionDto>('/transactions', { ...data, type, sessionDate: today })
        .then((r) => r.data),
    onSuccess: (tx) => {
      setLastReceipt(tx);
      reset();
      qc.invalidateQueries({ queryKey: ['session-report'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['eod-report'] });
    },
  });

  return (
    <div className="max-w-2xl">
      {/* Success receipt banner */}
      {lastReceipt && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <div className="font-semibold text-green-800">{t('success')}</div>
            <div className="text-sm text-green-600">
              {t('receiptNumber')}: {lastReceipt.receiptNumber}
            </div>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('customerName')}
          </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('currencyIn')}
            </label>
            <select
              {...register('currencyInId', { required: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            >
              <option value="">Select…</option>
              {currencies?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.nameEn}
                </option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('currencyOut')}
            </label>
            <select
              {...register('currencyOutId', { required: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            >
              <option value="">Select…</option>
              {currencies?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Out — auto-calculated, but editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('amountOut')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register('amountOut', { required: true, min: 0.01 })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e] bg-blue-50"
              placeholder="Auto-calculated"
            />
          </div>
        </div>

        {/* Rate — auto-filled from current exchange rates */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('rate')}
            <span className="text-xs text-gray-400 ms-2 font-normal">
              (auto-filled from current rate)
            </span>
          </label>
          <input
            type="number"
            step="0.000001"
            min="0"
            {...register('rateApplied', { required: true })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e] bg-blue-50"
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
          <div className="text-red-600 text-sm">
            Failed to record transaction. Please try again.
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className={`w-full font-semibold py-3 rounded-lg text-white transition-colors disabled:opacity-60 ${
            type === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
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
