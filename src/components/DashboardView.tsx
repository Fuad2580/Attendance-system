import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Camera,
  Navigation,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { ClockModal } from './ClockModal';
import { FaceRegistrationModal } from './FaceRegistrationModal';
import { RequestType } from '../types';

interface DashboardViewProps {
  onOpenNewRequest: (preselectedType?: RequestType) => void;
  onViewAllRequests: () => void;
  onOpenSpreadsheet: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewRequest,
  onViewAllRequests,
  onOpenSpreadsheet,
}) => {
  const {
    currentUser,
    config,
    geoStatus,
    userCoords,
    refreshGPS,
    isGpsLoading,
    setSimulatedLocation,
    currentSimulatedLabel,
    attendance,
    requests,
    locations,
  } = useApp();

  const [activeClockModal, setActiveClockModal] = useState<'IN' | 'OUT' | null>(null);
  const [showFaceRegModal, setShowFaceRegModal] = useState(false);
  const [showGeoTester, setShowGeoTester] = useState(false);

  if (!currentUser) return null;

  // Format today's date
  const now = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const todayFormatted = now.toLocaleDateString('id-ID', dateOptions);
  const todayIso = now.toISOString().split('T')[0];

  // Find today's attendance records for current user
  const todayIn = attendance.find(
    (a) => a.nik === currentUser.nik && a.date === todayIso && a.type === 'IN'
  );
  const todayOut = attendance.find(
    (a) => a.nik === currentUser.nik && a.date === todayIso && a.type === 'OUT'
  );

  // Homebase location
  const homebaseObj = locations.find((l) => l.locationId === currentUser.homebaseLocationId);
  const homebaseName = homebaseObj ? homebaseObj.locationName : currentUser.homebaseLocationId;

  // Recent requests for current user
  const myRecentRequests = requests.filter((r) => r.nik === currentUser.nik).slice(0, 3);

  const isFlexible = currentUser.flexibleAttendance;
  const isGpsOk = isFlexible || geoStatus.isWithinRadius;

  return (
    <div className="space-y-4 pb-12">
      {/* Retail Store Greeting & Date */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-lg relative overflow-hidden">
        {/* Subtle decorative background pattern */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
              <span>Selamat Pagi • Retail Staff Portal</span>
              {currentUser.flexibleAttendance && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[9px]">
                  FLEXIBLE ATTENDANCE
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              {currentUser.employeeName}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Hari ini: <strong className="text-white">{todayFormatted}</strong>
            </p>
          </div>

          {/* Quick Face Register Button if not registered */}
          {!currentUser.faceRegistered && config.requireFaceRecognition && (
            <button
              onClick={() => setShowFaceRegModal(true)}
              className="self-start sm:self-auto flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all animate-bounce"
            >
              <Camera className="w-4 h-4" />
              <span>Daftar Wajah (Face Biometric)</span>
            </button>
          )}
        </div>

        {/* Homebase vs Current GPS Location Grid (Rule 7 & 28) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-5 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Homebase</div>
            <div className="text-xs sm:text-sm font-bold text-white truncate mt-1">
              {homebaseName}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{currentUser.homebaseLocationId}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Location</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-300 truncate mt-1">
              {geoStatus.location ? geoStatus.location.locationName : 'Detecting GPS...'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {geoStatus.location?.locationType || 'Retail Outlet'}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distance</div>
            <div className="text-xs sm:text-sm font-bold text-white mt-1 flex items-baseline gap-1">
              <span>{geoStatus.distance}</span>
              <span className="text-[10px] font-normal text-slate-300">meter</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Max radius: {geoStatus.allowedRadius}m</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GPS Status</div>
            <div
              className={`text-xs sm:text-sm font-bold mt-1 flex items-center gap-1.5 ${
                isGpsOk ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isGpsOk ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isFlexible && !geoStatus.isWithinRadius ? 'FLEXIBLE' : 'VERIFIED'}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>OUT OF RANGE</span>
                </>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Acc: ±{userCoords.accuracy}m</div>
          </div>
        </div>
      </div>

      {/* GPS Location Simulator & Real GPS Bar */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold text-slate-700">GPS Simulator / Coordinate Tool:</span>
            {currentSimulatedLabel && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-medium">
                {currentSimulatedLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={refreshGPS}
              disabled={isGpsLoading}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
              title="Query Browser HTML5 Geolocation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
              <span>Real Device GPS</span>
            </button>
            <button
              onClick={() => setShowGeoTester(!showGeoTester)}
              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 font-medium flex items-center gap-1"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Preset Ruko</span>
            </button>
          </div>
        </div>

        {/* Expandable Preset Location Buttons */}
        {showGeoTester && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => setSimulatedLocation(-6.18562, 106.73448, 'Ruko Puri (14m - In Radius)')}
              className="p-2 text-left rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 transition-colors"
            >
              <div className="font-bold text-xs">Ruko Puri Indah</div>
              <div className="text-[10px] text-emerald-700">~14m away (Verified)</div>
            </button>

            <button
              onClick={() => setSimulatedLocation(-6.15335, 106.90165, 'Ruko Gading (25m - In Radius)')}
              className="p-2 text-left rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 transition-colors"
            >
              <div className="font-bold text-xs">Ruko Kelapa Gading</div>
              <div className="text-[10px] text-blue-700">~25m away (Cross-store)</div>
            </button>

            <button
              onClick={() => setSimulatedLocation(-6.21995, 106.82045, 'Sudirman Head Office (18m)')}
              className="p-2 text-left rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 transition-colors"
            >
              <div className="font-bold text-xs">Kantor Sudirman</div>
              <div className="text-[10px] text-purple-700">~18m away (HQ)</div>
            </button>

            <button
              onClick={() => setSimulatedLocation(-6.2000, 106.7000, 'Outside Attendance Range (3.2km)')}
              className="p-2 text-left rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-900 transition-colors"
            >
              <div className="font-bold text-xs">Outside Radius (3.2km)</div>
              <div className="text-[10px] text-rose-700">Test Rejected Attempt</div>
            </button>
          </div>
        )}
      </div>

      {/* Main Big Attendance Action Buttons (Rule 5 & 28) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Clock In Button */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                IN
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Clock In Masuk</h3>
                <p className="text-[11px] text-slate-500">Jam Masuk Toko: {config.workStartTime}</p>
              </div>
            </div>
            {todayIn && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {todayIn.time.substring(0, 5)}
              </span>
            )}
          </div>

          <div>
            <button
              onClick={() => setActiveClockModal('IN')}
              disabled={!!todayIn || !config.allowClockIn}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2.5 ${
                todayIn
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>{todayIn ? `SUDAH CLOCK IN (${todayIn.time})` : 'CLOCK IN SEKARANG'}</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 text-center">
            {todayIn ? (
              <span className="text-emerald-700 font-medium">
                ✓ Recorded at {todayIn.locationName} ({todayIn.distance}m)
              </span>
            ) : (
              <span>Wajib verifikasi wajah & radius GPS</span>
            )}
          </div>
        </div>

        {/* Clock Out Button */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                OUT
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Clock Out Pulang</h3>
                <p className="text-[11px] text-slate-500">Jam Pulang Toko: {config.workEndTime}</p>
              </div>
            </div>
            {todayOut && (
              <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {todayOut.time.substring(0, 5)}
              </span>
            )}
          </div>

          <div>
            <button
              onClick={() => setActiveClockModal('OUT')}
              disabled={!todayIn || !!todayOut || !config.allowClockOut}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2.5 ${
                !todayIn
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                  : todayOut
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                  : 'bg-rose-600 hover:bg-rose-700 text-white active:scale-98'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>
                {!todayIn
                  ? 'CLOCK IN TERLEBIH DAHULU'
                  : todayOut
                  ? `SUDAH CLOCK OUT (${todayOut.time})`
                  : 'CLOCK OUT SEKARANG'}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 text-center">
            {todayOut ? (
              <span className="text-rose-700 font-medium">
                ✓ Recorded at {todayOut.locationName} ({todayOut.distance}m)
              </span>
            ) : !todayIn ? (
              <span className="text-slate-400">Tidak dapat Clock Out tanpa Clock In</span>
            ) : (
              <span>Pastikan shift kerja selesai sebelum clock out</span>
            )}
          </div>
        </div>
      </div>

      {/* Today's Attendance Detail Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span>Status Kehadiran Hari Ini</span>
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-500 text-[11px] font-medium">Clock In</div>
            <div className="text-base font-bold text-slate-900 mt-1">
              {todayIn ? todayIn.time : 'Belum Ada'}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {todayIn ? `${todayIn.locationName} (${todayIn.distance}m)` : 'Menunggu kedatangan'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-500 text-[11px] font-medium">Clock Out</div>
            <div className="text-base font-bold text-slate-900 mt-1">
              {todayOut ? todayOut.time : 'Belum Ada'}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {todayOut ? `${todayOut.locationName} (${todayOut.distance}m)` : 'Shift masih berjalan'}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions (Overtime, Revision, Leaves) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Quick Request Actions</span>
          </h3>
          <span className="text-[11px] text-slate-500">Auto-routes to direct supervisor</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            onClick={() => onOpenNewRequest('Overtime')}
            className="p-3 text-left rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
          >
            <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
              Lembur (Overtime)
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Stock opname / shift ekstra</div>
          </button>

          <button
            onClick={() => onOpenNewRequest('Clock In Revision')}
            className="p-3 text-left rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
          >
            <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
              Revisi Clock In
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Koreksi jam datang</div>
          </button>

          <button
            onClick={() => onOpenNewRequest('Clock Out Revision')}
            className="p-3 text-left rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
          >
            <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
              Revisi Clock Out
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Koreksi jam pulang</div>
          </button>

          <button
            onClick={() => onOpenNewRequest('Sick Leave')}
            className="p-3 text-left rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
          >
            <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
              Izin Sakit
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Lampiran surat dokter</div>
          </button>

          <button
            onClick={() => onOpenNewRequest('Annual Leave')}
            className="p-3 text-left rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
          >
            <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
              Cuti Tahunan
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Pengajuan libur tahunan</div>
          </button>
        </div>
      </div>

      {/* My Requests Recent List with Multi-level Timeline */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Riwayat Pengajuan Saya</span>
          </h3>
          <button
            onClick={onViewAllRequests}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {myRecentRequests.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Belum ada pengajuan request aktif.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {myRecentRequests.map((req) => (
              <div key={req.requestId} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{req.requestType}</span>
                    <span className="text-[10px] font-mono text-slate-400">{req.requestId}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs sm:max-w-md">
                    {req.reason} • Tgl: {req.startDate}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : req.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clock Modal */}
      {activeClockModal && (
        <ClockModal
          type={activeClockModal}
          onClose={() => setActiveClockModal(null)}
          onOpenFaceRegistration={() => setShowFaceRegModal(true)}
        />
      )}

      {/* Face Registration Modal */}
      {showFaceRegModal && (
        <FaceRegistrationModal onClose={() => setShowFaceRegModal(false)} />
      )}
    </div>
  );
};
