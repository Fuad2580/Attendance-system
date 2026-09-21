/**
 * RETAIL ATTENDANCE MANAGEMENT - GOOGLE SHEETS INITIALIZER
 * Run this function once in your Apps Script Editor to set up all 8 required sheets with header columns.
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY/edit
 */

function initializeRetailAttendanceSheets() {
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) ss = SpreadsheetApp.openById('1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY');
  } catch (e) {
    ss = SpreadsheetApp.openById('1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY');
  }
  
  const SHEETS_SCHEMA = {
    'CONFIG': [
      ['Parameter', 'Value', 'Description'],
      ['Attendance Radius Meter', 100, 'Radius tolerance in meters for geolocation validation'],
      ['Attendance Retention Days', 90, 'Active attendance retention period before archival'],
      ['Allow Face Registration', 'TRUE', 'Enable employees to register facial biometrics'],
      ['Require Face Recognition', 'TRUE', 'Mandatory face verification on clock in'],
      ['Face Match Max Distance', 0.45, 'Ambang jarak Euclidean face recognition 128-d (0.35 ketat, 0.5 longgar)'],
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
      ['Location ID', 'Location Name', 'Location Type', 'Address', 'Latitude', 'Longitude', 'Radius Meter', 'Status', 'Time Zone'],
      ['LOC001', 'Ruko Puri Indah', 'Retail Store', 'Jl. Puri Indah Raya Blok A No. 12, Jakarta Barat', -6.1856, 106.7345, 100, 'ACTIVE', 'WIB'],
      ['LOC002', 'Ruko Kelapa Gading', 'Retail Store', 'Jl. Boulevard Barat Raya Blok LC7 No. 45, Jakarta Utara', -6.1532, 106.9015, 120, 'ACTIVE', 'WIB'],
      ['LOC003', 'Kantor Pusat Sudirman', 'Head Office', 'Menara Sudirman Lt. 15, Jl. Jend. Sudirman, Jakarta Pusat', -6.2198, 106.8203, 150, 'ACTIVE', 'WIB']
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

  // Kolom Date, Time & Created At di ATTENDANCE dipaksa TEKS agar tanggal "2026-09-21"
  // tidak diubah Google Sheets menjadi tanggal bertimezone lain (bikin Clock Out tak terbaca).
  const attSheet = ss.getSheetByName('ATTENDANCE');
  if (attSheet) {
    attSheet.getRange('D2:E').setNumberFormat('@');
    attSheet.getRange('Q2:Q').setNumberFormat('@');
  }

  // Kolom Face Template menampung JSON descriptor 128 dimensi: paksa teks juga.
  const faceSheet = ss.getSheetByName('FACE_REGISTER');
  if (faceSheet) {
    faceSheet.getRange('C2:C').setNumberFormat('@');
  }
  Logger.log('Spreadsheet setup completed successfully.');
}

/**
 * PERBAIKAN DATA LAMA - jalankan SEKALI dari editor Apps Script.
 *
 * Menulis ulang kolom NIK, Date, Time & Created At di sheet ATTENDANCE (dan NIK di MANPOWER
 * serta FACE_REGISTER) sebagai TEKS. Ini memperbaiki baris lama yang NIK-nya terlanjur
 * tersimpan sebagai angka (mis. "0012" menjadi 12) atau tanggalnya terlanjur dikonversi
 * menjadi objek tanggal bertimezone lain - dua hal yang membuat Clock Out ditolak
 * dengan pesan "Anda belum melakukan Clock In hari ini".
 */
function repairAttendanceFormats() {
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) ss = SpreadsheetApp.openById('1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY');
  } catch (e) {
    ss = SpreadsheetApp.openById('1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY');
  }

  function asText(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') {
      return (Math.abs(val) >= 1e11) ? val.toFixed(0) : String(val);
    }
    return String(val).trim();
  }

  function asDateText(val) {
    if (!val) return '';
    if (val instanceof Date) {
      return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd');
    }
    return String(val).trim();
  }

  var att = ss.getSheetByName('ATTENDANCE');
  if (att && att.getLastRow() > 1) {
    var n = att.getLastRow() - 1;
    var nikVals = att.getRange(2, 2, n, 1).getValues();
    var dateVals = att.getRange(2, 4, n, 1).getValues();
    var timeVals = att.getRange(2, 5, n, 1).getValues();

    var newNik = [];
    var newDate = [];
    var newTime = [];
    for (var i = 0; i < n; i++) {
      newNik.push([asText(nikVals[i][0])]);
      newDate.push([asDateText(dateVals[i][0])]);
      var t = timeVals[i][0];
      newTime.push([(t instanceof Date) ? Utilities.formatDate(t, 'Asia/Jakarta', 'HH:mm:ss') : String(t || '').trim()]);
    }

    att.getRange(2, 2, n, 1).setNumberFormat('@').setValues(newNik);
    att.getRange(2, 4, n, 1).setNumberFormat('@').setValues(newDate);
    att.getRange(2, 5, n, 1).setNumberFormat('@').setValues(newTime);
    att.getRange('Q2:Q').setNumberFormat('@');
  }

  var sheetsWithNik = ['MANPOWER', 'FACE_REGISTER'];
  for (var s = 0; s < sheetsWithNik.length; s++) {
    var sh = ss.getSheetByName(sheetsWithNik[s]);
    if (!sh || sh.getLastRow() < 2) continue;
    var rows = sh.getLastRow() - 1;
    var vals = sh.getRange(2, 1, rows, 1).getValues();
    var fixed = [];
    for (var j = 0; j < rows; j++) {
      fixed.push([asText(vals[j][0])]);
    }
    sh.getRange(2, 1, rows, 1).setNumberFormat('@').setValues(fixed);
  }

  SpreadsheetApp.flush();
  Logger.log('Perbaikan format NIK & tanggal selesai.');
}
