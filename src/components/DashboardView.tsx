import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { isDateToday, nikEquals, normalizeDateString } from '../utils/dateUtils';
import {
  dateInZone,
  longDateInZone,
  timeInZone,
  greetingInZone,
} from '../utils/timezone';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CameraOff,
  Clock,
  Camera,
  LogIn,
  LogOut,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { ClockModal } from './ClockModal';
import { FaceRegistrationModal } from './FaceRegistrationModal';
import { LocationCard } from './LocationCard';
import { StatusChip, OvertimeChip } from './StatusChip';
import { computeDayStatus, resolveSchedule, minutesToLabel } from '../utils/schedule';
import { WeeklyAttendanceChart } from './WeeklyAttendanceChart';
import { RequestType, AttendanceRecord } from '../types';

interface DashboardViewProps {
  onOpenNewRequest: (preselectedType?: RequestType) => void;
  onViewAllRequests: () => void;
  onOpenSpreadsheet: () => void;
  onOpenGasSetup?: () => void;
}

/** Selisih jam antara dua string HH:mm:ss. */
function hoursBetween(start?: string, end?: string): string {
  if (!start || !end) return '-';
  const toMin = (t: string) => {
    const p = t.split(':');
    return parseInt(p[0] || '0', 10) * 60 + parseInt(p[1] || '0', 10);
  };
  const diff = toMin(end) - toMin(start);
  if (isNaN(diff) || diff <= 0) return '-';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m === 0 ? `${h} jam` : `${h}j ${m}m`;
}

const StatCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'emerald' | 'sky' | 'rose' | 'violet';
}> = ({ label, value, icon, tone }) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    sky: 'bg-sky-50 text-sky-600',
    rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewRequest,
  onViewAllRequests,
  onOpenGasSetup,
}) => {
  const {
    currentUser,
    config,
    geoStatus,
    userCoords,
    refreshGPS,
    isGpsLoading,
    attendance,
    manpower,
    requests,
    gasUrl,
    activeZone,
    schedules,
  } = useApp();

  const [activeClockModal, setActiveClockModal] = useState<'IN' | 'OUT' | null>(null);
  const [showFaceRegModal, setShowFaceRegModal] = useState(false);
  const [clockTick, setClockTick] = useState(new Date());
  const [previewOn, setPreviewOn] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => setClockTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (previewOn) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((s) => {
          stream = s;
          if (previewRef.current) previewRef.current.srcObject = s;
        })
        .catch(() => {
          setPreviewError('Kamera tidak dapat diakses.');
          setPreviewOn(false);
        });
    }
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [previewOn]);

  if (!currentUser) return null;

  const zone = activeZone;
  const todayKey = dateInZone(zone, clockTick);

  const todayIn = attendance.find(
    (a) => nikEquals(a.nik, currentUser.nik) && isDateToday(a.date) && a.type === 'IN'
  );
  const todayOut = attendance.find(
    (a) => nikEquals(a.nik, currentUser.nik) && isDateToday(a.date) && a.type === 'OUT'
  );

  const nowTime = timeInZone(zone, clockTick).substring(0, 5);
  const todaySchedule = resolveSchedule(currentUser.nik, todayKey, schedules, config);
  const todayStatus = computeDayStatus({
    date: todayKey,
    nik: currentUser.nik,
    inRecord: todayIn,
    outRecord: todayOut,
    schedule: todaySchedule,
    requests,
    today: todayKey,
    nowTime,
  });

  // ---- Statistik bulan berjalan untuk karyawan yang login ----
  const monthPrefix = todayKey.substring(0, 7);
  const myMonth = attendance.filter(
    (a) => nikEquals(a.nik, currentUser.nik) && normalizeDateString(a.date).startsWith(monthPrefix)
  );
  const myInDays = new Set<string>(
    myMonth.filter((a) => a.type === 'IN').map((a) => normalizeDateString(a.date))
  );

  let lateDays = 0;
  let overtimeMinutes = 0;
  myInDays.forEach((day) => {
    const sched = resolveSchedule(currentUser.nik, day, schedules, config);
    const st = computeDayStatus({
      date: day,
      nik: currentUser.nik,
      inRecord: myMonth.find((a) => a.type === 'IN' && normalizeDateString(a.date) === day),
      outRecord: myMonth.find((a) => a.type === 'OUT' && normalizeDateString(a.date) === day),
      schedule: sched,
      requests,
      today: todayKey,
      nowTime,
    });
    if (st.code === 'LATE') lateDays++;
    if (st.overtime) overtimeMinutes += st.overtime.minutes;
  });
  const onTimeDays = Math.max(0, myInDays.size - lateDays);

  const workingDaysSoFar = (() => {
    const day = parseInt(todayKey.substring(8, 10), 10);
    let count = 0;
    for (let d = 1; d <= day; d++) {
      const dt = new Date(`${monthPrefix}-${String(d).padStart(2, '0')}T00:00:00`);
      const wd = dt.getDay();
      if (wd !== 0) count++; // Minggu libur
    }
    return Math.max(1, count);
  })();
  const attendanceRate = Math.min(100, Math.round((myInDays.size / workingDaysSoFar) * 100));

  const approvedLeave = requests.filter(
    (r) =>
      nikEquals(r.nik, currentUser.nik) &&
      String(r.status).toUpperCase() === 'APPROVED' &&
      normalizeDateString(r.startDate).startsWith(monthPrefix)
  ).length;

  // ---- Log kehadiran hari ini (semua karyawan untuk R2/R3/ADMIN, diri sendiri untuk R1) ----
  const canSeeTeam = currentUser.roleLevel !== 'R1';
  const todayRecords = attendance.filter((a) => isDateToday(a.date));
  const byNik = new Map<string, { in?: AttendanceRecord; out?: AttendanceRecord }>();
  todayRecords.forEach((rec) => {
    if (!canSeeTeam && !nikEquals(rec.nik, currentUser.nik)) return;
    const key = String(rec.nik).trim();
    const entry = byNik.get(key) || {};
    if (rec.type === 'IN') entry.in = rec;
    else entry.out = rec;
    byNik.set(key, entry);
  });
  const logRows = Array.from(byNik.entries()).map(([nik, v]) => {
    const emp = manpower.find((m) => nikEquals(m.nik, nik));
    const sched = resolveSchedule(nik, todayKey, schedules, config);
    const status = computeDayStatus({
      date: todayKey,
      nik,
      inRecord: v.in,
      outRecord: v.out,
      schedule: sched,
      requests,
      today: todayKey,
      nowTime,
    });
    return {
      nik,
      name: emp?.employeeName || v.in?.employeeName || v.out?.employeeName || nik,
      inTime: v.in?.time,
      outTime: v.out?.time,
      location: v.in?.locationName || v.out?.locationName || '-',
      schedule: `${sched.startTime}–${sched.endTime}`,
      status,
    };
  });

  const hasClockedIn = !!todayIn;
  const heroAction: 'IN' | 'OUT' = hasClockedIn ? 'OUT' : 'IN';

  return (
    <div className="space-y-5 pb-16">
      {!gasUrl && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Apps Script belum terhubung</h4>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Clock In/Out tidak akan tercatat ke Google Sheets sebelum Web App URL dihubungkan.
              </p>
            </div>
          </div>
          {onOpenGasSetup && (
            <button
              onClick={onOpenGasSetup}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>Hubungkan URL</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Sapaan + jam berjalan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {currentUser.employeeName.charAt(0)}
          </div>
          <div>
            <p className="text-xs text-slate-500">{greetingInZone(zone, clockTick)},</p>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
              {currentUser.employeeName}
            </h2>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight tabular-nums leading-none">
            {timeInZone(zone, clockTick)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            {longDateInZone(zone, clockTick)} • {zone.code}
          </p>
        </div>
      </div>

      {/* Hero widget */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 className="text-sm font-bold text-slate-900">Aksi Cepat</h3>
          <div className="flex items-center gap-2">
            <StatusChip status={todayStatus} />
            <OvertimeChip status={todayStatus} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveClockModal(heroAction)}
              className={`w-full py-6 px-4 rounded-2xl text-white font-bold text-base transition-all active:scale-98 flex items-center justify-center gap-2.5 ${
                heroAction === 'IN' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {heroAction === 'IN' ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
              <span>{heroAction === 'IN' ? 'Check-In Sekarang' : 'Check-Out Sekarang'}</span>
            </button>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 p-2.5">
                <p className="text-[11px] text-slate-500">Check-In</p>
                <p className="text-sm font-bold text-slate-900 font-mono">
                  {todayIn?.time?.substring(0, 5) || '--:--'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-2.5">
                <p className="text-[11px] text-slate-500">Check-Out</p>
                <p className="text-sm font-bold text-slate-900 font-mono">
                  {todayOut?.time?.substring(0, 5) || '--:--'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-2.5">
                <p className="text-[11px] text-slate-500">Jadwal</p>
                <p className="text-sm font-bold text-slate-900 font-mono">
                  {todaySchedule.startTime}–{todaySchedule.endTime}
                </p>
              </div>
            </div>

            {todayOut && (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Sudah check-out pukul {todayOut.time?.substring(0, 5)}. Check-out lagi akan
                <strong> menimpa</strong> jam tersebut.
              </p>
            )}
          </div>

          {/* Preview kamera */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 min-h-[150px] flex items-center justify-center">
            {previewOn ? (
              <video
                ref={previewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPreviewError(null);
                  setPreviewOn(true);
                }}
                className="flex flex-col items-center gap-2 text-slate-300 hover:text-white transition-colors px-4 py-6"
              >
                {previewError ? <CameraOff className="w-7 h-7" /> : <Camera className="w-7 h-7" />}
                <span className="text-[11px] font-medium text-center">
                  {previewError || 'Aktifkan pratinjau kamera'}
                </span>
              </button>
            )}
            {previewOn && (
              <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-xs">
                Pratinjau
              </span>
            )}
          </div>
        </div>

        {config.requireFaceRecognition && !currentUser.faceRegistered && (
          <button
            onClick={() => setShowFaceRegModal(true)}
            className="mt-3 w-full py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
          >
            Wajah belum terdaftar — daftarkan sekarang
          </button>
        )}
      </div>

      <LocationCard
        accuracy={userCoords.accuracy}
        geoStatus={geoStatus}
        isFlexible={currentUser.flexibleAttendance}
        isGpsLoading={isGpsLoading}
        onRefresh={refreshGPS}
      />

      {/* Kartu statistik */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Kehadiran" value={`${attendanceRate}%`} tone="emerald" icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Tepat Waktu" value={`${onTimeDays} Hari`} tone="sky" icon={<Clock className="w-4 h-4" />} />
        <StatCard label="Terlambat" value={`${lateDays} Hari`} tone="rose" icon={<AlertTriangle className="w-4 h-4" />} />
        <StatCard
          label="Lembur Bulan Ini"
          value={overtimeMinutes > 0 ? minutesToLabel(overtimeMinutes) : '0m'}
          tone="violet"
          icon={<CalendarCheck className="w-4 h-4" />}
        />
      </div>

      {/* Log hari ini + grafik */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Log Kehadiran Hari Ini</h3>
            <span className="text-[11px] text-slate-400">{logRows.length} karyawan</span>
          </div>

          {logRows.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-400">
              Belum ada absensi tercatat hari ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 bg-slate-50/70">
                    <th className="px-4 sm:px-5 py-2.5 font-semibold">Nama</th>
                    <th className="px-3 py-2.5 font-semibold">Check-In</th>
                    <th className="px-3 py-2.5 font-semibold">Check-Out</th>
                    <th className="px-3 py-2.5 font-semibold">Jadwal</th>
                    <th className="px-3 py-2.5 font-semibold">Total</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Lokasi</th>
                  </tr>
                </thead>
                <tbody>
                  {logRows.map((row) => (
                    <tr key={row.nik} className="border-t border-slate-100">
                      <td className="px-4 sm:px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                            {row.name.charAt(0)}
                          </span>
                          <span className="font-medium text-slate-800 whitespace-nowrap">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-600">{row.inTime?.substring(0, 8) || '-'}</td>
                      <td className="px-3 py-3 font-mono text-slate-600">{row.outTime?.substring(0, 8) || '-'}</td>
                      <td className="px-3 py-3 font-mono text-slate-500 whitespace-nowrap">{row.schedule}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                        {hoursBetween(row.inTime, row.outTime)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusChip status={row.status} compact />
                          <OvertimeChip status={row.status} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500 max-w-[160px] truncate">{row.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Grafik Kehadiran Mingguan</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Jumlah karyawan hadir, 7 hari terakhir</p>
          <WeeklyAttendanceChart attendance={attendance} today={todayKey} />

          <button
            onClick={onViewAllRequests}
            className="mt-3 w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Lihat Pengajuan Saya
          </button>
        </div>
      </div>

      {activeClockModal && (
        <ClockModal
          type={activeClockModal}
          onClose={() => setActiveClockModal(null)}
          onOpenFaceRegistration={() => setShowFaceRegModal(true)}
        />
      )}
      {showFaceRegModal && <FaceRegistrationModal onClose={() => setShowFaceRegModal(false)} />}
    </div>
  );
};
