/**
 * Complete Google Apps Script backend generator and deployment helper.
 * Provides the full modular .gs files and Google Sheets schema initialization script.
 */

import { DEFAULT_SPREADSHEET_ID, DEFAULT_SPREADSHEET_URL } from '../config/gasConfig';

export { DEFAULT_SPREADSHEET_ID, DEFAULT_SPREADSHEET_URL };

export const GAS_SCRIPTS = {
  'SetupSheets.gs': `/**
 * RETAIL ATTENDANCE MANAGEMENT - GOOGLE SHEETS INITIALIZER
 * Run this function once in your Apps Script Editor to set up all 8 required sheets with header columns.
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit
 */

function initializeRetailAttendanceSheets() {
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) ss = SpreadsheetApp.openById('${DEFAULT_SPREADSHEET_ID}');
  } catch (e) {
    ss = SpreadsheetApp.openById('${DEFAULT_SPREADSHEET_ID}');
  }
  
  const SHEETS_SCHEMA = {
    'CONFIG': [
      ['Parameter', 'Value', 'Description'],
      ['Attendance Radius Meter', 100, 'Radius tolerance in meters for geolocation validation'],
      ['Attendance Retention Days', 90, 'Active attendance retention period before archival'],
      ['Allow Face Registration', 'TRUE', 'Enable employees to register facial biometrics'],
      ['Require Face Recognition', 'TRUE', 'Mandatory face verification on clock in'],
      ['Face Match Threshold', 0.65, 'Minimum cosine similarity score (0.0 - 1.0)'],
      ['Face Consent Required', 'TRUE', 'Require biometric consent agreement before registration'],
      ['Allow Clock In', 'TRUE', 'Global clock in master toggle'],
      ['Allow Clock Out', 'TRUE', 'Global clock out master toggle'],
      ['Work Start Time', '08:00', 'Standard morning shift start time'],
      ['Work End Time', '17:00', 'Standard evening shift end time'],
      ['Archive Before Delete', 'TRUE', 'Move expired attendance to ATTENDANCE_ARCHIVE before purging'],
      ['Request Retention Days', 365, 'Retention duration for requests and approval audit records'],
      ['GAS Web App URL', '', 'URL Web App Apps Script berakhiran /exec agar semua device otomatis tersambung']
    ],
    'MANPOWER': [
      ['NIK', 'Employee Name', 'Email', 'Phone', 'Position', 'Role Level', 'Department', 'Homebase Location ID', 'Flexible Location Attendance', 'Supervisor NIK', 'Status', 'Face Registered', 'Join Date', 'End Date'],
      ['1001', 'Andi Pratama', 'andi@retail.id', '081234567801', 'Store Staff', 'R1', 'Retail Operations', 'LOC001', 'FALSE', '2001', 'ACTIVE', 'TRUE', '2024-01-15', ''],
      ['1002', 'Citra Lestari', 'citra@retail.id', '081234567802', 'Field Merchandiser', 'R1', 'Field Sales', 'LOC001', 'TRUE', '2001', 'ACTIVE', 'FALSE', '2024-03-01', ''],
      ['2001', 'Budi Santoso', 'budi@retail.id', '081234567810', 'Store Supervisor', 'R2', 'Retail Operations', 'LOC001', 'FALSE', '3001', 'ACTIVE', 'TRUE', '2023-05-10', ''],
      ['3001', 'Dewi Anggraini', 'dewi@retail.id', '081234567820', 'Area Operations Manager', 'R3', 'Management', 'LOC003', 'TRUE', '9999', 'ACTIVE', 'TRUE', '2022-01-10', ''],
      ['9999', 'Hendra Wijaya', 'hendra@retail.id', '081234567899', 'System Administrator', 'ADMIN', 'HR & IT', 'LOC003', 'TRUE', '', 'ACTIVE', 'TRUE', '2021-08-01', '']
    ],
    'LOCATION_MASTER': [
      ['Location ID', 'Location Name', 'Location Type', 'Address', 'Latitude', 'Longitude', 'Radius Meter', 'Status'],
      ['LOC001', 'Ruko Puri Indah', 'Retail Store', 'Jl. Puri Indah Raya Blok A No. 12, Jakarta Barat', -6.1856, 106.7345, 100, 'ACTIVE'],
      ['LOC002', 'Ruko Kelapa Gading', 'Retail Store', 'Jl. Boulevard Barat Raya Blok LC7 No. 45, Jakarta Utara', -6.1532, 106.9015, 120, 'ACTIVE'],
      ['LOC003', 'Kantor Pusat Sudirman', 'Head Office', 'Menara Sudirman Lt. 15, Jl. Jend. Sudirman, Jakarta Pusat', -6.2198, 106.8203, 150, 'ACTIVE']
    ],
    'ATTENDANCE': [
      ['Attendance ID', 'NIK', 'Employee Name', 'Date', 'Time', 'Type', 'Location ID', 'Location Name', 'Homebase', 'Latitude', 'Longitude', 'Accuracy', 'Distance', 'Attendance Mode', 'Face Verified', 'Status', 'Created At']
    ],
    'REQUEST': [
      ['Request ID', 'NIK', 'Employee Name', 'Request Type', 'Start Date', 'End Date', 'Start Time', 'End Time', 'Reason', 'Attachment', 'Status', 'Approver NIK', 'Submitted At', 'Approved At', 'Rejected At', 'Rejection Reason']
    ],
    'APPROVAL': [
      ['Approval ID', 'Request ID', 'Approver NIK', 'Approver Name', 'Role', 'Action', 'Action Date', 'Comment']
    ],
    'FACE_REGISTER': [
      ['NIK', 'Employee Name', 'Face Template', 'Registered At', 'Updated At', 'Status']
    ],
    'AUDIT_LOG': [
      ['Log ID', 'Timestamp', 'NIK', 'User', 'Action', 'Reference ID', 'Old Value', 'New Value', 'Latitude', 'Longitude', 'Description']
    ]
  };

  for (let sheetName in SHEETS_SCHEMA) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    const data = SHEETS_SCHEMA[sheetName];
    if (sheet.getLastRow() === 0 && data.length > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      sheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold').setBackground('#E2E8F0');
      sheet.autoResizeColumns(1, data[0].length);
    }
  }
  Logger.log('Spreadsheet setup completed successfully.');
}`,

  'Code.gs': `/**
 * Google Apps Script Web App Entrypoint (doGet & doPost)
 * All-In-One API for Retail Attendance Management
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit
 */

var TARGET_SPREADSHEET_ID = '${DEFAULT_SPREADSHEET_ID}';

function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    let params = {};
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    const action = params.action || 'ping';
    let result = { success: false, message: 'Invalid or missing action', data: null };

    switch (action) {
      case 'ping':
        result = { success: true, message: 'Retail Attendance API is active and connected to Google Sheets', timestamp: new Date().toISOString() };
        break;
      case 'getAllData':
        result = Data_getAll();
        break;
      case 'clockIn':
        result = Attendance_clockIn(params);
        break;
      case 'clockOut':
        result = Attendance_clockOut(params);
        break;
      case 'registerFace':
        result = Face_register(params);
        break;
      case 'createRequest':
        result = Request_create(params);
        break;
      case 'processApproval':
        result = Approval_process(params);
        break;
      case 'getConfig':
        result = Config_getAll();
        break;
      case 'saveConfig':
        result = Config_set(params);
        break;
      default:
        result = { success: false, message: 'Unknown action: ' + action };
    }

    output.setContent(JSON.stringify(result));
    return output;
  } catch (err) {
    output.setContent(JSON.stringify({
      success: false,
      message: 'Server error: ' + err.toString(),
      stack: err.stack
    }));
    return output;
  }
}

/**
 * Audit Log Helper (Writes to AUDIT_LOG sheet)
 */
function Audit_log(nik, user, action, refId, oldVal, newVal, lat, lon, desc) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet) return;
    const logId = 'AUD-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);
    sheet.appendRow([
      logId,
      new Date().toISOString(),
      nik || 'SYSTEM',
      user || 'Unknown',
      action,
      refId || '-',
      oldVal || '-',
      newVal || '-',
      lat || 0,
      lon || 0,
      desc || ''
    ]);
  } catch (err) {
    Logger.log('Audit log error: ' + err);
  }
}

/**
 * Clock In with LockService
 */
/**
 * Helper to normalize dates from Google Sheets (handles Date objects, YYYY-MM-DD, DD/MM/YYYY)
 */
function normalizeGasDate(cellVal) {
  if (!cellVal) return '';
  if (cellVal instanceof Date) {
    return Utilities.formatDate(cellVal, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  var str = String(cellVal).trim();
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    var parts = str.split(/[-/]/);
    var y = parts[0];
    var m = ('0' + parts[1]).slice(-2);
    var d = ('0' + parts[2]).slice(-2);
    return y + '-' + m + '-' + d;
  }
  var dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    var d = ('0' + dmy[1]).slice(-2);
    var m = ('0' + dmy[2]).slice(-2);
    var y = dmy[3];
    return y + '-' + m + '-' + d;
  }
  return str;
}

/**
 * Clock In with LockService
 */
function Attendance_clockIn(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('ATTENDANCE');
    if (!sheet) return { success: false, message: 'ATTENDANCE sheet not found' };

    const today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
    const nowTime = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm:ss');
    const targetDate = payload.date ? normalizeGasDate(payload.date) : today;

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      var rNik = String(data[i][1]).trim();
      var rDate = normalizeGasDate(data[i][3]);
      var rType = String(data[i][5]).trim().toUpperCase();
      if (rNik === String(payload.nik).trim() && (rDate === today || rDate === targetDate) && rType === 'IN') {
        return { success: false, message: 'Karyawan sudah melakukan Clock In hari ini.' };
      }
    }

    const attendanceId = payload.attendanceId || ('ATT-' + today.replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000));
    const newRow = [
      attendanceId,
      payload.nik,
      payload.employeeName,
      payload.date || today,
      payload.time || nowTime,
      'IN',
      payload.locationId || 'REMOTE',
      payload.locationName || 'Unmapped Location',
      payload.homebase || '-',
      payload.latitude || 0,
      payload.longitude || 0,
      payload.accuracy || 0,
      payload.distance || 0,
      payload.attendanceMode || 'STANDARD',
      payload.faceVerified ? 'TRUE' : 'FALSE',
      payload.status || 'VERIFIED',
      new Date().toISOString()
    ];

    sheet.appendRow(newRow);
    Audit_log(payload.nik, payload.employeeName, 'Clock In', attendanceId, 'NOT CLOCKED IN', 'CLOCKED IN ' + (payload.time || nowTime), payload.latitude, payload.longitude, 'Clock In verified');

    return { success: true, message: 'Clock In berhasil dicatat di Spreadsheet pada ' + (payload.time || nowTime), attendanceId: attendanceId };
  } catch (err) {
    return { success: false, message: 'Gagal mencatat Clock In: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Clock Out with LockService
 */
function Attendance_clockOut(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('ATTENDANCE');
    if (!sheet) return { success: false, message: 'ATTENDANCE sheet not found' };

    const today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
    const nowTime = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm:ss');
    const targetDate = payload.date ? normalizeGasDate(payload.date) : today;

    const data = sheet.getDataRange().getValues();
    let hasClockedIn = false;
    let hasClockedOut = false;

    for (let i = 1; i < data.length; i++) {
      var rNik = String(data[i][1]).trim();
      var rDate = normalizeGasDate(data[i][3]);
      var rType = String(data[i][5]).trim().toUpperCase();

      if (rNik === String(payload.nik).trim() && (rDate === today || rDate === targetDate)) {
        if (rType === 'IN') hasClockedIn = true;
        if (rType === 'OUT') hasClockedOut = true;
      }
    }

    // Fallback: Check if user clocked in today under any matching row
    if (!hasClockedIn) {
      for (let i = data.length - 1; i >= 1; i--) {
        var rNik = String(data[i][1]).trim();
        var rType = String(data[i][5]).trim().toUpperCase();
        if (rNik === String(payload.nik).trim() && rType === 'IN') {
          hasClockedIn = true;
          break;
        }
      }
    }

    if (!hasClockedIn) {
      return { success: false, message: 'Clock Out gagal. Anda belum melakukan Clock In hari ini.' };
    }
    if (hasClockedOut) {
      return { success: false, message: 'Anda sudah melakukan Clock Out hari ini.' };
    }

    const attendanceId = payload.attendanceId || ('ATT-' + today.replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000));
    const newRow = [
      attendanceId,
      payload.nik,
      payload.employeeName,
      payload.date || today,
      payload.time || nowTime,
      'OUT',
      payload.locationId || 'REMOTE',
      payload.locationName || 'Unmapped Location',
      payload.homebase || '-',
      payload.latitude || 0,
      payload.longitude || 0,
      payload.accuracy || 0,
      payload.distance || 0,
      payload.attendanceMode || 'STANDARD',
      payload.faceVerified ? 'TRUE' : 'FALSE',
      payload.status || 'VERIFIED',
      new Date().toISOString()
    ];

    sheet.appendRow(newRow);
    Audit_log(payload.nik, payload.employeeName, 'Clock Out', attendanceId, 'CLOCKED IN', 'CLOCKED OUT ' + (payload.time || nowTime), payload.latitude, payload.longitude, 'Clock Out verified');

    return { success: true, message: 'Clock Out berhasil dicatat di Spreadsheet pada ' + (payload.time || nowTime), attendanceId: attendanceId };
  } catch (err) {
    return { success: false, message: 'Gagal mencatat Clock Out: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Register Face Template & update MANPOWER
 */
function Face_register(payload) {
  try {
    const ss = getSpreadsheet();
    const faceSheet = ss.getSheetByName('FACE_REGISTER');
    const manSheet = ss.getSheetByName('MANPOWER');
    if (!faceSheet || !manSheet) return { success: false, message: 'Required sheets not found' };

    const now = new Date().toISOString();
    const faceData = faceSheet.getDataRange().getValues();
    let foundFace = false;

    for (let i = 1; i < faceData.length; i++) {
      if (String(faceData[i][0]).trim() == String(payload.nik).trim()) {
        faceSheet.getRange(i + 1, 3).setValue(payload.faceTemplate);
        faceSheet.getRange(i + 1, 5).setValue(now);
        foundFace = true;
        break;
      }
    }

    if (!foundFace) {
      faceSheet.appendRow([
        payload.nik,
        payload.employeeName || '',
        payload.faceTemplate,
        now,
        now,
        'ACTIVE'
      ]);
    }

    // Update MANPOWER sheet Face Registered column (col 12)
    const manData = manSheet.getDataRange().getValues();
    for (let i = 1; i < manData.length; i++) {
      if (String(manData[i][0]).trim() == String(payload.nik).trim()) {
        manSheet.getRange(i + 1, 12).setValue('TRUE');
        break;
      }
    }

    Audit_log(payload.nik, payload.employeeName, 'Face Registration', payload.nik, 'TEMPLATE', 'TEMPLATE_ACTIVE', 0, 0, 'Face template registered to Google Sheets');
    return { success: true, message: 'Template biometrik wajah berhasil disimpan di Spreadsheet.' };
  } catch (err) {
    return { success: false, message: 'Gagal mendaftarkan wajah: ' + err.toString() };
  }
}

/**
 * Submit Request
 */
function Request_create(payload) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('REQUEST');
    if (!sheet) return { success: false, message: 'REQUEST sheet not found' };

    const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
    const reqId = payload.requestId || ('REQ-' + (payload.requestType || 'REQ').substring(0, 3).toUpperCase() + '-' + todayStr.replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900));

    sheet.appendRow([
      reqId,
      payload.nik,
      payload.employeeName,
      payload.requestType,
      payload.startDate,
      payload.endDate,
      payload.startTime || '',
      payload.endTime || '',
      payload.reason || '',
      payload.attachment || '',
      'PENDING APPROVAL',
      payload.currentApproverNik || '',
      new Date().toISOString(),
      '',
      '',
      ''
    ]);

    Audit_log(payload.nik, payload.employeeName, 'Request Created', reqId, 'DRAFT', 'PENDING APPROVAL', 0, 0, 'Request submitted');
    return { success: true, message: 'Pengajuan berhasil dicatat di Spreadsheet.', requestId: reqId };
  } catch (err) {
    return { success: false, message: 'Gagal membuat pengajuan: ' + err.toString() };
  }
}

/**
 * Process Approval / Rejection
 */
function Approval_process(payload) {
  try {
    const ss = getSpreadsheet();
    const appSheet = ss.getSheetByName('APPROVAL');
    const reqSheet = ss.getSheetByName('REQUEST');
    if (!appSheet || !reqSheet) return { success: false, message: 'Sheet not found' };

    const now = new Date().toISOString();
    const appData = appSheet.getDataRange().getValues();
    const appRow = [
      payload.approvalId || ('APP-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900)),
      payload.requestId,
      payload.approverNik,
      payload.approverName,
      payload.role || 'SUPERVISOR',
      payload.action,
      now,
      payload.comment || ''
    ];
    appSheet.appendRow(appRow);

    // Update status in REQUEST sheet
    const reqData = reqSheet.getDataRange().getValues();
    for (let i = 1; i < reqData.length; i++) {
      if (String(reqData[i][0]).trim() == String(payload.requestId).trim()) {
        const newStatus = payload.action == 'APPROVE' ? 'APPROVED' : 'REJECTED';
        reqSheet.getRange(i + 1, 11).setValue(newStatus);
        if (payload.action == 'APPROVE') {
          reqSheet.getRange(i + 1, 14).setValue(now);
        } else {
          reqSheet.getRange(i + 1, 15).setValue(now);
          reqSheet.getRange(i + 1, 16).setValue(payload.comment || 'Rejected');
        }
        break;
      }
    }

    Audit_log(payload.approverNik, payload.approverName, 'Request ' + payload.action, payload.requestId, 'PENDING', payload.action, 0, 0, payload.comment);
    return { success: true, message: 'Status approval berhasil diperbarui di Spreadsheet.' };
  } catch (err) {
    return { success: false, message: 'Gagal memproses approval: ' + err.toString() };
  }
}

/**
 * Config_getAll
 */
function Config_getAll() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('CONFIG');
  if (!sheet) return { success: false, message: 'CONFIG sheet not found' };

  const data = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    let val = data[i][1];
    if (val === 'TRUE') val = true;
    if (val === 'FALSE') val = false;
    config[key] = val;
  }
  return { success: true, data: config };
}

/**
 * Config_set - Saves or updates configuration parameters into CONFIG sheet
 */
function Config_set(payload) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('CONFIG');
    if (!sheet) return { success: false, message: 'CONFIG sheet not found' };
    const data = sheet.getDataRange().getValues();
    let found = false;
    const keyToFind = String(payload.key || '').trim().toLowerCase();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === keyToFind) {
        sheet.getRange(i + 1, 2).setValue(payload.value);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([payload.key, payload.value, payload.desc || 'Auto-configured parameter']);
    }
    return { success: true, message: 'Configuration saved to Google Sheets successfully.' };
  } catch (err) {
    return { success: false, message: 'Failed to save config: ' + err.toString() };
  }
}

/**
 * Data_getAll - Returns all live tables in one call
 */
function Data_getAll() {
  try {
    const ss = getSpreadsheet();
    return {
      success: true,
      data: {
        config: Config_getAll().data || {},
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}`
};
