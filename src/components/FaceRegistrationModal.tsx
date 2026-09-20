import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  Scan,
  RefreshCw,
  Sparkles,
  Lock,
} from 'lucide-react';
import { extractFaceEmbeddingFromVideo } from '../utils/faceBiometrics';

interface FaceRegistrationModalProps {
  onClose: () => void;
}

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({ onClose }) => {
  const { currentUser, config, registerFaceTemplate } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [hasConsented, setHasConsented] = useState(!config.faceConsentRequired);
  const [step, setStep] = useState<'consent' | 'capture' | 'completed'>('consent');
  const [capturedFramesCount, setCapturedFramesCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    if (step === 'capture') {
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
          console.warn('Camera capture error:', err);
          setCameraError(
            'Camera not accessible in this environment. Simulated high-precision biometric vector generator is ready.'
          );
        }
      }
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [step]);

  const handleCaptureTemplate = async () => {
    if (!currentUser) return;
    setIsProcessing(true);
    setErrorMessage(null);

    const vectors: number[][] = [];

    // Multi-frame accumulation animation and feature extraction
    for (let i = 1; i <= 4; i++) {
      setCapturedFramesCount(i);
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (videoRef.current && cameraStream) {
        vectors.push(extractFaceEmbeddingFromVideo(videoRef.current));
      }
    }

    if (vectors.length === 0) {
      setIsProcessing(false);
      setErrorMessage('Kamera tidak terdeteksi atau tidak aktif. Harap izinkan akses kamera untuk merekam wajah Anda.');
      return;
    }

    // Average collected vectors to produce a clean, stable biometric template
    const vectorLength = vectors[0].length;
    const avgVector: number[] = new Array(vectorLength).fill(0);
    for (const vec of vectors) {
      for (let i = 0; i < vectorLength; i++) {
        avgVector[i] += vec[i];
      }
    }
    const norm = Math.sqrt(avgVector.reduce((acc, v) => acc + v * v, 0)) || 1;
    const finalVector = avgVector.map((v) => v / norm);

    const vectorJson = JSON.stringify(finalVector);
    const res = await registerFaceTemplate(currentUser.nik, vectorJson);

    setIsProcessing(false);
    if (res.success) {
      setStep('completed');
    } else {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Face Biometric Registration</h3>
              <p className="text-xs text-slate-500">
                {currentUser?.employeeName} • NIK: {currentUser?.nik}
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

        {/* Body based on step */}
        <div className="p-5 space-y-4">
          {step === 'consent' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Biometric Privacy & Consent Policy</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  "By registering your face, you consent to the use of biometric verification for attendance purposes."
                </p>
                <div className="text-[11px] text-slate-500 space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/70">
                  <p className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    Sensitive Data Protection (Rule 17 & 18):
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-500 pl-1">
                    <li>Raw photos are never saved to the server or Google Sheets.</li>
                    <li>Only mathematical feature vectors (embeddings) are recorded.</li>
                    <li>Biometrics are strictly used for Clock In anti-spoofing verification.</li>
                  </ul>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={hasConsented}
                  onChange={(e) => setHasConsented(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-700 font-medium leading-normal">
                  I have read, understood, and consent to biometric facial registration for attendance recording.
                </span>
              </label>

              <button
                type="button"
                disabled={!hasConsented}
                onClick={() => setStep('capture')}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Continue to Facial Capture</span>
              </button>
            </div>
          )}

          {step === 'capture' && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-4/3 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />

                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div
                    className={`w-44 h-56 border-2 rounded-full flex items-center justify-center transition-all ${
                      isProcessing
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/60 bg-transparent'
                    }`}
                  >
                    <div className="text-[11px] text-white/90 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs font-mono">
                      {isProcessing
                        ? `Sampling Frame ${capturedFramesCount}/4...`
                        : 'Align Face in Frame'}
                    </div>
                  </div>
                </div>

                {cameraError && (
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 text-slate-200 text-[11px] p-2 rounded-lg backdrop-blur-xs border border-slate-700 text-center">
                    Synthetic vector generator active
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCaptureTemplate}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Extracting Facial Landmarks...</span>
                  </>
                ) : (
                  <>
                    <Scan className="w-4 h-4" />
                    <span>Capture Face Embedding Vector</span>
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'completed' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Face Registered Successfully</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Your biometric feature vector has been secured in the FACE_REGISTER sheet. You are now authorized to Clock In.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
              >
                Proceed to Attendance
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
