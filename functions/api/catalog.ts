export interface R2BucketBinding {
  get(key: string): Promise<{
    text(): Promise<string>;
    json<T>(): Promise<T>;
  } | null>;
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
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

const STATE_OBJECT_KEY = 'state/catalog.json';

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet = async (context: {
  env: Env;
}): Promise<Response> => {
  try {
    if (context.env.SAMO_R2_BUCKET) {
      const obj = await context.env.SAMO_R2_BUCKET.get(STATE_OBJECT_KEY);
      if (obj) {
        const text = await obj.text();
        return new Response(text, {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ updatedAt: 0 }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        updatedAt: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
};

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  try {
    const patch = (await context.request.json()) as Record<string, unknown>;
    let current: Record<string, unknown> = { updatedAt: 0 };

    if (context.env.SAMO_R2_BUCKET) {
      try {
        const existing = await context.env.SAMO_R2_BUCKET.get(STATE_OBJECT_KEY);
        if (existing) {
          const parsed = await existing.json<Record<string, unknown>>();
          if (parsed && typeof parsed === 'object') {
            current = parsed;
          }
        }
      } catch {}

      const mergedDeletedProducts = Array.from(
        new Set([
          ...((current.deletedProductIds as string[]) || []),
          ...(Array.isArray(patch.deletedProductIds) ? (patch.deletedProductIds as string[]) : []),
        ])
      );

      const mergedDeletedCategories = Array.from(
        new Set([
          ...((current.deletedCategoryIds as string[]) || []),
          ...(Array.isArray(patch.deletedCategoryIds) ? (patch.deletedCategoryIds as string[]) : []),
        ])
      );

      const nextState = {
        ...current,
        ...(Array.isArray(patch.products) ? { products: patch.products } : {}),
        ...(Array.isArray(patch.categories) ? { categories: patch.categories } : {}),
        ...(Array.isArray(patch.promoCodes) ? { promoCodes: patch.promoCodes } : {}),
        ...(Array.isArray(patch.customMaterials) ? { customMaterials: patch.customMaterials } : {}),
        ...(Array.isArray(patch.customColors) ? { customColors: patch.customColors } : {}),
        ...(Array.isArray(patch.orders) ? { orders: patch.orders } : {}),
        ...(Array.isArray(patch.preorders) ? { preorders: patch.preorders } : {}),
        ...(Array.isArray(patch.admins) ? { admins: patch.admins } : {}),
        ...(patch.siteBanners && typeof patch.siteBanners === 'object'
          ? { siteBanners: patch.siteBanners }
          : {}),
        ...(typeof patch.autoAcceptOrders === 'boolean'
          ? { autoAcceptOrders: patch.autoAcceptOrders }
          : {}),
        deletedProductIds: mergedDeletedProducts,
        deletedCategoryIds: mergedDeletedCategories,
        updatedAt: Date.now(),
      };

      await context.env.SAMO_R2_BUCKET.put(
        STATE_OBJECT_KEY,
        JSON.stringify(nextState, null, 2),
        {
          httpMetadata: {
            contentType: 'application/json',
            cacheControl: 'no-store, no-cache, must-revalidate',
          },
        }
      );

      return new Response(JSON.stringify(nextState), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ...patch, updatedAt: Date.now() }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to update catalog state',
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
};
