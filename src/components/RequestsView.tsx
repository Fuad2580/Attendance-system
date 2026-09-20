import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Sparkles,
  Paperclip,
  Check,
} from 'lucide-react';
import { RequestType, RequestRecord } from '../types';

interface RequestsViewProps {
  initialRequestType?: RequestType | null;
  onClearInitialRequestType?: () => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  initialRequestType,
  onClearInitialRequestType,
}) => {
  const { currentUser, requests, submitRequest, manpower } = useApp();

  const [showModal, setShowModal] = useState(!!initialRequestType);
  const [requestType, setRequestType] = useState<RequestType>(initialRequestType || 'Overtime');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('20:00');
  const [targetAttendanceDate, setTargetAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetRevisedTime, setTargetRevisedTime] = useState('08:00');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState('');
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  if (!currentUser) return null;

  // Filter requests belonging to current user
  const userRequests = requests.filter((r) => r.nik === currentUser.nik);

  // Compute overtime hours
  const calculateOvertimeHours = () => {
    if (requestType !== 'Overtime') return undefined;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const diffMin = (eh * 60 + em) - (sh * 60 + sm);
    return diffMin > 0 ? Math.round((diffMin / 60) * 10) / 10 : 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setFeedback({ success: false, message: 'Reason is required for submitting a request.' });
      return;
    }

    const otHours = calculateOvertimeHours();

    const res = submitRequest({
      requestType,
      startDate,
      endDate: requestType === 'Overtime' ? startDate : endDate,
      startTime: requestType === 'Overtime' ? startTime : undefined,
      endTime: requestType === 'Overtime' ? endTime : undefined,
      reason,
      attachment: attachment || undefined,
      targetAttendanceDate: requestType.includes('Revision') ? targetAttendanceDate : undefined,
      targetRevisedTime: requestType.includes('Revision') ? targetRevisedTime : undefined,
      overtimeHours: otHours,
    });

    setFeedback(res);
    if (res.success) {
      setTimeout(() => {
        setShowModal(false);
        setReason('');
        setAttachment('');
        setFeedback(null);
        if (onClearInitialRequestType) onClearInitialRequestType();
      }, 1500);
    }
  };

  // Render Visual Timeline (Rule 13)
  const renderTimeline = (req: RequestRecord) => {
    const isApproved = req.status === 'APPROVED';
    const isRejected = req.status === 'REJECTED';
    const isPending = req.status === 'PENDING APPROVAL';

    // Supervisor info
    const approverObj = manpower.find((m) => m.nik === req.currentApproverNik);
    const approverName = approverObj ? approverObj.employeeName : `NIK ${req.currentApproverNik}`;

    return (
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] mb-2 font-medium text-slate-500">
          <span>Approval Workflow Timeline</span>
          <span>Target Approver: <strong>{approverName}</strong></span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Step 1: Submitted */}
          <div className="flex items-center gap-1 text-emerald-700 font-semibold">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">
              ✓
            </div>
            <span>Submitted</span>
          </div>

          <div className="w-8 h-0.5 bg-emerald-300" />

          {/* Step 2: Supervisor Review */}
          <div
            className={`flex items-center gap-1 font-semibold ${
              isApproved
                ? 'text-emerald-700'
                : isRejected
                ? 'text-rose-700'
                : 'text-amber-700 animate-pulse'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                isApproved
                  ? 'bg-emerald-100'
                  : isRejected
                  ? 'bg-rose-100'
                  : 'bg-amber-100'
              }`}
            >
              {isApproved ? '✓' : isRejected ? '✕' : '●'}
            </div>
            <span>
              {isApproved
                ? 'Supervisor Approved'
                : isRejected
                ? 'Rejected'
                : 'Pending Review'}
            </span>
          </div>

          <div
            className={`w-8 h-0.5 ${
              isApproved
                ? 'bg-emerald-300'
                : isRejected
                ? 'bg-rose-200'
                : 'bg-slate-200'
            }`}
          />

          {/* Step 3: Final Status */}
          <div
            className={`flex items-center gap-1 ${
              isApproved
                ? 'text-emerald-700 font-bold'
                : isRejected
                ? 'text-rose-700 font-bold'
                : 'text-slate-400 font-medium'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                isApproved
                  ? 'bg-emerald-200'
                  : isRejected
                  ? 'bg-rose-200'
                  : 'bg-slate-100'
              }`}
            >
              {isApproved ? '✓' : isRejected ? '✕' : '○'}
            </div>
            <span>{isApproved ? 'Active in System' : isRejected ? 'Declined' : 'Final Status'}</span>
          </div>
        </div>

        {isRejected && req.rejectionReason && (
          <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            <strong>Rejection Reason:</strong> {req.rejectionReason}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Permohonan & Izin (Requests)</h2>
          <p className="text-xs text-slate-500">
            Ajukan permohonan lembur, koreksi absensi, cuti, atau izin sakit
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setFeedback(null);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Request</span>
        </button>
      </div>

      {/* Requests List */}
      {userRequests.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Belum Ada Pengajuan</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Anda belum membuat permohonan lembur atau izin. Klik tombol "Buat Request" untuk mengajukan.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {userRequests.map((req) => (
            <div
              key={req.requestId}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{req.requestType}</span>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      {req.requestId}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                    <p>
                      <strong>Tanggal:</strong> {req.startDate}{' '}
                      {req.endDate && req.endDate !== req.startDate ? `s/d ${req.endDate}` : ''}
                      {req.startTime && req.endTime ? ` (${req.startTime} - ${req.endTime})` : ''}
                    </p>
                    {req.overtimeHours && (
                      <p className="text-indigo-600 font-semibold">
                        Durasi Lembur: {req.overtimeHours} Jam
                      </p>
                    )}
                    {req.targetRevisedTime && (
                      <p className="text-emerald-700 font-semibold">
                        Koreksi Waktu: {req.targetRevisedTime}
                      </p>
                    )}
                    <p className="text-slate-700 mt-1 italic">"{req.reason}"</p>
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
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

              {/* Multi-Level Status Timeline */}
              {renderTimeline(req)}
            </div>
          ))}
        </div>
      )}

      {/* New Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Buat Permohonan Baru</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipe Permohonan
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as RequestType)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="Overtime">Overtime (Lembur Toko)</option>
                  <option value="Clock In Revision">Clock In Revision (Revisi Jam Masuk)</option>
                  <option value="Clock Out Revision">Clock Out Revision (Revisi Jam Pulang)</option>
                  <option value="Sick Leave">Sick Leave (Izin Sakit)</option>
                  <option value="Annual Leave">Annual Leave (Cuti Tahunan)</option>
                </select>
              </div>

              {/* Overtime Specific Fields */}
              {requestType === 'Overtime' && (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Mulai Lembur
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Selesai Lembur
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        required
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-indigo-700 font-semibold">
                    Estimasi Total Jam Lembur: {calculateOvertimeHours() || 0} Jam
                  </div>
                </div>
              )}

              {/* Revision Specific Fields */}
              {requestType.includes('Revision') && (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tanggal Absensi
                      </label>
                      <input
                        type="date"
                        value={targetAttendanceDate}
                        onChange={(e) => setTargetAttendanceDate(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Waktu Sebenarnya
                      </label>
                      <input
                        type="time"
                        value={targetRevisedTime}
                        onChange={(e) => setTargetRevisedTime(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Nilai absensi pada Google Sheet akan diperbarui otomatis setelah disetujui atasan, dan nilai lama disimpan di AUDIT_LOG.
                  </p>
                </div>
              )}

              {/* Dates for Leave */}
              {(requestType === 'Sick Leave' || requestType === 'Annual Leave') && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Dari Tanggal
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Sampai Tanggal
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alasan / Keterangan
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan alasan pengajuan secara rinci..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Attachment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lampiran / Bukti Surat (Opsional)
                </label>
                <input
                  type="text"
                  value={attachment}
                  onChange={(e) => setAttachment(e.target.value)}
                  placeholder="Misal: surat-dokter-20260920.pdf / foto kwitansi"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Approver preview */}
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
                Atasan Penyetuju (Supervisor):{' '}
                <strong className="text-slate-900">
                  {manpower.find((m) => m.nik === currentUser.supervisorNik)?.employeeName ||
                    'Administrator'}
                </strong>
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {feedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
