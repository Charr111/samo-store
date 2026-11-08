export interface R2BucketBinding {
  delete(keys: string | string[]): Promise<void>;
}

export interface Env {
  SAMO_R2_BUCKET?: R2BucketBinding;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
      keys?: string[];
    };

    const rawKeys = Array.isArray(body?.keys) ? body.keys : [];
    const safeKeys = rawKeys
      .map((k) => (typeof k === 'string' ? k.trim().replace(/^\/+/, '') : ''))
      .filter(
        (k) =>
          Boolean(k) &&
          (k.startsWith('products/') || k.startsWith('banners/'))
      );

    if (safeKeys.length === 0) {
      return new Response(
        JSON.stringify({ deletedKeys: [] }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    if (context.env.SAMO_R2_BUCKET) {
      await context.env.SAMO_R2_BUCKET.delete(safeKeys);
    }

    return new Response(
      JSON.stringify({
        deletedKeys: safeKeys,
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
        : 'Failed to delete media from Cloudflare R2.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};
