/**
 * Mesin jadwal & status absensi.
 *
 * Sumber jadwal: sheet SCHEDULE (satu baris per karyawan per periode berlaku).
 * Kalau seorang karyawan belum punya baris jadwal, dipakai jam kerja umum dari CONFIG.
 */

import { AppConfig, AttendanceRecord, RequestRecord, ScheduleRecord } from '../types';
import { nikEquals, normalizeDateString } from './dateUtils';

export interface EffectiveSchedule {
  /** ROSTER = ada baris untuk tanggal itu, CONFIG = belum ada roster sama sekali */
  source: 'ROSTER' | 'CONFIG' | 'UNSCHEDULED';
  shiftName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  lateToleranceMinutes: number;
  overtimeAfterMinutes: number;
  /** true kalau hari itu memang hari kerja untuk orang ini */
  isWorkDay: boolean;
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

/** Normalisasi jam "8:0" / "08.00" / "0800" menjadi "08:00". */
export function normalizeTime(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s) return '';

  // Nilai waktu dari Excel bisa berupa pecahan hari (0.333 = 08:00)
  const asNumber = Number(s);
  if (!isNaN(asNumber) && asNumber > 0 && asNumber < 1) {
    const totalMinutes = Math.round(asNumber * 24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  }

  const m = s.match(/^(\d{1,2})[:.\s]?(\d{2})/);
  if (m) {
    const h = Math.min(23, parseInt(m[1], 10));
    const mi = Math.min(59, parseInt(m[2], 10));
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  }
  return s.substring(0, 5);
}

/**
 * Jadwal yang berlaku untuk seorang karyawan pada tanggal tertentu.
 *
 * Aturannya:
 *  1. Ada baris untuk tanggal itu  -> pakai baris tersebut (status OFF = diliburkan).
 *  2. Tidak ada baris, tapi orang ini punya baris lain di bulan yang sama
 *     -> berarti memang tidak dijadwalkan hari itu (libur).
 *  3. Orang ini belum punya baris sama sekali -> pakai jam kerja umum dari CONFIG,
 *     supaya sistem tetap jalan sebelum roster diisi.
 */
export function resolveSchedule(
  nik: string,
  date: string,
  schedules: ScheduleRecord[],
  config: AppConfig
): EffectiveSchedule {
  const target = normalizeDateString(date);
  const mine = (schedules || []).filter((s) => nikEquals(s.nik, nik));
  const exact = mine.find((s) => normalizeDateString(s.date) === target);

  const fallbackTolerance = 0;
  const fallbackOvertime = 30;

  if (exact) {
    const off = String(exact.status || 'SCHEDULED').toUpperCase() === 'OFF';
    return {
      source: off ? 'UNSCHEDULED' : 'ROSTER',
      shiftName: exact.shiftName || (off ? 'Libur' : 'Shift'),
      startTime: normalizeTime(exact.startTime) || config.workStartTime || '08:00',
      endTime: normalizeTime(exact.endTime) || config.workEndTime || '17:00',
      breakMinutes: Number(exact.breakMinutes) || 0,
      lateToleranceMinutes:
        exact.lateToleranceMinutes === undefined || exact.lateToleranceMinutes === null
          ? fallbackTolerance
          : Number(exact.lateToleranceMinutes) || 0,
      overtimeAfterMinutes:
        exact.overtimeAfterMinutes === undefined || exact.overtimeAfterMinutes === null
          ? fallbackOvertime
          : Number(exact.overtimeAfterMinutes) || 0,
      isWorkDay: !off,
    };
  }

  const monthPrefix = target.substring(0, 7);
  const hasRosterThisMonth = mine.some((s) => normalizeDateString(s.date).startsWith(monthPrefix));

  if (hasRosterThisMonth) {
    return {
      source: 'UNSCHEDULED',
      shiftName: 'Libur',
      startTime: config.workStartTime || '08:00',
      endTime: config.workEndTime || '17:00',
      breakMinutes: 0,
      lateToleranceMinutes: fallbackTolerance,
      overtimeAfterMinutes: fallbackOvertime,
      isWorkDay: false,
    };
  }

  // Belum ada roster untuk orang ini: pakai jam kerja umum, Senin-Sabtu
  const weekday = new Date(`${target}T00:00:00`).getDay();
  return {
    source: 'CONFIG',
    shiftName: 'Jam Kerja Umum',
    startTime: config.workStartTime || '08:00',
    endTime: config.workEndTime || '17:00',
    breakMinutes: 60,
    lateToleranceMinutes: fallbackTolerance,
    overtimeAfterMinutes: fallbackOvertime,
    isWorkDay: weekday !== 0,
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

  const isWorkDay = schedule.isWorkDay;

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

  // lateMinutes = keterlambatan SEBENARNYA dari jadwal (untuk pelaporan),
  // sedangkan toleransi hanya menentukan apakah statusnya dihitung terlambat.
  const lateMinutes =
    !isNaN(startMin) && !isNaN(inMin) ? Math.max(0, inMin - startMin) : 0;
  const countsAsLate = lateMinutes > schedule.lateToleranceMinutes;

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

  if (countsAsLate) {
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
