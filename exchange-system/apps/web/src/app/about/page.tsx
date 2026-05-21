'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { Info } from 'lucide-react';

const INFO_ROWS = [
  { label: 'System Name', value: 'Exchange Manager (RMX2)' },
  { label: 'Version', value: '2.0.0' },
  { label: 'Base Currency', value: 'GBP (£)' },
];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="w-40 text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default function AboutPage() {
  return (
    <AppShell>
      <PageHeader title="About" />

      <div className="max-w-2xl space-y-6">
        {/* System info card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-[#0a146e]/10 rounded-lg flex items-center justify-center">
              <Info size={20} className="text-[#0a146e]" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">System Information</h2>
          </div>
          {INFO_ROWS.map((r) => (
            <InfoRow key={r.label} label={r.label} value={r.value} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
