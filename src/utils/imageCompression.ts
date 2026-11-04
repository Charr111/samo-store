export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  targetMaxBytes?: number;
}

export interface CompressedImageResult {
  base64Data: string;
  contentType: string;
  fileName: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

/**
 * Pure c_limit dimension calculator:
 * Scales down proportionally only if width > maxWidth or height > maxHeight.
 * Never upscales images that are already smaller than maxWidth x maxHeight.
 */
export function calculateCLimitDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth = 600,
  maxHeight = 750
): { width: number; height: number } {
  const safeSrcW = Math.max(1, Math.round(srcWidth));
  const safeSrcH = Math.max(1, Math.round(srcHeight));
  const safeMaxW = Math.max(1, Math.round(maxWidth));
  const safeMaxH = Math.max(1, Math.round(maxHeight));

  if (safeSrcW <= safeMaxW && safeSrcH <= safeMaxH) {
    return { width: safeSrcW, height: safeSrcH };
  }

  const widthRatio = safeMaxW / safeSrcW;
  const heightRatio = safeMaxH / safeSrcH;
  const scale = Math.min(widthRatio, heightRatio, 1);

  return {
    width: Math.max(1, Math.round(safeSrcW * scale)),
    height: Math.max(1, Math.round(safeSrcH * scale)),
  };
}

/**
 * Generates a clean, URL-safe filename: <timestamp>-<sanitized-slug>.<ext>
 */
export function sanitizeUploadFileName(
  originalName: string,
  timestamp: number = Date.now(),
  contentType = 'image/webp'
): string {
  const withoutExt = (originalName || 'samo-item')
    .replace(/\.[^/.]+$/, '')
    .trim()
    .toLowerCase();

  const slug =
    withoutExt
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'samo-item';

  const ext = contentType === 'image/jpeg' ? 'jpg' : 'webp';
  return `${timestamp}-${slug}.${ext}`;
}

function blobToBase64Data(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read compressed image data.'));
        return;
      }
      const commaIdx = reader.result.indexOf(',');
      resolve(commaIdx >= 0 ? reader.result.slice(commaIdx + 1) : reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to encode compressed image.'));
    reader.readAsDataURL(blob);
  });
}

function encodeCanvasSingleFormat(
  canvas: HTMLCanvasElement,
  mimeType: 'image/webp' | 'image/jpeg',
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size === 0) {
            resolve(null);
            return;
          }
          // CRITICAL iOS/WebKit check: when 'image/webp' is unsupported or ignored,
          // browsers silently return an uncompressed 'image/png' (~400 KB+).
          if (mimeType === 'image/webp' && blob.type !== 'image/webp') {
            resolve(null);
            return;
          }
          resolve(blob);
        },
        mimeType,
        quality
      );
    } catch {
      resolve(null);
    }
  });
}

async function encodeSmallestCanvasBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<{ blob: Blob; contentType: string }> {
  const [webpBlob, jpegBlob] = await Promise.all([
    encodeCanvasSingleFormat(canvas, 'image/webp', quality),
    encodeCanvasSingleFormat(canvas, 'image/jpeg', quality),
  ]);

  if (webpBlob && jpegBlob) {
    // Pick whichever format actually compressed smaller on this device's browser engine
    if (webpBlob.size <= jpegBlob.size) {
      return { blob: webpBlob, contentType: 'image/webp' };
    }
    return { blob: jpegBlob, contentType: 'image/jpeg' };
  }

  if (webpBlob) {
    return { blob: webpBlob, contentType: 'image/webp' };
  }
  if (jpegBlob) {
    return { blob: jpegBlob, contentType: 'image/jpeg' };
  }

  throw new Error('Browser canvas failed to compress image.');
}

function renderToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser 2D canvas context is unavailable.');
  }

  // Fill white studio background for transparent PNGs before lossy compression
  ctx.fillStyle = '#EFEFEF';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/**
 * Compresses an image File in the browser (c_limit 600x750 4:5 studio ratio, adaptive quality).
 * Guarantees 1.2 MB - 5 MB mobile camera photos shrink down to ~30 KB - 60 KB across
 * both iOS Safari/WebKit and Android/Desktop Chrome.
 */
export async function compressImageToWebP(
  file: File,
  options?: ImageCompressionOptions
): Promise<CompressedImageResult> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file (JPG, PNG, WebP, HEIC).');
  }

  const maxWidth = options?.maxWidth ?? 600;
  const maxHeight = options?.maxHeight ?? 750;
  const initialQuality = options?.quality ?? 0.72;
  const targetMaxBytes = options?.targetMaxBytes ?? 60 * 1024; // 60 KB target budget

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageEl = new Image();
      imageEl.onload = () => resolve(imageEl);
      imageEl.onerror = () =>
        reject(new Error('Failed to decode image file in browser.'));
      imageEl.src = objectUrl;
    });

    let { width, height } = calculateCLimitDimensions(
      img.naturalWidth || img.width || maxWidth,
      img.naturalHeight || img.height || maxHeight,
      maxWidth,
      maxHeight
    );

    let canvas = renderToCanvas(img, width, height);
    let bestResult = await encodeSmallestCanvasBlob(canvas, initialQuality);

    // Step down quality iteratively if the encoded image exceeds ~60 KB (e.g. on high-detail photos or iOS WebKit)
    const qualitySteps = [0.62, 0.52, 0.44, 0.36];
    for (const q of qualitySteps) {
      if (bestResult.blob.size <= targetMaxBytes) break;
      const candidate = await encodeSmallestCanvasBlob(canvas, q);
      if (candidate.blob.size < bestResult.blob.size) {
        bestResult = candidate;
      }
    }

    // If still above targetMaxBytes (e.g., mobile browser ignores lower quality steps), scale down dimensions slightly
    if (bestResult.blob.size > targetMaxBytes) {
      width = Math.max(320, Math.round(width * 0.82));
      height = Math.max(400, Math.round(height * 0.82));
      canvas = renderToCanvas(img, width, height);
      const scaledCandidate = await encodeSmallestCanvasBlob(canvas, 0.52);
      if (scaledCandidate.blob.size < bestResult.blob.size) {
        bestResult = scaledCandidate;
      }
    }

    const base64Data = await blobToBase64Data(bestResult.blob);
    const fileName = sanitizeUploadFileName(
      file.name,
      Date.now(),
      bestResult.contentType
    );

    return {
      base64Data,
      contentType: bestResult.contentType,
      fileName,
      width,
      height,
      originalSizeBytes: file.size,
      compressedSizeBytes: bestResult.blob.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compresses an image file in the browser and uploads it to Cloudflare R2 via /api/r2-upload.
 */
export async function uploadCompressedImageToR2(
  file: File,
  options?: ImageCompressionOptions
): Promise<{
  url: string;
  sizeBytes: number;
  originalSizeKB: number;
  compressedSizeKB: number;
  width: number;
  height: number;
}> {
  const compressed = await compressImageToWebP(file, options);

  const response = await fetch('/api/r2-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: compressed.fileName,
      contentType: compressed.contentType,
      base64Data: compressed.base64Data,
    }),
  });

  let payload: { url?: string; sizeBytes?: number; error?: string } = {};
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Upload failed with HTTP ${response.status}.`);
  }

  if (!response.ok || !payload.url) {
    throw new Error(
      payload.error || `Upload failed with status ${response.status}.`
    );
  }

  const finalBytes = payload.sizeBytes || compressed.compressedSizeBytes;
  const compressedSizeKB = Math.max(1, Math.round(finalBytes / 1024));
  const originalSizeKB = Math.max(1, Math.round(compressed.originalSizeBytes / 1024));

  return {
    url: payload.url,
    sizeBytes: finalBytes,
    originalSizeKB,
    compressedSizeKB,
    width: compressed.width,
    height: compressed.height,
  };
}

/**
 * Uploads a video file (.mp4 / .webm / .mov) to Cloudflare R2 via /api/r2-upload for the Hero Video Banner.
 */
export async function uploadVideoFileToR2(file: File): Promise<{
  url: string;
  sizeKB: number;
}> {
  if (!file || !file.type.startsWith('video/')) {
    throw new Error('Please select a valid video file (.mp4, .webm, .mov).');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Video file exceeds 25 MB limit. Please upload a shorter clip.');
  }

  const base64Data = await blobToBase64Data(file);
  const ext = file.type.includes('webm')
    ? 'webm'
    : file.type.includes('quicktime')
    ? 'mov'
    : 'mp4';
  const safeBase = (file.name || 'samo-hero-video')
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'samo-hero-video';
  const fileName = `${Date.now()}-${safeBase}.${ext}`;

  const response = await fetch('/api/r2-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      contentType: file.type || 'video/mp4',
      base64Data,
    }),
  });

  let payload: { url?: string; sizeBytes?: number; error?: string } = {};
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Video upload failed with HTTP ${response.status}.`);
  }

  if (!response.ok || !payload.url) {
    throw new Error(payload.error || `Video upload failed (${response.status}).`);
  }

  return {
    url: payload.url,
    sizeKB: Math.max(1, Math.round((payload.sizeBytes || file.size) / 1024)),
  };
}

