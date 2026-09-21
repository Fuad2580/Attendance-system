import { nikEquals } from '../utils/dateUtils';
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Filter,
  Trash2,
  MapPin,
  Building2,
  Shield,
  Search,
  ExternalLink,
} from 'lucide-react';

export const AdminDashboardView: React.FC = () => {
  const {
    currentUser,
    config,
    attendance,
    manpower,
    locations,
    requests,
    auditLogs,
    runRetentionCleanup,
    spreadsheetUrl,
  } = useApp();

  const [dateFilter, setDateFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [retentionMessage, setRetentionMessage] = useState<string | null>(null);

  if (!currentUser || (currentUser.roleLevel !== 'ADMIN' && currentUser.roleLevel !== 'R3')) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
        <Shield className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="font-bold text-slate-800 text-sm">Access Restricted</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          The Executive & Admin Dashboard is strictly reserved for Area Managers (R3) and Administrators.
        </p>
      </div>
    );
  }

  const todayIso = new Date().toISOString().split('T')[0];
  const targetDate = dateFilter || todayIso;

  // Compute metrics
  const activeEmployees = manpower.filter((m) => m.status === 'ACTIVE');
  const targetDateAttendance = attendance.filter((a) => a.date === targetDate);

  const clockIns = targetDateAttendance.filter((a) => a.type === 'IN');
  const presentEmployeeNiks = new Set(clockIns.map((a) => a.nik));
  const presentCount = presentEmployeeNiks.size;
  const absentCount = Math.max(0, activeEmployees.length - presentCount);

  // Late check: clock in after workStartTime
  const lateCount = clockIns.filter((a) => a.time > config.workStartTime).length;

  // Flexible attendance count
  const flexibleCount = clockIns.filter((a) => a.attendanceMode === 'FLEXIBLE').length;

  // Invalid GPS attempts from audit logs
  const invalidGpsCount = auditLogs.filter(
    (l) => l.action === 'Failed Clock In' || l.action === 'Failed GPS validation'
  ).length;

  // Active Approved Leaves
  const onLeaveCount = requests.filter(
    (r) =>
      r.status === 'APPROVED' &&
      (r.requestType === 'Sick Leave' || r.requestType === 'Annual Leave') &&
      r.startDate <= targetDate &&
      r.endDate >= targetDate
  ).length;

  // Approved Overtime count
  const overtimeApprovedCount = requests.filter(
    (r) => r.status === 'APPROVED' && r.requestType === 'Overtime' && r.startDate === targetDate
  ).length;

  // Filtered attendance records table
  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (dateFilter && a.date !== dateFilter) return false;
      if (locationFilter !== 'ALL' && a.locationId !== locationFilter) return false;

      const emp = manpower.find((m) => nikEquals(m.nik, a.nik));
      if (departmentFilter !== 'ALL' && emp?.department !== departmentFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = a.employeeName.toLowerCase().includes(q);
        const matchNik = a.nik.toLowerCase().includes(q);
        const matchLoc = a.locationName.toLowerCase().includes(q);
        if (!matchName && !matchNik && !matchLoc) return false;
      }

      return true;
    });
  }, [attendance, dateFilter, locationFilter, departmentFilter, searchQuery, manpower]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Attendance ID',
      'NIK',
      'Employee Name',
      'Date',
      'Time',
      'Type',
      'Location ID',
      'Location Name',
      'Homebase',
      'Latitude',
      'Longitude',
      'Distance (m)',
      'Attendance Mode',
      'Face Verified',
      'Status',
    ];

    const rows = filteredAttendance.map((a) => [
      a.attendanceId,
      a.nik,
      `"${a.employeeName}"`,
      a.date,
      a.time,
      a.type,
      a.locationId,
      `"${a.locationName}"`,
      `"${a.homebase}"`,
      a.latitude,
      a.longitude,
      a.distance,
      a.attendanceMode,
      a.faceVerified ? 'TRUE' : 'FALSE',
      a.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Export_${targetDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRunRetention = () => {
    const res = runRetentionCleanup();
    setRetentionMessage(
      `Pembersihan selesai: ${res.purgedCount} data kedaluwarsa dibersihkan. (Mode Arsip: ${res.archivedCount} arsip disimpan ke ATTENDANCE_ARCHIVE).`
    );
    setTimeout(() => setRetentionMessage(null), 5000);
  };

  // Departments list for dropdown
  const departments = Array.from(new Set(manpower.map((m) => m.department)));

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Admin & Operations Management</h2>
          <p className="text-xs text-slate-500">
            Monitoring seluruh cabang retail, kepatuhan GPS, dan audit trail log
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs transition-colors border border-emerald-300"
            title="Buka Google Spreadsheet Terhubung"
          >
            <ExternalLink className="w-4 h-4 text-emerald-600" />
            <span>Buka Google Sheets</span>
          </a>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleRunRetention}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors border border-slate-200"
            title="Purge / Archive attendance older than 90 days"
          >
            <Trash2 className="w-4 h-4 text-amber-600" />
            <span>Retention Job</span>
          </button>
        </div>
      </div>

      {retentionMessage && (
        <div className="p-3 rounded-xl text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 font-medium">
          {retentionMessage}
        </div>
      )}

      {/* 8 Metric Summary Blocks (Rule 21) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Manpower</div>
          <div className="text-xl font-black text-slate-900 mt-1">{activeEmployees.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pegawai aktif</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Hadir (Present)</div>
          <div className="text-xl font-black text-emerald-600 mt-1">{presentCount}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Sudah Clock In</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Belum Hadir (Absent)</div>
          <div className="text-xl font-black text-rose-600 mt-1">{absentCount}</div>
          <div className="text-[10px] text-rose-700 mt-0.5">Hari ini</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Terlambat (Late)</div>
          <div className="text-xl font-black text-amber-600 mt-1">{lateCount}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">&gt; {config.workStartTime} WIB</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Izin & Cuti</div>
          <div className="text-xl font-black text-purple-600 mt-1">{onLeaveCount}</div>
          <div className="text-[10px] text-purple-700 mt-0.5">Approved requests</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Lembur (Overtime)</div>
          <div className="text-xl font-black text-blue-600 mt-1">{overtimeApprovedCount}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Disetujui hari ini</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Remote / Flexible</div>
          <div className="text-xl font-black text-indigo-600 mt-1">{flexibleCount}</div>
          <div className="text-[10px] text-indigo-700 mt-0.5">Mobile attendance</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Invalid GPS Attempts</div>
          <div className="text-xl font-black text-rose-700 mt-1">{invalidGpsCount}</div>
          <div className="text-[10px] text-rose-600 mt-0.5">Tercatat di Audit Log</div>
        </div>
      </div>

      {/* Location Summary Cards */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span>Monitoring Kehadiran Per Ruko / Lokasi Retail</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {locations.map((loc) => {
            const storeClockIns = targetDateAttendance.filter(
              (a) => a.locationId === loc.locationId && a.type === 'IN'
            ).length;
            const homebaseStaff = manpower.filter(
              (m) => m.homebaseLocationId === loc.locationId
            ).length;

            return (
              <div
                key={loc.locationId}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-slate-900 truncate">{loc.locationName}</div>
                  <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {loc.locationId}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">{loc.address}</div>
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    Hadir di lokasi: <strong className="text-emerald-700">{storeClockIns}</strong>
                  </span>
                  <span className="text-slate-500 text-[11px]">Homebase: {homebaseStaff}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filter Transaksi Absensi</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filteredAttendance.length} record ditemukan
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Pilih Tanggal
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lokasi</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
            >
              <option value="ALL">Semua Lokasi</option>
              {locations.map((l) => (
                <option key={l.locationId} value={l.locationId}>
                  {l.locationName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Departemen
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
            >
              <option value="ALL">Semua Dept</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Cari Nama / NIK
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nama atau NIK..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-7 border border-slate-300 rounded-lg bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Tabel Log Absensi Terkini</h3>
          <span className="text-[11px] text-slate-400">Tersinkronisasi dengan sheet ATTENDANCE</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3">Pegawai</th>
                <th className="py-2.5 px-3">Tipe</th>
                <th className="py-2.5 px-3">Lokasi Absen</th>
                <th className="py-2.5 px-3">Homebase</th>
                <th className="py-2.5 px-3">Jarak</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAttendance.map((a) => (
                <tr key={a.attendanceId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px]">
                    <div>{a.date}</div>
                    <div className="text-slate-500 font-bold">{a.time}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{a.employeeName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">NIK: {a.nik}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        a.type === 'IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {a.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{a.locationName}</td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px]">{a.homebase}</td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px] font-mono">{a.distance}m</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        a.attendanceMode === 'FLEXIBLE'
                          ? 'bg-amber-100 text-amber-800'
                          : a.attendanceMode === 'REVISED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {a.attendanceMode}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-emerald-700 font-bold text-[11px]">✓ {a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
