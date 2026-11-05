export interface R2BucketBinding {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream | string,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
    }
  ): Promise<unknown>;
}

export interface Env {
  SAMO_R2_BUCKET?: R2BucketBinding;
  R2_PUBLIC_BASE_URL?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  try {
    const body = (await context.request.json()) as {
      fileName?: string;
      contentType?: string;
      base64Data?: string;
    };

    const { fileName, contentType, base64Data } = body || {};
    if (!base64Data || typeof base64Data !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing base64Data payload.' }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!context.env.SAMO_R2_BUCKET) {
      return new Response(
        JSON.stringify({
          error:
            'Cloudflare R2 bucket binding SAMO_R2_BUCKET is not configured on this Pages Function.',
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    const rawBase64 = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;
    const binaryString = atob(rawBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (bytes.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: 'Decoded media buffer is empty.' }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    const isVideo =
      (typeof contentType === 'string' && contentType.startsWith('video/')) ||
      (typeof fileName === 'string' && /\.(mp4|webm|mov|hevc|m4v)$/i.test(fileName));
    const maxAllowedBytes = isVideo ? 35 * 1024 * 1024 : 10 * 1024 * 1024;

    if (bytes.byteLength > maxAllowedBytes) {
      return new Response(
        JSON.stringify({
          error: isVideo
            ? 'Video exceeds the 35 MB maximum upload size.'
            : 'Compressed image exceeds 10 MB maximum upload size.',
        }),
        {
          status: 413,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    let mimeType =
      typeof contentType === 'string' &&
      (contentType.startsWith('image/') || contentType.startsWith('video/'))
        ? contentType
        : 'image/webp';

    const rawExtMatch = typeof fileName === 'string' ? fileName.match(/\.([a-z0-9]+)$/i) : null;
    const rawExt = rawExtMatch ? rawExtMatch[1].toLowerCase() : '';

    if (rawExt === 'mov') {
      mimeType = 'video/quicktime';
    } else if (rawExt === 'hevc' || rawExt === 'm4v') {
      mimeType = 'video/mp4';
    } else if (rawExt === 'webm') {
      mimeType = 'video/webm';
    } else if (rawExt === 'mp4') {
      mimeType = 'video/mp4';
    }

    const defaultExt = isVideo
      ? rawExt
        ? `.${rawExt}`
        : mimeType.includes('webm')
        ? '.webm'
        : mimeType.includes('quicktime')
        ? '.mov'
        : '.mp4'
      : mimeType === 'image/jpeg'
      ? '.jpg'
      : '.webp';

    const safeFileName =
      typeof fileName === 'string' && fileName.trim()
        ? fileName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
        : `${Date.now()}-samo-item${defaultExt}`;

    const isRecognizedExt =
      /\.(webp|jpg|jpeg|png|gif|mp4|webm|mov|hevc|m4v)$/i.test(safeFileName);
    const finalFileName = isRecognizedExt
      ? safeFileName
      : `${safeFileName.replace(/\.[^/.]+$/, '')}${defaultExt}`;
    const objectKey = isVideo
      ? `banners/${finalFileName}`
      : `products/${finalFileName}`;

    await context.env.SAMO_R2_BUCKET.put(objectKey, bytes.buffer, {
      httpMetadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const publicBaseUrl = (
      context.env.R2_PUBLIC_BASE_URL || 'https://images.samoweave.com'
    )
      .trim()
      .replace(/\/+$/, '');

    return new Response(
      JSON.stringify({
        url: `${publicBaseUrl}/${objectKey}`,
        key: objectKey,
        sizeBytes: bytes.byteLength,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to upload image to Cloudflare R2.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};
