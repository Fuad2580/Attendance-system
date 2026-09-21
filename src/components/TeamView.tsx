import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { nikEquals, normalizeDateString } from '../utils/dateUtils';
import { dateInZone, timeInZone } from '../utils/timezone';
import { computeDayStatus, resolveSchedule, minutesToLabel } from '../utils/schedule';
import { StatusChip, OvertimeChip } from './StatusChip';
import { Users, Search } from 'lucide-react';

/**
 * Tab "Tim Saya" — atasan melihat anggota timnya (Supervisor NIK = dirinya).
 * ADMIN melihat seluruh karyawan aktif.
 */
export const TeamView: React.FC = () => {
  const { currentUser, manpower, attendance, requests, schedules, config, activeZone } = useApp();
  const [query, setQuery] = useState('');

  const today = dateInZone(activeZone);
  const nowTime = timeInZone(activeZone).substring(0, 5);
  const monthPrefix = today.substring(0, 7);

  const team = useMemo(() => {
    if (!currentUser) return [];
    const isAdmin = currentUser.roleLevel === 'ADMIN';
    return manpower
      .filter((m) => m.status !== 'INACTIVE')
      .filter((m) => (isAdmin ? !nikEquals(m.nik, currentUser.nik) : nikEquals(m.supervisorNik, currentUser.nik)))
      .filter((m) =>
        query.trim()
          ? m.employeeName.toLowerCase().includes(query.toLowerCase()) || m.nik.includes(query.trim())
          : true
      );
  }, [manpower, currentUser, query]);

  const rows = team.map((member) => {
    const todayIn = attendance.find(
      (a) => nikEquals(a.nik, member.nik) && normalizeDateString(a.date) === today && a.type === 'IN'
    );
    const todayOut = attendance.find(
      (a) => nikEquals(a.nik, member.nik) && normalizeDateString(a.date) === today && a.type === 'OUT'
    );
    const schedule = resolveSchedule(member.nik, today, schedules, config);
    const status = computeDayStatus({
      date: today,
      nik: member.nik,
      inRecord: todayIn,
      outRecord: todayOut,
      schedule,
      requests,
      today,
      nowTime,
    });

    // Rekap bulan berjalan
    const monthRecords = attendance.filter(
      (a) => nikEquals(a.nik, member.nik) && normalizeDateString(a.date).startsWith(monthPrefix)
    );
    const days = new Set<string>(
      monthRecords.filter((a) => a.type === 'IN').map((a) => normalizeDateString(a.date))
    );
    let late = 0;
    let otMinutes = 0;
    days.forEach((day) => {
      const sc = resolveSchedule(member.nik, day, schedules, config);
      const st = computeDayStatus({
        date: day,
        nik: member.nik,
        inRecord: monthRecords.find((a) => a.type === 'IN' && normalizeDateString(a.date) === day),
        outRecord: monthRecords.find((a) => a.type === 'OUT' && normalizeDateString(a.date) === day),
        schedule: sc,
        requests,
        today,
        nowTime,
      });
      if (st.code === 'LATE') late++;
      if (st.overtime) otMinutes += st.overtime.minutes;
    });

    const pendingReq = requests.filter(
      (r) => nikEquals(r.nik, member.nik) && String(r.status).toUpperCase().includes('PENDING')
    ).length;

    return { member, status, schedule, todayIn, todayOut, present: days.size, late, otMinutes, pendingReq };
  });

  if (!currentUser) return null;

  return (
    <div className="space-y-4 pb-16">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Tim Saya</p>
            <p className="text-[11px] text-slate-500">{team.length} anggota aktif</p>
          </div>
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari anggota tim..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-xs text-slate-400">
          Belum ada anggota tim. Isi kolom <strong>Supervisor NIK</strong> di sheet MANPOWER dengan
          NIK Anda ({currentUser.nik}) agar karyawan muncul di sini.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50/70">
                  <th className="px-4 sm:px-5 py-2.5 font-semibold">Anggota</th>
                  <th className="px-3 py-2.5 font-semibold">Jadwal</th>
                  <th className="px-3 py-2.5 font-semibold">Masuk</th>
                  <th className="px-3 py-2.5 font-semibold">Pulang</th>
                  <th className="px-3 py-2.5 font-semibold">Status Hari Ini</th>
                  <th className="px-3 py-2.5 font-semibold">Bulan Ini</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.member.nik} className="border-t border-slate-100 align-top">
                    <td className="px-4 sm:px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                          {r.member.employeeName.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 whitespace-nowrap">
                            {r.member.employeeName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {r.member.position} • {r.member.nik}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="font-mono text-slate-700">
                        {r.schedule.startTime}–{r.schedule.endTime}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {r.schedule.shiftName}
                        {r.schedule.source === 'CONFIG' && ' (default)'}
                        {r.schedule.source === 'UNSCHEDULED' && ' — tidak dijadwalkan'}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-600">
                      {r.todayIn?.time?.substring(0, 5) || '-'}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-600">
                      {r.todayOut?.time?.substring(0, 5) || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusChip status={r.status} compact />
                        <OvertimeChip status={r.status} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      <p>{r.present} hari hadir</p>
                      <p className="text-[11px] text-rose-600">{r.late} terlambat</p>
                      {r.otMinutes > 0 && (
                        <p className="text-[11px] text-violet-600">OT {minutesToLabel(r.otMinutes)}</p>
                      )}
                      {r.pendingReq > 0 && (
                        <p className="text-[11px] text-orange-600">{r.pendingReq} pengajuan menunggu</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
