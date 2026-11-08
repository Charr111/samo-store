export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  targetMaxBytes?: number;
  forceShrink?: boolean;
}

export interface CompressedImageResult {
  base64Data: string;
  contentType: string;
  fileName: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  wasShrunk?: boolean;
}

export const SHRINK_STORAGE_KEY = 'samo_shrink_uploads_enabled_v1';

/**
 * Returns whether automatic image shrinking (~50 KB WebP) is currently enabled.
 * Defaults to true unless toggled off by the admin.
 */
export function getShrinkUploadsEnabled(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    const raw = window.localStorage.getItem(SHRINK_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

/**
 * Persists the admin toggle for automatic image shrinking on/off.
 */
export function setShrinkUploadsEnabled(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SHRINK_STORAGE_KEY, enabled ? 'true' : 'false');
      window.dispatchEvent(
        new CustomEvent('samo-shrink-toggle-changed', { detail: { enabled } })
      );
    }
  } catch {}
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

  let ext = 'webp';
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
    ext = 'jpg';
  } else if (contentType === 'image/png') {
    ext = 'png';
  } else if (contentType === 'image/gif') {
    ext = 'gif';
  }
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
 * Converts iPhone HEIC/HEIF photos to a standard JPEG Blob if the browser cannot decode them natively.
 */
async function convertHeicToJpegIfNeeded(file: File, quality = 0.88): Promise<Blob> {
  const isHeic =
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif';

  if (!isHeic) {
    return file;
  }

  try {
    const heic2anyModule = await import('heic2any');
    const heic2any = heic2anyModule.default || heic2anyModule;
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality,
    });
    return Array.isArray(converted) ? converted[0] : converted;
  } catch (err) {
    console.warn('heic2any conversion fallback:', err);
    return file;
  }
}

/**
 * Prepares an image file for upload WITHOUT shrinking when the admin turns OFF Auto-Shrink.
 * Preserves original resolution and quality (converts raw .heic/.heif to full-resolution JPEG so all browsers can render it).
 */
export async function prepareOriginalQualityImage(
  file: File
): Promise<CompressedImageResult> {
  const isImageCandidate =
    Boolean(file) &&
    ((file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(file.name || ''));

  if (!isImageCandidate) {
    throw new Error('Please select a valid image file (JPG, PNG, WebP, HEIC).');
  }

  const isHeic =
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif';

  const targetBlob = isHeic ? await convertHeicToJpegIfNeeded(file, 0.95) : file;
  let contentType = targetBlob.type || file.type || 'image/jpeg';
  if (isHeic || contentType === 'image/heic' || contentType === 'image/heif') {
    contentType = 'image/jpeg';
  } else if (!contentType.startsWith('image/')) {
    if (file.name.toLowerCase().endsWith('.png')) contentType = 'image/png';
    else if (file.name.toLowerCase().endsWith('.webp')) contentType = 'image/webp';
    else contentType = 'image/jpeg';
  }

  let width = 1200;
  let height = 1500;
  const objectUrl = URL.createObjectURL(targetBlob);
  try {
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const imageEl = new Image();
      imageEl.onload = () =>
        resolve({
          w: imageEl.naturalWidth || imageEl.width || 1200,
          h: imageEl.naturalHeight || imageEl.height || 1500,
        });
      imageEl.onerror = () => resolve({ w: 1200, h: 1500 });
      imageEl.src = objectUrl;
    });
    width = dims.w;
    height = dims.h;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const base64Data = await blobToBase64Data(targetBlob);
  const fileName = sanitizeUploadFileName(file.name, Date.now(), contentType);

  return {
    base64Data,
    contentType,
    fileName,
    width,
    height,
    originalSizeBytes: file.size,
    compressedSizeBytes: targetBlob.size,
    wasShrunk: false,
  };
}

/**
 * Compresses an image File in the browser by ~60% to 70% of its original size
 * (retaining ~25% to 40% of the original file size — e.g., a 2 MB image becomes ~500 KB to 800 KB).
 * Preserves high studio resolution (up to 2400x3000) while adaptively selecting the JPEG/WebP
 * quality level that lands inside the 60%–70% reduction window.
 */
export async function compressImageToWebP(
  file: File,
  options?: ImageCompressionOptions
): Promise<CompressedImageResult> {
  const isImageCandidate =
    Boolean(file) &&
    ((file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(file.name || ''));

  if (!isImageCandidate) {
    throw new Error('Please select a valid image file (JPG, PNG, WebP, HEIC).');
  }

  const originalBytes = Math.max(1024, file.size);
  const maxWidth = options?.maxWidth ?? 2400;
  const maxHeight = options?.maxHeight ?? 3000;

  // Target 60% to 70% reduction => resulting file is ~25% to 40% of original size
  // (For a 2 MB / 2,048 KB file: min ~512 KB, ideal ~675 KB, max ~819 KB)
  const minTargetBytes = Math.max(30 * 1024, Math.round(originalBytes * 0.25));
  const maxTargetBytes =
    options?.targetMaxBytes ??
    Math.max(60 * 1024, Math.round(originalBytes * 0.40));
  const idealTargetBytes = Math.round((minTargetBytes + maxTargetBytes) / 2);

  const decodedBlob = await convertHeicToJpegIfNeeded(file, 0.94);
  const objectUrl = URL.createObjectURL(decodedBlob);

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

    const candidateQualities = options?.quality
      ? [options.quality, 0.92, 0.85, 0.78, 0.70, 0.60]
      : [0.95, 0.92, 0.88, 0.84, 0.80, 0.75, 0.70, 0.64, 0.56, 0.48];

    let bestInWindow: { blob: Blob; contentType: string; diff: number } | null =
      null;
    let bestUnderMax: { blob: Blob; contentType: string; diff: number } | null =
      null;
    let smallestOverall: { blob: Blob; contentType: string } | null = null;

    for (const q of candidateQualities) {
      const [jpegBlob, webpBlob] = await Promise.all([
        encodeCanvasSingleFormat(canvas, 'image/jpeg', q),
        encodeCanvasSingleFormat(canvas, 'image/webp', q),
      ]);

      const candidates: Array<{ blob: Blob; contentType: string }> = [];
      if (jpegBlob) candidates.push({ blob: jpegBlob, contentType: 'image/jpeg' });
      if (webpBlob) candidates.push({ blob: webpBlob, contentType: 'image/webp' });

      for (const cand of candidates) {
        const sz = cand.blob.size;
        const diff = Math.abs(sz - idealTargetBytes);

        if (!smallestOverall || sz < smallestOverall.blob.size) {
          smallestOverall = cand;
        }

        if (sz >= minTargetBytes && sz <= maxTargetBytes) {
          if (!bestInWindow || diff < bestInWindow.diff) {
            bestInWindow = { ...cand, diff };
          }
        }

        if (sz <= maxTargetBytes) {
          if (!bestUnderMax || diff < bestUnderMax.diff) {
            bestUnderMax = { ...cand, diff };
          }
        }
      }

      if (bestInWindow && bestInWindow.diff <= idealTargetBytes * 0.12) {
        break;
      }
    }

    let chosen =
      bestInWindow ||
      bestUnderMax ||
      (smallestOverall
        ? { ...smallestOverall, diff: Math.abs(smallestOverall.blob.size - idealTargetBytes) }
        : null);

    // If still above maxTargetBytes (e.g., ultra-dense image), scale down dimensions slightly so it shrinks by at least 60%
    if (!chosen || chosen.blob.size > maxTargetBytes) {
      width = Math.max(480, Math.round(width * 0.78));
      height = Math.max(600, Math.round(height * 0.78));
      canvas = renderToCanvas(img, width, height);
      const scaled = await encodeSmallestCanvasBlob(canvas, 0.76);
      if (!chosen || scaled.blob.size < chosen.blob.size) {
        chosen = {
          ...scaled,
          diff: Math.abs(scaled.blob.size - idealTargetBytes),
        };
      }
    }

    const base64Data = await blobToBase64Data(chosen.blob);
    const fileName = sanitizeUploadFileName(
      file.name,
      Date.now(),
      chosen.contentType
    );

    return {
      base64Data,
      contentType: chosen.contentType,
      fileName,
      width,
      height,
      originalSizeBytes: file.size,
      compressedSizeBytes: chosen.blob.size,
      wasShrunk: true,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Uploads an image file to Cloudflare R2 via /api/r2-upload.
 * Respects the global Auto-Shrink toggle (shrinks by ~60%–70% when ON, or uploads original quality when OFF).
 */
export async function uploadCompressedImageToR2(
  file: File,
  options?: ImageCompressionOptions
): Promise<{
  url: string;
  sizeBytes: number;
  originalSizeKB: number;
  compressedSizeKB: number;
  reductionPercent: number;
  width: number;
  height: number;
  wasShrunk: boolean;
}> {
  const shouldShrink =
    options?.forceShrink !== undefined
      ? options.forceShrink
      : getShrinkUploadsEnabled();

  const prepared = shouldShrink
    ? await compressImageToWebP(file, options)
    : await prepareOriginalQualityImage(file);

  const response = await fetch('/api/r2-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: prepared.fileName,
      contentType: prepared.contentType,
      base64Data: prepared.base64Data,
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

  const finalBytes = payload.sizeBytes || prepared.compressedSizeBytes;
  const compressedSizeKB = Math.max(1, Math.round(finalBytes / 1024));
  const originalSizeKB = Math.max(1, Math.round(prepared.originalSizeBytes / 1024));
  const reductionPercent =
    prepared.originalSizeBytes > 0
      ? Math.max(
          0,
          Math.round((1 - finalBytes / prepared.originalSizeBytes) * 100)
        )
      : 0;

  return {
    url: payload.url,
    sizeBytes: finalBytes,
    originalSizeKB,
    compressedSizeKB,
    reductionPercent,
    width: prepared.width,
    height: prepared.height,
    wasShrunk: shouldShrink,
  };
}

/**
 * Extracts the R2 object key (e.g., "products/173000-jacket.webp" or "banners/...") from a public R2 URL.
 */
export function extractR2ObjectKey(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('studio://') || trimmed.startsWith('/assets/')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const pathKey = parsed.pathname.replace(/^\/+/, '');
    if (pathKey.startsWith('products/') || pathKey.startsWith('banners/')) {
      return pathKey;
    }
  } catch {
    if (trimmed.startsWith('products/') || trimmed.startsWith('banners/')) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Deletes one or more uploaded images/videos from the Cloudflare R2 bucket via /api/r2-delete.
 */
export async function deleteMediaFromR2(
  urls: string | string[]
): Promise<{ deletedKeys: string[] }> {
  const list = Array.isArray(urls) ? urls : [urls];
  const keys = Array.from(
    new Set(
      list
        .map((u) => extractR2ObjectKey(u))
        .filter((k): k is string => Boolean(k))
    )
  );
  if (keys.length === 0) {
    return { deletedKeys: [] };
  }
  try {
    const res = await fetch('/api/r2-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        deletedKeys: Array.isArray(data?.deletedKeys) ? data.deletedKeys : keys,
      };
    }
  } catch (err) {
    console.warn('[SAMO Atelier] R2 media delete notice:', err);
  }
  return { deletedKeys: keys };
}

/**
 * Uploads a video file (.mp4 / .webm / .mov / .hevc / .m4v) to Cloudflare R2 via /api/r2-upload.
 * Supports iPhone HEVC, QuickTime .mov, and standard MP4/WebM videos up to 35 MB.
 */
export async function uploadVideoFileToR2(file: File): Promise<{
  url: string;
  sizeKB: number;
}> {
  const isVideoCandidate =
    Boolean(file) &&
    ((file.type && file.type.startsWith('video/')) ||
      /\.(mp4|webm|mov|hevc|m4v|qt|mkv)$/i.test(file.name || ''));

  if (!file || !isVideoCandidate) {
    throw new Error('Please select a valid video file (.mp4, .mov, .hevc, .webm).');
  }
  if (file.size > 35 * 1024 * 1024) {
    throw new Error('Video file exceeds 35 MB limit. Please upload a shorter clip.');
  }

  const base64Data = await blobToBase64Data(file);

  const isHevc =
    file.name.toLowerCase().endsWith('.hevc') ||
    (typeof file.type === 'string' && file.type.includes('hevc'));
  const isWebm =
    file.name.toLowerCase().endsWith('.webm') ||
    (typeof file.type === 'string' && file.type.includes('webm'));
  const isMov =
    file.name.toLowerCase().endsWith('.mov') ||
    (typeof file.type === 'string' && file.type.includes('quicktime'));

  const ext = isHevc ? 'hevc' : isWebm ? 'webm' : isMov ? 'mov' : 'mp4';
  const resolvedContentType = isWebm
    ? 'video/webm'
    : isMov
    ? 'video/quicktime'
    : 'video/mp4';

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
      contentType: resolvedContentType,
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

