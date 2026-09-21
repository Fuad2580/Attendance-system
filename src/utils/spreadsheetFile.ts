/**
 * Pembaca & penulis berkas Excel/CSV di sisi browser.
 *
 * Library SheetJS dimuat dari CDN saat dibutuhkan saja (sekali per sesi),
 * supaya halaman utama tetap ringan dan tidak ada dependensi npm tambahan.
 */

declare global {
  interface Window {
    XLSX?: any;
  }
}

const XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

let loader: Promise<any> | null = null;

export function loadSpreadsheetEngine(): Promise<any> {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-xlsx="1"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(window.XLSX));
      existing.addEventListener('error', () => reject(new Error('Gagal memuat pembaca Excel.')));
      return;
    }
    const el = document.createElement('script');
    el.src = XLSX_CDN;
    el.async = true;
    el.dataset.xlsx = '1';
    el.onload = () => resolve(window.XLSX);
    el.onerror = () =>
      reject(new Error('Gagal memuat pembaca Excel (periksa koneksi internet).'));
    document.head.appendChild(el);
  }).catch((err) => {
    loader = null;
    throw err;
  });

  return loader;
}

/** Membaca sheet pertama sebuah file .xlsx / .xls / .csv menjadi array objek. */
export async function readSpreadsheetFile(file: File): Promise<Record<string, any>[]> {
  const XLSX = await loadSpreadsheetEngine();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File tidak berisi sheet apa pun.');
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

/** Menyusun & mengunduh file .xlsx dari array objek. */
export async function downloadAsXlsx(
  rows: Record<string, any>[],
  headers: string[],
  fileName: string,
  sheetName = 'Jadwal'
): Promise<void> {
  const XLSX = await loadSpreadsheetEngine();
  const data = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, fileName);
}
