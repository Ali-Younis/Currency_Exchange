'use client';

import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { useState, useEffect, useRef } from 'react';

type Locale = 'en' | 'ar';

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((r) => r.startsWith(`${name}=`))
    ?.split('=')[1];
}

const API = '/api/v1';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function getSetting(key: string): Promise<string | null> {
  const r = await fetch(`${API}/app-settings/${key}`, { headers: authHeaders() });
  if (!r.ok) return null;
  const d = await r.json();
  return d?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await fetch(`${API}/app-settings/${key}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ value }),
  });
}

/** Convert a stored UTC "HH:MM" string to the browser's local "HH:MM" for display */
function utcTimeToLocal(utcHHMM: string): string {
  const [h, m] = utcHHMM.split(':').map(Number);
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Convert a browser-local "HH:MM" string to UTC "HH:MM" for storage */
function localTimeToUtc(localHHMM: string): string {
  const [h, m] = localHHMM.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export default function SettingsPage() {
  const [locale, setLocale] = useState<Locale>('en');

  // Logo
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoMsg, setLogoMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // SMTP
  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', pass: '', from: '' });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testMsg, setTestMsg] = useState('');

  // Company details
  const [company, setCompany] = useState({ name: '', address: '', email: '', phone: '' });
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMsg, setCompanyMsg] = useState('');

  // Backup
  const [backupConfig, setBackupConfig] = useState({ directory: '/app/backups', autoTime: '02:00', autoEnabled: false });
  const [backupConfigSaving, setBackupConfigSaving] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Receipt messages
  const [receiptMsg, setReceiptMsgState] = useState({ greeting: '', closing: '' });
  const [receiptMsgSaving, setReceiptMsgSaving] = useState(false);
  const [receiptMsgResult, setReceiptMsgResult] = useState('');

  // Backup last-run status
  const [backupLastRun, setBackupLastRun] = useState<string | null>(null);
  const [backupLastStatus, setBackupLastStatus] = useState<string | null>(null);
  const [backupRunning, setBackupRunning] = useState(false);

  // PDF save directory
  const [pdfDir, setPdfDir] = useState('/app/pdf-receipts');
  const [pdfDirSaving, setPdfDirSaving] = useState(false);
  const [pdfDirMsg, setPdfDirMsg] = useState('');

  // PDF file browser
  type StoredFile = { name: string; size: number; modifiedAt: string };
  const [pdfFiles, setPdfFiles] = useState<StoredFile[]>([]);
  const [pdfFilesLoading, setPdfFilesLoading] = useState(false);
  const [pdfFilesMsg, setPdfFilesMsg] = useState('');

  // Backup file browser
  const [backupFiles, setBackupFiles] = useState<StoredFile[]>([]);
  const [backupFilesLoading, setBackupFilesLoading] = useState(false);
  const [backupFilesMsg, setBackupFilesMsg] = useState('');

  useEffect(() => {
    const stored = getCookie('locale') as Locale | undefined;
    if (stored === 'en' || stored === 'ar') setLocale(stored);
  }, []);

  useEffect(() => {
    getSetting('logo_base64').then((v) => { if (v) setLogoPreview(v); });
    Promise.all([
      getSetting('smtp_host'),
      getSetting('smtp_port'),
      getSetting('smtp_user'),
      getSetting('smtp_from'),
    ]).then(([host, port, user, from]) => {
      setSmtp((s) => ({
        ...s,
        host: host ?? '',
        port: port ?? '587',
        user: user ?? '',
        from: from ?? '',
      }));
    });
    // Company details
    Promise.all([
      getSetting('company_name'),
      getSetting('company_address'),
      getSetting('company_email'),
      getSetting('company_phone'),
    ]).then(([name, address, email, phone]) => {
      setCompany({ name: name ?? '', address: address ?? '', email: email ?? '', phone: phone ?? '' });
    });
    // Backup config
    fetch(`${API}/backup/config`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setBackupConfig({ directory: d.directory, autoTime: d.autoTime ? utcTimeToLocal(d.autoTime) : '02:00', autoEnabled: d.autoEnabled });
          if (d.lastRun) setBackupLastRun(d.lastRun);
          if (d.lastStatus) setBackupLastStatus(d.lastStatus);
        }
      })
      .catch(() => {});
    // Receipt messages
    Promise.all([getSetting('receipt_greeting'), getSetting('receipt_closing')])
      .then(([greeting, closing]) => {
        setReceiptMsgState({ greeting: greeting ?? '', closing: closing ?? '' });
      });
    // PDF save directory
    getSetting('pdf_save_directory').then((v) => { if (v) setPdfDir(v); });
  }, []);

  function handleLocaleChange(l: Locale) {
    setLocale(l);
    setCookie('locale', l);
    window.location.reload();
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 400;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setLogoPreview(canvas.toDataURL('image/jpeg', 0.8));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function saveLogo() {
    if (!logoPreview) return;
    setLogoSaving(true);
    setLogoMsg('');
    try {
      const r = await fetch(`${API}/app-settings/logo_base64`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ value: logoPreview }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setLogoMsg('Logo saved successfully.');
    } catch (err) {
      setLogoMsg(`Failed to save logo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLogoSaving(false);
    }
  }

  function removeLogo() {
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function saveSmtp() {
    setSmtpSaving(true);
    setSmtpMsg('');
    await Promise.all([
      setSetting('smtp_host', smtp.host),
      setSetting('smtp_port', smtp.port),
      setSetting('smtp_user', smtp.user),
      setSetting('smtp_pass', smtp.pass),
      setSetting('smtp_from', smtp.from),
    ]);
    setSmtpMsg('SMTP settings saved.');
    setSmtpSaving(false);
  }

  async function sendTestEmail() {
    setTestMsg('');
    const r = await fetch(`${API}/app-settings/email/test`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ to: testEmail }),
    });
    setTestMsg(r.ok ? 'Test email sent!' : 'Failed to send test email.');
  }

  async function saveCompany() {
    setCompanySaving(true);
    setCompanyMsg('');
    await Promise.all([
      setSetting('company_name', company.name),
      setSetting('company_address', company.address),
      setSetting('company_email', company.email),
      setSetting('company_phone', company.phone),
    ]);
    setCompanyMsg('Company details saved.');
    setCompanySaving(false);
  }

  async function downloadBackup() {
    setBackupMsg('');
    try {
      const r = await fetch(`${API}/backup/export`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const name = `RMX2_Exchange_Backup_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      setBackupMsg('Backup downloaded successfully.');
    } catch (err) {
      setBackupMsg(`Backup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function restoreBackup() {
    if (!restoreFile) return;
    setRestoring(true);
    setRestoreMsg('');
    try {
      const text = await restoreFile.text();
      const backup = JSON.parse(text);
      const r = await fetch(`${API}/backup/import`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ backup }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRestoreMsg('✓ Restore completed successfully. Please refresh the page.');
    } catch (err) {
      setRestoreMsg(`Restore failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRestoring(false);
    }
  }

  async function saveBackupConfig() {
    setBackupConfigSaving(true);
    try {
      await fetch(`${API}/backup/config`, {
        method: 'PUT',
        headers: authHeaders(),
        // Convert user-entered local time to UTC before storing
        body: JSON.stringify({ ...backupConfig, autoTime: localTimeToUtc(backupConfig.autoTime) }),
      });
      setBackupMsg('Auto-backup settings saved.');
    } catch { setBackupMsg('Failed to save backup settings.'); }
    setBackupConfigSaving(false);
  }

  async function runBackupNow() {
    setBackupRunning(true);
    setBackupMsg('');
    try {
      const r = await fetch(`${API}/backup/run-now`, { method: 'POST', headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const config = await fetch(`${API}/backup/config`, { headers: authHeaders() }).then((res) => res.json());
      if (config.lastRun) setBackupLastRun(config.lastRun);
      if (config.lastStatus) setBackupLastStatus(config.lastStatus);
      setBackupMsg('Backup completed successfully.');
    } catch (err) {
      setBackupMsg(`Backup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setBackupRunning(false);
  }

  async function saveReceiptMessages() {
    setReceiptMsgSaving(true);
    setReceiptMsgResult('');
    await Promise.all([
      setSetting('receipt_greeting', receiptMsg.greeting),
      setSetting('receipt_closing', receiptMsg.closing),
    ]);
    setReceiptMsgResult('Receipt messages saved.');
    setReceiptMsgSaving(false);
  }

  async function savePdfDirectory() {
    setPdfDirSaving(true);
    setPdfDirMsg('');
    await setSetting('pdf_save_directory', pdfDir);
    setPdfDirMsg('PDF save directory saved.');
    setPdfDirSaving(false);
  }

  async function loadPdfFiles() {
    setPdfFilesLoading(true);
    setPdfFilesMsg('');
    try {
      const r = await fetch(`${API}/backup/pdf-files`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setPdfFiles(await r.json());
    } catch (err) {
      setPdfFilesMsg(`Failed to load files: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setPdfFilesLoading(false);
  }

  async function deletePdfFile(filename: string) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    try {
      const r = await fetch(`${API}/backup/pdf-files/${encodeURIComponent(filename)}`, { method: 'DELETE', headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setPdfFiles((prev) => prev.filter((f) => f.name !== filename));
    } catch (err) {
      setPdfFilesMsg(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function downloadPdfFile(filename: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const url = `${API}/backup/pdf-files/${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    // Attach token via a fetch-blob approach
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => { setPdfFilesMsg('Download failed.'); });
  }

  async function loadBackupFiles() {
    setBackupFilesLoading(true);
    setBackupFilesMsg('');
    try {
      const r = await fetch(`${API}/backup/stored-files`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setBackupFiles(await r.json());
    } catch (err) {
      setBackupFilesMsg(`Failed to load files: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setBackupFilesLoading(false);
  }

  async function deleteBackupFile(filename: string) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    try {
      const r = await fetch(`${API}/backup/stored-files/${encodeURIComponent(filename)}`, { method: 'DELETE', headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setBackupFiles((prev) => prev.filter((f) => f.name !== filename));
    } catch (err) {
      setBackupFilesMsg(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function downloadBackupFile(filename: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const url = `${API}/backup/stored-files/${encodeURIComponent(filename)}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => { setBackupFilesMsg('Download failed.'); });
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <AppShell>
      <PageHeader title="Settings" />

      <div className="max-w-2xl space-y-6">
        {/* Language */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Display Language / لغة العرض</h3>
          <div className="flex gap-3">
            {(['en', 'ar'] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLocaleChange(l)}
                className={`flex-1 py-3 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  locale === l
                    ? 'border-[#0a146e] bg-[#0a146e] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-[#0a146e]'
                }`}
              >
                {l === 'en' ? 'English' : 'العربية'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Page will reload to apply the new language.
          </p>
        </div>

        {/* Logo */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Company Logo</h3>
          {logoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Logo preview" className="h-16 object-contain mb-4 border border-gray-100 rounded p-1" />
          )}
          <div className="flex gap-3 items-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleLogoFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-[#0a146e] hover:text-[#0a146e]"
            >
              Choose File
            </button>
            <button
              onClick={saveLogo}
              disabled={!logoPreview || logoSaving}
              className="px-4 py-2 text-sm bg-[#0a146e] text-white rounded-lg disabled:opacity-50"
            >
              {logoSaving ? 'Saving…' : 'Save Logo'}
            </button>
          </div>
          {logoMsg && (
            <p className={`text-xs mt-2 ${logoMsg.startsWith('Failed') ? 'text-red-500' : 'text-green-600'}`}>
              {logoMsg}
            </p>
          )}
        </div>

        {/* SMTP */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">SMTP / Email Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'SMTP Host', key: 'host' as const },
              { label: 'SMTP Port', key: 'port' as const },
              { label: 'SMTP Username', key: 'user' as const },
              { label: 'From Address', key: 'from' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="text"
                  value={smtp[key]}
                  onChange={(e) => setSmtp((s) => ({ ...s, [key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">SMTP Password</label>
              <input
                type="password"
                value={smtp.pass}
                onChange={(e) => setSmtp((s) => ({ ...s, pass: e.target.value }))}
                placeholder="Leave blank to keep existing"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4 items-center">
            <button
              onClick={saveSmtp}
              disabled={smtpSaving}
              className="px-4 py-2 text-sm bg-[#0a146e] text-white rounded-lg disabled:opacity-50"
            >
              {smtpSaving ? 'Saving…' : 'Save SMTP'}
            </button>
            {smtpMsg && <span className="text-xs text-green-600">{smtpMsg}</span>}
          </div>

          {/* Test email */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Send a test email to verify SMTP settings:</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={sendTestEmail}
                disabled={!testEmail}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 disabled:opacity-50"
              >
                Send Test
              </button>
            </div>
            {testMsg && <p className="text-xs mt-2 text-blue-600">{testMsg}</p>}
          </div>
        </div>

        {/* Company Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Company Details</h3>
          <p className="text-xs text-gray-400 mb-4">Shown at the top of PDF receipts.</p>
          <div className="space-y-3">
            {[
              { label: 'Company Name', key: 'name' as const, placeholder: 'RMX2 Exchange' },
              { label: 'Address', key: 'address' as const, placeholder: '123 High Street, London, UK' },
              { label: 'Email', key: 'email' as const, placeholder: 'info@rmx2.com' },
              { label: 'Phone', key: 'phone' as const, placeholder: '+44 20 1234 5678' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="text"
                  value={company[key]}
                  onChange={(e) => setCompany((c) => ({ ...c, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
                />
              </div>
            ))}
          </div>
          <button
            onClick={saveCompany}
            disabled={companySaving}
            className="mt-4 px-5 py-2 text-sm bg-[#0a146e] text-white rounded-lg hover:bg-[#070e57] disabled:opacity-50"
          >
            {companySaving ? 'Saving…' : 'Save Company Details'}
          </button>
          {companyMsg && <p className="text-xs mt-2 text-green-600">{companyMsg}</p>}
        </div>

        {/* Receipt Messages */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Receipt Messages</h3>
          <p className="text-xs text-gray-400 mb-4">
            Customize the greeting and closing text on email and PDF receipts. Use{' '}
            <code className="bg-gray-100 px-1 rounded text-gray-700">{'{customerName}'}</code> and{' '}
            <code className="bg-gray-100 px-1 rounded text-gray-700">{'{companyName}'}</code> as placeholders.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Greeting Message</label>
              <textarea
                value={receiptMsg.greeting}
                onChange={(e) => setReceiptMsgState((m) => ({ ...m, greeting: e.target.value }))}
                rows={3}
                placeholder={`Dear {customerName},\n\nThank you for your transaction.`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Closing Message</label>
              <textarea
                value={receiptMsg.closing}
                onChange={(e) => setReceiptMsgState((m) => ({ ...m, closing: e.target.value }))}
                rows={3}
                placeholder="Thank you for choosing {companyName} for your currency exchange needs."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
              />
            </div>
          </div>
          <button
            onClick={saveReceiptMessages}
            disabled={receiptMsgSaving}
            className="mt-4 px-5 py-2 text-sm bg-[#0a146e] text-white rounded-lg hover:bg-[#070e57] disabled:opacity-50"
          >
            {receiptMsgSaving ? 'Saving…' : 'Save Receipt Messages'}
          </button>
          {receiptMsgResult && <p className="text-xs mt-2 text-green-600">{receiptMsgResult}</p>}
        </div>

        {/* Backup & Restore */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Backup &amp; Restore</h3>

          {/* Manual backup */}
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Manual Backup</p>
            <p className="text-xs text-gray-400 mb-3">Download a full JSON backup of all system data.</p>
            <button
              onClick={downloadBackup}
              className="px-5 py-2 text-sm bg-[#0a146e] text-white rounded-lg hover:bg-[#070e57]"
            >
              ⬇ Download Backup
            </button>
          </div>

          {/* Restore */}
          <div className="border-t border-gray-100 pt-5 mb-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Restore from Backup</p>
            <p className="text-xs text-amber-600 mb-3">⚠ This will overwrite ALL current data. Ensure you have a recent backup first.</p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600"
              />
              <button
                onClick={restoreBackup}
                disabled={!restoreFile || restoring}
                className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {restoring ? 'Restoring…' : 'Restore'}
              </button>
            </div>
            {restoreMsg && (
              <p className={`text-xs mt-2 ${restoreMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                {restoreMsg}
              </p>
            )}
          </div>

          {/* Auto-backup */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-medium text-gray-700 mb-3">Automated Daily Backup</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500 w-36">Enable Auto-Backup</label>
                <button
                  onClick={() => setBackupConfig((c) => ({ ...c, autoEnabled: !c.autoEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${backupConfig.autoEnabled ? 'bg-[#0a146e]' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${backupConfig.autoEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Backup Time — your local time
                </label>
                <input
                  type="time"
                  value={backupConfig.autoTime}
                  onChange={(e) => setBackupConfig((c) => ({ ...c, autoTime: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Stored as UTC {backupConfig.autoTime ? localTimeToUtc(backupConfig.autoTime) : '--:--'} — enter in your local time, DST is handled automatically.
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Save Directory (server path)</label>
                <input
                  type="text"
                  value={backupConfig.directory}
                  onChange={(e) => setBackupConfig((c) => ({ ...c, directory: e.target.value }))}
                  placeholder="/app/backups"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Files saved as: <span className="font-mono">RMX2_Exchange_Backup_YYYY-MM-DD_HH-MM-SS.json</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-4 items-center">
              <button
                onClick={saveBackupConfig}
                disabled={backupConfigSaving}
                className="px-5 py-2 text-sm bg-[#0a146e] text-white rounded-lg hover:bg-[#070e57] disabled:opacity-50"
              >
                {backupConfigSaving ? 'Saving…' : 'Save Auto-Backup Settings'}
              </button>
              <button
                onClick={runBackupNow}
                disabled={backupRunning}
                className="px-5 py-2 text-sm border border-[#0a146e] text-[#0a146e] rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {backupRunning ? 'Running…' : 'Run Now'}
              </button>
            </div>
            {backupLastRun && (
              <p className={`text-xs mt-2 ${backupLastStatus?.startsWith('failed') ? 'text-red-500' : 'text-green-600'}`}>
                Last backup: {new Date(backupLastRun).toLocaleString()} —{' '}
                {backupLastStatus?.startsWith('failed') ? `✗ ${backupLastStatus}` : '✓ Success'}
              </p>
            )}
            {backupMsg && (
              <p className={`text-xs mt-1 ${backupMsg.includes('failed') || backupMsg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>
                {backupMsg}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Backup files are saved to the Docker volume. Use the &apos;Download Backup&apos; button above to export and save a copy locally.
            </p>

            {/* Backup file browser */}
            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">Stored Backup Files</p>
                <button
                  onClick={loadBackupFiles}
                  disabled={backupFilesLoading}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[#0a146e] hover:text-[#0a146e] disabled:opacity-50"
                >
                  {backupFilesLoading ? 'Loading…' : '↻ Refresh'}
                </button>
              </div>
              {backupFilesMsg && <p className="text-xs mb-2 text-red-500">{backupFilesMsg}</p>}
              {backupFiles.length === 0 && !backupFilesLoading ? (
                <p className="text-xs text-gray-400 italic">Click Refresh to load backup files from the server.</p>
              ) : (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">File Name</th>
                        <th className="text-right px-3 py-2 font-medium">Size</th>
                        <th className="text-right px-3 py-2 font-medium">Date</th>
                        <th className="text-right px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backupFiles.map((file) => (
                        <tr key={file.name} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-gray-700 truncate max-w-[180px]">{file.name}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{formatBytes(file.size)}</td>
                          <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                            {new Date(file.modifiedAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => downloadBackupFile(file.name)}
                                className="px-2 py-1 text-[#0a146e] border border-[#0a146e] rounded text-xs hover:bg-[#0a146e] hover:text-white"
                              >
                                ⬇ Download
                              </button>
                              <button
                                onClick={() => deleteBackupFile(file.name)}
                                className="px-2 py-1 text-red-600 border border-red-300 rounded text-xs hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PDF Receipt Storage */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">PDF Receipt Storage</h3>
          <p className="text-xs text-gray-400 mb-4">
            Automatically save a copy of each PDF receipt to a server folder after every transaction.
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Save Directory (server path)</label>
            <input
              type="text"
              value={pdfDir}
              onChange={(e) => setPdfDir(e.target.value)}
              placeholder="/app/pdf-receipts"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a146e]"
            />
            <p className="text-xs text-gray-400 mt-1">
              PDF receipts are saved inside the Docker volume. Access via Docker or mount the volume to a host path.
            </p>
          </div>
          <button
            onClick={savePdfDirectory}
            disabled={pdfDirSaving}
            className="mt-4 px-5 py-2 text-sm bg-[#0a146e] text-white rounded-lg hover:bg-[#070e57] disabled:opacity-50"
          >
            {pdfDirSaving ? 'Saving…' : 'Save PDF Directory'}
          </button>
          {pdfDirMsg && <p className="text-xs mt-2 text-green-600">{pdfDirMsg}</p>}

          {/* PDF file browser */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">Stored PDF Receipts</p>
              <button
                onClick={loadPdfFiles}
                disabled={pdfFilesLoading}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[#0a146e] hover:text-[#0a146e] disabled:opacity-50"
              >
                {pdfFilesLoading ? 'Loading…' : '↻ Refresh'}
              </button>
            </div>
            {pdfFilesMsg && <p className="text-xs mb-2 text-red-500">{pdfFilesMsg}</p>}
            {pdfFiles.length === 0 && !pdfFilesLoading ? (
              <p className="text-xs text-gray-400 italic">Click Refresh to load files from the server.</p>
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">File Name</th>
                      <th className="text-right px-3 py-2 font-medium">Size</th>
                      <th className="text-right px-3 py-2 font-medium">Date</th>
                      <th className="text-right px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdfFiles.map((file) => (
                      <tr key={file.name} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-700 truncate max-w-[180px]">{file.name}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{formatBytes(file.size)}</td>
                        <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                          {new Date(file.modifiedAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => downloadPdfFile(file.name)}
                              className="px-2 py-1 text-[#0a146e] border border-[#0a146e] rounded text-xs hover:bg-[#0a146e] hover:text-white"
                            >
                              ⬇ View
                            </button>
                            <button
                              onClick={() => deletePdfFile(file.name)}
                              className="px-2 py-1 text-red-600 border border-red-300 rounded text-xs hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}


