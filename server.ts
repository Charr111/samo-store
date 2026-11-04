import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATALOG_STATE_FILE = path.join(__dirname, '.samo-catalog-state.json');

interface PersistedCatalogState {
  updatedAt: number;
  products?: unknown[];
  deletedProductIds?: string[];
  categories?: unknown[];
  deletedCategoryIds?: string[];
  promoCodes?: unknown[];
  customMaterials?: string[];
  customColors?: string[];
  orders?: unknown[];
  preorders?: unknown[];
  admins?: unknown[];
  siteBanners?: Record<string, unknown>;
}

function readCatalogState(): PersistedCatalogState {
  try {
    if (fs.existsSync(CATALOG_STATE_FILE)) {
      const raw = fs.readFileSync(CATALOG_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedCatalogState;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {}
  return { updatedAt: 0 };
}

function writeCatalogState(patch: Partial<PersistedCatalogState>): PersistedCatalogState {
  const current = readCatalogState();
  const next: PersistedCatalogState = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  try {
    fs.writeFileSync(CATALOG_STATE_FILE, JSON.stringify(next, null, 2), 'utf-8');
  } catch {}
  return next;
}

const R2_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

function getR2Config() {
  const accountId = (
    process.env.R2_ACCOUNT_ID || 'a7aeacd3a375ad4e1d7e12810ccbdd15'
  ).trim();
  const accessKeyId = (
    process.env.R2_ACCESS_KEY_ID || 'e0322ab12db081670fbc869a603d7202'
  ).trim();
  const secretAccessKey = (
    process.env.R2_SECRET_ACCESS_KEY ||
    'fafe8a2491fb1cef9ba577bdba5e613079c94081561749f6bd975ea4f8dad5c1'
  ).trim();
  const bucketName = (process.env.R2_BUCKET_NAME || 'samo-images').trim();
  const publicBaseUrl = (
    process.env.R2_PUBLIC_BASE_URL || 'https://images.samoweave.com'
  )
    .trim()
    .replace(/\/+$/, '');

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl,
  };
}

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '35mb' }));

  // Cross-Device Catalog Sync Endpoint (Syncs Phone <-> Laptop on preview & production server)
  app.get('/api/catalog', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(readCatalogState());
  });

  app.post('/api/catalog', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const body = req.body || {};
    const current = readCatalogState();
    const mergedDeletedProducts = Array.from(
      new Set([
        ...(current.deletedProductIds || []),
        ...(Array.isArray(body.deletedProductIds) ? body.deletedProductIds : []),
      ])
    );
    const mergedDeletedCategories = Array.from(
      new Set([
        ...(current.deletedCategoryIds || []),
        ...(Array.isArray(body.deletedCategoryIds) ? body.deletedCategoryIds : []),
      ])
    );

    const updated = writeCatalogState({
      ...(Array.isArray(body.products) ? { products: body.products } : {}),
      ...(Array.isArray(body.categories) ? { categories: body.categories } : {}),
      ...(Array.isArray(body.promoCodes) ? { promoCodes: body.promoCodes } : {}),
      ...(Array.isArray(body.customMaterials)
        ? { customMaterials: body.customMaterials }
        : {}),
      ...(Array.isArray(body.customColors)
        ? { customColors: body.customColors }
        : {}),
      ...(Array.isArray(body.orders) ? { orders: body.orders } : {}),
      ...(Array.isArray(body.preorders) ? { preorders: body.preorders } : {}),
      ...(Array.isArray(body.admins) ? { admins: body.admins } : {}),
      ...(body.siteBanners && typeof body.siteBanners === 'object'
        ? { siteBanners: body.siteBanners as Record<string, unknown> }
        : {}),
      deletedProductIds: mergedDeletedProducts,
      deletedCategoryIds: mergedDeletedCategories,
    });
    res.json(updated);
  });

  // 0. Cloudflare R2 Image Upload Endpoint (with full CORS + Cross-Origin-Resource-Policy headers)
  app.options('/api/r2-upload', (_req, res) => {
    res.set(R2_CORS_HEADERS).status(204).end();
  });

  app.post('/api/r2-upload', async (req, res) => {
    res.set(R2_CORS_HEADERS);
    try {
      const { fileName, contentType, base64Data } = req.body || {};
      if (!base64Data || typeof base64Data !== 'string') {
        res.status(400).json({ error: 'Missing base64Data payload.' });
        return;
      }

      const {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicBaseUrl,
      } = getR2Config();

      if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        res.status(500).json({
          error:
            'Cloudflare R2 credentials are not configured on the server.',
        });
        return;
      }

      const rawBase64 = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data;
      const buffer = Buffer.from(rawBase64, 'base64');

      if (buffer.byteLength === 0) {
        res.status(400).json({ error: 'Decoded image buffer is empty.' });
        return;
      }

      const isVideo =
        typeof contentType === 'string' && contentType.startsWith('video/');
      const maxAllowedBytes = isVideo ? 25 * 1024 * 1024 : 5 * 1024 * 1024;

      if (buffer.byteLength > maxAllowedBytes) {
        res.status(413).json({
          error: isVideo
            ? 'Video exceeds the 25 MB maximum upload size.'
            : 'Compressed image exceeds the 5 MB maximum upload size.',
        });
        return;
      }

      const mimeType =
        typeof contentType === 'string' &&
        (contentType.startsWith('image/') || contentType.startsWith('video/'))
          ? contentType
          : 'image/webp';
      const defaultExt = isVideo
        ? mimeType.includes('webm')
          ? '.webm'
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

      const finalFileName =
        safeFileName.endsWith('.webp') ||
        safeFileName.endsWith('.jpg') ||
        safeFileName.endsWith('.jpeg') ||
        safeFileName.endsWith('.mp4') ||
        safeFileName.endsWith('.webm') ||
        safeFileName.endsWith('.mov')
          ? safeFileName
          : `${safeFileName.replace(/\.[^/.]+$/, '')}${defaultExt}`;
      const objectKey = isVideo
        ? `banners/${finalFileName}`
        : `products/${finalFileName}`;

      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      const publicUrl = `${publicBaseUrl}/${objectKey}`;
      res.status(200).json({
        url: publicUrl,
        key: objectKey,
        sizeBytes: buffer.byteLength,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to upload image to Cloudflare R2.';
      res.status(500).json({ error: message });
    }
  });

  // 1. Complex Fashion Atelier & Sizing/Architecture Thinking Endpoint (gemini-4-argon with HIGH thinking)
  app.post('/api/ai/stylist', async (req, res) => {
    try {
      const { query, contextProducts, department } = req.body || {};
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required.' });
        return;
      }

      const ai = getAiClient();
      const catalogContext = Array.isArray(contextProducts)
        ? contextProducts
            .slice(0, 15)
            .map(
              (p: Record<string, unknown>) =>
                `- ${p.name} (${p.department}/${p.category}, ${p.style}): $${p.price} | Sizes: ${
                  Array.isArray(p.sizes) ? p.sizes.join(', ') : ''
                } | Materials: ${Array.isArray(p.materials) ? p.materials.join(', ') : ''}`
            )
            .join('\n')
        : '';

      const systemPrompt = `You are the Head Atelier Director for SAMO, an architectural luxury fashion house specializing in Women and Kids wear (Classic, Sport Chic, Fine Leather, Suede, Fur, Bags, and Belts).
Provide concise, authoritative styling, sizing (Letter XS-XL, European Numeric 34-44, or Kids Centimeters 80 cm - 150 cm), and material care guidance.
Current department focus: ${department || 'All'}.
Available catalog items:
${catalogContext}`;

      let textOutput = '';
      let modelUsed = 'gemini-4-argon';

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-argon',
          contents: query,
          config: {
            systemInstruction: systemPrompt,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });
        textOutput = response.text || '';
      } catch (primaryErr) {
        // Fallback to gemini-3.8-flash with ThinkingLevel.HIGH if paid model key was declined
        modelUsed = 'gemini-3.8-flash';
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: query,
          config: {
            systemInstruction: systemPrompt,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });
        textOutput = fallbackResponse.text || '';
      }

      res.json({
        reply: textOutput,
        model: modelUsed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI Stylist request failed';
      res.status(500).json({ error: message });
    }
  });

  // 2. General Task: Admin Product Editorial Copy & Material Generator (gemini-3.8-flash)
  app.post('/api/ai/product-copy', async (req, res) => {
    try {
      const { name, department, category, style, materials } = req.body || {};
      if (!name) {
        res.status(400).json({ error: 'Product name is required.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate luxury architectural fashion product metadata for SAMO:
Product Name: ${name}
Department: ${department || 'women'}
Category: ${category || 'Jacket'}
Style: ${style || 'Fine Leather'}
Selected Materials: ${Array.isArray(materials) ? materials.join(', ') : 'Cow Leather'}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: {
                type: Type.STRING,
                description: '2-3 sentence brutalist-luxury editorial product description focusing on silhouette and construction.',
              },
              suggestedMaterials: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Up to 3 recommended materials from Cow Leather, Suede, Cotton, Wool, Cashmere, Silk, Linen, Denim, Satin, Lace.',
              },
              recommendedSizeType: {
                type: Type.STRING,
                description: 'Recommended sizeType: letter, numeric, or cm.',
              },
            },
            required: ['description', 'suggestedMaterials', 'recommendedSizeType'],
          },
        },
      });

      const rawText = response.text?.trim() || '{}';
      res.json(JSON.parse(rawText));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate product copy';
      res.status(500).json({ error: message });
    }
  });

  // 3. Fast Task: Instant Catalog Search Intent Filter (gemini-3.1-flash-lite)
  app.post('/api/ai/quick-filter', async (req, res) => {
    try {
      const { searchPrompt } = req.body || {};
      if (!searchPrompt) {
        res.status(400).json({ error: 'Search prompt is required.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Map this customer fashion search query "${searchPrompt}" to SAMO catalog filters.
Departments: women, kids, all.
Women Categories: Jacket, Trousers, Pants, Skirts, Denim, Tops, Full Set, Trench Coat, Fur, Bags, Belts.
Kids Categories: MINIS 1 To 5, CHILDREN 6+, Teen 13+.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              department: { type: Type.STRING },
              category: { type: Type.STRING },
              materialKeyword: { type: Type.STRING },
            },
            required: ['department', 'category', 'materialKeyword'],
          },
        },
      });

      const rawText = response.text?.trim() || '{}';
      res.json(JSON.parse(rawText));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Quick filter failed';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SAMO Server listening on http://localhost:${PORT}`);
  });
}

startServer();
