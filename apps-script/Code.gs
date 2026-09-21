/**
 * Google Apps Script Web App Entrypoint (doGet & doPost)
 * All-In-One API for Retail Attendance Management
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY/edit
 */

var TARGET_SPREADSHEET_ID = '1d6cejgL6Fh49Umk4YrOM-Iop5v_j3l-R8DRoxUH5-oY';

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
      case 'getTodayStatus':
        result = Attendance_todayStatus(params);
        break;
      case 'diagnose':
        result = Diagnose(params);
        break;
      case 'saveSchedule':
        result = Schedule_save(params);
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
 * Membandingkan NIK secara aman.
 *
 * PENYEBAB UMUM "Anda belum melakukan Clock In": Google Sheets menyimpan NIK yang ditulis
 * lewat appendRow sebagai ANGKA. NIK "0012" jadi 12, dan NIK panjang bisa tampil sebagai
 * 1.2345E+12. Kalau dibandingkan mentah dengan ===, baris Clock In milik karyawan tidak
 * pernah ketemu, sehingga Clock Out selalu ditolak.
 */
function sameNik(a, b) {
  var sa = nikToText(a);
  var sb = nikToText(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  if (sa.toUpperCase() === sb.toUpperCase()) return true;

  var numeric = /^[0-9]+$/;
  if (numeric.test(sa) && numeric.test(sb)) {
    var na = sa.replace(/^0+/, '') || '0';
    var nb = sb.replace(/^0+/, '') || '0';
    if (na === nb) return true;
  }
  return false;
}

/**
 * Mengubah nilai sel NIK menjadi teks apa adanya, termasuk membereskan notasi ilmiah
 * (1.2345E+12) yang muncul kalau NIK panjang tersimpan sebagai angka.
 */
function nikToText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1e11 || String(val).indexOf('e') >= 0 || String(val).indexOf('E') >= 0) {
      return val.toFixed(0);
    }
    return String(val);
  }
  return String(val).trim();
}

/**
 * Kolom ATTENDANCE (1-based):
 * 1 Attendance ID | 2 NIK | 3 Employee Name | 4 Date | 5 Time | 6 Type | 7 Location ID
 * 8 Location Name | 9 Homebase | 10 Latitude | 11 Longitude | 12 Accuracy | 13 Distance
 * 14 Attendance Mode | 15 Face Verified | 16 Status | 17 Created At
 */
var ATT_COL_NIK = 2;
var ATT_COL_DATE = 4;
var ATT_COL_TIME = 5;
var ATT_COL_CREATED = 17;

/**
 * Menulis baris absensi. Kolom Date & Time dipaksa berformat TEKS supaya Google Sheets
 * tidak mengubah "2026-09-21" menjadi objek tanggal bertimezone lain
 * (penyebab utama baris Clock Out dianggap "bukan hari ini").
 */
function Attendance_appendRow(sheet, row) {
  sheet.appendRow(row);
  var lastRow = sheet.getLastRow();
  // NIK ikut dipaksa teks supaya "0012" tidak berubah jadi 12 di baris-baris berikutnya
  sheet.getRange(lastRow, ATT_COL_NIK).setNumberFormat('@').setValue(nikToText(row[ATT_COL_NIK - 1]));
  sheet.getRange(lastRow, ATT_COL_DATE).setNumberFormat('@').setValue(String(row[ATT_COL_DATE - 1]));
  sheet.getRange(lastRow, ATT_COL_TIME).setNumberFormat('@').setValue(String(row[ATT_COL_TIME - 1]));
  sheet.getRange(lastRow, ATT_COL_CREATED).setNumberFormat('@').setValue(String(row[ATT_COL_CREATED - 1]));
  return lastRow;
}

/**
 * Mencari baris absensi HARI INI milik satu NIK.
 * Sebuah baris dianggap "hari ini" jika tanggalnya = hari ini (WIB), ATAU
 * timestamp Created At-nya masih dalam 18 jam terakhir (menyelamatkan baris lama
 * yang tanggalnya terlanjur tersimpan dengan timezone berbeda).
 */
function Attendance_findToday(data, nik, refDate) {
  var today = refDate ? normalizeGasDate(refDate) : Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  var nowMs = new Date().getTime();
  var result = { hasClockedIn: false, hasClockedOut: false, inTime: '', outTime: '', inRow: 0, outRow: 0 };

  for (var i = 1; i < data.length; i++) {
    if (!sameNik(data[i][1], nik)) continue;

    var rDate = normalizeGasDate(data[i][3]);
    var rType = String(data[i][5]).trim().toUpperCase();
    var rTime = String(data[i][4] || '').trim();

    var isToday = (rDate === today);

    if (!isToday) {
      var createdRaw = data[i][16];
      var createdMs = 0;
      if (createdRaw instanceof Date) {
        createdMs = createdRaw.getTime();
      } else if (createdRaw) {
        var parsed = new Date(String(createdRaw));
        createdMs = isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      }
      if (createdMs > 0 && (nowMs - createdMs) < 18 * 60 * 60 * 1000) {
        isToday = true;
      }
    }

    if (!isToday) continue;

    if (rType === 'IN') {
      result.hasClockedIn = true;
      result.inTime = rTime;
      result.inRow = i + 1;
    }
    if (rType === 'OUT') {
      result.hasClockedOut = true;
      result.outTime = rTime;
      result.outRow = i + 1;
    }
  }

  return result;
}

/**
 * Dipanggil aplikasi sebelum Clock Out, supaya aplikasi tidak perlu menebak dari cache lokal.
 */
function Attendance_todayStatus(payload) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('ATTENDANCE');
    if (!sheet) return { success: false, message: 'ATTENDANCE sheet not found' };
    if (!payload || !payload.nik) return { success: false, message: 'NIK wajib diisi' };

    const data = sheet.getDataRange().getValues();
    const status = Attendance_findToday(data, payload.nik, payload.date);

    return {
      success: true,
      message: 'OK',
      data: {
        nik: String(payload.nik),
        date: payload.date ? normalizeGasDate(payload.date) : Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
        hasClockedIn: status.hasClockedIn,
        hasClockedOut: status.hasClockedOut,
        inTime: status.inTime,
        outTime: status.outTime
      }
    };
  } catch (err) {
    return { success: false, message: 'Gagal membaca status absensi: ' + err.toString() };
  }
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
    const dateStr = payload.date ? normalizeGasDate(payload.date) : today;
    const timeStr = payload.time || nowTime;

    const data = sheet.getDataRange().getValues();
    const status = Attendance_findToday(data, payload.nik, dateStr);
    if (status.hasClockedIn) {
      return { success: false, message: 'Karyawan sudah melakukan Clock In hari ini pukul ' + (status.inTime || '-') + '.' };
    }

    const attendanceId = payload.attendanceId || ('ATT-' + today.replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000));
    const newRow = [
      attendanceId,
      nikToText(payload.nik),
      payload.employeeName,
      dateStr,
      timeStr,
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

    Attendance_appendRow(sheet, newRow);
    SpreadsheetApp.flush();

    Audit_log(payload.nik, payload.employeeName, 'Clock In', attendanceId, 'NOT CLOCKED IN', 'CLOCKED IN ' + timeStr, payload.latitude, payload.longitude, 'Clock In verified');

    return { success: true, message: 'Clock In berhasil dicatat di Spreadsheet pada ' + timeStr, attendanceId: attendanceId };
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
    const dateStr = payload.date ? normalizeGasDate(payload.date) : today;
    const timeStr = payload.time || nowTime;

    const data = sheet.getDataRange().getValues();
    const status = Attendance_findToday(data, payload.nik, dateStr);

    if (!status.hasClockedIn) {
      return { success: false, message: 'Clock Out gagal. Anda belum melakukan Clock In hari ini.' };
    }

    // Clock Out boleh diulang: baris OUT hari ini DITIMPA dengan jam terbaru,
    // sehingga tetap hanya ada satu baris OUT per karyawan per hari.
    const replacing = status.hasClockedOut && status.outRow > 0;

    const attendanceId = payload.attendanceId || ('ATT-' + today.replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000));
    const newRow = [
      attendanceId,
      nikToText(payload.nik),
      payload.employeeName,
      dateStr,
      timeStr,
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

    let writtenRow;
    const previousOutTime = status.outTime || '';

    if (replacing) {
      // Timpa baris lama (kolom 1..17) agar riwayat tidak dobel
      newRow[0] = String(data[status.outRow - 1][0] || attendanceId);
      sheet.getRange(status.outRow, 1, 1, newRow.length).setValues([newRow]);
      sheet.getRange(status.outRow, ATT_COL_NIK).setNumberFormat('@').setValue(nikToText(newRow[ATT_COL_NIK - 1]));
      sheet.getRange(status.outRow, ATT_COL_DATE).setNumberFormat('@').setValue(String(newRow[ATT_COL_DATE - 1]));
      sheet.getRange(status.outRow, ATT_COL_TIME).setNumberFormat('@').setValue(String(newRow[ATT_COL_TIME - 1]));
      sheet.getRange(status.outRow, ATT_COL_CREATED).setNumberFormat('@').setValue(String(newRow[ATT_COL_CREATED - 1]));
      writtenRow = status.outRow;
    } else {
      writtenRow = Attendance_appendRow(sheet, newRow);
    }

    SpreadsheetApp.flush();

    // Verifikasi tulis: pastikan jam benar-benar tersimpan sebelum melaporkan sukses.
    const check = String(sheet.getRange(writtenRow, ATT_COL_TIME).getValue()).trim();
    if (check.indexOf(timeStr.substring(0, 5)) !== 0 && check !== timeStr) {
      return { success: false, message: 'Baris Clock Out gagal tersimpan di sheet ATTENDANCE. Coba lagi.' };
    }

    Audit_log(
      payload.nik,
      payload.employeeName,
      replacing ? 'Clock Out (Revisi)' : 'Clock Out',
      newRow[0],
      replacing ? ('CLOCKED OUT ' + previousOutTime) : 'CLOCKED IN',
      'CLOCKED OUT ' + timeStr,
      payload.latitude,
      payload.longitude,
      replacing ? ('Jam Clock Out ditimpa: ' + previousOutTime + ' -> ' + timeStr) : 'Clock Out verified'
    );

    return {
      success: true,
      message: replacing
        ? ('Clock Out diperbarui dari ' + previousOutTime + ' menjadi ' + timeStr)
        : ('Clock Out berhasil dicatat di Spreadsheet pada ' + timeStr),
      attendanceId: newRow[0],
      replaced: replacing,
      previousTime: previousOutTime
    };
  } catch (err) {
    return { success: false, message: 'Gagal mencatat Clock Out: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Simpan / perbarui satu baris jadwal di sheet SCHEDULE.
 * Baris dikenali dari Schedule ID; kalau belum ada, ditambahkan.
 */
function Schedule_save(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('SCHEDULE');

    if (!sheet) {
      sheet = ss.insertSheet('SCHEDULE');
      sheet.appendRow(['Schedule ID', 'NIK', 'Employee Name', 'Shift Name', 'Work Days', 'Start Time', 'End Time', 'Break Minutes', 'Late Tolerance Minutes', 'Overtime After Minutes', 'Effective Date', 'End Date', 'Status']);
      sheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#E2E8F0');
    }

    if (!payload.nik) return { success: false, message: 'NIK wajib diisi.' };

    const scheduleId = payload.scheduleId || ('SCH-' + nikToText(payload.nik) + '-' + String(payload.effectiveDate || '').replace(/-/g, ''));

    const row = [
      scheduleId,
      nikToText(payload.nik),
      payload.employeeName || '',
      payload.shiftName || 'Shift',
      payload.workDays || '1,2,3,4,5,6',
      String(payload.startTime || '08:00'),
      String(payload.endTime || '17:00'),
      payload.breakMinutes === undefined ? 60 : Number(payload.breakMinutes),
      payload.lateToleranceMinutes === undefined ? 0 : Number(payload.lateToleranceMinutes),
      payload.overtimeAfterMinutes === undefined ? 30 : Number(payload.overtimeAfterMinutes),
      String(payload.effectiveDate || ''),
      String(payload.endDate || ''),
      String(payload.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
    ];

    const data = sheet.getDataRange().getValues();
    let targetRow = 0;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(scheduleId).trim()) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      targetRow = sheet.getLastRow();
    }

    // Jam & tanggal dipaksa teks agar tidak dikonversi Google Sheets
    sheet.getRange(targetRow, 2).setNumberFormat('@').setValue(nikToText(payload.nik));
    sheet.getRange(targetRow, 6, 1, 2).setNumberFormat('@').setValues([[row[5], row[6]]]);
    sheet.getRange(targetRow, 11, 1, 2).setNumberFormat('@').setValues([[row[10], row[11]]]);
    SpreadsheetApp.flush();

    Audit_log(payload.nik, payload.employeeName, 'Schedule Update', scheduleId, '-', row[5] + '-' + row[6] + ' (' + row[4] + ')', 0, 0, 'Jadwal kerja disimpan ke sheet SCHEDULE');

    return { success: true, message: 'Jadwal tersimpan.', scheduleId: scheduleId };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan jadwal: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ALAT DIAGNOSA.
 * Buka di browser:  <URL Web App>/exec?action=diagnose&nik=1001
 * Hasilnya memperlihatkan spreadsheet mana yang dipakai, tanggal hari ini menurut script,
 * dan 10 baris ATTENDANCE terakhir lengkap dengan bagaimana NIK & tanggalnya terbaca.
 */
function Diagnose(payload) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('ATTENDANCE');
    if (!sheet) return { success: false, message: 'ATTENDANCE sheet not found' };

    const nik = payload && payload.nik ? payload.nik : '';
    const data = sheet.getDataRange().getValues();
    const today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

    const rows = [];
    for (let i = Math.max(1, data.length - 10); i < data.length; i++) {
      rows.push({
        sheetRow: i + 1,
        nikRaw: String(data[i][1]),
        nikType: typeof data[i][1],
        nikAsText: nikToText(data[i][1]),
        matchesQuery: nik ? sameNik(data[i][1], nik) : null,
        dateRaw: String(data[i][3]),
        dateType: (data[i][3] instanceof Date) ? 'Date' : typeof data[i][3],
        dateNormalized: normalizeGasDate(data[i][3]),
        isToday: normalizeGasDate(data[i][3]) === today,
        type: String(data[i][5]),
        time: String(data[i][4]),
        createdAt: String(data[i][16])
      });
    }

    let manpowerNik = null;
    const manSheet = ss.getSheetByName('MANPOWER');
    if (manSheet && nik) {
      const manData = manSheet.getDataRange().getValues();
      for (let i = 1; i < manData.length; i++) {
        if (sameNik(manData[i][0], nik)) {
          manpowerNik = { sheetRow: i + 1, nikRaw: String(manData[i][0]), nikType: typeof manData[i][0], name: String(manData[i][1]) };
          break;
        }
      }
    }

    return {
      success: true,
      message: 'Diagnostic OK',
      data: {
        spreadsheetIdUsed: ss.getId(),
        spreadsheetName: ss.getName(),
        spreadsheetIdHardcoded: TARGET_SPREADSHEET_ID,
        spreadsheetMatchesApp: ss.getId() === TARGET_SPREADSHEET_ID,
        spreadsheetTimeZone: ss.getSpreadsheetTimeZone(),
        todayJakarta: today,
        totalRows: data.length - 1,
        queriedNik: String(nik),
        foundInManpower: manpowerNik,
        todayStatusForNik: nik ? Attendance_findToday(data, nik) : null,
        last10Rows: rows
      }
    };
  } catch (err) {
    return { success: false, message: 'Diagnose error: ' + err.toString() };
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

    if (!payload.faceTemplate || String(payload.faceTemplate).length < 50) {
      return { success: false, message: 'Template wajah kosong atau tidak valid.' };
    }

    const now = new Date().toISOString();
    const faceData = faceSheet.getDataRange().getValues();
    let foundFace = false;

    for (let i = 1; i < faceData.length; i++) {
      if (sameNik(faceData[i][0], payload.nik)) {
        faceSheet.getRange(i + 1, 3).setNumberFormat('@').setValue(payload.faceTemplate);
        faceSheet.getRange(i + 1, 5).setNumberFormat('@').setValue(now);
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
      if (sameNik(manData[i][0], payload.nik)) {
        manSheet.getRange(i + 1, 12).setValue('TRUE');
        break;
      }
    }

    SpreadsheetApp.flush();

    Audit_log(payload.nik, payload.employeeName, 'Face Registration', payload.nik, 'TEMPLATE', 'TEMPLATE_ACTIVE', 0, 0, 'Face descriptor 128-d registered to Google Sheets');
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
 * Membaca satu sheet menjadi array objek berdasarkan urutan kolom yang diberikan.
 */
function Sheet_toObjects(sheetName, fields) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || String(row[0]).trim() === '') continue;

    const obj = {};
    for (let c = 0; c < fields.length; c++) {
      let val = row[c];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd');
      }
      obj[fields[c]] = val === null || val === undefined ? '' : val;
    }
    out.push(obj);
  }
  return out;
}

/**
 * Data_getAll - Mengembalikan seluruh tabel dalam satu panggilan.
 *
 * PENTING: aplikasi memakai ini sebagai jalur baca utama/cadangan, sehingga spreadsheet
 * TIDAK perlu dibagikan ke publik. Endpoint gviz (docs.google.com/.../gviz/tq) hanya bisa
 * dibaca kalau file di-share "Anyone with the link"; kalau tidak, data absensi terlihat
 * kosong di aplikasi dan Clock Out ikut gagal.
 */
function Data_getAll() {
  try {
    return {
      success: true,
      message: 'OK',
      data: {
        attendance: Sheet_toObjects('ATTENDANCE', [
          'attendanceId', 'nik', 'employeeName', 'date', 'time', 'type', 'locationId',
          'locationName', 'homebase', 'latitude', 'longitude', 'accuracy', 'distance',
          'attendanceMode', 'faceVerified', 'status', 'createdAt'
        ]),
        manpower: Sheet_toObjects('MANPOWER', [
          'nik', 'employeeName', 'email', 'phone', 'position', 'roleLevel', 'department',
          'homebaseLocationId', 'flexibleAttendance', 'supervisorNik', 'status',
          'faceRegistered', 'joinDate', 'endDate'
        ]),
        locations: Sheet_toObjects('LOCATION_MASTER', [
          'locationId', 'locationName', 'locationType', 'address', 'latitude', 'longitude',
          'radiusMeter', 'status', 'timeZone'
        ]),
        requests: Sheet_toObjects('REQUEST', [
          'requestId', 'nik', 'employeeName', 'requestType', 'startDate', 'endDate',
          'startTime', 'endTime', 'reason', 'attachment', 'status', 'currentApproverNik',
          'submittedAt', 'approvedAt', 'rejectedAt', 'rejectionReason'
        ]),
        faceRegisters: Sheet_toObjects('FACE_REGISTER', [
          'nik', 'employeeName', 'faceTemplate', 'registeredAt', 'updatedAt', 'status'
        ]),
        schedules: Sheet_toObjects('SCHEDULE', [
          'scheduleId', 'nik', 'employeeName', 'shiftName', 'workDays', 'startTime', 'endTime',
          'breakMinutes', 'lateToleranceMinutes', 'overtimeAfterMinutes', 'effectiveDate',
          'endDate', 'status'
        ]),
        config: Config_getAll().data || {},
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}
