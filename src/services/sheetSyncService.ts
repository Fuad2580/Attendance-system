import {
  AppConfig,
  AttendanceRecord,
  Manpower,
  LocationMaster,
  RequestRecord,
  ApprovalRecord,
  FaceRegisterRecord,
  AuditLogRecord,
} from '../types';
import { normalizeDateString } from '../utils/dateUtils';

/**
 * Safely parses numeric values such as coordinates, radius, or distance.
 * Handles both international decimal dot (-6.1856) and Indonesian decimal comma (-6,1856).
 */
export function parseCoordinate(val: any, defaultVal = 0): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const str = String(val).trim();
  if (!str) return defaultVal;

  let normalized = str;
  if (str.includes(',') && !str.includes('.')) {
    // Indonesian format: e.g. "-6,1856" or "106,7345"
    normalized = str.replace(',', '.');
  } else if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      normalized = str.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = str.replace(/,/g, '');
    }
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Parses Google Visualization API (gviz/tq) response JSON
 */
async function fetchGvizSheet(spreadsheetId: string, sheetName: string): Promise<any[][]> {
  const timestamp = Date.now();
  // Prevent any browser/CDN caching by appending cache-busting timestamp
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
    sheetName
  )}&_t=${timestamp}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet ${sheetName}: HTTP ${res.status}`);
  }

  const text = await res.text();
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Invalid gviz response for sheet ${sheetName}`);
  }

  const jsonStr = text.substring(startIdx, endIdx + 1);
  const data = JSON.parse(jsonStr);
  const rows = data.table?.rows || [];

  return rows.map((r: any) =>
    (r.c || []).map((cell: any) => {
      if (!cell) return '';
      // If raw value is already a number, return it to preserve exact float
      if (typeof cell.v === 'number') return cell.v;
      if (cell.f !== undefined && cell.f !== null) return cell.f;
      return cell.v !== undefined && cell.v !== null ? cell.v : '';
    })
  );
}

/**
 * Fetch all attendance records from Google Spreadsheet directly
 */
export async function fetchLiveAttendance(spreadsheetId: string): Promise<AttendanceRecord[]> {
  try {
    const rawRows = await fetchGvizSheet(spreadsheetId, 'ATTENDANCE');
    if (!rawRows || rawRows.length === 0) return [];

    const records: AttendanceRecord[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      // Skip header row if present
      const id = String(row[0] || '').trim();
      if (!id || id.toLowerCase() === 'attendance id') continue;

      const record: AttendanceRecord = {
        attendanceId: id,
        nik: String(row[1] || '').trim(),
        employeeName: String(row[2] || '').trim(),
        date: normalizeDateString(row[3]),
        time: String(row[4] || '').trim(),
        type: (String(row[5] || '').toUpperCase() === 'OUT' ? 'OUT' : 'IN') as 'IN' | 'OUT',
        locationId: String(row[6] || '').trim(),
        locationName: String(row[7] || '').trim(),
        homebase: String(row[8] || '').trim(),
        latitude: parseCoordinate(row[9]),
        longitude: parseCoordinate(row[10]),
        accuracy: parseCoordinate(row[11]),
        distance: parseCoordinate(row[12]),
        attendanceMode: String(row[13] || '').toUpperCase() === 'FLEXIBLE' ? 'FLEXIBLE' : 'STANDARD',
        faceVerified: String(row[14]).toUpperCase() === 'TRUE' || row[14] === true,
        status: (String(row[15] || '').toUpperCase() as any) || 'VERIFIED',
        createdAt: String(row[16] || new Date().toISOString()),
      };
      records.push(record);
    }
    // Return newest first
    return records.reverse();
  } catch (err) {
    console.warn('[SheetSync] fetchLiveAttendance failed:', err);
    return [];
  }
}

/**
 * Fetch configuration & GAS Web App URL from CONFIG sheet
 */
export async function fetchLiveConfig(spreadsheetId: string): Promise<{ gasUrl?: string }> {
  try {
    const rawRows = await fetchGvizSheet(spreadsheetId, 'CONFIG');
    if (!rawRows || rawRows.length === 0) return {};
    let foundGasUrl: string | undefined;
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const param = String(row[0] || '').trim().toLowerCase();
      const val = String(row[1] || '').trim();
      if ((param.includes('gas web app url') || param.includes('web app url')) && val.startsWith('http')) {
        foundGasUrl = val;
      }
    }
    return { gasUrl: foundGasUrl };
  } catch (err) {
    return {};
  }
}

/**
 * Fetch all employees from MANPOWER sheet
 */
export async function fetchLiveManpower(spreadsheetId: string): Promise<Manpower[]> {
  try {
    const rawRows = await fetchGvizSheet(spreadsheetId, 'MANPOWER');
    if (!rawRows || rawRows.length === 0) return [];

    const list: Manpower[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const nik = String(row[0] || '').trim();
      if (!nik || nik.toLowerCase() === 'nik') continue;

      list.push({
        nik,
        employeeName: String(row[1] || '').trim(),
        email: String(row[2] || '').trim(),
        phone: String(row[3] || '').trim(),
        position: String(row[4] || '').trim(),
        roleLevel: (String(row[5] || '').toUpperCase() as any) || 'R1',
        department: String(row[6] || '').trim(),
        homebaseLocationId: String(row[7] || '').trim(),
        flexibleAttendance: String(row[8]).toUpperCase() === 'TRUE' || row[8] === true,
        supervisorNik: String(row[9] || '').trim(),
        status: String(row[10] || '').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        faceRegistered: String(row[11]).toUpperCase() === 'TRUE' || row[11] === true,
        joinDate: String(row[12] || ''),
        endDate: String(row[13] || ''),
      });
    }
    return list;
  } catch (err) {
    console.warn('[SheetSync] fetchLiveManpower failed:', err);
    return [];
  }
}

/**
 * Fetch all locations from LOCATION_MASTER sheet
 */
export async function fetchLiveLocations(spreadsheetId: string): Promise<LocationMaster[]> {
  try {
    const rawRows = await fetchGvizSheet(spreadsheetId, 'LOCATION_MASTER');
    if (!rawRows || rawRows.length === 0) return [];

    const list: LocationMaster[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const id = String(row[0] || '').trim();
      if (!id || id.toLowerCase() === 'location id') continue;

      list.push({
        locationId: id,
        locationName: String(row[1] || '').trim(),
        locationType: String(row[2] || '').trim(),
        address: String(row[3] || '').trim(),
        latitude: parseCoordinate(row[4]),
        longitude: parseCoordinate(row[5]),
        radiusMeter: parseCoordinate(row[6], 100),
        status: String(row[7] || '').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
    }
    return list;
  } catch (err) {
    console.warn('[SheetSync] fetchLiveLocations failed:', err);
    return [];
  }
}

/**
 * Fetch requests from REQUEST sheet
 */
export async function fetchLiveRequests(spreadsheetId: string): Promise<RequestRecord[]> {
  try {
    const rawRows = await fetchGvizSheet(spreadsheetId, 'REQUEST');
    if (!rawRows || rawRows.length === 0) return [];

    const list: RequestRecord[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const id = String(row[0] || '').trim();
      if (!id || id.toLowerCase() === 'request id') continue;

      const startDate = String(row[4] || '');
      list.push({
        requestId: id,
        nik: String(row[1] || '').trim(),
        employeeName: String(row[2] || '').trim(),
        requestType: (row[3] as any) || 'Izin',
        requestDate: startDate || new Date().toISOString().split('T')[0],
        startDate: startDate,
        endDate: String(row[5] || ''),
        startTime: String(row[6] || ''),
        endTime: String(row[7] || ''),
        reason: String(row[8] || ''),
        attachment: String(row[9] || ''),
        status: (String(row[10] || '').toUpperCase() as any) || 'PENDING APPROVAL',
        currentApproverNik: String(row[11] || ''),
        submittedAt: String(row[12] || new Date().toISOString()),
        approvedAt: row[13] ? String(row[13]) : undefined,
        rejectedAt: row[14] ? String(row[14]) : undefined,
        rejectionReason: row[15] ? String(row[15]) : undefined,
      });
    }
    return list.reverse();
  } catch (err) {
    console.warn('[SheetSync] fetchLiveRequests failed:', err);
    return [];
  }
}

/**
 * Fetch all registered face templates from FACE_REGISTER sheet
 */
export async function fetchLiveFaceRegisters(spreadsheetId: string): Promise<FaceRegisterRecord[]> {
  try {
    const rawRows = await fetchGvizSheet(spreadsheetId, 'FACE_REGISTER');
    if (!rawRows || rawRows.length === 0) return [];

    const list: FaceRegisterRecord[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const nik = String(row[0] || '').trim();
      if (!nik || nik.toLowerCase() === 'nik') continue;

      list.push({
        nik,
        employeeName: String(row[1] || '').trim(),
        faceTemplate: String(row[2] || '').trim(),
        registeredAt: String(row[3] || new Date().toISOString()),
        updatedAt: String(row[4] || new Date().toISOString()),
        status: (String(row[5] || '').toUpperCase() as any) || 'ACTIVE',
      });
    }
    return list;
  } catch (err) {
    console.warn('[SheetSync] fetchLiveFaceRegisters failed:', err);
    return [];
  }
}

/**
 * Fetch every table straight from the Apps Script Web App.
 * This is the reliable path: it works even when the spreadsheet is NOT shared publicly
 * (the gviz endpoint above silently returns nothing in that case).
 */
export async function fetchAllDataViaGas(gasUrl: string): Promise<{
  attendance: AttendanceRecord[];
  manpower: Manpower[];
  locations: LocationMaster[];
  requests: RequestRecord[];
  faceRegisters: FaceRegisterRecord[];
} | null> {
  if (!gasUrl) return null;
  try {
    const res = await sendGasAction(gasUrl, 'getAllData');
    if (!res.success || !res.data) return null;
    const d = res.data;

    const attendance: AttendanceRecord[] = (d.attendance || []).map((r: any) => ({
      attendanceId: String(r.attendanceId || ''),
      nik: String(r.nik || '').trim(),
      employeeName: String(r.employeeName || ''),
      date: normalizeDateString(r.date),
      time: String(r.time || ''),
      type: String(r.type || '').toUpperCase() === 'OUT' ? 'OUT' : 'IN',
      locationId: String(r.locationId || ''),
      locationName: String(r.locationName || ''),
      homebase: String(r.homebase || ''),
      latitude: parseCoordinate(r.latitude),
      longitude: parseCoordinate(r.longitude),
      accuracy: parseCoordinate(r.accuracy),
      distance: parseCoordinate(r.distance),
      attendanceMode: String(r.attendanceMode || '').toUpperCase() === 'FLEXIBLE' ? 'FLEXIBLE' : 'STANDARD',
      faceVerified: String(r.faceVerified).toUpperCase() === 'TRUE' || r.faceVerified === true,
      status: (String(r.status || 'VERIFIED').toUpperCase() as any),
      createdAt: String(r.createdAt || new Date().toISOString()),
    }));

    const manpower: Manpower[] = (d.manpower || []).map((r: any) => ({
      nik: String(r.nik || '').trim(),
      employeeName: String(r.employeeName || ''),
      email: String(r.email || ''),
      phone: String(r.phone || ''),
      position: String(r.position || ''),
      roleLevel: (String(r.roleLevel || 'R1').toUpperCase() as any),
      department: String(r.department || ''),
      homebaseLocationId: String(r.homebaseLocationId || ''),
      flexibleAttendance: String(r.flexibleAttendance).toUpperCase() === 'TRUE' || r.flexibleAttendance === true,
      supervisorNik: String(r.supervisorNik || ''),
      status: String(r.status || '').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      faceRegistered: String(r.faceRegistered).toUpperCase() === 'TRUE' || r.faceRegistered === true,
      joinDate: String(r.joinDate || ''),
      endDate: String(r.endDate || ''),
    }));

    const locations: LocationMaster[] = (d.locations || []).map((r: any) => ({
      locationId: String(r.locationId || '').trim(),
      locationName: String(r.locationName || ''),
      locationType: String(r.locationType || ''),
      address: String(r.address || ''),
      latitude: parseCoordinate(r.latitude),
      longitude: parseCoordinate(r.longitude),
      radiusMeter: parseCoordinate(r.radiusMeter, 100),
      status: String(r.status || '').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    }));

    const requests: RequestRecord[] = (d.requests || []).map((r: any) => ({
      requestId: String(r.requestId || ''),
      nik: String(r.nik || '').trim(),
      employeeName: String(r.employeeName || ''),
      requestType: (r.requestType as any) || 'Izin',
      requestDate: normalizeDateString(r.startDate) || new Date().toISOString().split('T')[0],
      startDate: normalizeDateString(r.startDate),
      endDate: normalizeDateString(r.endDate),
      startTime: String(r.startTime || ''),
      endTime: String(r.endTime || ''),
      reason: String(r.reason || ''),
      attachment: String(r.attachment || ''),
      status: (String(r.status || 'PENDING APPROVAL').toUpperCase() as any),
      currentApproverNik: String(r.currentApproverNik || ''),
      submittedAt: String(r.submittedAt || new Date().toISOString()),
      approvedAt: r.approvedAt ? String(r.approvedAt) : undefined,
      rejectedAt: r.rejectedAt ? String(r.rejectedAt) : undefined,
      rejectionReason: r.rejectionReason ? String(r.rejectionReason) : undefined,
    }));

    const faceRegisters: FaceRegisterRecord[] = (d.faceRegisters || []).map((r: any) => ({
      nik: String(r.nik || '').trim(),
      employeeName: String(r.employeeName || ''),
      faceTemplate: String(r.faceTemplate || ''),
      registeredAt: String(r.registeredAt || ''),
      updatedAt: String(r.updatedAt || ''),
      status: (String(r.status || 'ACTIVE').toUpperCase() as any),
    }));

    return {
      attendance: attendance.reverse(),
      manpower,
      locations,
      requests: requests.reverse(),
      faceRegisters,
    };
  } catch (err) {
    console.warn('[SheetSync] fetchAllDataViaGas failed:', err);
    return null;
  }
}

/**
 * Asks the Apps Script backend whether this employee has already clocked in / out today.
 * The spreadsheet is the single source of truth, so the UI never has to guess from stale local state.
 */
export async function fetchTodayStatusViaGas(
  gasUrl: string,
  nik: string
): Promise<{ hasClockedIn: boolean; hasClockedOut: boolean; inTime?: string; outTime?: string } | null> {
  if (!gasUrl || !nik) return null;
  const res = await sendGasAction(gasUrl, 'getTodayStatus', { nik });
  if (!res.success || !res.data) return null;
  return {
    hasClockedIn: !!res.data.hasClockedIn,
    hasClockedOut: !!res.data.hasClockedOut,
    inTime: res.data.inTime || undefined,
    outTime: res.data.outTime || undefined,
  };
}

/**
 * Send write action to Google Apps Script Web App
 */
export async function sendGasAction(gasUrl: string, action: string, payload: any = {}): Promise<{ success: boolean; message: string; data?: any }> {
  if (!gasUrl || gasUrl.trim() === '') {
    return {
      success: false,
      message: 'Google Apps Script URL is not configured.',
    };
  }

  try {
    const body = JSON.stringify({
      action,
      ...payload,
    });

    // Use text/plain to avoid CORS OPTIONS preflight issue with Google Apps Script
    const response = await fetch(gasUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body,
    });

    const result = await response.json();
    return {
      success: !!result.success,
      message: result.message || (result.success ? 'Operation succeeded' : 'Operation failed'),
      data: result.data,
    };
  } catch (error: any) {
    console.error(`[GAS POST] Error on action '${action}':`, error);
    return {
      success: false,
      message: `Network error connecting to Google Apps Script: ${error.message || error}`,
    };
  }
}
