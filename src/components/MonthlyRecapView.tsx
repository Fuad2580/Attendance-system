import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { nikEquals, normalizeDateString } from '../utils/dateUtils';
import { dateInZone, timeInZone } from '../utils/timezone';
import { computeDayStatus, resolveSchedule, DayStatus, minutesToLabel } from '../utils/schedule';
import { Search, Maximize2, Minimize2 } from 'lucide-react';

const CELL_TONE: Record<DayStatus['code'], string> = {
  ON_TIME: 'bg-emerald-50 text-emerald-700',
  LATE: 'bg-rose-50 text-rose-700',
  NO_CLOCKOUT: 'bg-amber-50 text-amber-700',
  ABSENT: 'bg-rose-100 text-rose-800',
  DAY_OFF: 'bg-slate-50 text-slate-400',
  LEAVE: 'bg-sky-50 text-sky-700',
  UPCOMING: 'bg-white text-slate-300',
};

const LEGEND: { code: DayStatus['code']; short: string; label: string }[] = [
  { code: 'ON_TIME', short: 'OK', label: 'Tepat waktu' },
  { code: 'LATE', short: 'T', label: 'Terlambat' },
  { code: 'NO_CLOCKOUT', short: 'BO', label: 'Belum clock out' },
  { code: 'ABSENT', short: 'A', label: 'Tidak hadir' },
  { code: 'LEAVE', short: 'C', label: 'Cuti / izin' },
  { code: 'DAY_OFF', short: 'L', label: 'Libur' },
];

/**
 * Rekap bulanan berbentuk matriks: karyawan (baris) x tanggal (kolom).
 * Kolom nama dibuat sticky agar tetap terbaca saat tabel digeser ke samping.
 */
export const MonthlyRecapView: React.FC = () => {
  const { currentUser, manpower, attendance, requests, schedules, config, activeZone } = useApp();

  const today = dateInZone(activeZone);
  const nowTime = timeInZone(activeZone).substring(0, 5);

  const [month, setMonth] = useState(today.substring(0, 7));
  const [query, setQuery] = useState('');
  const [wide, setWide] = useState(false);

  const canSeeTeam = currentUser && currentUser.roleLevel !== 'R1';

  const daysInMonth = useMemo(() => {
    const [y, m] = month.split('-').map((n) => parseInt(n, 10));
    return new Date(y, m, 0).getDate();
  }, [month]);

  const employees = useMemo(() => {
    if (!currentUser) return [];
    const base = manpower.filter((m) => m.status !== 'INACTIVE');
    const scoped = canSeeTeam
      ? currentUser.roleLevel === 'ADMIN'
        ? base
        : base.filter(
            (m) => nikEquals(m.supervisorNik, currentUser.nik) || nikEquals(m.nik, currentUser.nik)
          )
      : base.filter((m) => nikEquals(m.nik, currentUser.nik));

    return scoped
      .filter((m) =>
        query.trim()
          ? m.employeeName.toLowerCase().includes(query.toLowerCase()) || m.nik.includes(query.trim())
          : true
      )
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [manpower, currentUser, canSeeTeam, query]);

  const grid = useMemo(() => {
    return employees.map((emp) => {
      const empRecords = attendance.filter((a) => nikEquals(a.nik, emp.nik));
      const cells: { day: number; date: string; status: DayStatus }[] = [];
      let present = 0;
      let late = 0;
      let otMinutes = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${month}-${String(d).padStart(2, '0')}`;
        const inRec = empRecords.find((a) => a.type === 'IN' && normalizeDateString(a.date) === date);
        const outRec = empRecords.find((a) => a.type === 'OUT' && normalizeDateString(a.date) === date);
        const schedule = resolveSchedule(emp.nik, date, schedules, config);
        const status = computeDayStatus({
          date,
          nik: emp.nik,
          inRecord: inRec,
          outRecord: outRec,
          schedule,
          requests,
          today,
          nowTime,
        });

        if (inRec) present++;
        if (status.code === 'LATE') late++;
        if (status.overtime) otMinutes += status.overtime.minutes;

        cells.push({ day: d, date, status });
      }

      return { emp, cells, present, late, otMinutes };
    });
  }, [employees, attendance, schedules, config, requests, month, daysInMonth, today, nowTime]);

  return (
    <div className="space-y-4 pb-16">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
        />
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau NIK..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <button
          onClick={() => setWide((v) => !v)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 justify-center"
        >
          {wide ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {wide ? 'Rapatkan' : 'Lebarkan'}
        </button>
      </div>

      {/* Legenda: warna selalu disertai kode huruf */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap gap-2">
        {LEGEND.map((l) => (
          <span key={l.code} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
            <span
              className={`w-6 h-5 rounded-md flex items-center justify-center font-bold text-[10px] ${
                CELL_TONE[l.code]
              }`}
            >
              {l.short}
            </span>
            {l.label}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Rekap Bulanan per Tanggal</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {employees.length} karyawan • geser ke samping untuk melihat seluruh tanggal
            </p>
          </div>
        </div>

        {grid.length === 0 ? (
          <div className="px-5 py-12 text-center text-xs text-slate-400">Tidak ada data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500">
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 text-left font-semibold min-w-[170px] border-r border-slate-200">
                    Karyawan
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                    const date = `${month}-${String(d).padStart(2, '0')}`;
                    const weekday = new Date(`${date}T00:00:00`).getDay();
                    return (
                      <th
                        key={d}
                        className={`px-1 py-2.5 font-semibold text-center ${
                          wide ? 'min-w-[44px]' : 'min-w-[30px]'
                        } ${weekday === 0 ? 'text-rose-400' : ''} ${
                          date === today ? 'bg-slate-200 text-slate-900 rounded-t-md' : ''
                        }`}
                      >
                        {d}
                      </th>
                    );
                  })}
                  <th className="px-3 py-2.5 font-semibold text-center min-w-[120px] border-l border-slate-200">
                    Ringkasan
                  </th>
                </tr>
              </thead>
              <tbody>
                {grid.map((row) => (
                  <tr key={row.emp.nik} className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-slate-200">
                      <p className="font-semibold text-slate-800 whitespace-nowrap">
                        {row.emp.employeeName}
                      </p>
                      <p className="text-[10px] text-slate-400 whitespace-nowrap">
                        {row.emp.nik} • {row.emp.position}
                      </p>
                    </td>

                    {row.cells.map((cell) => (
                      <td key={cell.date} className="px-0.5 py-1.5 text-center">
                        <span
                          title={`${cell.date} — ${cell.status.label}${
                            cell.status.overtime ? ` • ${cell.status.overtime.label}` : ''
                          }`}
                          className={`inline-flex items-center justify-center rounded-md font-bold ${
                            wide ? 'w-10 h-7 text-[10px]' : 'w-7 h-6 text-[9px]'
                          } ${CELL_TONE[cell.status.code]} ${
                            cell.status.overtime && cell.status.overtime.state === 'pending'
                              ? 'ring-1 ring-orange-400'
                              : cell.status.overtime && cell.status.overtime.state === 'approved'
                              ? 'ring-1 ring-emerald-400'
                              : ''
                          }`}
                        >
                          {cell.status.shortCode}
                        </span>
                      </td>
                    ))}

                    <td className="px-3 py-2 border-l border-slate-200 whitespace-nowrap">
                      <p className="text-slate-700 font-semibold">{row.present} hadir</p>
                      <p className="text-[10px] text-rose-600">{row.late} terlambat</p>
                      {row.otMinutes > 0 && (
                        <p className="text-[10px] text-violet-600">OT {minutesToLabel(row.otMinutes)}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 px-1">
        Sel dengan garis tepi oranye = ada lembur yang belum disetujui. Garis tepi hijau = lembur
        sudah disetujui.
      </p>
    </div>
  );
};
