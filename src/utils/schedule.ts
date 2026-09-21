/**
 * Mesin jadwal & status absensi.
 *
 * Sumber jadwal: sheet SCHEDULE (satu baris per karyawan per periode berlaku).
 * Kalau seorang karyawan belum punya baris jadwal, dipakai jam kerja umum dari CONFIG.
 */

import { AppConfig, AttendanceRecord, RequestRecord, ScheduleRecord } from '../types';
import { nikEquals, normalizeDateString } from './dateUtils';

export interface EffectiveSchedule {
  source: 'SCHEDULE' | 'CONFIG';
  shiftName: string;
  workDays: number[];
  startTime: string;
  endTime: string;
  breakMinutes: number;
  lateToleranceMinutes: number;
  overtimeAfterMinutes: number;
}

export type StatusCode =
  | 'ON_TIME'
  | 'LATE'
  | 'NO_CLOCKOUT'
  | 'ABSENT'
  | 'DAY_OFF'
  | 'LEAVE'
  | 'UPCOMING';

export type StatusTone = 'emerald' | 'rose' | 'amber' | 'slate' | 'sky';

export interface OvertimeInfo {
  minutes: number;
  hoursLabel: string;
  /** approved = sudah disetujui, pending = diajukan belum disetujui, none = belum diajukan */
  state: 'approved' | 'pending' | 'none';
  label: string;
  tone: 'emerald' | 'amber' | 'slate';
}

export interface DayStatus {
  code: StatusCode;
  label: string;
  tone: StatusTone;
  /** Menit keterlambatan, 0 kalau tidak telat */
  lateMinutes: number;
  overtime: OvertimeInfo | null;
  /** Singkatan untuk sel rekap bulanan */
  shortCode: string;
}

export function timeToMinutes(time?: string): number {
  if (!time) return NaN;
  const parts = String(time).trim().split(':');
  const h = parseInt(parts[0] || '', 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isNaN(h)) return NaN;
  return h * 60 + (isNaN(m) ? 0 : m);
}

export function minutesToLabel(mins: number): string {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

function parseWorkDays(raw: string | undefined, fallback: number[]): number[] {
  const s = String(raw || '').trim();
  if (!s) return fallback;
  const out: number[] = [];
  s.split(/[,;\s]+/).forEach((token) => {
    const t = token.trim().toUpperCase();
    if (!t) return;
    const map: Record<string, number> = {
      MIN: 0, MINGGU: 0, SUN: 0,
      SEN: 1, SENIN: 1, MON: 1,
      SEL: 2, SELASA: 2, TUE: 2,
      RAB: 3, RABU: 3, WED: 3,
      KAM: 4, KAMIS: 4, THU: 4,
      JUM: 5, JUMAT: 5, FRI: 5,
      SAB: 6, SABTU: 6, SAT: 6,
    };
    if (map[t] !== undefined) {
      out.push(map[t]);
      return;
    }
    const n = parseInt(t, 10);
    if (!isNaN(n) && n >= 0 && n <= 6) out.push(n);
  });
  return out.length > 0 ? out : fallback;
}

/**
 * Jadwal yang berlaku untuk seorang karyawan pada tanggal tertentu.
 * Baris dengan effectiveDate paling akhir (namun <= tanggal) yang menang.
 */
export function resolveSchedule(
  nik: string,
  date: string,
  schedules: ScheduleRecord[],
  config: AppConfig
): EffectiveSchedule {
  const target = normalizeDateString(date);

  const candidates = (schedules || [])
    .filter((s) => nikEquals(s.nik, nik))
    .filter((s) => String(s.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
    .filter((s) => {
      const eff = normalizeDateString(s.effectiveDate);
      const end = normalizeDateString(s.endDate || '');
      if (eff && eff > target) return false;
      if (end && end < target) return false;
      return true;
    })
    .sort((a, b) => normalizeDateString(b.effectiveDate).localeCompare(normalizeDateString(a.effectiveDate)));

  const picked = candidates[0];

  if (!picked) {
    return {
      source: 'CONFIG',
      shiftName: 'Reguler',
      workDays: [1, 2, 3, 4, 5, 6],
      startTime: config.workStartTime || '08:00',
      endTime: config.workEndTime || '17:00',
      breakMinutes: 60,
      lateToleranceMinutes: 0,
      overtimeAfterMinutes: 30,
    };
  }

  return {
    source: 'SCHEDULE',
    shiftName: picked.shiftName || 'Shift',
    workDays: parseWorkDays(picked.workDays, [1, 2, 3, 4, 5, 6]),
    startTime: (picked.startTime || config.workStartTime || '08:00').substring(0, 5),
    endTime: (picked.endTime || config.workEndTime || '17:00').substring(0, 5),
    breakMinutes: Number(picked.breakMinutes) || 0,
    lateToleranceMinutes: Number(picked.lateToleranceMinutes) || 0,
    overtimeAfterMinutes:
      picked.overtimeAfterMinutes === undefined || picked.overtimeAfterMinutes === null
        ? 30
        : Number(picked.overtimeAfterMinutes) || 0,
  };
}

function requestCoversDate(req: RequestRecord, date: string): boolean {
  const start = normalizeDateString(req.startDate);
  const end = normalizeDateString(req.endDate || req.startDate);
  if (!start) return false;
  return date >= start && date <= (end || start);
}

const LEAVE_TYPES = ['sick leave', 'annual leave', 'cuti', 'izin', 'sakit'];

export interface DayStatusInput {
  date: string;
  nik: string;
  inRecord?: AttendanceRecord;
  outRecord?: AttendanceRecord;
  schedule: EffectiveSchedule;
  requests: RequestRecord[];
  /** Tanggal hari ini pada zona kantor, untuk membedakan "belum terjadi" vs "alpha". */
  today: string;
  /** Jam sekarang HH:mm pada zona kantor. */
  nowTime: string;
}

/**
 * Menghitung status satu hari kerja seorang karyawan.
 */
export function computeDayStatus(input: DayStatusInput): DayStatus {
  const { date, nik, inRecord, outRecord, schedule, requests, today, nowTime } = input;

  const myRequests = (requests || []).filter(
    (r) => nikEquals(r.nik, nik) && requestCoversDate(r, date)
  );

  const leaveReq = myRequests.find((r) =>
    LEAVE_TYPES.some((t) => String(r.requestType || '').toLowerCase().includes(t))
  );
  const leaveApproved = leaveReq && String(leaveReq.status).toUpperCase() === 'APPROVED';

  const weekday = new Date(`${date}T00:00:00`).getDay();
  const isWorkDay = schedule.workDays.includes(weekday);

  // ---- Lembur ----
  let overtime: OvertimeInfo | null = null;
  const endMin = timeToMinutes(schedule.endTime);
  const outMin = timeToMinutes(outRecord?.time);

  if (!isNaN(endMin) && !isNaN(outMin)) {
    const extra = outMin - endMin - schedule.overtimeAfterMinutes;
    if (extra > 0) {
      const otMinutes = outMin - endMin;
      const otReq = myRequests.find((r) =>
        String(r.requestType || '').toLowerCase().includes('overtime')
      );
      const otStatus = otReq ? String(otReq.status).toUpperCase() : '';

      let state: OvertimeInfo['state'] = 'none';
      let tone: OvertimeInfo['tone'] = 'slate';
      let label = `OT ${minutesToLabel(otMinutes)} (belum diajukan)`;

      if (otReq && otStatus === 'APPROVED') {
        state = 'approved';
        tone = 'emerald';
        label = `OT ${minutesToLabel(otMinutes)} disetujui`;
      } else if (otReq && otStatus !== 'REJECTED' && otStatus !== 'CANCELLED') {
        state = 'pending';
        tone = 'amber';
        label = `OT ${minutesToLabel(otMinutes)} belum di-approve`;
      }

      overtime = { minutes: otMinutes, hoursLabel: minutesToLabel(otMinutes), state, label, tone };
    }
  }

  // ---- Status utama ----
  if (leaveApproved) {
    return {
      code: 'LEAVE',
      label: leaveReq?.requestType || 'Cuti / Izin',
      tone: 'sky',
      lateMinutes: 0,
      overtime,
      shortCode: 'C',
    };
  }

  if (!isWorkDay && !inRecord) {
    return { code: 'DAY_OFF', label: 'Libur', tone: 'slate', lateMinutes: 0, overtime, shortCode: 'L' };
  }

  if (!inRecord) {
    // Hari ini dan jam masuk belum lewat -> belum waktunya, bukan alpha
    const startMin = timeToMinutes(schedule.startTime);
    const nowMin = timeToMinutes(nowTime);
    if (date > today || (date === today && !isNaN(startMin) && !isNaN(nowMin) && nowMin <= startMin)) {
      return {
        code: 'UPCOMING',
        label: 'Belum jadwalnya',
        tone: 'slate',
        lateMinutes: 0,
        overtime: null,
        shortCode: '–',
      };
    }
    return { code: 'ABSENT', label: 'Tidak Hadir', tone: 'rose', lateMinutes: 0, overtime: null, shortCode: 'A' };
  }

  const startMin = timeToMinutes(schedule.startTime);
  const inMin = timeToMinutes(inRecord.time);
  const lateMinutes =
    !isNaN(startMin) && !isNaN(inMin)
      ? Math.max(0, inMin - startMin - schedule.lateToleranceMinutes)
      : 0;

  if (!outRecord) {
    if (date < today) {
      return {
        code: 'NO_CLOCKOUT',
        label: 'Belum Clock Out',
        tone: 'amber',
        lateMinutes,
        overtime: null,
        shortCode: 'BO',
      };
    }
    return {
      code: 'NO_CLOCKOUT',
      label: 'Sedang Bekerja',
      tone: 'amber',
      lateMinutes,
      overtime: null,
      shortCode: 'IN',
    };
  }

  if (lateMinutes > 0) {
    return {
      code: 'LATE',
      label: `Terlambat ${minutesToLabel(lateMinutes)}`,
      tone: 'rose',
      lateMinutes,
      overtime,
      shortCode: 'T',
    };
  }

  return { code: 'ON_TIME', label: 'Tepat Waktu', tone: 'emerald', lateMinutes: 0, overtime, shortCode: 'OK' };
}

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  slate: 'bg-slate-100 text-slate-500 border-slate-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
};

export const OT_TONE_CLASS: Record<OvertimeInfo['tone'], string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-orange-50 text-orange-700 border-orange-300',
  slate: 'bg-slate-100 text-slate-500 border-slate-200',
};
