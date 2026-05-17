'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { CurrencyDto, TransactionDto } from '@exchange/shared';
import { useState, useEffect } from 'react';

interface RateRow {
  currency: CurrencyDto;
  rate: { buyRate: string; sellRate: string; effectiveDate: string } | null;
}

interface CrossInfo {
  inCode: string;
  outCode: string;
  inBuyRate: string;
  outSellRate: string;
  syntheticRate: string;
}

interface FormData {
  customerName: string;
  customerEmail: string;
  currencyInId: string;
  amountIn: string;
  currencyOutId: string;
  amountOut: string;
  rateApplied: string;
  notes: string;
}

async function downloadReceiptPdf(tx: TransactionDto, type: 'BUY' | 'SELL' | 'CROSS') {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  // Fetch logo (if saved)
  let logoB64: string | null = null;
  try {
    const r = await fetch('/api/v1/app-settings/public/logo');
    if (r.ok) { const d = await r.json(); if (d?.value) logoB64 = d.value; }
  } catch { /* ignore */ }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

  let cursorY = 14;

  if (logoB64) {
    try {
      const fmt = logoB64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoB64, fmt, 14, cursorY, 40, 16);
      cursorY += 22;
    } catch { /* skip */ }
  }

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Exchange Receipt', 14, cursorY + 6);
  cursorY += 14;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt No: ${tx.receiptNumber}`, 14, cursorY);
  cursorY += 6;
  doc.text(`Date: ${tx.sessionDate?.toString().split('T')[0] ?? new Date().toISOString().split('T')[0]}`, 14, cursorY);
  cursorY += 6;
  doc.text(`Type: ${type}`, 14, cursorY);
  cursorY += 6;
  doc.text(`Customer: ${tx.customerName}`, 14, cursorY);
  cursorY += 10;

  autoTable(doc, {
    startY: cursorY,
    head: [['', 'Currency', 'Amount']],
    body: [
      ['Given', (tx as unknown as { currencyIn?: { code: string } }).currencyIn?.code ?? '', tx.amountIn?.toString() ?? ''],
      ['Received', (tx as unknown as { currencyOut?: { code: string } }).currencyOut?.code ?? '', tx.amountOut?.toString() ?? ''],
      ['Rate applied', '', tx.rateApplied?.toString() ?? ''],
    ],
    styles: { fontSize: 10 },
    headStyles: { fillColor: [10, 20, 110] },
  });

  doc.save(`receipt-${tx.receiptNumber}.pdf`);
}

function TransactionForm({ type }: { type: 'BUY' | 'SELL' | 'CROSS' }) {
  const t = useTranslations('transaction');
  const { user } = useAuth();
  const qc = useQueryClient();
  const [lastReceipt, setLastReceipt] = useState<TransactionDto | null>(null);
  const [crossInfo, setCrossInfo] = useState<CrossInfo | null>(null);
  // Used to force the GBP-lock useEffect to re-run after form reset
  const [resetCount, setResetCount] = useState(0);
  // Commission state
  const [commType, setCommType] = useState<'fixed' | 'pct'>('fixed');
  const [commValue, setCommValue] = useState('0');
  const [commType2, setCommType2] = useState<'fixed' | 'pct'>('fixed');
  const [commValue2, setCommValue2] = useState('0');
  const today = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } =
    useForm<FormData>();

  const currencyInId = useWatch({ control, name: 'currencyInId' });
  const currencyOutId = useWatch({ control, name: 'currencyOutId' });
  const amountIn = useWatch({ control, name: 'amountIn' });
  const rateApplied = useWatch({ control, name: 'rateApplied' });

  const { data: currencies } = useQuery<CurrencyDto[]>({
    queryKey: ['currencies'],
    queryFn: () => api.get('/currencies?active=true').then((r) => r.data),
  });

  const { data: rates } = useQuery<RateRow[]>({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get('/exchange-rates').then((r) => r.data),
  });

  const gbpCurrency = currencies?.find((c) => c.code === 'GBP') ?? null;
  const nonGbpCurrencies = currencies?.filter((c) => c.code !== 'GBP') ?? [];

  // Lock the GBP side whenever currencies load or form resets (BUY/SELL only)
  useEffect(() => {
    if (!gbpCurrency) return;
    if (type === 'BUY') setValue('currencyOutId', gbpCurrency.id);
    else if (type === 'SELL') setValue('currencyInId', gbpCurrency.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gbpCurrency, type, setValue, resetCount]);

  // Auto-fill rate when the currency pair changes
  useEffect(() => {
    if (!currencies || !rates || !currencyInId || !currencyOutId) {
      setCrossInfo(null);
      return;
    }
    const gbp = currencies.find((c) => c.code === 'GBP');
    if (!gbp) return;

    // Same currency on both sides — nothing to calculate
    if (currencyInId === currencyOutId) {
      setCrossInfo(null);
      return;
    }

    const getLatestRate = (currencyId: string) =>
      rates.find((r) => r.currency.id === currencyId && r.rate !== null) ?? null;

    if (currencyOutId === gbp.id) {
      // ── BUY: customer gives foreign, receives GBP ────────────────────────
      // rateApplied = foreign buyRate (foreign units per 1 GBP)
      // amountOut(GBP) = amountIn(foreign) / buyRate
      const row = getLatestRate(currencyInId);
      if (!row) return;
      setValue('rateApplied', row.rate!.buyRate, { shouldValidate: false });
      setCrossInfo(null);
    } else if (currencyInId === gbp.id) {
      // ── SELL: customer gives GBP, receives foreign ───────────────────────
      // rateApplied = foreign sellRate (foreign units per 1 GBP)
      // amountOut(foreign) = amountIn(GBP) × sellRate
      const row = getLatestRate(currencyOutId);
      if (!row) return;
      setValue('rateApplied', row.rate!.sellRate, { shouldValidate: false });
      setCrossInfo(null);
    } else {
      // ── CROSS: neither side is GBP — use GBP as the invisible bridge ────
      // Step 1: customer gives currencyIn → agency converts to GBP at currencyIn buyRate
      // Step 2: agency converts GBP to currencyOut at currencyOut sellRate
      // Synthetic rate = outSellRate / inBuyRate  (units of currencyOut per 1 currencyIn)
      // amountOut = amountIn × syntheticRate
      const inRow = getLatestRate(currencyInId);
      const outRow = getLatestRate(currencyOutId);
      if (!inRow || !outRow) {
        setCrossInfo(null);
        return;
      }
      const inBuy = parseFloat(inRow.rate!.buyRate);
      const outSell = parseFloat(outRow.rate!.sellRate);
      const synthetic = outSell / inBuy;
      const syntheticStr = synthetic.toFixed(6);
      setValue('rateApplied', syntheticStr, { shouldValidate: false });
      const inCode = currencies.find((c) => c.id === currencyInId)?.code ?? '';
      const outCode = currencies.find((c) => c.id === currencyOutId)?.code ?? '';
      setCrossInfo({
        inCode,
        outCode,
        inBuyRate: inRow.rate!.buyRate,
        outSellRate: outRow.rate!.sellRate,
        syntheticRate: syntheticStr,
      });
    }
  }, [currencyInId, currencyOutId, currencies, rates, setValue]);

  // Auto-calculate amountOut whenever amountIn, rate, or commission changes
  useEffect(() => {
    if (!currencies || !currencyInId || !currencyOutId) return;
    const gbp = currencies.find((c) => c.code === 'GBP');
    const amt = parseFloat(amountIn);
    const rate = parseFloat(rateApplied);
    if (isNaN(amt) || isNaN(rate) || rate <= 0 || !gbp) return;

    function calcComm(type: 'fixed' | 'pct', val: string, baseGbp: number): number {
      const v = parseFloat(val) || 0;
      if (v <= 0) return 0;
      return type === 'fixed' ? v : (baseGbp * v / 100);
    }

    let amtOut: number;
    if (currencyOutId === gbp.id) {
      // BUY: amountOut(GBP) = amountIn(foreign) / buyRate - commission
      const grossGbp = amt / rate;
      const commGbp = calcComm(commType, commValue, grossGbp);
      amtOut = Math.max(0, grossGbp - commGbp);
    } else if (currencyInId === gbp.id) {
      // SELL: customer gives GBP; commission deducted from GBP before converting
      const commGbp = calcComm(commType, commValue, amt);
      amtOut = Math.max(0, (amt - commGbp) * rate);
    } else {
      // CROSS: two-leg commission
      const inBuy = parseFloat(crossInfo?.inBuyRate ?? '0');
      const outSell = parseFloat(crossInfo?.outSellRate ?? '0');
      if (inBuy <= 0 || outSell <= 0) {
        amtOut = amt * rate;
      } else {
        const intermediateGbp = amt / inBuy;
        const commGbp1 = calcComm(commType, commValue, intermediateGbp);
        const netGbp = Math.max(0, intermediateGbp - commGbp1);
        const commGbp2 = calcComm(commType2, commValue2, netGbp);
        amtOut = Math.max(0, (netGbp - commGbp2) * outSell);
      }
    }
    setValue('amountOut', amtOut.toFixed(2), { shouldValidate: false });
  }, [amountIn, rateApplied, currencyInId, currencyOutId, currencies, setValue, commType, commValue, commType2, commValue2, crossInfo]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api
        .post<TransactionDto>('/transactions', { ...data, type, sessionDate: today })
        .then((r) => r.data),
    onSuccess: (tx) => {
      setLastReceipt(tx);
      reset();
      setResetCount((n) => n + 1); // triggers GBP re-lock useEffect
      setCommValue('0');
      setCommValue2('0');
      setCommType('fixed');
      setCommType2('fixed');
      qc.invalidateQueries({ queryKey: ['session-report'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['eod-report'] });
    },
  });

  void user;

  return (
    <div className="max-w-2xl">
      {lastReceipt && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <div className="font-semibold text-green-800">{t('success')}</div>
            <div className="text-sm text-green-600">
              {t('receiptNumber')}: {lastReceipt.receiptNumber}
            </div>
          </div>
          <button
            onClick={() => downloadReceiptPdf(lastReceipt, type)}
            className="text-xs border border-green-600 text-green-700 rounded px-3 py-1.5 hover:bg-green-100"
          >
            {t('receipt')} (PDF)
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

        {/* Customer Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('customerEmail')}
            <span className="text-xs text-gray-400 ms-2 font-normal">(optional — sends email receipt)</span>
          </label>
          <input
            type="email"
            {...register('customerEmail', {
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
            })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            placeholder="customer@example.com"
          />
          {errors.customerEmail && <p className="text-xs text-red-500 mt-1">{errors.customerEmail.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Currency In */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('currencyIn')}
              <span className="text-xs text-gray-400 ms-1 font-normal">(customer gives)</span>
            </label>
            {type === 'SELL' ? (
              /* SELL: currencyIn is always GBP — locked display */
              <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-600 flex items-center gap-2">
                <span>🇬🇧</span>
                <span className="font-medium">GBP</span>
                <span className="text-gray-400">— British Pound</span>
                <span className="ms-auto text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">fixed</span>
              </div>
            ) : (
              <select
                {...register('currencyInId', { required: true })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              >
                <option value="">Select…</option>
                {nonGbpCurrencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} – {c.nameEn}
                  </option>
                ))}
              </select>
            )}
            {errors.currencyInId && <p className="text-xs text-red-500 mt-1">Required</p>}
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
              <span className="text-xs text-gray-400 ms-1 font-normal">(customer receives)</span>
            </label>
            {type === 'BUY' ? (
              /* BUY: currencyOut is always GBP — locked display */
              <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-600 flex items-center gap-2">
                <span>🇬🇧</span>
                <span className="font-medium">GBP</span>
                <span className="text-gray-400">— British Pound</span>
                <span className="ms-auto text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">fixed</span>
              </div>
            ) : (
              <select
                {...register('currencyOutId', { required: true })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              >
                <option value="">Select…</option>
                {nonGbpCurrencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} – {c.nameEn}
                  </option>
                ))}
              </select>
            )}
            {errors.currencyOutId && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>

          {/* Amount Out — auto-calculated */}
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

        {/* Cross-currency info badge */}
        {crossInfo && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 space-y-0.5">
            <div className="font-semibold text-amber-900">
              Cross-currency via GBP bridge: {crossInfo.inCode} → GBP → {crossInfo.outCode}
            </div>
            <div>
              {crossInfo.inCode} buy rate: <span className="font-mono">{crossInfo.inBuyRate}</span>
              &nbsp;·&nbsp;
              {crossInfo.outCode} sell rate: <span className="font-mono">{crossInfo.outSellRate}</span>
            </div>
            <div>
              Synthetic rate: <span className="font-mono">{crossInfo.outSellRate}</span>
              {' '}÷{' '}
              <span className="font-mono">{crossInfo.inBuyRate}</span>
              {' '}={' '}
              <span className="font-semibold font-mono">{crossInfo.syntheticRate}</span>
              {' '}{crossInfo.outCode}/{crossInfo.inCode}
            </div>
          </div>
        )}

        {/* Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('rate')}
            <span className="text-xs text-gray-400 ms-2 font-normal">
              {crossInfo
                ? `(${crossInfo.outCode} per ${crossInfo.inCode} — synthetic)`
                : '(auto-filled from current rate, editable)'}
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

        {/* Commission */}
        {type === 'CROSS' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">Commission</p>
            <div>
              <label className="block text-xs text-amber-700 mb-1">
                Leg 1: {crossInfo?.inCode ?? 'Currency'} → GBP
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={commType}
                  onChange={(e) => setCommType(e.target.value as 'fixed' | 'pct')}
                  className="border border-amber-300 bg-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="fixed">Fixed £</option>
                  <option value="pct">%</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={commValue}
                  onChange={(e) => setCommValue(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-amber-700 mb-1">
                Leg 2: GBP → {crossInfo?.outCode ?? 'Currency'}
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={commType2}
                  onChange={(e) => setCommType2(e.target.value as 'fixed' | 'pct')}
                  className="border border-amber-300 bg-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="fixed">Fixed £</option>
                  <option value="pct">%</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={commValue2}
                  onChange={(e) => setCommValue2(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commission</label>
            <div className="flex items-center gap-2">
              <select
                value={commType}
                onChange={(e) => setCommType(e.target.value as 'fixed' | 'pct')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              >
                <option value="fixed">Fixed £</option>
                <option value="pct">%</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={commValue}
                onChange={(e) => setCommValue(e.target.value)}
                placeholder="0.00"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              />
            </div>
          </div>
        )}

        {mutation.isError && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            Failed to record transaction. Please try again.
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className={`w-full font-semibold py-3 rounded-lg text-white transition-colors disabled:opacity-60 ${
            type === 'BUY'
              ? 'bg-green-600 hover:bg-green-700'
              : type === 'SELL'
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-[#0a146e] hover:bg-[#060d52]'
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
        subtitle="Customer gives foreign currency · receives GBP"
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
        subtitle="Customer gives GBP · receives foreign currency"
      />
      <TransactionForm type="SELL" />
    </AppShell>
  );
}

export function CrossPage() {
  const t = useTranslations();
  return (
    <AppShell>
      <PageHeader
        title={t('nav.cross')}
        subtitle="Exchange between two non-GBP currencies · GBP bridge applied automatically"
      />
      <TransactionForm type="CROSS" />
    </AppShell>
  );
}

