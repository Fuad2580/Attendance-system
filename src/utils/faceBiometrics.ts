/**
 * Browser-based facial feature extractor and biometric comparison.
 * Extracts a normalized 72-dimensional geometric/contour gradient embedding vector from video frames.
 * Captures facial architecture (eyes, nose bridge, lips, jaw contours) while eliminating global lighting bias.
 */

export interface BiometricVerificationResult {
  matched: boolean;
  score: number; // 0 to 1
  message: string;
}

/**
 * Extracts a 72-dimensional normalized facial architecture feature vector
 * from the central face region of a video element.
 */
export function extractFaceEmbeddingFromVideo(videoElement: HTMLVideoElement): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return Array.from({ length: 72 }, () => 0);
  }

  // Draw video frame to square canvas
  ctx.drawImage(videoElement, 0, 0, 128, 128);
  const imgData = ctx.getImageData(0, 0, 128, 128).data;

  // Face central region crop (focus on face oval, excluding background)
  const fx0 = 20;  // ~15%
  const fx1 = 108; // ~85%
  const fy0 = 16;  // ~12%
  const fy1 = 112; // ~88%
  const fw = fx1 - fx0;
  const fh = fy1 - fy0;

  // 1. Calculate global mean luminance within the face area to eliminate room lighting bias
  let totalLum = 0;
  let totalCount = 0;
  for (let y = fy0; y < fy1; y++) {
    for (let x = fx0; x < fx1; x++) {
      const idx = (y * 128 + x) * 4;
      const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      totalLum += lum;
      totalCount++;
    }
  }
  const meanLum = totalCount > 0 ? totalLum / totalCount : 128;

  // 2. Sample across a 6x6 spatial grid (36 cells)
  // For each cell, extract:
  // - Normalized relative contrast (lum - meanLum)
  // - Directional gradient magnitude (Sobel dx + dy: captures eyes, nose, mouth lines, jawline)
  const vector: number[] = [];
  const rows = 6;
  const cols = 6;
  const cellW = Math.floor(fw / cols);
  const cellH = Math.floor(fh / rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let cellContrastSum = 0;
      let cellGradSum = 0;
      let count = 0;

      const cy0 = fy0 + r * cellH;
      const cx0 = fx0 + c * cellW;

      for (let y = cy0; y < cy0 + cellH; y++) {
        for (let x = cx0; x < cx0 + cellW; x++) {
          const idx = (y * 128 + x) * 4;
          const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
          cellContrastSum += (lum - meanLum);

          // Directional gradients (dx and dy)
          const rx = Math.min(127, x + 1);
          const lx = Math.max(0, x - 1);
          const dy_bottom = Math.min(127, y + 1);
          const dy_top = Math.max(0, y - 1);

          const rLum = 0.299 * imgData[(y * 128 + rx) * 4] + 0.587 * imgData[(y * 128 + rx) * 4 + 1] + 0.114 * imgData[(y * 128 + rx) * 4 + 2];
          const lLum = 0.299 * imgData[(y * 128 + lx) * 4] + 0.587 * imgData[(y * 128 + lx) * 4 + 1] + 0.114 * imgData[(y * 128 + lx) * 4 + 2];
          const bLum = 0.299 * imgData[(dy_bottom * 128 + x) * 4] + 0.587 * imgData[(dy_bottom * 128 + x) * 4 + 1] + 0.114 * imgData[(dy_bottom * 128 + x) * 4 + 2];
          const tLum = 0.299 * imgData[(dy_top * 128 + x) * 4] + 0.587 * imgData[(dy_top * 128 + x) * 4 + 1] + 0.114 * imgData[(dy_top * 128 + x) * 4 + 2];

          const dx = Math.abs(rLum - lLum);
          const dy = Math.abs(bLum - tLum);

          cellGradSum += (dx + dy);
          count++;
        }
      }

      vector.push(count > 0 ? cellContrastSum / (count * 128) : 0);
      vector.push(count > 0 ? cellGradSum / (count * 255) : 0);
    }
  }

  // 3. Normalize vector to unit L2 length so cosine distance is consistent
  const norm = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0)) || 1;
  return vector.map((v) => v / norm);
}

/**
 * Computes Cosine Similarity between two embedding vectors.
 * Returns value between 0 and 1.
 */
export function compareFaceEmbeddings(vectorA: number[], vectorB: number[]): number {
  if (!vectorA || !vectorB || vectorA.length === 0 || vectorB.length === 0) {
    return 0;
  }

  const length = Math.min(vectorA.length, vectorB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Evaluates whether live face vector matches registered template against threshold.
 */
export function verifyFaceAgainstTemplate(
  liveVector: number[],
  registeredTemplateJson: string,
  threshold: number = 0.65
): BiometricVerificationResult {
  try {
    const templateVector: number[] = JSON.parse(registeredTemplateJson);
    if (!Array.isArray(templateVector) || templateVector.length === 0) {
      return {
        matched: false,
        score: 0,
        message: 'Template biometrik wajah tidak valid atau belum terdaftar.',
      };
    }

    const score = compareFaceEmbeddings(liveVector, templateVector);
    const matched = score >= threshold;

    return {
      matched,
      score: Math.round(score * 100) / 100,
      message: matched
        ? `Verifikasi biometrik cocok (${Math.round(score * 100)}% kesesuaian)`
        : `Wajah tidak cocok! Tingkat kesesuaian hanya ${Math.round(score * 100)}% (Dibutuhkan minimal ${Math.round(threshold * 100)}%). Wajah berbeda terdeteksi.`,
    };
  } catch (err) {
    return {
      matched: false,
      score: 0,
      message: 'Format template wajah tidak valid.',
    };
  }
}
