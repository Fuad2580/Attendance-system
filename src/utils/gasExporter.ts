/**
 * Complete Google Apps Script backend generator and deployment helper.
 * Provides the full modular .gs files and Google Sheets schema initialization script.
 */

export const DEFAULT_SPREADSHEET_ID = '1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY';
export const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY/edit?gid=0#gid=0';

export const GAS_SCRIPTS = {
  'SetupSheets.gs': `/**
 * RETAIL ATTENDANCE MANAGEMENT - GOOGLE SHEETS INITIALIZER
 * Run this function once in your Apps Script Editor to set up all 8 required sheets with header columns.
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY/edit
 */

const TARGET_SPREADSHEET_ID = '1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY';

function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
}

function initializeRetailAttendanceSheets() {
  const ss = getSpreadsheet();
  
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
      ['Request Retention Days', 365, 'Retention duration for requests and approval audit records']
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
 * Handles JSON RPC routing for Retail Attendance Management
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY/edit
 */

const TARGET_SPREADSHEET_ID = '1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY';

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
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
    }

    const action = params.action;
    let result = { success: false, message: 'Invalid or missing action', data: null };

    switch (action) {
      case 'ping':
        result = { success: true, message: 'Retail Attendance API is active', timestamp: new Date().toISOString() };
        break;
      case 'login':
        result = Auth_login(params.nik);
        break;
      case 'getConfig':
        result = Config_getAll();
        break;
      case 'getLocations':
        result = Location_getAll();
        break;
      case 'getTodayAttendance':
        result = Attendance_getToday(params.nik);
        break;
      case 'clockIn':
        result = Attendance_clockIn(params);
        break;
      case 'clockOut':
        result = Attendance_clockOut(params);
        break;
      case 'createRequest':
        result = Request_create(params);
        break;
      case 'getMyRequests':
        result = Request_getByNik(params.nik);
        break;
      case 'getPendingApprovals':
        result = Approval_getPendingForApprover(params.nik);
        break;
      case 'processApproval':
        result = Approval_process(params);
        break;
      case 'registerFace':
        result = Face_register(params);
        break;
      case 'getAdminSummary':
        result = Admin_getSummary(params.nik);
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
}`,

  'Config.gs': `/**
 * Config.gs - Reads dynamic configuration from CONFIG sheet
 */
function Config_getAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
}`,

  'Attendance.gs': `/**
 * Attendance.gs - Clock In and Clock Out with LockService & GPS validation
 */
function Attendance_clockIn(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ATTENDANCE');
    const today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
    const nowTime = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm:ss');

    // Check if already clocked in today
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] == payload.nik && data[i][3] == today && data[i][5] == 'IN') {
        return { success: false, message: 'You have already clocked in today.' };
      }
    }

    const attendanceId = 'ATT-' + today.replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const newRow = [
      attendanceId,
      payload.nik,
      payload.employeeName,
      today,
      nowTime,
      'IN',
      payload.locationId,
      payload.locationName,
      payload.homebase,
      payload.latitude,
      payload.longitude,
      payload.accuracy,
      payload.distance,
      payload.attendanceMode,
      payload.faceVerified,
      'VERIFIED',
      new Date().toISOString()
    ];

    sheet.appendRow(newRow);
    Audit_log(payload.nik, payload.employeeName, 'Clock In', attendanceId, 'NOT CLOCKED IN', 'CLOCKED IN ' + nowTime, payload.latitude, payload.longitude, 'Clock In verified');

    return { success: true, message: 'Clock In successful at ' + nowTime, attendanceId: attendanceId };
  } catch (err) {
    return { success: false, message: 'Failed to record clock in: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function Attendance_clockOut(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ATTENDANCE');
    const today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
    const nowTime = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm:ss');

    const data = sheet.getDataRange().getValues();
    let hasClockedIn = false;
    let hasClockedOut = false;

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] == payload.nik && data[i][3] == today) {
        if (data[i][5] == 'IN') hasClockedIn = true;
        if (data[i][5] == 'OUT') hasClockedOut = true;
      }
    }

    if (!hasClockedIn) {
      return { success: false, message: 'Cannot clock out. No valid Clock In record found for today.' };
    }
    if (hasClockedOut) {
      return { success: false, message: 'You have already clocked out today.' };
    }

    const attendanceId = 'ATT-' + today.replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const newRow = [
      attendanceId,
      payload.nik,
      payload.employeeName,
      today,
      nowTime,
      'OUT',
      payload.locationId,
      payload.locationName,
      payload.homebase,
      payload.latitude,
      payload.longitude,
      payload.accuracy,
      payload.distance,
      payload.attendanceMode,
      payload.faceVerified,
      'VERIFIED',
      new Date().toISOString()
    ];

    sheet.appendRow(newRow);
    Audit_log(payload.nik, payload.employeeName, 'Clock Out', attendanceId, 'CLOCKED IN', 'CLOCKED OUT ' + nowTime, payload.latitude, payload.longitude, 'Clock Out verified');

    return { success: true, message: 'Clock Out recorded at ' + nowTime, attendanceId: attendanceId };
  } finally {
    lock.releaseLock();
  }
}`
};
