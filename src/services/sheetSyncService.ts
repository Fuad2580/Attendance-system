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
        latitude: parseFloat(row[9]) || 0,
        longitude: parseFloat(row[10]) || 0,
        accuracy: parseFloat(row[11]) || 0,
        distance: parseFloat(row[12]) || 0,
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
        latitude: parseFloat(row[4]) || 0,
        longitude: parseFloat(row[5]) || 0,
        radiusMeter: parseFloat(row[6]) || 100,
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
