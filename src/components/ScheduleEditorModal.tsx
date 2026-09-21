import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, CalendarClock, Save, RefreshCw } from 'lucide-react';
import { Manpower, ScheduleRecord } from '../types';
import { resolveSchedule } from '../utils/schedule';
import { dateInZone } from '../utils/timezone';

interface ScheduleEditorModalProps {
  employee: Manpower;
  onClose: () => void;
}

const DAYS = [
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Min' },
];

export const ScheduleEditorModal: React.FC<ScheduleEditorModalProps> = ({ employee, onClose }) => {
  const { schedules, config, saveSchedule, activeZone } = useApp();

  const today = dateInZone(activeZone);
  const current = resolveSchedule(employee.nik, today, schedules, config);
  const existing = schedules.find(
    (s) => String(s.nik).trim() === String(employee.nik).trim() && s.status !== 'INACTIVE'
  );

  const [shiftName, setShiftName] = useState(current.shiftName);
  const [workDays, setWorkDays] = useState<number[]>(current.workDays);
  const [startTime, setStartTime] = useState(current.startTime);
  const [endTime, setEndTime] = useState(current.endTime);
  const [breakMinutes, setBreakMinutes] = useState(current.breakMinutes);
  const [lateTolerance, setLateTolerance] = useState(current.lateToleranceMinutes);
  const [otAfter, setOtAfter] = useState(current.overtimeAfterMinutes);
  const [effectiveDate, setEffectiveDate] = useState(existing?.effectiveDate || today);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const toggleDay = (d: number) =>
    setWorkDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const handleSave = async () => {
    setSaving(true);
    setResult(null);

    const record: ScheduleRecord = {
      scheduleId: `SCH-${String(employee.nik).trim()}-${effectiveDate.replace(/-/g, '')}`,
      nik: employee.nik,
      employeeName: employee.employeeName,
      shiftName: shiftName || 'Shift',
      workDays: workDays.join(','),
      startTime,
      endTime,
      breakMinutes: Number(breakMinutes) || 0,
      lateToleranceMinutes: Number(lateTolerance) || 0,
      overtimeAfterMinutes: Number(otAfter) || 0,
      effectiveDate,
      endDate: '',
      status: 'ACTIVE',
    };

    const res = await saveSchedule(record);
    setSaving(false);
    setResult({ ok: res.success, msg: res.message });
    if (res.success) setTimeout(onClose, 1200);
  };

  const field = 'w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <CalendarClock className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Atur Jadwal Kerja</h3>
              <p className="text-xs text-slate-500">
                {employee.employeeName} • NIK {employee.nik}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Shift</label>
            <input value={shiftName} onChange={(e) => setShiftName(e.target.value)} className={field} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hari Kerja</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    workDays.includes(d.value)
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Hari yang tidak dipilih dihitung sebagai libur, bukan alpha.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jam Masuk</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jam Pulang</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={field} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Istirahat (m)</label>
              <input type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} className={field} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Toleransi (m)</label>
              <input type="number" min={0} value={lateTolerance} onChange={(e) => setLateTolerance(Number(e.target.value))} className={field} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Lembur &gt; (m)</label>
              <input type="number" min={0} value={otAfter} onChange={(e) => setOtAfter(Number(e.target.value))} className={field} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Berlaku Mulai</label>
            <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={field} />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Absensi sebelum tanggal ini tetap dinilai memakai jadwal lama, jadi riwayat tidak berubah.
            </p>
          </div>

          {result && (
            <div
              className={`p-3 rounded-xl text-xs border ${
                result.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {result.msg}
            </div>
          )}
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="w-1/3 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || workDays.length === 0}
            className="w-2/3 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Menyimpan...' : 'Simpan ke sheet SCHEDULE'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
