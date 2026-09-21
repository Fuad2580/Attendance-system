import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, Moon, Plane, MinusCircle, Timer } from 'lucide-react';
import { DayStatus, STATUS_TONE_CLASS, OT_TONE_CLASS } from '../utils/schedule';

/**
 * Chip status satu hari. Warna selalu ditemani ikon + teks,
 * jadi statusnya tetap terbaca tanpa mengandalkan warna saja.
 */
export const StatusChip: React.FC<{ status: DayStatus; compact?: boolean }> = ({ status, compact }) => {
  const icons: Record<DayStatus['code'], React.ReactNode> = {
    ON_TIME: <CheckCircle2 className="w-3 h-3" />,
    LATE: <AlertTriangle className="w-3 h-3" />,
    NO_CLOCKOUT: <Clock className="w-3 h-3" />,
    ABSENT: <MinusCircle className="w-3 h-3" />,
    DAY_OFF: <Moon className="w-3 h-3" />,
    LEAVE: <Plane className="w-3 h-3" />,
    UPCOMING: <Clock className="w-3 h-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${
        STATUS_TONE_CLASS[status.tone]
      } ${compact ? 'text-[10px]' : 'text-[11px]'}`}
    >
      {icons[status.code]}
      {status.label}
    </span>
  );
};

/** Catatan lembur: oranye kalau belum disetujui, hijau kalau sudah. */
export const OvertimeChip: React.FC<{ status: DayStatus }> = ({ status }) => {
  if (!status.overtime) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${
        OT_TONE_CLASS[status.overtime.tone]
      }`}
    >
      <Timer className="w-3 h-3" />
      {status.overtime.label}
    </span>
  );
};
