import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  X,
  MapPin,
  Scan,
  RefreshCw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  captureFaceDescriptor,
  verifyFaceAgainstTemplate,
  loadFaceEngine,
  DEFAULT_MAX_DISTANCE,
} from '../utils/faceBiometrics';
import { nikEquals } from '../utils/dateUtils';

interface ClockModalProps {
  type: 'IN' | 'OUT';
  onClose: () => void;
  onOpenFaceRegistration: () => void;
}

export const ClockModal: React.FC<ClockModalProps> = ({
  type,
  onClose,
  onOpenFaceRegistration,
}) => {
  const {
    currentUser,
    config,
    geoStatus,
    clockIn,
    clockOut,
    faceRegisters,
    userCoords,
    activeZone,
  } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [engineStatus, setEngineStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [engineError, setEngineError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    score?: number;
    message: string;
  } | null>(null);

  const needsFaceRegistration =
    config.requireFaceRecognition && currentUser && !currentUser.faceRegistered;

  // Initialize camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn('Camera access error or iframe restriction:', err);
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Camera permission was denied. Please allow camera access in your browser settings.'
            : 'Camera could not be started in this environment. Fallback simulated scanning is ready.'
        );
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Preload face recognition models (once per session, cached by the browser)
  useEffect(() => {
    if (!config.requireFaceRecognition) {
      setEngineStatus('ready');
      return;
    }
    let cancelled = false;
    loadFaceEngine()
      .then(() => {
        if (!cancelled) setEngineStatus('ready');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setEngineStatus('error');
        setEngineError(err?.message || 'Mesin pengenalan wajah gagal dimuat.');
      });
    return () => {
      cancelled = true;
    };
  }, [config.requireFaceRecognition]);

  const handleCaptureAndExecute = async () => {
    if (!currentUser) return;
    setIsVerifying(true);
    setVerificationResult(null);

    // Short scanning animation delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    let faceVerified = false;
    let biometricScore: number | undefined = undefined;

    if (config.requireFaceRecognition) {
      // Lookup registered face template in FACE_REGISTER sheet
      const registered = faceRegisters.find((f) => nikEquals(f.nik, currentUser.nik));

      if (!registered || !registered.faceTemplate) {
        setIsVerifying(false);
        setVerificationResult({
          success: false,
          message: 'Biometrik wajah Anda belum terdaftar. Silakan lakukan Registrasi Wajah terlebih dahulu.',
        });
        return;
      }

      if (!videoRef.current || !cameraStream) {
        setIsVerifying(false);
        setVerificationResult({
          success: false,
          message: 'Kamera aktif wajib untuk verifikasi wajah. Izinkan akses kamera lalu ulangi.',
        });
        return;
      }

      const maxDistance = config.faceMaxDistance || DEFAULT_MAX_DISTANCE;

      // Dua pemindaian terpisah (jeda 400ms). Keduanya WAJIB cocok.
      const capture1 = await captureFaceDescriptor(videoRef.current);
      if (!capture1.ok || !capture1.descriptor) {
        setIsVerifying(false);
        setVerificationResult({ success: false, message: capture1.reason || 'Wajah tidak terdeteksi.' });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 400));

      const capture2 = await captureFaceDescriptor(videoRef.current);
      if (!capture2.ok || !capture2.descriptor) {
        setIsVerifying(false);
        setVerificationResult({ success: false, message: capture2.reason || 'Wajah tidak terdeteksi.' });
        return;
      }

      const check1 = verifyFaceAgainstTemplate(capture1.descriptor, registered.faceTemplate, maxDistance);
      const check2 = verifyFaceAgainstTemplate(capture2.descriptor, registered.faceTemplate, maxDistance);

      biometricScore = Math.round(((check1.score + check2.score) / 2) * 100) / 100;

      if (check1.needsReregistration || check2.needsReregistration) {
        setIsVerifying(false);
        setVerificationResult({ success: false, message: check1.message });
        return;
      }

      if (!check1.matched || !check2.matched) {
        const worst = check1.distance >= check2.distance ? check1 : check2;
        setIsVerifying(false);
        setVerificationResult({
          success: false,
          score: biometricScore,
          message: worst.message,
        });
        return;
      }

      faceVerified = true;
    } else {
      faceVerified = true;
    }

    // Execute Attendance Action
    const res = type === 'IN' ? await clockIn({ faceVerified }) : await clockOut({ faceVerified });

    setIsVerifying(false);
    setVerificationResult({
      success: res.success,
      score: biometricScore,
      message: res.message,
    });

    if (res.success) {
      setTimeout(() => {
        onClose();
      }, 1800);
    }
  };

  const isFlexible = currentUser?.flexibleAttendance;
  const isGpsOk = isFlexible || geoStatus.isWithinRadius;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold ${
                type === 'IN' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {type === 'IN' ? 'IN' : 'OUT'}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {type === 'IN' ? 'Clock In Attendance' : 'Clock Out Attendance'}
              </h3>
              <p className="text-xs text-slate-500">
                {currentUser?.employeeName} • NIK: {currentUser?.nik} • {activeZone.code}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {/* Unregistered Face Notice */}
          {needsFaceRegistration && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>First-Time Biometric Registration Required</span>
              </div>
              <p className="text-amber-700">
                You have not registered your face biometric template. Rule 17 requires completing face registration before first clock in.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenFaceRegistration();
                }}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>Start Face Registration</span>
              </button>
            </div>
          )}

          {/* Camera Viewport & Scan Frame */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-4/3 flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Scanning Overlay Grid */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Oval Facial Target */}
              <div
                className={`w-44 h-56 border-2 border-dashed rounded-full flex items-center justify-center transition-all ${
                  isVerifying
                    ? 'border-emerald-400 bg-emerald-500/10 scale-105'
                    : 'border-white/50 bg-transparent'
                }`}
              >
                <div className="text-[11px] text-white/80 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-xs font-mono">
                  {isVerifying ? 'Analyzing Face Vectors...' : 'Fit Face in Oval'}
                </div>
              </div>

              {/* Scanning sweep beam */}
              {isVerifying && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-[0_0_12px_#34d399]" />
              )}
            </div>

            {/* Camera Error / Fallback info badge */}
            {cameraError && (
              <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 text-slate-300 text-[11px] p-2 rounded-lg backdrop-blur-xs border border-slate-700 flex items-center justify-between">
                <span>Active Camera Fallback Mode</span>
                <span className="text-emerald-400 font-semibold">Simulated Scanner Ready</span>
              </div>
            )}
          </div>

          {/* Geolocation Verification Banner */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              isGpsOk
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <MapPin
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                isGpsOk ? 'text-emerald-600' : 'text-rose-600'
              }`}
            />
            <div className="space-y-0.5 flex-1">
              <div className="font-semibold flex items-center justify-between">
                <span>
                  {isFlexible && !geoStatus.isWithinRadius
                    ? 'REMOTE / FLEXIBLE GPS RECORD'
                    : geoStatus.isWithinRadius
                    ? 'LOCATION VERIFIED'
                    : 'OUTSIDE ATTENDANCE RANGE'}
                </span>
                <span className="font-mono text-[11px] font-normal">
                  {geoStatus.distance}m away
                </span>
              </div>
              <p className="text-[11px] opacity-90">
                Nearest Store: <strong>{geoStatus.location?.locationName || 'Unknown'}</strong> (Max Radius: {geoStatus.allowedRadius}m)
              </p>
              {!isGpsOk && !isFlexible && (
                <div className="pt-2 space-y-1.5 border-t border-rose-200 mt-2">
                  <p className="text-[11px] text-rose-800 font-medium leading-relaxed">
                    Jarak terdeteksi{' '}
                    <strong>
                      {geoStatus.distance >= 1000
                        ? `${(geoStatus.distance / 1000).toFixed(1)} km`
                        : `${geoStatus.distance} m`}
                    </strong>{' '}
                    dari <strong>{geoStatus.location?.locationName || 'kantor terdekat'}</strong>.
                  </p>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Lokasi absensi ditentukan otomatis dari titik GPS Anda dan tidak dapat diubah
                    manual. Mendekatlah ke area kantor, atau ajukan Izin/Revisi lewat menu Requests.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Face engine status */}
          {config.requireFaceRecognition && engineStatus === 'error' && (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                {engineError} Absensi wajah tidak bisa dijalankan tanpa mesin pengenalan wajah. Periksa koneksi
                internet lalu buka ulang halaman ini.
              </span>
            </div>
          )}

          {/* Verification Feedback Result */}
          {verificationResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                verificationResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {verificationResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{verificationResult.message}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-2.5 px-3 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              isVerifying ||
              (needsFaceRegistration ?? false) ||
              (config.requireFaceRecognition && engineStatus !== 'ready')
            }
            onClick={handleCaptureAndExecute}
            className={`w-2/3 py-2.5 px-4 font-bold rounded-xl text-xs text-white shadow-md transition-all flex items-center justify-center gap-2 ${
              type === 'IN'
                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
                : 'bg-rose-600 hover:bg-rose-700 active:scale-98'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memverifikasi wajah...</span>
              </>
            ) : config.requireFaceRecognition && engineStatus === 'loading' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memuat mesin pengenalan wajah...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Record {type}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
