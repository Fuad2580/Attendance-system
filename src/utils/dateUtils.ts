/**
 * Utility functions for date normalization and timezone-aware date handling
 */

/**
 * Returns today's date in YYYY-MM-DD format based on local device date
 */
export function getLocalTodayDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date in Asia/Jakarta timezone (WIB, UTC+7)
 */
export function getJakartaTodayDate(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (e) {
    return getLocalTodayDate();
  }
}

/**
 * Returns current time HH:mm:ss in Asia/Jakarta timezone (WIB, UTC+7)
 */
export function getJakartaTimeString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date());
  } catch (e) {
    return new Date().toTimeString().split(' ')[0];
  }
}

/**
 * Normalizes various date string formats into standard YYYY-MM-DD
 * Handles:
 * - "2026-09-20"
 * - "2026-9-20"
 * - "20/09/2026" or "20-09-2026" (DD/MM/YYYY)
 * - "Date(2026,8,20)" (GViz JSON format, where month is 0-indexed)
 * - "2026-09-20T12:00:00.000Z"
 */
export function normalizeDateString(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw).trim();

  // Match GViz Date(yyyy, m, d)
  const gvizMatch = s.match(/Date\((\d+),\s*(\d+),\s*(\d+)/i);
  if (gvizMatch) {
    const y = gvizMatch[1];
    const m = String(parseInt(gvizMatch[2], 10) + 1).padStart(2, '0');
    const d = String(parseInt(gvizMatch[3], 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Match standard YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Match DD/MM/YYYY or MM/DD/YYYY (Google Sheets formatted value follows the sheet locale,
  // so disambiguate: a part greater than 12 can only be the day)
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const first = parseInt(dmyMatch[1], 10);
    const second = parseInt(dmyMatch[2], 10);
    const y = dmyMatch[3];
    // Default Indonesian order is DD/MM, but if the second part is > 12 it must be MM/DD
    const dayFirst = !(second > 12 && first <= 12);
    const d = String(dayFirst ? first : second).padStart(2, '0');
    const m = String(dayFirst ? second : first).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Match Indonesian date format like "20 September 2026" or "20 Sep 2026"
  const indoMonths: Record<string, string> = {
    jan: '01', januari: '01',
    feb: '02', februari: '02',
    mar: '03', maret: '03',
    apr: '04', april: '04',
    mei: '05', may: '05',
    jun: '06', juni: '06',
    jul: '07', juli: '07',
    agu: '08', agust: '08', agustus: '08', aug: '08',
    sep: '09', sept: '09', september: '09',
    okt: '10', oktober: '10', oct: '10',
    nov: '11', november: '11',
    des: '12', desember: '12', dec: '12',
  };
  const indoMatch = s.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (indoMatch) {
    const d = indoMatch[1].padStart(2, '0');
    const mKey = indoMatch[2].toLowerCase();
    const m = indoMonths[mKey];
    const y = indoMatch[3];
    if (m) {
      return `${y}-${m}-${d}`;
    }
  }

  // Fallback: try parsing with Date
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // ignore
  }

  return s;
}

/**
 * Checks if a given date string matches today (either local device today or Jakarta today)
 */
export function isDateToday(rawDate: string | null | undefined): boolean {
  if (!rawDate) return false;
  const normalized = normalizeDateString(rawDate);
  const localToday = getLocalTodayDate();
  const jakartaToday = getJakartaTodayDate();
  const isoUtcToday = new Date().toISOString().split('T')[0];

  return normalized === localToday || normalized === jakartaToday || normalized === isoUtcToday;
}
