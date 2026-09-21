import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { nikEquals, normalizeDateString } from '../utils/dateUtils';
import { dateInZone, timeInZone } from '../utils/timezone';
import { computeDayStatus, resolveSchedule } from '../utils/schedule';
import { StatusChip, OvertimeChip } from './StatusChip';
import { Search, MapPin, ShieldCheck, ShieldOff } from 'lucide-react';
import { AttendanceRecord } from '../types';

interface DayRow {
  date: string;
  nik: string;
  name: string;
  inRec?: AttendanceRecord;
  outRec?: AttendanceRecord;
}

function hoursBetween(start?: string, end?: string): string {
  if (!start || !end) return '-';
  const toMin = (t: string) => {
    const p = t.split(':');
    return parseInt(p[0] || '0', 10) * 60 + parseInt(p[1] || '0', 10);
  };
  const diff = toMin(end) - toMin(start);
  if (isNaN(diff) || diff <= 0) return '-';
  return `${Math.floor(diff / 60)}j ${diff % 60}m`;
}

export const AttendanceLogView: React.FC = () => {
  const { attendance, manpower, currentUser, config, activeZone, schedules, requests } = useApp();
  const [query, setQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState(() => dateInZone(activeZone).substring(0, 7));

  const canSeeTeam = currentUser && currentUser.roleLevel !== 'R1';

  const rows = useMemo<DayRow[]>(() => {
    const map = new Map<string, DayRow>();

    attendance.forEach((rec) => {
      const date = normalizeDateString(rec.date);
      if (!date.startsWith(monthFilter)) return;
      if (!canSeeTeam && currentUser && !nikEquals(rec.nik, currentUser.nik)) return;

      const nik = String(rec.nik).trim();
      const key = `${date}__${nik}`;
      const emp = manpower.find((m) => nikEquals(m.nik, nik));
      const row: DayRow =
        map.get(key) || { date, nik, name: emp?.employeeName || rec.employeeName || nik };

      if (rec.type === 'IN') row.inRec = rec;
      else row.outRec = rec;
      map.set(key, row);
    });

    return Array.from(map.values())
      .filter((r) =>
        query.trim()
          ? r.name.toLowerCase().includes(query.toLowerCase()) || r.nik.includes(query.trim())
          : true
      )
      .sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : b.date.localeCompare(a.date)));
  }, [attendance, manpower, monthFilter, query, canSeeTeam, currentUser]);

  const today = dateInZone(activeZone);
  const nowTime = timeInZone(activeZone).substring(0, 5);

  return (
    <div className="space-y-4 pb-16">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau NIK..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Riwayat Absensi</h3>
          <span className="text-[11px] text-slate-400">{rows.length} baris • {activeZone.code}</span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-xs text-slate-400">
            Tidak ada data absensi pada periode ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50/70">
                  <th className="px-4 sm:px-5 py-2.5 font-semibold">Tanggal</th>
                  <th className="px-3 py-2.5 font-semibold">Nama</th>
                  <th className="px-3 py-2.5 font-semibold">Masuk</th>
                  <th className="px-3 py-2.5 font-semibold">Pulang</th>
                  <th className="px-3 py-2.5 font-semibold">Jadwal</th>
                  <th className="px-3 py-2.5 font-semibold">Total</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Wajah</th>
                  <th className="px-3 py-2.5 font-semibold">Lokasi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const schedule = resolveSchedule(r.nik, r.date, schedules, config);
                  const status = computeDayStatus({
                    date: r.date,
                    nik: r.nik,
                    inRecord: r.inRec,
                    outRecord: r.outRec,
                    schedule,
                    requests,
                    today,
                    nowTime,
                  });
                  return (
                    <tr key={`${r.date}-${r.nik}`} className="border-t border-slate-100">
                      <td className="px-4 sm:px-5 py-3 font-mono text-slate-600 whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap">{r.name}</td>
                      <td className="px-3 py-3 font-mono text-slate-600">{r.inRec?.time?.substring(0, 8) || '-'}</td>
                      <td className="px-3 py-3 font-mono text-slate-600">{r.outRec?.time?.substring(0, 8) || '-'}</td>
                      <td className="px-3 py-3 font-mono text-slate-500 whitespace-nowrap">
                        {schedule.startTime}–{schedule.endTime}
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                        {hoursBetween(r.inRec?.time, r.outRec?.time)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusChip status={status} compact />
                          <OvertimeChip status={status} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {r.inRec?.faceVerified ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ShieldOff className="w-4 h-4 text-slate-300" />
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        <span className="inline-flex items-center gap-1 max-w-[180px] truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {r.inRec?.locationName || r.outRec?.locationName || '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
