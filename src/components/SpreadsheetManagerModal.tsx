import { resolveZone } from '../utils/timezone';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Table,
  Save,
  RotateCcw,
  Download,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Shield,
  FileSpreadsheet,
  ExternalLink,
  Link2,
  Edit3,
  Copy,
  Check,
} from 'lucide-react';
import { AppConfig, LocationMaster, Manpower } from '../types';

interface SpreadsheetManagerModalProps {
  onClose: () => void;
}

export const SpreadsheetManagerModal: React.FC<SpreadsheetManagerModalProps> = ({ onClose }) => {
  const {
    config,
    updateConfig,
    locations,
    updateLocations,
    manpower,
    updateManpower,
    attendance,
    requests,
    approvals,
    faceRegisters,
    auditLogs,
    resetAllDataToDefault,
    spreadsheetUrl,
    spreadsheetId,
    setSpreadsheetUrl,
  } = useApp();

  type SheetName =
    | 'CONFIG'
    | 'MANPOWER'
    | 'LOCATION_MASTER'
    | 'ATTENDANCE'
    | 'REQUEST'
    | 'APPROVAL'
    | 'FACE_REGISTER'
    | 'AUDIT_LOG';

  const [activeSheet, setActiveSheet] = useState<SheetName>('CONFIG');
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editUrlValue, setEditUrlValue] = useState(spreadsheetUrl);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const sheets: SheetName[] = [
    'CONFIG',
    'MANPOWER',
    'LOCATION_MASTER',
    'ATTENDANCE',
    'REQUEST',
    'APPROVAL',
    'FACE_REGISTER',
    'AUDIT_LOG',
  ];

  const handleSaveConfig = () => {
    updateConfig(localConfig);
    setSaveSuccessMsg('Parameter konfigurasi tersimpan! Sistem langsung menerapkan nilai baru tanpa ubah kode.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setSpreadsheetUrl(editUrlValue);
    setIsEditingUrl(false);
    setSaveSuccessMsg('URL Google Spreadsheet berhasil diperbarui!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(spreadsheetUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleReset = () => {
    if (confirm('Reset seluruh Google Sheets data ke sample bawaan?')) {
      resetAllDataToDefault();
      setLocalConfig(config);
      setSaveSuccessMsg('Database telah direset ke initial state.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Google Spreadsheet Master Database</span>
                <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                  Single Source of Truth
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Kelola 8 sheet Google Sheets secara real-time. Perubahan langsung aktif di web app.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 flex items-center gap-1 font-medium"
              title="Reset data ke default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset DB</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Connected Google Spreadsheet Info Bar */}
        <div className="px-6 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950 shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Target Google Spreadsheet:</span>
            </div>
            <code className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 truncate max-w-xs sm:max-w-md" title={spreadsheetUrl}>
              {spreadsheetId}
            </code>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors"
              title="Buka Google Sheets di tab baru"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Google Sheets</span>
            </a>

            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-semibold text-xs transition-colors"
              title="Salin URL Spreadsheet"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Disalin' : 'Salin URL'}</span>
            </button>

            <button
              onClick={() => {
                setIsEditingUrl(!isEditingUrl);
                setEditUrlValue(spreadsheetUrl);
              }}
              className="p-1 text-emerald-700 hover:text-emerald-900 rounded hover:bg-emerald-100 transition-colors"
              title="Ubah URL Google Spreadsheet"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Inline URL Editor Form */}
        {isEditingUrl && (
          <form onSubmit={handleSaveUrl} className="px-6 py-2.5 bg-emerald-100/50 border-b border-emerald-200 flex items-center gap-2">
            <div className="flex-1">
              <input
                type="url"
                value={editUrlValue}
                onChange={(e) => setEditUrlValue(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="w-full text-xs p-2 border border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
            >
              Simpan URL
            </button>
            <button
              type="button"
              onClick={() => setIsEditingUrl(false)}
              className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors shrink-0"
            >
              Batal
            </button>
          </form>
        )}

        {/* Sheet Tabs Bar */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-100/70 shrink-0">
          {sheets.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSheet(s)}
              className={`py-2.5 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                activeSheet === s
                  ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3 h-3 text-slate-400" />
              <span>{s}</span>
            </button>
          ))}
        </div>

        {/* Sheet Data View / Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{saveSuccessMsg}</span>
            </div>
          )}

          {/* 1. CONFIG SHEET */}
          {activeSheet === 'CONFIG' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Sheet: CONFIG</h3>
                  <p className="text-xs text-slate-500">
                    Parameter operasional tanpa perlu ubah kode JavaScript (Aturan #2).
                  </p>
                </div>
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Konfigurasi</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="font-bold text-xs text-slate-800 border-b pb-1.5">
                    Geolocation & Radius Rules
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Attendance Radius Meter
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={localConfig.attendanceRadiusMeter}
                        onChange={(e) =>
                          setLocalConfig({
                            ...localConfig,
                            attendanceRadiusMeter: Number(e.target.value),
                          })
                        }
                        className="w-32 p-2 border border-slate-300 rounded-xl bg-white text-xs font-bold"
                      />
                      <span className="text-xs text-slate-500">meter toleransi GPS</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Ubah ke 150m untuk langsung mengubah radius validasi toko.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Attendance Retention Days
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={localConfig.attendanceRetentionDays}
                        onChange={(e) =>
                          setLocalConfig({
                            ...localConfig,
                            attendanceRetentionDays: Number(e.target.value),
                          })
                        }
                        className="w-32 p-2 border border-slate-300 rounded-xl bg-white text-xs font-bold"
                      />
                      <span className="text-xs text-slate-500">hari (Default: 90 hari)</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="archiveToggle"
                      checked={localConfig.archiveBeforeDelete}
                      onChange={(e) =>
                        setLocalConfig({ ...localConfig, archiveBeforeDelete: e.target.checked })
                      }
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <label htmlFor="archiveToggle" className="text-xs text-slate-700 font-medium">
                      Archive Before Delete (Simpan ke ATTENDANCE_ARCHIVE)
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="font-bold text-xs text-slate-800 border-b pb-1.5">
                    Biometrics & Face Recognition
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={localConfig.requireFaceRecognition}
                        onChange={(e) =>
                          setLocalConfig({
                            ...localConfig,
                            requireFaceRecognition: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span>Require Face Recognition (Wajib verifikasi wajah saat Clock In)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={localConfig.allowFaceRegistration}
                        onChange={(e) =>
                          setLocalConfig({
                            ...localConfig,
                            allowFaceRegistration: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span>Allow Face Registration (Bolehkan pendaftaran wajah baru)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={localConfig.faceConsentRequired}
                        onChange={(e) =>
                          setLocalConfig({
                            ...localConfig,
                            faceConsentRequired: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span>Face Consent Required (Wajibkan persetujuan biometrik)</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Face Match Max Distance (semakin kecil = semakin ketat)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.30"
                      max="0.60"
                      value={localConfig.faceMaxDistance ?? 0.45}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          faceMaxDistance: Number(e.target.value),
                        })
                      }
                      className="w-32 p-2 border border-slate-300 rounded-xl bg-white text-xs font-bold"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Jarak Euclidean descriptor wajah 128-dimensi. Orang yang sama biasanya 0.20-0.45,
                      orang berbeda 0.60-1.10. Rekomendasi: <strong>0.45</strong> (ketat: 0.38).
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 sm:col-span-2">
                  <div className="font-bold text-xs text-slate-800 border-b pb-1.5">
                    Work Hours & Master Toggles
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Work Start Time
                      </label>
                      <input
                        type="time"
                        value={localConfig.workStartTime}
                        onChange={(e) =>
                          setLocalConfig({ ...localConfig, workStartTime: e.target.value })
                        }
                        className="w-full p-2 border border-slate-300 rounded-xl bg-white text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Work End Time
                      </label>
                      <input
                        type="time"
                        value={localConfig.workEndTime}
                        onChange={(e) =>
                          setLocalConfig({ ...localConfig, workEndTime: e.target.value })
                        }
                        className="w-full p-2 border border-slate-300 rounded-xl bg-white text-xs font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="allowIn"
                        checked={localConfig.allowClockIn}
                        onChange={(e) =>
                          setLocalConfig({ ...localConfig, allowClockIn: e.target.checked })
                        }
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <label htmlFor="allowIn" className="text-xs font-semibold text-slate-700">
                        Allow Clock In
                      </label>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="allowOut"
                        checked={localConfig.allowClockOut}
                        onChange={(e) =>
                          setLocalConfig({ ...localConfig, allowClockOut: e.target.checked })
                        }
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <label htmlFor="allowOut" className="text-xs font-semibold text-slate-700">
                        Allow Clock Out
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. MANPOWER SHEET */}
          {activeSheet === 'MANPOWER' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Sheet: MANPOWER</h3>
                  <p className="text-xs text-slate-500">
                    Master data pegawai retail, role level, atasan langsung, dan izin flexible.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">NIK</th>
                      <th className="py-2.5 px-3">Employee Name</th>
                      <th className="py-2.5 px-3">Position</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Homebase</th>
                      <th className="py-2.5 px-3">Flexible</th>
                      <th className="py-2.5 px-3">Supervisor NIK</th>
                      <th className="py-2.5 px-3">Face Reg</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {manpower.map((m) => (
                      <tr key={m.nik} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold">{m.nik}</td>
                        <td className="py-2 px-3 font-medium">{m.employeeName}</td>
                        <td className="py-2 px-3 text-slate-600">{m.position}</td>
                        <td className="py-2 px-3">
                          <span className="font-bold px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">
                            {m.roleLevel}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">{m.homebaseLocationId}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              m.flexibleAttendance
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {m.flexibleAttendance ? 'TRUE' : 'FALSE'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                          {m.supervisorNik || '-'}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-[10px] font-bold ${
                              m.faceRegistered ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {m.faceRegistered ? '✓ YES' : 'NO'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-emerald-700">{m.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. LOCATION_MASTER SHEET */}
          {activeSheet === 'LOCATION_MASTER' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Sheet: LOCATION_MASTER</h3>
                  <p className="text-xs text-slate-500">
                    Master koordinat GPS ruko dan radius toleransi kehadiran.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Location ID</th>
                      <th className="py-2.5 px-3">Location Name</th>
                      <th className="py-2.5 px-3">Address</th>
                      <th className="py-2.5 px-3">Latitude</th>
                      <th className="py-2.5 px-3">Longitude</th>
                      <th className="py-2.5 px-3">Radius (m)</th>
                      <th className="py-2.5 px-3">Zona</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {locations.map((loc) => (
                      <tr key={loc.locationId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold">{loc.locationId}</td>
                        <td className="py-2 px-3 font-medium">{loc.locationName}</td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                          {loc.address}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">{loc.latitude}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{loc.longitude}</td>
                        <td className="py-2 px-3 font-bold text-emerald-700">
                          {loc.radiusMeter || `${config.attendanceRadiusMeter} (Default)`}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-600">
                          {resolveZone(loc).code}
                          {!loc.timeZone && <span className="text-slate-400 font-normal"> (auto)</span>}
                        </td>
                        <td className="py-2 px-3 font-semibold text-emerald-700">{loc.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. ATTENDANCE SHEET */}
          {activeSheet === 'ATTENDANCE' && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Sheet: ATTENDANCE</h3>
                <p className="text-xs text-slate-500">
                  Seluruh transaksi kehadiran masuk dan keluar retail.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">NIK</th>
                      <th className="py-2.5 px-3">Nama</th>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Waktu</th>
                      <th className="py-2.5 px-3">Tipe</th>
                      <th className="py-2.5 px-3">Lokasi</th>
                      <th className="py-2.5 px-3">Homebase</th>
                      <th className="py-2.5 px-3">Jarak</th>
                      <th className="py-2.5 px-3">Face Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendance.map((a) => (
                      <tr key={a.attendanceId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-400">
                          {a.attendanceId}
                        </td>
                        <td className="py-2 px-3 font-mono">{a.nik}</td>
                        <td className="py-2 px-3 font-medium">{a.employeeName}</td>
                        <td className="py-2 px-3">{a.date}</td>
                        <td className="py-2 px-3 font-bold">{a.time}</td>
                        <td className="py-2 px-3 font-bold">{a.type}</td>
                        <td className="py-2 px-3">{a.locationName}</td>
                        <td className="py-2 px-3 text-[11px] text-slate-500">{a.homebase}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{a.distance}m</td>
                        <td className="py-2 px-3 text-emerald-700 font-bold">
                          {a.faceVerified ? 'TRUE' : 'FALSE'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. REQUEST SHEET */}
          {activeSheet === 'REQUEST' && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Sheet: REQUEST</h3>
                <p className="text-xs text-slate-500">
                  Data pengajuan lembur, koreksi absensi, dan cuti pegawai.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Request ID</th>
                      <th className="py-2.5 px-3">NIK</th>
                      <th className="py-2.5 px-3">Nama</th>
                      <th className="py-2.5 px-3">Tipe</th>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Alasan</th>
                      <th className="py-2.5 px-3">Approver NIK</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.map((r) => (
                      <tr key={r.requestId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-[11px] font-bold">{r.requestId}</td>
                        <td className="py-2 px-3 font-mono">{r.nik}</td>
                        <td className="py-2 px-3 font-medium">{r.employeeName}</td>
                        <td className="py-2 px-3 font-semibold">{r.requestType}</td>
                        <td className="py-2 px-3">{r.startDate}</td>
                        <td className="py-2 px-3 text-[11px] max-w-xs truncate">{r.reason}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{r.currentApproverNik}</td>
                        <td className="py-2 px-3 font-bold">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. APPROVAL SHEET */}
          {activeSheet === 'APPROVAL' && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Sheet: APPROVAL</h3>
                <p className="text-xs text-slate-500">
                  Catatan keputusan persetujuan/penolakan dari atasan (R2/R3/Admin).
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Approval ID</th>
                      <th className="py-2.5 px-3">Request ID</th>
                      <th className="py-2.5 px-3">Approver</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Comment / Rejection Reason</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {approvals.map((ap) => (
                      <tr key={ap.approvalId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-[11px]">{ap.approvalId}</td>
                        <td className="py-2 px-3 font-mono font-bold">{ap.requestId}</td>
                        <td className="py-2 px-3 font-medium">{ap.approverName}</td>
                        <td className="py-2 px-3">{ap.role}</td>
                        <td className="py-2 px-3 font-bold">{ap.action}</td>
                        <td className="py-2 px-3 text-slate-600 italic">{ap.comment}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-400 font-mono">
                          {ap.actionDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. FACE_REGISTER SHEET */}
          {activeSheet === 'FACE_REGISTER' && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Sheet: FACE_REGISTER</h3>
                <p className="text-xs text-slate-500">
                  Biometric embedding vector templates. Tidak menyimpan foto mentah (Rule 17 & 18).
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">NIK</th>
                      <th className="py-2.5 px-3">Nama Pegawai</th>
                      <th className="py-2.5 px-3">Face Template (Normalized Vector)</th>
                      <th className="py-2.5 px-3">Registered At</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {faceRegisters.map((f) => (
                      <tr key={f.nik} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold">{f.nik}</td>
                        <td className="py-2 px-3 font-medium">{f.employeeName}</td>
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-500 max-w-sm truncate">
                          {f.faceTemplate}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500">{f.registeredAt}</td>
                        <td className="py-2 px-3 font-bold text-emerald-700">{f.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. AUDIT_LOG SHEET */}
          {activeSheet === 'AUDIT_LOG' && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Sheet: AUDIT_LOG</h3>
                <p className="text-xs text-slate-500">
                  Immutable audit trail mencatat seluruh aktivitas, revisi, dan percobaan gagal (Rule 24).
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Reference ID</th>
                      <th className="py-2.5 px-3">Old Value</th>
                      <th className="py-2.5 px-3">New Value</th>
                      <th className="py-2.5 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.logId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-3 font-medium whitespace-nowrap">{log.user}</td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                          {log.referenceId}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] max-w-[120px] truncate">
                          {log.oldValue}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800 text-[11px] max-w-[120px] truncate">
                          {log.newValue}
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-[11px] max-w-xs truncate">
                          {log.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
