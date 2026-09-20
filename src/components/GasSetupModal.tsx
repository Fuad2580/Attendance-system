import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Code2,
  Copy,
  Check,
  ExternalLink,
  X,
  Sparkles,
  Link,
  RefreshCw,
  FileCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { GAS_SCRIPTS } from '../utils/gasExporter';
import { sendGasAction } from '../services/sheetSyncService';

interface GasSetupModalProps {
  onClose: () => void;
}

export const GasSetupModal: React.FC<GasSetupModalProps> = ({ onClose }) => {
  const { gasUrl, setGasUrl, isSyncingGas, syncGas, spreadsheetUrl, spreadsheetId } = useApp();

  const [selectedFile, setSelectedFile] = useState<keyof typeof GAS_SCRIPTS>('SetupSheets.gs');
  const [copied, setCopied] = useState(false);
  const [inputUrl, setInputUrl] = useState(gasUrl);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_SCRIPTS[selectedFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setGasUrl(inputUrl);
    const res = await syncGas(inputUrl);
    setSyncStatus(res);
    if (res.success && inputUrl) {
      // Auto-save this URL to the CONFIG sheet in Google Sheets so all devices connect automatically!
      sendGasAction(inputUrl, 'saveConfig', {
        key: 'GAS Web App URL',
        value: inputUrl,
        desc: 'URL Web App Apps Script berakhiran /exec agar semua device otomatis tersambung',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-4xl w-full h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Google Apps Script Deployment & Setup</span>
              </h2>
              <p className="text-xs text-slate-500">
                Panduan instalasi backend Apps Script dan deployment Google Spreadsheet Anda
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Connected Target Spreadsheet Banner */}
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>Target Spreadsheet Terkoneksi</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-mono font-normal">Active</span>
                </p>
                <p className="text-[11px] text-emerald-700 font-mono">
                  ID: {spreadsheetId}
                </p>
              </div>
            </div>

            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Spreadsheet Ini</span>
            </a>
          </div>

          {/* Quick Steps Guide */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>3 Langkah Mudah Menghubungkan Google Spreadsheet:</span>
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-slate-600 pl-1 leading-relaxed">
              <li>
                Buka Google Spreadsheet target Anda ({' '}
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline font-semibold inline-flex items-center gap-0.5"
                >
                  klik disini untuk membuka <ExternalLink className="w-3 h-3" />
                </a>{' '}
                ), lalu klik menu{' '}
                <strong className="text-slate-900">Extensions &gt; Apps Script</strong>.
              </li>
              <li>
                Salin file <code className="bg-white px-1.5 py-0.5 rounded border font-bold text-slate-800">SetupSheets.gs</code> di bawah ke editor Apps Script, lalu klik tombol <strong className="text-slate-900">Run</strong> pada fungsi{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border font-bold text-slate-800">initializeRetailAttendanceSheets()</code>. Seluruh 8 sheet skema database retail akan terbuat otomatis!
              </li>
              <li>
                Buat file baru bernama <code className="bg-white px-1.5 py-0.5 rounded border font-bold text-slate-800">Code.gs</code>, salin kode API di bawah, lalu klik{' '}
                <strong className="text-slate-900">Deploy &gt; New deployment &gt; Select type: Web app</strong>{' '}
                (atur <em>Execute as: Me</em> dan <em>Who has access: Anyone</em>). Salin URL Web App yang dihasilkan ke kotak di bawah untuk live sync.
              </li>
            </ol>
          </div>

          {/* Web App URL Connector */}
          <form
            onSubmit={handleConnect}
            className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-indigo-600" />
                <span>Google Apps Script Web App URL (Live Sync)</span>
              </label>
              <span className="text-[11px] text-indigo-700">Opsional untuk sinkronisasi cloud langsung</span>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 text-xs p-2.5 border border-indigo-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <button
                type="submit"
                disabled={isSyncingGas}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                {isSyncingGas ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Test Koneksi</span>
              </button>
            </div>

            {syncStatus && (
              <div
                className={`p-2.5 rounded-lg text-xs font-medium ${
                  syncStatus.success
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-rose-100 text-rose-900 border border-rose-200'
                }`}
              >
                {syncStatus.message}
              </div>
            )}
          </form>

          {/* Code Viewer and Copy Tool */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* File switcher tabs */}
              <div className="flex items-center gap-1.5">
                {(Object.keys(GAS_SCRIPTS) as Array<keyof typeof GAS_SCRIPTS>).map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => setSelectedFile(fileName)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      selectedFile === fileName
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {fileName}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Code Block */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-200 font-mono text-xs p-4 shadow-inner">
              <div className="text-[10px] text-slate-400 mb-2 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>File: {selectedFile}</span>
                <span>Google Apps Script (.gs)</span>
              </div>
              <pre className="max-h-72 overflow-y-auto overflow-x-auto leading-relaxed">
                {GAS_SCRIPTS[selectedFile]}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
