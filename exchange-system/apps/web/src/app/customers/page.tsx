'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Upload, Download, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerDoc {
  id: string;
  docType: 'PASSPORT' | 'PASSPORT_CARD' | 'NATIONAL_ID' | 'DRIVING_LICENSE';
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: { fullName: string; username: string };
}

interface CustomerSummary {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  totalTransactions: number;
  totalDocuments: number;
  createdAt: string;
}

interface CustomerDetail extends CustomerSummary {
  documents: CustomerDoc[];
  _count: { transactions: number };
}

const DOC_TYPE_LABELS: Record<string, string> = {
  PASSPORT: 'Passport',
  PASSPORT_CARD: 'Passport Card',
  NATIONAL_ID: 'National ID',
  DRIVING_LICENSE: 'Driving License',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload() {
    if (!file || !docType) { setError('Please select a document type and file.'); return; }
    setUploading(true);
    setError('');
    try {
      const form = new window.FormData();
      form.append('file', file);
      form.append('docType', docType);
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const res = await fetch(`/api/v1/customers/${customerId}/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.message ?? 'Upload failed');
        return;
      }
      await qc.invalidateQueries({ queryKey: ['customer-detail', customerId] });
      onClose();
    } catch (e) {
      setError((e as Error).message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Upload Identity Document</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
          >
            <option value="">Select type…</option>
            <option value="PASSPORT">Passport</option>
            <option value="PASSPORT_CARD">Passport Card</option>
            <option value="NATIONAL_ID">National ID</option>
            <option value="DRIVING_LICENSE">Driving License</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">File (max 10 MB)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > 10 * 1024 * 1024) {
                setError('File too large — max 10 MB');
                e.target.value = '';
                return;
              }
              setFile(f);
              setError('');
            }}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && (
            <p className="text-xs text-gray-500 mt-1">{file.name} — {formatBytes(file.size)}</p>
          )}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 text-sm bg-[#0a146e] text-white rounded-lg hover:bg-[#060d52] disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : <><Upload size={14} className="inline me-1" />Upload</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Customer Row (expandable) ─────────────────────────────────────────────────

function CustomerRow({ customer }: { customer: CustomerSummary }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { data: detail, isLoading: detailLoading } = useQuery<CustomerDetail>({
    queryKey: ['customer-detail', customer.id],
    queryFn: () => api.get(`/customers/${customer.id}`).then((r) => r.data),
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ docId }: { docId: string }) =>
      api.delete(`/customers/${customer.id}/documents/${docId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-detail', customer.id] }),
  });

  function handleDownload(docId: string, originalName: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const a = document.createElement('a');
    a.href = `/api/v1/customers/${customer.id}/documents/${docId}/download`;
    // Add auth header via a hidden fetch + blob URL trick
    void fetch(a.href, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(async (res) => {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = originalName;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <>
      <tr
        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((x) => !x)}
      >
        <td className="px-4 py-3 text-gray-400 w-8">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td className="px-4 py-3 font-medium text-gray-900">{customer.name}</td>
        <td className="px-4 py-3 font-mono text-xs text-gray-600">{customer.phone}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{customer.email ?? '—'}</td>
        <td className="px-4 py-3 text-center text-sm">{customer.totalTransactions}</td>
        <td className="px-4 py-3 text-center text-sm">{customer.totalDocuments}</td>
        <td className="px-4 py-3 text-xs text-gray-400">
          {new Date(customer.createdAt).toLocaleDateString()}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={7} className="px-6 py-4">
            {detailLoading ? (
              <p className="text-sm text-gray-400 animate-pulse">Loading documents…</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Identity Documents ({detail?.documents.length ?? 0})
                  </h4>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowUploadModal(true); }}
                    className="flex items-center gap-1.5 text-xs bg-[#0a146e] text-white px-3 py-1.5 rounded-lg hover:bg-[#060d52]"
                  >
                    <Upload size={13} /> Upload Document
                  </button>
                </div>

                {detail?.documents.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No documents uploaded yet.</p>
                )}

                <div className="space-y-2">
                  {detail?.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-gray-800">
                          {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                        </div>
                        <div className="text-xs text-gray-500">
                          {doc.originalName} · {formatBytes(doc.fileSize)} · uploaded by {doc.uploadedBy.fullName}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(doc.uploadedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(doc.id, doc.originalName); }}
                          className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 rounded px-2.5 py-1.5 hover:bg-blue-50"
                        >
                          <Download size={12} /> Download
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete ${doc.originalName}?`)) {
                                deleteMutation.mutate({ docId: doc.id });
                              }
                            }}
                            className="flex items-center gap-1 text-xs text-red-600 border border-red-200 rounded px-2.5 py-1.5 hover:bg-red-50"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}

      {showUploadModal && (
        <UploadModal customerId={customer.id} onClose={() => setShowUploadModal(false)} />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [search, setSearch] = useState('');

  const { data: customers, isLoading } = useQuery<CustomerSummary[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers?limit=500').then((r) => r.data),
  });

  const filtered = (customers ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell permission="customers">
      <PageHeader
        title="Customer Inventory"
        subtitle="Customer details and proof-of-identity documents"
      />

      <div className="max-w-6xl space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
          />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-[#0a146e]">{customers?.length ?? 0}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Customers</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {customers?.reduce((s, c) => s + c.totalTransactions, 0) ?? 0}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Total Transactions</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">
              {customers?.reduce((s, c) => s + c.totalDocuments, 0) ?? 0}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Documents Stored</div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 animate-pulse">
            Loading customers…
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a146e] text-white text-xs uppercase">
                  <th className="w-8 px-4 py-3"></th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Phone</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-center px-4 py-3">Transactions</th>
                  <th className="text-center px-4 py-3">Documents</th>
                  <th className="text-left px-4 py-3">Customer Since</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <CustomerRow key={c.id} customer={c} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-400 py-12">
                      {search ? 'No customers match your search' : 'No customers yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
