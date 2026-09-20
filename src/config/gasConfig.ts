/**
 * Global Configuration for Google Spreadsheet & Google Apps Script
 * This URL is shared by default across all devices (Laptop, HP, Tablet, etc.)
 */

export const DEFAULT_SPREADSHEET_ID = '1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY';
export const DEFAULT_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit`;

// Default Google Apps Script Web App URL.
// When set here or via VITE_GAS_URL / VITE_GAS_WEB_APP_URL, any device accessing the web app will automatically
// sync without needing to manually connect.
export const DEFAULT_GAS_URL =
  (import.meta as any).env?.VITE_GAS_WEB_APP_URL ||
  (import.meta as any).env?.VITE_GAS_URL ||
  'https://script.google.com/macros/s/AKfycbwiBs9vn8aFmhQ2gWVs7yIPcGR2DpFsXVwbUMlvQ9Jg_DODiwMaG5ikOxLda6UL4FY/exec';
