/**
 * Zona waktu Indonesia (WIB / WITA / WIT).
 *
 * Jam absensi TIDAK boleh mengikuti jam HP karyawan (bisa diubah manual, bisa beda zona).
 * Yang dipakai adalah zona waktu KANTOR TERDEKAT dari titik GPS karyawan:
 *   1. kolom "Time Zone" di sheet LOCATION_MASTER kalau diisi (WIB / WITA / WIT), atau
 *   2. deteksi otomatis dari garis bujur kantor tersebut.
 */

import { LocationMaster } from '../types';

export type IndonesiaZoneCode = 'WIB' | 'WITA' | 'WIT';

export interface ZoneInfo {
  code: IndonesiaZoneCode;
  /** IANA timezone id untuk Intl.DateTimeFormat */
  tz: string;
  /** Offset UTC dalam jam (7 / 8 / 9) */
  offset: number;
  label: string;
}

export const ZONES: Record<IndonesiaZoneCode, ZoneInfo> = {
  WIB: { code: 'WIB', tz: 'Asia/Jakarta', offset: 7, label: 'WIB (UTC+7)' },
  WITA: { code: 'WITA', tz: 'Asia/Makassar', offset: 8, label: 'WITA (UTC+8)' },
  WIT: { code: 'WIT', tz: 'Asia/Jayapura', offset: 9, label: 'WIT (UTC+9)' },
};

/**
 * Deteksi zona dari garis bujur.
 * Batas resmi: WIB < 112.5°BT untuk Jawa/Sumatra, namun Kalimantan Barat & Tengah tetap WIB
 * hingga ~116°BT, dan batas WITA/WIT berada di ~134°BT (Papua).
 */
export function zoneFromLongitude(longitude: number): IndonesiaZoneCode {
  if (!longitude || isNaN(longitude)) return 'WIB';
  if (longitude >= 134) return 'WIT';
  if (longitude >= 116) return 'WITA';
  return 'WIB';
}

function parseZoneCode(raw: any): IndonesiaZoneCode | null {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'WIB' || s.indexOf('JAKARTA') >= 0 || s === 'UTC+7' || s === '+7') return 'WIB';
  if (s === 'WITA' || s.indexOf('MAKASSAR') >= 0 || s === 'UTC+8' || s === '+8') return 'WITA';
  if (s === 'WIT' || s.indexOf('JAYAPURA') >= 0 || s === 'UTC+9' || s === '+9') return 'WIT';
  return null;
}

/**
 * Zona waktu yang berlaku untuk sebuah lokasi kantor.
 */
export function resolveZone(location?: LocationMaster | null): ZoneInfo {
  if (!location) return ZONES.WIB;
  const explicit = parseZoneCode((location as any).timeZone);
  if (explicit) return ZONES[explicit];
  return ZONES[zoneFromLongitude(location.longitude)];
}

/** Tanggal YYYY-MM-DD pada zona tertentu. */
export function dateInZone(zone: ZoneInfo, when: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone.tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(when);
  } catch (e) {
    const shifted = new Date(when.getTime() + zone.offset * 3600000);
    return shifted.toISOString().split('T')[0];
  }
}

/** Jam HH:mm:ss pada zona tertentu. */
export function timeInZone(zone: ZoneInfo, when: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone.tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(when);
  } catch (e) {
    const shifted = new Date(when.getTime() + zone.offset * 3600000);
    return shifted.toISOString().split('T')[1].substring(0, 8);
  }
}

/** Jam HH:mm untuk tampilan, mis. "08:42". */
export function clockInZone(zone: ZoneInfo, when: Date = new Date()): string {
  return timeInZone(zone, when).substring(0, 5);
}

/** Tanggal panjang Indonesia, mis. "21 September 2026". */
export function longDateInZone(zone: ZoneInfo, when: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: zone.tz,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(when);
  } catch (e) {
    return dateInZone(zone, when);
  }
}

/** Sapaan mengikuti jam setempat. */
export function greetingInZone(zone: ZoneInfo, when: Date = new Date()): string {
  const hour = parseInt(timeInZone(zone, when).substring(0, 2), 10);
  if (hour < 11) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}
