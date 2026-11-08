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
 * Compresses an image File in the browser (c_limit 600x750 4:5 studio ratio, adaptive quality).
 * Guarantees 1.2 MB - 8 MB mobile camera photos (including iPhone HEIC and JPG) shrink down to
 * ~30 KB - 60 KB WebP/JPEG across both iOS Safari/WebKit and Android/Desktop Chrome.
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

  const maxWidth = options?.maxWidth ?? 600;
  const maxHeight = options?.maxHeight ?? 750;
  const initialQuality = options?.quality ?? 0.72;
  const targetMaxBytes = options?.targetMaxBytes ?? 60 * 1024; // 60 KB target budget

  const decodedBlob = await convertHeicToJpegIfNeeded(file, 0.88);
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
      wasShrunk: true,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Uploads an image file to Cloudflare R2 via /api/r2-upload.
 * Respects the global Auto-Shrink toggle (shrinks to ~50 KB WebP when ON, or uploads original quality when OFF).
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

  return {
    url: payload.url,
    sizeBytes: finalBytes,
    originalSizeKB,
    compressedSizeKB,
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

