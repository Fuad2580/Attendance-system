/**
 * REAL face recognition (bukan lagi "grid kecerahan piksel").
 *
 * Versi lama membuat vektor 108 dimensi dari rata-rata kecerahan & gradien pada grid 6x6.
 * Vektor seperti itu merekam PENCAHAYAAN + POSISI KEPALA, bukan identitas wajah, sehingga
 * dua orang berbeda yang duduk di tempat & cahaya yang sama selalu mendapat skor tinggi
 * (itulah sebabnya wajah teman bisa lolos).
 *
 * Versi ini memakai model face recognition sungguhan (face-api.js / TensorFlow.js):
 *  - TinyFaceDetector      -> memastikan memang ADA wajah di frame
 *  - FaceLandmark68        -> meluruskan (align) wajah sebelum diukur
 *  - FaceRecognitionNet    -> menghasilkan descriptor 128 dimensi khas per individu
 *
 * Pencocokan memakai Euclidean distance antar descriptor:
 *  - orang yang SAMA   : ~0.20 - 0.45
 *  - orang BERBEDA     : ~0.60 - 1.10
 * Ambang default 0.45 (bisa diubah di Pengaturan -> Face Match Max Distance).
 */

declare global {
  interface Window {
    faceapi?: any;
  }
}

/** Versi template biometrik. v1 = vektor luminansi lama (TIDAK AMAN, wajib daftar ulang). */
export const FACE_TEMPLATE_VERSION = 2;
export const DESCRIPTOR_LENGTH = 128;

/** Jarak maksimum agar dianggap orang yang sama. Semakin kecil semakin ketat. */
export const DEFAULT_MAX_DISTANCE = 0.45;

/** Minimal skor deteksi wajah & minimal lebar wajah relatif terhadap frame. */
const MIN_DETECTION_SCORE = 0.5;
const MIN_FACE_WIDTH_RATIO = 0.18;

const FACEAPI_VERSION = '1.7.15';
const FACEAPI_SCRIPT = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FACEAPI_VERSION}/dist/face-api.js`;
const MODEL_URL_CDN = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FACEAPI_VERSION}/model`;
const MODEL_URL_LOCAL = '/models'; // taruh file model di public/models untuk mode offline

export interface FaceCaptureResult {
  ok: boolean;
  descriptor?: number[];
  detectionScore?: number;
  faceWidthRatio?: number;
  reason?: string;
}

export interface BiometricVerificationResult {
  matched: boolean;
  /** Skor kemiripan 0..1 untuk ditampilkan di UI (diturunkan dari distance). */
  score: number;
  distance: number;
  /** true jika template masih versi lama sehingga wajib registrasi ulang. */
  needsReregistration?: boolean;
  message: string;
}

let enginePromise: Promise<void> | null = null;
let engineReady = false;

export function isFaceEngineReady(): boolean {
  return engineReady;
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.faceapi) return resolve();
    const existing = document.querySelector(`script[data-faceapi="1"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Gagal memuat mesin face recognition.')));
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.dataset.faceapi = '1';
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Gagal memuat mesin face recognition (periksa koneksi internet).'));
    document.head.appendChild(el);
  });
}

async function modelsAvailableAt(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/tiny_face_detector_model-weights_manifest.json`, { method: 'GET' });
    if (!res.ok) return false;
    const txt = await res.text();
    return txt.trim().startsWith('[') || txt.trim().startsWith('{');
  } catch (e) {
    return false;
  }
}

/**
 * Memuat mesin + bobot model. Aman dipanggil berkali-kali (hanya dieksekusi sekali).
 */
export function loadFaceEngine(): Promise<void> {
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    await loadScriptOnce(FACEAPI_SCRIPT);
    const faceapi = window.faceapi;
    if (!faceapi) throw new Error('Mesin face recognition tidak tersedia.');

    const useLocal = await modelsAvailableAt(MODEL_URL_LOCAL);
    const modelUrl = useLocal ? MODEL_URL_LOCAL : MODEL_URL_CDN;

    await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
    await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);
    await faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl);

    engineReady = true;
  })().catch((err) => {
    enginePromise = null;
    engineReady = false;
    throw err;
  });

  return enginePromise;
}

/**
 * Mendeteksi SATU wajah pada video dan mengembalikan descriptor 128 dimensi.
 * Mengembalikan ok:false bila tidak ada wajah, wajah terlalu kecil/jauh, atau ada lebih dari satu wajah.
 */
export async function captureFaceDescriptor(videoElement: HTMLVideoElement): Promise<FaceCaptureResult> {
  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
    return { ok: false, reason: 'Kamera belum siap. Tunggu sebentar lalu coba lagi.' };
  }

  try {
    await loadFaceEngine();
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'Mesin face recognition gagal dimuat.' };
  }

  const faceapi = window.faceapi;
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: MIN_DETECTION_SCORE });

  // Deteksi semua wajah dulu agar bisa menolak bila ada >1 orang di depan kamera
  const all = await faceapi.detectAllFaces(videoElement, options);
  if (!all || all.length === 0) {
    return { ok: false, reason: 'Wajah tidak terdeteksi. Pastikan wajah terlihat jelas, tidak backlight, dan tanpa masker.' };
  }
  if (all.length > 1) {
    return { ok: false, reason: `Terdeteksi ${all.length} wajah di kamera. Pastikan hanya Anda yang berada di depan kamera.` };
  }

  const detection = await faceapi
    .detectSingleFace(videoElement, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection || !detection.descriptor) {
    return { ok: false, reason: 'Wajah gagal dianalisis. Dekatkan wajah ke kamera dan ulangi.' };
  }

  const box = detection.detection?.box;
  const score = detection.detection?.score ?? 0;
  const widthRatio = box && videoElement.videoWidth ? box.width / videoElement.videoWidth : 0;

  if (widthRatio < MIN_FACE_WIDTH_RATIO) {
    return {
      ok: false,
      detectionScore: score,
      faceWidthRatio: widthRatio,
      reason: 'Wajah terlalu jauh dari kamera. Dekatkan wajah hingga memenuhi bingkai oval.',
    };
  }

  return {
    ok: true,
    descriptor: Array.from(detection.descriptor as Float32Array).map((v: number) => Number(v)),
    detectionScore: score,
    faceWidthRatio: widthRatio,
  };
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Jarak rata-rata antar sampel; dipakai untuk memastikan enrolmen berasal dari satu orang. */
export function maxPairwiseDistance(samples: number[][]): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      max = Math.max(max, euclideanDistance(samples[i], samples[j]));
    }
  }
  return max;
}

/** Membuat template (disimpan sebagai JSON di kolom Face Template sheet FACE_REGISTER). */
export function buildFaceTemplate(samples: number[][]): string {
  const clean = samples
    .filter((s) => Array.isArray(s) && s.length === DESCRIPTOR_LENGTH)
    .map((s) => s.map((v) => Math.round(v * 100000) / 100000));
  return JSON.stringify({ v: FACE_TEMPLATE_VERSION, n: clean.length, d: clean });
}

export interface ParsedTemplate {
  version: number;
  samples: number[][];
}

/** Membaca template; mendukung format lama (array datar) agar bisa dideteksi & diminta daftar ulang. */
export function parseFaceTemplate(templateJson: string): ParsedTemplate | null {
  if (!templateJson) return null;
  try {
    const parsed = JSON.parse(templateJson);

    if (Array.isArray(parsed)) {
      // Format lama v1: satu array datar (108 dimensi luminansi)
      return { version: 1, samples: [parsed as number[]] };
    }

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.d)) {
      const samples: number[][] = Array.isArray(parsed.d[0]) ? parsed.d : [parsed.d];
      return { version: Number(parsed.v) || 1, samples };
    }

    return null;
  } catch (e) {
    return null;
  }
}

function distanceToSimilarity(distance: number): number {
  // 0.0 -> 100%, 0.6 -> 0%. Hanya untuk tampilan.
  const sim = 1 - distance / 0.6;
  return Math.max(0, Math.min(1, sim));
}

/**
 * Membandingkan descriptor hasil capture dengan template terdaftar.
 */
export function verifyFaceAgainstTemplate(
  liveDescriptor: number[],
  registeredTemplateJson: string,
  maxDistance: number = DEFAULT_MAX_DISTANCE
): BiometricVerificationResult {
  const parsed = parseFaceTemplate(registeredTemplateJson);

  if (!parsed || parsed.samples.length === 0) {
    return {
      matched: false,
      score: 0,
      distance: Number.POSITIVE_INFINITY,
      message: 'Template biometrik wajah tidak valid atau belum terdaftar.',
    };
  }

  if (parsed.version < FACE_TEMPLATE_VERSION || parsed.samples[0].length !== DESCRIPTOR_LENGTH) {
    return {
      matched: false,
      score: 0,
      distance: Number.POSITIVE_INFINITY,
      needsReregistration: true,
      message:
        'Template wajah Anda masih versi lama yang tidak aman (bisa tertukar dengan orang lain). Buka menu Registrasi Wajah untuk merekam ulang dengan mesin pengenalan wajah baru.',
    };
  }

  if (!liveDescriptor || liveDescriptor.length !== DESCRIPTOR_LENGTH) {
    return {
      matched: false,
      score: 0,
      distance: Number.POSITIVE_INFINITY,
      message: 'Hasil pemindaian wajah tidak valid. Ulangi pemindaian.',
    };
  }

  let best = Number.POSITIVE_INFINITY;
  for (const sample of parsed.samples) {
    best = Math.min(best, euclideanDistance(liveDescriptor, sample));
  }

  const matched = best <= maxDistance;
  const similarity = distanceToSimilarity(best);

  return {
    matched,
    score: Math.round(similarity * 100) / 100,
    distance: Math.round(best * 1000) / 1000,
    message: matched
      ? `Verifikasi wajah cocok (jarak biometrik ${best.toFixed(3)}, ambang ${maxDistance.toFixed(2)}).`
      : `Wajah TIDAK cocok dengan data terdaftar. Jarak biometrik ${best.toFixed(3)} melebihi ambang ${maxDistance.toFixed(
          2
        )}. Clock In/Out dibatalkan.`,
  };
}
