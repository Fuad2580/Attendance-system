import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Shield,
  AlertCircle,
  FileCheck,
  Search,
  MessageSquare,
} from 'lucide-react';

export const ApprovalsView: React.FC = () => {
  const {
    currentUser,
    requests,
    approvals,
    approveRequest,
    rejectRequest,
    manpower,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [rejectModalReqId, setRejectModalReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  if (!currentUser || currentUser.roleLevel === 'R1') {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
        <Shield className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="font-bold text-slate-800 text-sm">Access Restricted</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Approvals are only accessible to Supervisors (R2), Managers (R3), and Administrators.
        </p>
      </div>
    );
  }

  // Filter requests that this approver is responsible for
  const pendingRequests = requests.filter((r) => {
    if (r.status !== 'PENDING APPROVAL') return false;

    // Administrator has full access
    if (currentUser.roleLevel === 'ADMIN') return true;

    // R3 Manager can see requests from their department or where they are designated approver
    if (currentUser.roleLevel === 'R3') {
      return r.currentApproverNik === currentUser.nik || true; // R3 can oversee team
    }

    // R2 Supervisor can only see their direct team
    if (currentUser.roleLevel === 'R2') {
      return r.currentApproverNik === currentUser.nik;
    }

    return false;
  });

  const handleApprove = (reqId: string) => {
    const res = approveRequest(reqId, approvalComment || 'Approved by Supervisor');
    setFeedback(res);
    setApprovalComment('');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReqId) return;
    if (!rejectionReason.trim()) {
      setFeedback({ success: false, message: 'Alasan penolakan (rejection reason) wajib diisi!' });
      return;
    }

    const res = rejectRequest(rejectModalReqId, rejectionReason);
    setFeedback(res);
    setRejectModalReqId(null);
    setRejectionReason('');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Approval Center</h2>
          <p className="text-xs text-slate-500">
            Pusat persetujuan permohonan tim bawahan berdasarkan hirarki ({currentUser.roleLevel})
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'pending'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Riwayat Approval ({approvals.length})
          </button>
        </div>
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

      {/* Pending Tab Content */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
              <FileCheck className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-slate-900 text-sm">Semua Request Selesai</h3>
              <p className="text-xs text-slate-500">
                Tidak ada permohonan bawahan yang sedang menunggu persetujuan Anda saat ini.
              </p>
            </div>
          ) : (
            pendingRequests.map((req) => {
              const requester = manpower.find((m) => m.nik === req.nik);

              return (
                <div
                  key={req.requestId}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{req.employeeName}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                          NIK: {req.nik}
                        </span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                          {req.requestType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Posisi: {requester?.position || 'Staff'} • Dept: {requester?.department}
                      </p>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">{req.requestId}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-200/70">
                    <p>
                      <strong>Tanggal:</strong> {req.startDate}{' '}
                      {req.endDate !== req.startDate ? `s/d ${req.endDate}` : ''}
                      {req.startTime && req.endTime ? ` (${req.startTime} - ${req.endTime})` : ''}
                    </p>
                    {req.overtimeHours && (
                      <p className="text-indigo-700 font-semibold">
                        Durasi Lembur: {req.overtimeHours} Jam
                      </p>
                    )}
                    {req.targetRevisedTime && (
                      <p className="text-emerald-700 font-semibold">
                        Koreksi Waktu Absen: {req.targetRevisedTime}
                      </p>
                    )}
                    <p className="text-slate-700 pt-1">
                      <strong>Alasan:</strong> "{req.reason}"
                    </p>
                    {req.attachment && (
                      <p className="text-slate-500 text-[11px]">
                        <strong>Lampiran:</strong> {req.attachment}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => {
                        setRejectModalReqId(req.requestId);
                        setRejectionReason('');
                      }}
                      className="px-3.5 py-2 border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Tolak (Reject)</span>
                    </button>

                    <button
                      onClick={() => handleApprove(req.requestId)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Setujui (Approve)</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-700">
            Log Riwayat Keputusan Approval
          </div>

          <div className="divide-y divide-slate-100">
            {approvals.map((app) => (
              <div key={app.approvalId} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        app.action === 'APPROVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {app.action}
                    </span>
                    <span className="font-mono text-slate-500">{app.requestId}</span>
                  </div>
                  <p className="text-slate-600 mt-1">
                    Diputuskan oleh: <strong>{app.approverName}</strong> ({app.role})
                  </p>
                  <p className="text-slate-500 italic mt-0.5">"{app.comment}"</p>
                </div>
                <div className="text-[11px] text-slate-400 text-right">
                  {new Date(app.actionDate).toLocaleDateString('id-ID')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Modal with Mandatory Reason (Rule 12) */}
      {rejectModalReqId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Alasan Penolakan Request</h3>
              <button
                onClick={() => setRejectModalReqId(null)}
                className="text-slate-400 hover:text-slate-700 font-semibold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                Berdasarkan SOP (Aturan #12), penolakan pengajuan <strong>wajib</strong> menyertakan alasan penolakan yang jelas.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alasan Penolakan (Wajib)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Jam lembur tidak sesuai dengan jadwal stock opname..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalReqId(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs"
                >
                  Konfirmasi Penolakan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
