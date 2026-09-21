import React, { useState } from 'react';
import { AttendanceRecord } from '../types';
import { normalizeDateString } from '../utils/dateUtils';

interface WeeklyAttendanceChartProps {
  attendance: AttendanceRecord[];
  /** Tanggal acuan (YYYY-MM-DD) pada zona waktu kantor. */
  today: string;
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * Grafik batang kehadiran 7 hari terakhir.
 * Satu seri tunggal (jumlah karyawan hadir per hari), jadi tidak perlu legenda:
 * judul panel sudah menyebut apa yang diukur.
 */
export const WeeklyAttendanceChart: React.FC<WeeklyAttendanceChartProps> = ({ attendance, today }) => {
  const [hovered, setHovered] = useState<number | null>(null);

  const base = new Date(`${today}T00:00:00`);
  const days: { key: string; label: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const uniqueNik = new Set(
      attendance
        .filter((a) => a.type === 'IN' && normalizeDateString(a.date) === key)
        .map((a) => String(a.nik).trim())
    );
    days.push({ key, label: DAY_LABELS[d.getDay()], count: uniqueNik.size });
  }

  const maxCount = Math.max(1, ...days.map((d) => d.count));
  // Skala dibulatkan ke atas agar garis bantu jatuh di angka bulat
  const step = maxCount <= 4 ? 1 : Math.ceil(maxCount / 4);
  const top = step * 4;

  const width = 420;
  const height = 190;
  const padLeft = 30;
  const padBottom = 24;
  const padTop = 8;
  const plotW = width - padLeft - 8;
  const plotH = height - padBottom - padTop;
  const slot = plotW / days.length;
  const barW = Math.min(26, slot * 0.46);

  const yFor = (v: number) => padTop + plotH - (v / top) * plotH;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[190px]" role="img"
           aria-label="Jumlah karyawan hadir per hari selama 7 hari terakhir">
        {/* Garis bantu mendatar, sengaja dibuat samar */}
        {[0, 1, 2, 3, 4].map((i) => {
          const v = step * i;
          return (
            <g key={i}>
              <line
                x1={padLeft}
                y1={yFor(v)}
                x2={width - 8}
                y2={yFor(v)}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <text x={padLeft - 8} y={yFor(v) + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                {v}
              </text>
            </g>
          );
        })}

        {days.map((d, i) => {
          const x = padLeft + i * slot + (slot - barW) / 2;
          const y = yFor(d.count);
          const h = Math.max(d.count > 0 ? 3 : 0, padTop + plotH - y);
          return (
            <g key={d.key}
               onMouseEnter={() => setHovered(i)}
               onMouseLeave={() => setHovered(null)}>
              {/* area sentuh lebih besar dari batangnya */}
              <rect x={padLeft + i * slot} y={padTop} width={slot} height={plotH} fill="transparent" />
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx="4"
                fill={hovered === i ? '#0F172A' : '#1E293B'}
              />
              <text
                x={padLeft + i * slot + slot / 2}
                y={height - 7}
                textAnchor="middle"
                fontSize="10"
                fill={hovered === i ? '#0F172A' : '#94A3B8'}
                fontWeight={hovered === i ? 700 : 400}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered !== null && (
        <div className="absolute top-1 right-1 bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none">
          <span className="font-semibold">{days[hovered].count} orang hadir</span>
          <span className="text-slate-300"> • {days[hovered].key}</span>
        </div>
      )}
    </div>
  );
};
