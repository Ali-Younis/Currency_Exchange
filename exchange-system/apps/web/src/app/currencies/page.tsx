'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';
import { CurrencyDto, CreateCurrencyDto } from '@exchange/shared';

function CurrencyModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateCurrencyDto>({
    code: '',
    nameEn: '',
    nameAr: '',
    symbol: '',
    sortOrder: undefined,
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: CreateCurrencyDto) => api.post('/currencies', data),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to save currency');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add Currency</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="space-y-3">
          {(['code', 'nameEn', 'nameAr', 'symbol'] as const).map((f) => (
            <div key={f}>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">{f}</label>
              <input
                value={(form[f] as string) ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value ? Number(e.target.value) : undefined }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="bg-[#0a146e] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#070e57] disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CurrenciesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: currencies, isLoading } = useQuery<CurrencyDto[]>({
    queryKey: ['currencies-all'],
    queryFn: () => api.get('/currencies').then((r) => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/currencies/${id}/${active ? 'activate' : 'deactivate'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currencies-all'] }),
  });

  return (
    <AppShell>
      <PageHeader
        title="Currencies"
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="bg-[#0a146e] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#070e57]"
          >
            + Add Currency
          </button>
        }
      />

      {showAdd && (
        <CurrencyModal
          onClose={() => setShowAdd(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['currencies-all'] })}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0a146e] border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-200">
                <th className="text-left px-5 py-3">Code</th>
                <th className="text-left px-5 py-3">Name (EN)</th>
                <th className="text-left px-5 py-3">Name (AR)</th>
                <th className="text-left px-5 py-3">Symbol</th>
                <th className="text-left px-5 py-3">Sort</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {currencies?.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 font-bold">{c.code}</td>
                  <td className="px-5 py-3">{c.nameEn}</td>
                  <td className="px-5 py-3 font-arabic">{c.nameAr}</td>
                  <td className="px-5 py-3">{c.symbol}</td>
                  <td className="px-5 py-3 text-gray-400">{c.sortOrder ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => toggleActive.mutate({ id: c.id, active: !c.isActive })}
                      className="text-xs text-[#0a146e] hover:underline"
                    >
                      {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
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
