import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { nikEquals, normalizeDateString } from '../utils/dateUtils';
import { dateInZone } from '../utils/timezone';
import { normalizeTime } from '../utils/schedule';
import { readSpreadsheetFile, downloadAsXlsx } from '../utils/spreadsheetFile';
import { ScheduleRecord } from '../types';
import {
  CalendarClock,
  Download,
  Upload,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  FileSpreadsheet,
  ShieldAlert,
} from 'lucide-react';

const HEADERS = [
  'Schedule ID',
  'Date',
  'NIK',
  'Employee Name',
  'Shift Name',
  'Start Time',
  'End Time',
  'Break Minutes',
  'Late Tolerance Minutes',
  'Overtime After Minutes',
  'Status',
  'Notes',
];

interface PlanRow {
  nik: string;
  name: string;
  position: string;
  scheduled: boolean;
  startTime: string;
  endTime: string;
  shiftName: string;
}

interface ParsedRow {
  record: ScheduleRecord;
  error?: string;
}

/** Ambil nilai kolom tanpa peduli beda huruf besar/kecil atau spasi. */
function pick(row: Record<string, any>, ...names: string[]): string {
  const keys = Object.keys(row);
  for (const name of names) {
    const found = keys.find((k) => k.trim().toLowerCase() === name.trim().toLowerCase());
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
}

export const ScheduleAdminView: React.FC = () => {
  const { currentUser, manpower, schedules, saveSchedules, activeZone, gasUrl, config } = useApp();

  const today = dateInZone(activeZone);
  const [planDate, setPlanDate] = useState(today);
  const [bulkStart, setBulkStart] = useState(config.workStartTime || '08:00');
  const [bulkEnd, setBulkEnd] = useState(config.workEndTime || '17:00');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [uploadRows, setUploadRows] = useState<ParsedRow[] | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeStaff = useMemo(
    () => manpower.filter((m) => m.status !== 'INACTIVE').sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    [manpower]
  );

  // Baris planner untuk tanggal terpilih, diisi dari roster yang sudah ada
  const [plan, setPlan] = useState<Record<string, PlanRow>>({});
  const planForDate = useMemo(() => {
    const base: Record<string, PlanRow> = {};
    activeStaff.forEach((m) => {
      const existing = schedules.find(
        (s) => nikEquals(s.nik, m.nik) && normalizeDateString(s.date) === planDate
      );
      base[m.nik] = {
        nik: m.nik,
        name: m.employeeName,
        position: m.position,
        scheduled: existing ? existing.status !== 'OFF' : false,
        startTime: normalizeTime(existing?.startTime) || config.workStartTime || '08:00',
        endTime: normalizeTime(existing?.endTime) || config.workEndTime || '17:00',
        shiftName: existing?.shiftName || 'Shift',
      };
    });
    return base;
  }, [activeStaff, schedules, planDate, config]);

  const rows = Object.keys(plan).length > 0 && plan.__date === (planDate as any) ? plan : planForDate;

  const updateRow = (nik: string, patch: Partial<PlanRow>) => {
    setPlan((prev) => {
      const source = Object.keys(prev).length > 0 && (prev as any).__date === planDate ? prev : planForDate;
      return { ...source, __date: planDate, [nik]: { ...source[nik], ...patch } } as any;
    });
  };

  const setAll = (scheduled: boolean) => {
    const source = { ...(rows as Record<string, PlanRow>) };
    Object.keys(source).forEach((nik) => {
      if (nik.startsWith('__')) return;
      source[nik] = { ...source[nik], scheduled };
    });
    setPlan({ ...source, __date: planDate } as any);
  };

  const applyBulkTime = () => {
    const source = { ...(rows as Record<string, PlanRow>) };
    Object.keys(source).forEach((nik) => {
      if (nik.startsWith('__')) return;
      if (!source[nik].scheduled) return;
      source[nik] = { ...source[nik], startTime: bulkStart, endTime: bulkEnd };
    });
    setPlan({ ...source, __date: planDate } as any);
  };

  const copyFromPreviousDay = () => {
    const prev = new Date(`${planDate}T00:00:00`);
    prev.setDate(prev.getDate() - 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(
      prev.getDate()
    ).padStart(2, '0')}`;

    const source = { ...(rows as Record<string, PlanRow>) };
    Object.keys(source).forEach((nik) => {
      if (nik.startsWith('__')) return;
      const found = schedules.find(
        (s) => nikEquals(s.nik, nik) && normalizeDateString(s.date) === prevKey
      );
      source[nik] = {
        ...source[nik],
        scheduled: found ? found.status !== 'OFF' : false,
        startTime: normalizeTime(found?.startTime) || source[nik].startTime,
        endTime: normalizeTime(found?.endTime) || source[nik].endTime,
        shiftName: found?.shiftName || source[nik].shiftName,
      };
    });
    setPlan({ ...source, __date: planDate } as any);
  };

  const handleSavePlan = async () => {
    setSaving(true);
    setResult(null);
    setProgress(null);

    const list: ScheduleRecord[] = Object.keys(rows)
      .filter((k) => !k.startsWith('__'))
      .map((nik) => {
        const r = (rows as Record<string, PlanRow>)[nik];
        return {
          scheduleId: `SCH-${planDate.replace(/-/g, '')}-${String(nik).trim()}`,
          date: planDate,
          nik,
          employeeName: r.name,
          shiftName: r.shiftName || 'Shift',
          startTime: r.startTime,
          endTime: r.endTime,
          breakMinutes: 60,
          lateToleranceMinutes: 10,
          overtimeAfterMinutes: 30,
          status: r.scheduled ? 'SCHEDULED' : 'OFF',
          notes: '',
        } as ScheduleRecord;
      });

    const res = await saveSchedules(list, (done, total) => setProgress(`${done}/${total} baris...`));
    setSaving(false);
    setProgress(null);
    setResult({ ok: res.success, msg: res.message });
  };

  // ---------- Unggah Excel ----------
  const handleFile = async (file: File) => {
    setParsing(true);
    setUploadError(null);
    setUploadRows(null);
    setUploadName(file.name);

    try {
      const raw = await readSpreadsheetFile(file);
      if (raw.length === 0) throw new Error('File kosong atau tidak ada baris data.');

      const parsed: ParsedRow[] = raw.map((row) => {
        const date = normalizeDateString(pick(row, 'Date', 'Tanggal'));
        const nik = pick(row, 'NIK', 'Nik', 'Employee ID');
        const status = (pick(row, 'Status') || 'SCHEDULED').toUpperCase() === 'OFF' ? 'OFF' : 'SCHEDULED';
        const startTime = normalizeTime(pick(row, 'Start Time', 'Jam Masuk', 'Masuk'));
        const endTime = normalizeTime(pick(row, 'End Time', 'Jam Pulang', 'Pulang'));
        const emp = manpower.find((m) => nikEquals(m.nik, nik));

        const record: ScheduleRecord = {
          scheduleId: `SCH-${date.replace(/-/g, '')}-${nik}`,
          date,
          nik,
          employeeName: emp?.employeeName || pick(row, 'Employee Name', 'Nama'),
          shiftName: pick(row, 'Shift Name', 'Shift') || 'Shift',
          startTime,
          endTime,
          breakMinutes: Number(pick(row, 'Break Minutes', 'Istirahat')) || 60,
          lateToleranceMinutes: Number(pick(row, 'Late Tolerance Minutes', 'Toleransi')) || 0,
          overtimeAfterMinutes: Number(pick(row, 'Overtime After Minutes', 'Lembur Setelah')) || 30,
          status: status as 'SCHEDULED' | 'OFF',
          notes: pick(row, 'Notes', 'Catatan'),
        };

        let error: string | undefined;
        if (!nik) error = 'NIK kosong';
        else if (!emp) error = `NIK ${nik} tidak ada di MANPOWER`;
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error = 'Tanggal tidak terbaca (pakai YYYY-MM-DD)';
        else if (status === 'SCHEDULED' && (!startTime || !endTime)) error = 'Jam masuk/pulang kosong';

        return { record, error };
      });

      // Baris tanpa jam dan tanpa status OFF dianggap "tidak dijadwalkan" -> dibuang, bukan error
      const meaningful = parsed.filter(
        (p) => !(p.error === 'Jam masuk/pulang kosong' && !p.record.startTime && !p.record.endTime)
      );

      setUploadRows(meaningful);
    } catch (err: any) {
      setUploadError(err?.message || 'File gagal dibaca.');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const validUploadRows = (uploadRows || []).filter((r) => !r.error);
  const invalidUploadRows = (uploadRows || []).filter((r) => r.error);

  const handleUploadSave = async () => {
    if (validUploadRows.length === 0) return;
    setSaving(true);
    setResult(null);
    const res = await saveSchedules(
      validUploadRows.map((r) => r.record),
      (done, total) => setProgress(`${done}/${total} baris...`)
    );
    setSaving(false);
    setProgress(null);
    setResult({ ok: res.success, msg: res.message });
    if (res.success) setUploadRows(null);
  };

  const handleDownloadTemplate = async () => {
    const month = planDate.substring(0, 7);
    const daysInMonth = new Date(
      parseInt(month.substring(0, 4), 10),
      parseInt(month.substring(5, 7), 10),
      0
    ).getDate();

    const rowsOut: Record<string, any>[] = [];
    activeStaff.forEach((m) => {
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${month}-${String(d).padStart(2, '0')}`;
        rowsOut.push({
          'Schedule ID': `SCH-${date.replace(/-/g, '')}-${m.nik}`,
          Date: date,
          NIK: m.nik,
          'Employee Name': m.employeeName,
          'Shift Name': '',
          'Start Time': '',
          'End Time': '',
          'Break Minutes': 60,
          'Late Tolerance Minutes': 10,
          'Overtime After Minutes': 30,
          Status: 'SCHEDULED',
          Notes: '',
        });
      }
    });

    try {
      await downloadAsXlsx(rowsOut, HEADERS, `Template_Jadwal_${month}.xlsx`);
    } catch (err: any) {
      setUploadError(err?.message || 'Gagal membuat template.');
    }
  };

  const gasTemplateUrl = gasUrl
    ? `${gasUrl.trim()}?action=template&month=${planDate.substring(0, 7)}`
    : '';

  if (!currentUser || currentUser.roleLevel !== 'ADMIN') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center">
        <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-800">Khusus Administrator</p>
        <p className="text-xs text-slate-500 mt-1">
          Pengaturan jadwal hanya dapat diakses oleh akun dengan Role Level ADMIN.
        </p>
      </div>
    );
  }

  const planRows = Object.keys(rows).filter((k) => !k.startsWith('__'));
  const scheduledCount = planRows.filter((nik) => (rows as Record<string, PlanRow>)[nik].scheduled).length;
  const inputCls =
    'p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10';

  return (
    <div className="space-y-4 pb-16">
      {!gasUrl && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-800">
          Apps Script belum terhubung — jadwal tidak dapat disimpan ke spreadsheet.
        </div>
      )}

      {/* ---------- Planner harian ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <CalendarClock className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Plot Jadwal Harian</h3>
              <p className="text-[11px] text-slate-500">
                {scheduledCount} dari {planRows.length} karyawan dijadwalkan masuk
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={planDate}
              onChange={(e) => {
                setPlanDate(e.target.value);
                setPlan({});
              }}
              className={inputCls}
            />
            <button onClick={() => setAll(true)} className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700">
              Pilih semua
            </button>
            <button onClick={() => setAll(false)} className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700">
              Kosongkan
            </button>
            <button
              onClick={copyFromPreviousDay}
              className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Salin H-1
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">Terapkan jam ke yang terpilih:</span>
          <input type="time" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} className={inputCls} />
          <span className="text-slate-400 text-xs">s/d</span>
          <input type="time" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} className={inputCls} />
          <button
            onClick={applyBulkTime}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold"
          >
            Terapkan
          </button>
        </div>

        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="px-4 sm:px-5 py-2.5 font-semibold">Masuk?</th>
                <th className="px-3 py-2.5 font-semibold">Karyawan</th>
                <th className="px-3 py-2.5 font-semibold">Shift</th>
                <th className="px-3 py-2.5 font-semibold">Jam Masuk</th>
                <th className="px-3 py-2.5 font-semibold">Jam Pulang</th>
              </tr>
            </thead>
            <tbody>
              {planRows.map((nik) => {
                const r = (rows as Record<string, PlanRow>)[nik];
                return (
                  <tr key={nik} className={`border-b border-slate-50 ${r.scheduled ? '' : 'opacity-50'}`}>
                    <td className="px-4 sm:px-5 py-2">
                      <input
                        type="checkbox"
                        checked={r.scheduled}
                        onChange={(e) => updateRow(nik, { scheduled: e.target.checked })}
                        className="w-4 h-4 rounded accent-slate-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800 whitespace-nowrap">{r.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {nik} • {r.position}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={r.shiftName}
                        onChange={(e) => updateRow(nik, { shiftName: e.target.value })}
                        disabled={!r.scheduled}
                        className={`${inputCls} w-28`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={r.startTime}
                        onChange={(e) => updateRow(nik, { startTime: e.target.value })}
                        disabled={!r.scheduled}
                        className={inputCls}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={r.endTime}
                        onChange={(e) => updateRow(nik, { endTime: e.target.value })}
                        disabled={!r.scheduled}
                        className={inputCls}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Karyawan yang tidak dicentang disimpan sebagai <strong>OFF</strong> (libur) untuk tanggal ini.
          </p>
          <button
            onClick={handleSavePlan}
            disabled={saving || !gasUrl}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shrink-0"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? progress || 'Menyimpan...' : 'Simpan Jadwal Tanggal Ini'}
          </button>
        </div>
      </div>

      {/* ---------- Unggah Excel ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Unggah Jadwal Sebulan (Excel / CSV)</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Unduh template, isi jam masuk & pulang, lalu unggah kembali. Baris dengan Schedule ID
              yang sama akan ditimpa, jadi mengunggah ulang tidak menggandakan data.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Unduh Template .xlsx ({planDate.substring(0, 7)})
          </button>

          {gasTemplateUrl && (
            <a
              href={gasTemplateUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Template CSV dari Apps Script
            </a>
          )}

          <button
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
          >
            {parsing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {parsing ? 'Membaca file...' : 'Pilih File Excel / CSV'}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {uploadError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadRows && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">{uploadName}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                {validUploadRows.length} baris siap
              </span>
              {invalidUploadRows.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold">
                  {invalidUploadRows.length} baris bermasalah
                </span>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2 font-semibold">Tanggal</th>
                    <th className="px-3 py-2 font-semibold">NIK</th>
                    <th className="px-3 py-2 font-semibold">Nama</th>
                    <th className="px-3 py-2 font-semibold">Jam</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadRows.slice(0, 200).map((r, i) => (
                    <tr key={i} className={`border-t border-slate-100 ${r.error ? 'bg-rose-50/50' : ''}`}>
                      <td className="px-3 py-1.5 font-mono">{r.record.date || '-'}</td>
                      <td className="px-3 py-1.5 font-mono">{r.record.nik || '-'}</td>
                      <td className="px-3 py-1.5">{r.record.employeeName || '-'}</td>
                      <td className="px-3 py-1.5 font-mono">
                        {r.record.startTime || '--:--'}–{r.record.endTime || '--:--'}
                      </td>
                      <td className="px-3 py-1.5">{r.record.status}</td>
                      <td className="px-3 py-1.5 text-rose-700">{r.error || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {uploadRows.length > 200 && (
              <p className="text-[11px] text-slate-400">
                Menampilkan 200 baris pertama; seluruh {uploadRows.length} baris tetap akan diproses.
              </p>
            )}

            <button
              onClick={handleUploadSave}
              disabled={saving || validUploadRows.length === 0 || !gasUrl}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving
                ? progress || 'Mengirim...'
                : `Kirim ${validUploadRows.length} baris ke Spreadsheet`}
            </button>
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-700 mb-1">Aturan isi file</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Date</strong> format <code>YYYY-MM-DD</code>, mis. 2026-10-05.</li>
            <li><strong>NIK</strong> harus sama persis dengan sheet MANPOWER.</li>
            <li><strong>Start Time / End Time</strong> format 24 jam, mis. 08:00 dan 17:00.</li>
            <li><strong>Status</strong> isi <code>OFF</code> kalau orang itu libur pada tanggal tersebut.</li>
            <li>Baris yang jamnya dikosongkan tanpa status OFF akan dilewati, bukan dianggap error.</li>
          </ul>
        </div>
      </div>

      {result && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-start gap-2 ${
            result.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{result.msg}</span>
        </div>
      )}
    </div>
  );
};
