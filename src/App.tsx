/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  ArrowUpRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  AdminRecord,
  CartItem,
  CategoryItem,
  Department,
  DiscountType,
  FullSetSubItem,
  OrderItem,
  OrderStatus,
  PreorderItem,
  PreorderStatus,
  ProductColorVariant,
  ProductItem,
  PromoCodeItem,
  RoutePath,
  SelectedSetPieceSize,
  SiteBannersConfig,
  StyleType,
} from './types/samo';
import {
  INITIAL_ADMINS,
  INITIAL_CATEGORIES,
  INITIAL_ORDERS,
  INITIAL_PREORDERS,
  INITIAL_PRODUCTS,
  INITIAL_PROMO_CODES,
} from './data/seedCatalog';
import {
  buildDefaultCategoryBannerForCategory,
  buildSizeQuantitiesMap,
  createSafeSlug,
  decrementStockForAcceptedOrder,
  filterCatalogProducts,
  filterGiftsProducts,
  filterNewArrivalProducts,
  getCategoriesByDepartment,
  getCategoryBannerKey,
  getCategoryBannerSplitIndex,
  getSizeQuantity,
  isAuthorizedAdminEmail,
  mergeSiteBannersConfig,
  normalizeKidsCategoryName,
  parsePathnameToRoute,
  sumSizeQuantities,
  syncFullSetsWithCatalog,
  syncProductFromColorVariants,
  toggleProductInStockState,
} from './utils/catalogLogic';
import {
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  firebaseSignOut,
  googleProvider,
  handleFirestoreError,
  onAuthStateChanged,
  onSnapshot,
  OperationType,
  serverTimestamp,
  setDoc,
  signInWithPopup,
  updateDoc,
  User,
} from './lib/firebase';
import { Navbar } from './components/Navbar';
import { HeroVideoSection } from './components/HeroVideoSection';
import { ProductImage } from './components/ProductImage';
import { CatalogProductCard } from './components/CatalogProductCard';
import { ProductModal } from './components/ProductModal';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer';
import { AdminDashboard } from './components/AdminDashboard';
import { AiStylistModal } from './components/AiStylistModal';

const STORAGE_KEYS = {
  categories: 'samo_categories_v2',
  products: 'samo_products_v5',
  deletedProducts: 'samo_deleted_products_v1',
  promos: 'samo_promo_codes_v1',
  materials: 'samo_custom_materials_v1',
  colors: 'samo_custom_colors_v1',
  orders: 'samo_orders_v1',
  preorders: 'samo_preorders_v1',
  admins: 'samo_admins_v1',
  cart: 'samo_cart_v1',
  aiAdmin: 'samo_ai_admin_unlocked_v1',
  siteBanners: 'samo_site_banners_v2',
};

function sanitizeFirestorePayload<T extends Record<string, unknown>>(
  raw: T
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'id' || v === undefined) continue;
    clean[k] = v;
  }
  return clean;
}

export function deepCleanFirestorePayload<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => deepCleanFirestorePayload(item)) as unknown as T;
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      res[k] = deepCleanFirestorePayload(v);
    }
    return res as T;
  }
  return value;
}

async function pushServerCatalogPatch(patch: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch {}
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mergeStoredCategories(stored: CategoryItem[]): CategoryItem[] {
  const map = new Map<string, CategoryItem>();
  for (const c of INITIAL_CATEGORIES) map.set(c.id, c);
  for (const c of stored) {
    if (c.department === 'kids') {
      const normalizedName = normalizeKidsCategoryName(c.name);
      if (normalizedName.toLowerCase() === 'full set' || c.id === 'kids-full-set') {
        continue;
      }
      const normalizedSlug = createSafeSlug(normalizedName);
      const canonicalId = `kids-${normalizedSlug}`;
      map.set(canonicalId, {
        ...c,
        id: canonicalId,
        name: normalizedName,
        slug: normalizedSlug,
      });
    } else {
      map.set(c.id, c);
    }
  }
  return Array.from(map.values());
}

function normalizeStoredProducts(
  items: ProductItem[],
  deletedIds: string[] = []
): ProductItem[] {
  const deletedSet = new Set(deletedIds);
  const map = new Map<string, ProductItem>();

  // 1. Insert stored / newly added admin products FIRST so newest items stay at the top
  for (const item of items) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;
    const normalizedCat =
      item.department === 'kids'
        ? normalizeKidsCategoryName(item.category)
        : item.category;
    if (
      item.department === 'kids' &&
      (normalizedCat.toLowerCase() === 'full set' || item.id === 'samo-k-fullset-01')
    ) {
      continue;
    }
    const seedFallback = INITIAL_PRODUCTS.find((sp) => sp.id === item.id);
    map.set(item.id, {
      ...item,
      category: normalizedCat,
      galleryUrls:
        Array.isArray(item.galleryUrls) && item.galleryUrls.length > 0
          ? item.galleryUrls
          : seedFallback?.galleryUrls || [],
      isFullSet:
        item.department === 'kids'
          ? false
          : item.isFullSet ??
            (normalizedCat.trim().toLowerCase() === 'full set'
              ? true
              : seedFallback?.isFullSet),
      setItems:
        item.department === 'kids'
          ? undefined
          : item.setItems ?? seedFallback?.setItems,
    });
  }

  // 2. Append any seed products not already in the map
  for (const seed of INITIAL_PRODUCTS) {
    if (!deletedSet.has(seed.id) && !map.has(seed.id)) {
      map.set(seed.id, seed);
    }
  }

  const normalized = Array.from(map.values()).map((item) => {
    const explicitOutOfStock = item.inStock === false;
    const sizes = Array.isArray(item.sizes) && item.sizes.length > 0 ? item.sizes : ['M'];
    const sizeQuantities = buildSizeQuantitiesMap(sizes, item.sizeQuantities);
    const totalQty = sumSizeQuantities(sizes, sizeQuantities);
    const baseNormalized: ProductItem = {
      ...item,
      sizes,
      sizeQuantities,
      quantity: totalQty,
      isNewArrival: Boolean(item.isNewArrival ?? item.featured ?? true),
      discountType: item.discountType || 'none',
      discountValue: Number(item.discountValue) || 0,
      inStock: explicitOutOfStock ? false : totalQty > 0,
    };

    if (
      item.hasColors &&
      Array.isArray(item.colorVariants) &&
      item.colorVariants.length > 0
    ) {
      const synced = syncProductFromColorVariants(
        item.colorVariants,
        baseNormalized.sizeType
      );
      return {
        ...baseNormalized,
        hasColors: true,
        colorVariants: item.colorVariants,
        imageUrl: item.colorVariants[0]?.imageUrl || baseNormalized.imageUrl,
        ...synced,
        inStock: explicitOutOfStock ? false : synced.inStock,
      };
    }

    return baseNormalized;
  });

  return syncFullSetsWithCatalog(normalized);
}

export default function App() {
  // Route state (/home, /women, /kids, /new-arrivals, /gifts, /showroom, /admin)
  const [currentRoute, setCurrentRoute] = useState<RoutePath>(() =>
    parsePathnameToRoute(window.location.pathname)
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [deletedProductIds, setDeletedProductIds] = useState<string[]>(() =>
    loadStored(STORAGE_KEYS.deletedProducts, [])
  );
  const [categories, setCategories] = useState<CategoryItem[]>(() =>
    mergeStoredCategories(loadStored(STORAGE_KEYS.categories, INITIAL_CATEGORIES))
  );
  const [siteBanners, setSiteBanners] = useState<SiteBannersConfig>(() => {
    try {
      localStorage.removeItem('samo_site_banners_v1');
    } catch {}
    return mergeSiteBannersConfig(
      loadStored<Partial<SiteBannersConfig> | null>(STORAGE_KEYS.siteBanners, null),
      mergeStoredCategories(loadStored(STORAGE_KEYS.categories, INITIAL_CATEGORIES))
    );
  });
  const [products, setProducts] = useState<ProductItem[]>(() =>
    normalizeStoredProducts(
      loadStored(STORAGE_KEYS.products, INITIAL_PRODUCTS),
      loadStored(STORAGE_KEYS.deletedProducts, [])
    )
  );
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>(() =>
    loadStored(STORAGE_KEYS.promos, INITIAL_PROMO_CODES)
  );
  const [customMaterials, setCustomMaterials] = useState<string[]>(() =>
    loadStored(STORAGE_KEYS.materials, ['Shearling', 'Lambskin'])
  );
  const [customColors, setCustomColors] = useState<string[]>(() =>
    loadStored(STORAGE_KEYS.colors, ['Olive', 'Navy'])
  );
  const [orders, setOrders] = useState<OrderItem[]>(() =>
    loadStored(STORAGE_KEYS.orders, INITIAL_ORDERS)
  );
  const [preorders, setPreorders] = useState<PreorderItem[]>(() =>
    loadStored(STORAGE_KEYS.preorders, INITIAL_PREORDERS)
  );
  const [admins, setAdmins] = useState<AdminRecord[]>(() => {
    const stored = loadStored(STORAGE_KEYS.admins, INITIAL_ADMINS);
    const byEmail = new Map<string, AdminRecord>();
    for (const adm of [...INITIAL_ADMINS, ...(Array.isArray(stored) ? stored : [])]) {
      if (adm && typeof adm.email === 'string' && adm.email.trim()) {
        byEmail.set(adm.email.trim().toLowerCase(), adm);
      }
    }
    return Array.from(byEmail.values());
  });

  // Shopping Bag & Active Sole Product Modal State
  const [cartItems, setCartItems] = useState<CartItem[]>(() =>
    loadStored(STORAGE_KEYS.cart, [])
  );
  const [activeProductModal, setActiveProductModal] =
    useState<ProductItem | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);
  const [cartDrawerInitialStep, setCartDrawerInitialStep] = useState<
    'cart' | 'checkout'
  >('cart');
  const [aiStylistOpen, setAiStylistOpen] = useState<boolean>(false);
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [newsletterSubscribed, setNewsletterSubscribed] =
    useState<boolean>(false);

  // Home Page Section 2 (Categories Switcher: Women | Kids) & New Arrivals Carousel State
  const [homeCategoryDept, setHomeCategoryDept] = useState<Department>('women');
  const [homeNewArrivalsDept, setHomeNewArrivalsDept] =
    useState<Department>('women');
  const [newArrivalsScrollProgress, setNewArrivalsScrollProgress] =
    useState<number>(28);
  const newArrivalsScrollRef = useRef<HTMLDivElement | null>(null);

  // Catalog Listing Sort State
  const [catalogSortBy, setCatalogSortBy] = useState<
    'suggested' | 'price-asc' | 'price-desc'
  >('suggested');

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [aiAdminUnlocked, setAiAdminUnlocked] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ai_admin') === '1') return true;
    return loadStored(STORAGE_KEYS.aiAdmin, false);
  });

  // Sync localStorage whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
    } catch {}
    setSiteBanners((prev) => mergeSiteBannersConfig(prev, categories));
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.siteBanners, JSON.stringify(siteBanners));
    } catch {}
  }, [siteBanners]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
    } catch {}
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.deletedProducts,
        JSON.stringify(deletedProductIds)
      );
    } catch {}
  }, [deletedProductIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.promos, JSON.stringify(promoCodes));
    } catch {}
  }, [promoCodes]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.materials,
        JSON.stringify(customMaterials)
      );
    } catch {}
  }, [customMaterials]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.colors,
        JSON.stringify(customColors)
      );
    } catch {}
  }, [customColors]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
    } catch {}
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.preorders, JSON.stringify(preorders));
    } catch {}
  }, [preorders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.admins, JSON.stringify(admins));
    } catch {}
  }, [admins]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cartItems));
    } catch {}
  }, [cartItems]);

  // Normalize initial root path '/' to '/home' and listen for browser back/forward
  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.history.replaceState({}, '', '/home');
    }
    const onPopState = () => {
      setCurrentRoute(parsePathnameToRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Track Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Cross-Device Server Catalog Sync (Phone <-> Laptop on preview & production server)
  useEffect(() => {
    let active = true;

    const pullServerCatalog = async () => {
      try {
        const res = await fetch('/api/catalog', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !data || typeof data !== 'object') return;

        const remoteDeletedIds: string[] = Array.isArray(data.deletedProductIds)
          ? data.deletedProductIds
          : [];
        if (remoteDeletedIds.length > 0) {
          setDeletedProductIds((prev) =>
            Array.from(new Set([...prev, ...remoteDeletedIds]))
          );
        }

        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts((prev) => {
            const deletedSet = new Set(remoteDeletedIds);
            const mergedMap = new Map<string, ProductItem>();
            for (const rp of data.products as ProductItem[]) {
              if (rp && rp.id && !deletedSet.has(rp.id)) {
                mergedMap.set(rp.id, rp);
              }
            }
            for (const lp of prev) {
              if (lp && lp.id && !deletedSet.has(lp.id) && !mergedMap.has(lp.id)) {
                mergedMap.set(lp.id, lp);
              }
            }
            return normalizeStoredProducts(
              Array.from(mergedMap.values()),
              remoteDeletedIds
            );
          });
        }

        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(mergeStoredCategories(data.categories as CategoryItem[]));
        }
        if (data.siteBanners && typeof data.siteBanners === 'object') {
          setSiteBanners((prev) =>
            mergeSiteBannersConfig(
              data.siteBanners as Partial<SiteBannersConfig>,
              Array.isArray(data.categories) && data.categories.length > 0
                ? mergeStoredCategories(data.categories as CategoryItem[])
                : INITIAL_CATEGORIES
            )
          );
        }
        if (Array.isArray(data.promoCodes) && data.promoCodes.length > 0) {
          setPromoCodes(data.promoCodes as PromoCodeItem[]);
        }
        if (Array.isArray(data.customMaterials) && data.customMaterials.length > 0) {
          setCustomMaterials(data.customMaterials as string[]);
        }
        if (Array.isArray(data.customColors) && data.customColors.length > 0) {
          setCustomColors(data.customColors as string[]);
        }
        if (Array.isArray(data.orders) && data.orders.length > 0) {
          setOrders(data.orders as OrderItem[]);
        }
        if (Array.isArray(data.preorders) && data.preorders.length > 0) {
          setPreorders(data.preorders as PreorderItem[]);
        }
        if (data.siteBanners && typeof data.siteBanners === 'object') {
          setSiteBanners((prev) =>
            mergeSiteBannersConfig({ ...prev, ...data.siteBanners }, INITIAL_CATEGORIES)
          );
        }
      } catch {}
    };

    pullServerCatalog();
    const intervalId = window.setInterval(pullServerCatalog, 4000);
    const onFocus = () => pullServerCatalog();
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Subscribe to public Firestore collections (products, categories, promo_codes, settings/site_banners)
  useEffect(() => {
    if (!authReady) return;

    const unsubSiteBanners = onSnapshot(
      doc(db, 'settings', 'site_banners_v2'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SiteBannersConfig>;
          setSiteBanners((prev) =>
            mergeSiteBannersConfig({ ...prev, ...data }, INITIAL_CATEGORIES)
          );
        }
      },
      () => {}
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        if (!snap.empty) {
          const remoteCats: CategoryItem[] = snap.docs
            .map((d) => {
              const data = d.data();
              const dept = (
                data.department === 'kids' ? 'kids' : 'women'
              ) as Department;
              const rawName = String(data.name || '');
              const normalizedName =
                dept === 'kids' ? normalizeKidsCategoryName(rawName) : rawName;
              return {
                id: d.id,
                name: normalizedName,
                slug: String(data.slug || createSafeSlug(normalizedName)),
                department: dept,
                description: String(data.description || ''),
              };
            })
            .filter(
              (rc) =>
                !(
                  rc.department === 'kids' &&
                  (rc.name.toLowerCase() === 'full set' ||
                    rc.id === 'kids-full-set')
                )
            );
          setCategories((prev) => {
            const merged = [...prev];
            for (const rc of remoteCats) {
              if (
                !merged.some(
                  (m) =>
                    m.id === rc.id ||
                    (m.department === rc.department &&
                      m.name.toLowerCase() === rc.name.toLowerCase())
                )
              ) {
                merged.push(rc);
              }
            }
            return merged;
          });
        }
      },
      () => {}
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        if (!snap.empty) {
          const remoteProds: ProductItem[] = snap.docs
            .map((d) => {
              const data = d.data();
              const seedFallback = INITIAL_PRODUCTS.find((sp) => sp.id === d.id);
              const dept = (
                data.department === 'kids' ? 'kids' : 'women'
              ) as Department;
              const rawCat = String(data.category || 'Jacket');
              const normalizedCat =
                dept === 'kids' ? normalizeKidsCategoryName(rawCat) : rawCat;
              const sizes =
                Array.isArray(data.sizes) && data.sizes.length > 0
                  ? data.sizes
                  : ['M'];
              const sizeQuantities = buildSizeQuantitiesMap(
                sizes,
                data.sizeQuantities
              );
              const totalQty = sumSizeQuantities(sizes, sizeQuantities);
              const hasColors =
                data.hasColors !== undefined
                  ? Boolean(data.hasColors)
                  : Boolean(seedFallback?.hasColors);
              const colorVariants = Array.isArray(data.colorVariants)
                ? (data.colorVariants as ProductColorVariant[])
                : seedFallback?.colorVariants;

              const isFullSet =
                dept === 'kids'
                  ? false
                  : data.isFullSet !== undefined
                  ? Boolean(data.isFullSet)
                  : Boolean(seedFallback?.isFullSet);
              const setItems =
                dept === 'kids'
                  ? undefined
                  : Array.isArray(data.setItems)
                  ? (data.setItems as FullSetSubItem[])
                  : seedFallback?.setItems;

              const explicitOutOfStock = data.inStock === false;
              const baseProd: ProductItem = {
                id: d.id,
                name: String(data.name || ''),
                department: dept,
                category: normalizedCat,
                style: (data.style || 'Classic') as StyleType,
                price: Number(data.price) || 0,
                quantity: totalQty,
                sizeQuantities,
                isFullSet,
                setItems,
                isNewArrival: Boolean(data.isNewArrival ?? data.featured ?? true),
                discountType: (data.discountType || 'none') as DiscountType,
                discountValue: Number(data.discountValue) || 0,
                imageUrl: String(data.imageUrl || ''),
                galleryUrls:
                  Array.isArray(data.galleryUrls) && data.galleryUrls.length > 0
                    ? data.galleryUrls
                    : seedFallback?.galleryUrls || [],
                sizeType: data.sizeType || 'letter',
                sizes,
                hasColors,
                colorVariants,
                materials: Array.isArray(data.materials)
                  ? data.materials
                  : ['Cow Leather'],
                description: String(data.description || ''),
                inStock: explicitOutOfStock ? false : totalQty > 0 && Boolean(data.inStock ?? true),
                featured: Boolean(data.featured ?? true),
              };

              if (
                hasColors &&
                Array.isArray(colorVariants) &&
                colorVariants.length > 0
              ) {
                const synced = syncProductFromColorVariants(
                  colorVariants,
                  baseProd.sizeType
                );
                return {
                  ...baseProd,
                  hasColors: true,
                  colorVariants,
                  imageUrl: colorVariants[0]?.imageUrl || baseProd.imageUrl,
                  ...synced,
                  inStock: explicitOutOfStock ? false : synced.inStock,
                };
              }
              return baseProd;
            })
            .filter(
              (rp) =>
                !(
                  rp.department === 'kids' &&
                  (rp.category.toLowerCase() === 'full set' ||
                    rp.id === 'samo-k-fullset-01')
                )
            );
          setProducts((prev) => {
            const map = new Map<string, ProductItem>();
            // Keep remote Firestore items & new local items at the top
            for (const rp of remoteProds) map.set(rp.id, rp);
            for (const p of prev) {
              if (!map.has(p.id)) map.set(p.id, p);
            }
            return normalizeStoredProducts(Array.from(map.values()));
          });
        }
      },
      () => {}
    );

    const unsubPromos = onSnapshot(
      collection(db, 'promo_codes'),
      (snap) => {
        if (!snap.empty) {
          const remotePromos: PromoCodeItem[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              code: String(data.code || ''),
              discountType: data.discountType === 'fixed' ? 'fixed' : 'percentage',
              discountValue: Number(data.discountValue) || 0,
              active: Boolean(data.active ?? true),
            };
          });
          setPromoCodes((prev) => {
            const map = new Map<string, PromoCodeItem>();
            for (const p of prev) map.set(p.id, p);
            for (const rp of remotePromos) map.set(rp.id, rp);
            return Array.from(map.values());
          });
        }
      },
      () => {}
    );

    return () => {
      unsubSiteBanners();
      unsubCategories();
      unsubProducts();
      unsubPromos();
    };
  }, [authReady]);

  // Subscribe to Admin-only Firestore collections (orders, admins) when signed in as verified admin
  useEffect(() => {
    if (!authReady || !currentUser) return;
    if (!isAuthorizedAdminEmail(currentUser.email, admins)) return;

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        if (!snap.empty) {
          const remoteOrders: OrderItem[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              orderNumber: String(data.orderNumber || d.id),
              customerName: String(data.customerName || ''),
              customerEmail: String(data.customerEmail || ''),
              customerPhone: String(data.customerPhone || ''),
              shippingLocation: String(data.shippingLocation || ''),
              deliveryMethod: data.deliveryMethod || 'Standard Delivery',
              paymentMethod: data.paymentMethod || undefined,
              deliveryFee: Number(data.deliveryFee) || 0,
              subtotal: Number(data.subtotal) || 0,
              discountAmount: Number(data.discountAmount) || 0,
              promoCode: String(data.promoCode || ''),
              totalPrice: Number(data.totalPrice) || 0,
              itemsSummary: String(data.itemsSummary || ''),
              itemsCount: Number(data.itemsCount) || 1,
              primaryProductName: String(data.primaryProductName || ''),
              primaryProductSize: String(data.primaryProductSize || ''),
              primaryProductImage: String(data.primaryProductImage || ''),
              orderedItems: Array.isArray(data.orderedItems)
                ? data.orderedItems
                : undefined,
              status: (data.status || 'pending') as OrderStatus,
              createdAt:
                data.createdAt?.toDate?.()?.toISOString?.() ||
                new Date().toISOString(),
            };
          });
          setOrders((prev) => {
            const map = new Map<string, OrderItem>();
            for (const o of remoteOrders) map.set(o.id, o);
            for (const o of prev) {
              if (!map.has(o.id)) map.set(o.id, o);
            }
            return Array.from(map.values());
          });
        }
      },
      () => {}
    );

    const unsubPreorders = onSnapshot(
      collection(db, 'preorders'),
      (snap) => {
        if (!snap.empty) {
          const remotePreorders: PreorderItem[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              productId: String(data.productId || ''),
              productName: String(data.productName || ''),
              productImage: String(data.productImage || ''),
              department: (data.department === 'kids' ? 'kids' : 'women') as Department,
              category: String(data.category || ''),
              selectedSize: String(data.selectedSize || data.requestedSize || ''),
              selectedColor: data.selectedColor || data.requestedColor
                ? String(data.selectedColor || data.requestedColor)
                : undefined,
              customerContact: String(data.customerContact || data.contactInfo || ''),
              status: (data.status === 'notified'
                ? 'notified'
                : 'pending') as PreorderStatus,
              createdAt:
                data.createdAt?.toDate?.()?.toISOString?.() ||
                new Date().toISOString(),
            };
          });
          setPreorders((prev) => {
            const map = new Map<string, PreorderItem>();
            for (const p of remotePreorders) map.set(p.id, p);
            for (const p of prev) {
              if (!map.has(p.id) && p.productName) map.set(p.id, p);
            }
            return Array.from(map.values());
          });
        }
      },
      () => {}
    );

    return () => {
      unsubOrders();
      unsubPreorders();
    };
  }, [authReady, currentUser, admins]);

  // Navigation handler updating browser URL
  const handleNavigate = (route: RoutePath, categoryName?: string) => {
    window.history.pushState({}, '', route);
    setCurrentRoute(route);
    if (categoryName) {
      setSelectedCategory(categoryName);
    } else {
      setSelectedCategory('all');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cart & Buy Now Handlers (validating per-size, per-color, and 2-piece Full Set stock)
  const getMaxAvailableForCartSelection = (
    product: ProductItem,
    selectedSize: string,
    selectedColor?: string,
    selectedSetSizes?: SelectedSetPieceSize[]
  ): number => {
    if (
      product.isFullSet &&
      Array.isArray(product.setItems) &&
      product.setItems.length > 0 &&
      Array.isArray(selectedSetSizes) &&
      selectedSetSizes.length > 0
    ) {
      const pieceCapacities = product.setItems.map((piece, idx) => {
        const chosen =
          selectedSetSizes.find((s) => s.productId === piece.productId) ||
          selectedSetSizes[idx];
        const sz = chosen?.selectedSize || piece.sizes[0];
        return piece.sizeQuantities?.[sz] ?? 0;
      });
      return Math.min(...pieceCapacities);
    }
    return getSizeQuantity(product, selectedSize, selectedColor);
  };

  const handleAddToCart = (
    product: ProductItem,
    selectedSize: string,
    selectedColor?: string,
    selectedColorImage?: string,
    selectedSetSizes?: SelectedSetPieceSize[]
  ) => {
    const availableForSize = getMaxAvailableForCartSelection(
      product,
      selectedSize,
      selectedColor,
      selectedSetSizes
    );
    if (availableForSize <= 0 || !product.inStock) return;

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (ci) =>
          ci.product.id === product.id &&
          ci.selectedSize === selectedSize &&
          (ci.selectedColor || '') === (selectedColor || '')
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(
            availableForSize,
            updated[existingIndex].quantity + 1
          ),
        };
        return updated;
      }
      return [
        ...prev,
        {
          product,
          selectedSize,
          selectedSetSizes,
          selectedColor,
          selectedColorImage,
          quantity: 1,
        },
      ];
    });
  };

  const handleBuyNow = (
    product: ProductItem,
    selectedSize: string,
    selectedColor?: string,
    selectedColorImage?: string,
    selectedSetSizes?: SelectedSetPieceSize[]
  ) => {
    const availableForSize = getMaxAvailableForCartSelection(
      product,
      selectedSize,
      selectedColor,
      selectedSetSizes
    );
    if (availableForSize <= 0 || !product.inStock) return;

    handleAddToCart(
      product,
      selectedSize,
      selectedColor,
      selectedColorImage,
      selectedSetSizes
    );
    setActiveProductModal(null);
    setCartDrawerInitialStep('checkout');
    setCartDrawerOpen(true);
  };

  const handleUpdateCartQuantity = (
    productId: string,
    size: string,
    delta: number,
    selectedColor?: string
  ) => {
    setCartItems((prev) =>
      prev
        .map((ci) => {
          if (
            ci.product.id === productId &&
            ci.selectedSize === size &&
            (ci.selectedColor || '') === (selectedColor || '')
          ) {
            const maxForSize = getSizeQuantity(ci.product, size, selectedColor);
            const nextQty = Math.min(maxForSize, ci.quantity + delta);
            return nextQty > 0 ? { ...ci, quantity: nextQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveCartItem = (
    productId: string,
    size: string,
    selectedColor?: string
  ) => {
    setCartItems((prev) =>
      prev.filter(
        (ci) =>
          !(
            ci.product.id === productId &&
            ci.selectedSize === size &&
            (ci.selectedColor || '') === (selectedColor || '')
          )
      )
    );
  };

  const handleSubmitOrder = async (
    orderPayload: Omit<OrderItem, 'id' | 'createdAt' | 'status'>
  ): Promise<OrderItem> => {
    const newId = `ord-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newOrder: OrderItem = {
      ...orderPayload,
      id: newId,
      status: 'pending',
      createdAt: nowIso,
    };

    setOrders((prev) => [newOrder, ...prev]);
    setCartItems([]);

    try {
      await setDoc(doc(db, 'orders', newId), {
        ...orderPayload,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, `orders/${newId}`);
      } catch {}
    }

    return newOrder;
  };

  // Preorder / Back-in-Stock Request Handler (Public write to Firestore `preorders`)
  const handleSubmitPreorder = async (payload: {
    product: ProductItem;
    selectedSize: string;
    selectedColor?: string;
    customerContact: string;
  }): Promise<void> => {
    const newId = `pre-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newPreorder: PreorderItem = {
      id: newId,
      productId: payload.product.id,
      productName: payload.product.name,
      productImage: payload.product.imageUrl,
      department: payload.product.department,
      category: payload.product.category,
      selectedSize: payload.selectedSize,
      selectedColor: payload.selectedColor,
      customerContact: payload.customerContact,
      status: 'pending',
      createdAt: nowIso,
    };

    setPreorders((prev) => [newPreorder, ...prev.filter((p) => Boolean(p.productName))]);

    try {
      await setDoc(doc(db, 'preorders', newId), {
        productId: newPreorder.productId,
        productName: newPreorder.productName,
        productImage: newPreorder.productImage,
        department: newPreorder.department,
        category: newPreorder.category,
        selectedSize: newPreorder.selectedSize,
        selectedColor: newPreorder.selectedColor || '',
        customerContact: newPreorder.customerContact,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, `preorders/${newId}`);
      } catch {}
    }
  };

  const handleUpdatePreorderStatus = async (
    preorderId: string,
    status: PreorderStatus
  ) => {
    setPreorders((prev) =>
      prev.map((p) => (p.id === preorderId ? { ...p, status } : p))
    );
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await updateDoc(doc(db, 'preorders', preorderId), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `preorders/${preorderId}`
          );
        } catch {}
      }
    }
  };

  const handleDeletePreorder = async (preorderId: string) => {
    setPreorders((prev) => prev.filter((p) => p.id !== preorderId));
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await deleteDoc(doc(db, 'preorders', preorderId));
      } catch (err) {
        try {
          handleFirestoreError(
            err,
            OperationType.DELETE,
            `preorders/${preorderId}`
          );
        } catch {}
      }
    }
  };

  // Admin Mutations (Categories, Products, Per-Size/Per-Color Stock, Promo Codes, Materials, Colors, Orders, Admins)
  const handleAddCategory = async (cat: Omit<CategoryItem, 'id'>) => {
    const id = `${cat.department}-${createSafeSlug(cat.name)}-${Date.now()
      .toString()
      .slice(-4)}`;
    const newCat: CategoryItem = { ...cat, id };
    setCategories((prev) => [...prev, newCat]);

    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await setDoc(doc(db, 'categories', id), {
          name: newCat.name,
          slug: newCat.slug,
          department: newCat.department,
          description: newCat.description,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, `categories/${id}`);
        } catch {}
      }
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await deleteDoc(doc(db, 'categories', id));
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
        } catch {}
      }
    }
  };

  const handleAddProduct = async (prod: Omit<ProductItem, 'id'>) => {
    const id = `samo-${prod.department}-${createSafeSlug(prod.name).slice(
      0,
      20
    )}-${Date.now().toString().slice(-4)}`;
    const sizeQuantities = buildSizeQuantitiesMap(prod.sizes, prod.sizeQuantities);
    const totalQty = sumSizeQuantities(prod.sizes, sizeQuantities);
    const baseProd: ProductItem = {
      ...prod,
      id,
      sizeQuantities,
      quantity: totalQty,
      inStock: totalQty > 0,
    };
    const newProd =
      prod.hasColors &&
      Array.isArray(prod.colorVariants) &&
      prod.colorVariants.length > 0
        ? {
            ...baseProd,
            hasColors: true,
            colorVariants: prod.colorVariants,
            imageUrl: prod.colorVariants[0]?.imageUrl || baseProd.imageUrl,
            ...syncProductFromColorVariants(
              prod.colorVariants,
              baseProd.sizeType
            ),
          }
        : baseProd;

    setProducts((prev) => {
      const next = [newProd, ...prev];
      pushServerCatalogPatch({ products: next });
      return next;
    });

    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await setDoc(doc(db, 'products', id), {
          ...sanitizeFirestorePayload(newProd as unknown as Record<string, unknown>),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, `products/${id}`);
        } catch {}
      }
    }
  };

  const handleUpdateProductSizeQuantity = async (
    productId: string,
    size: string,
    nextQuantity: number
  ) => {
    const safeQty = Math.max(0, Math.floor(Number(nextQuantity) || 0));
    let updatedRef: ProductItem | null = null;
    let syncedFullSets: ProductItem[] = [];

    setProducts((prev) => {
      const nextCatalog = prev.map((p) => {
        if (p.id !== productId) return p;
        const nextMap = {
          ...buildSizeQuantitiesMap(p.sizes, p.sizeQuantities),
          [size]: safeQty,
        };
        const nextTotal = sumSizeQuantities(p.sizes, nextMap);
        const updated = {
          ...p,
          sizeQuantities: nextMap,
          quantity: nextTotal,
          inStock: nextTotal > 0,
        };
        updatedRef = updated;
        return updated;
      });
      const withSyncedSets = syncFullSetsWithCatalog(nextCatalog);
      syncedFullSets = withSyncedSets.filter((p) => p.isFullSet);
      pushServerCatalogPatch({ products: withSyncedSets });
      return withSyncedSets;
    });

    // Keep open modal in sync if viewing the same product or a linked Full Set
    setActiveProductModal((prev) => {
      if (!prev) return prev;
      if (prev.id === productId && updatedRef) return updatedRef;
      const syncedSet = syncedFullSets.find((s) => s.id === prev.id);
      return syncedSet || prev;
    });

    if (
      updatedRef &&
      currentUser &&
      isAuthorizedAdminEmail(currentUser.email, admins)
    ) {
      const target = updatedRef as ProductItem;
      try {
        await updateDoc(doc(db, 'products', productId), {
          sizeQuantities: target.sizeQuantities,
          quantity: target.quantity,
          inStock: target.inStock,
          updatedAt: serverTimestamp(),
        });
        for (const fsItem of syncedFullSets) {
          await updateDoc(doc(db, 'products', fsItem.id), {
            setItems: fsItem.setItems || [],
            sizeQuantities: fsItem.sizeQuantities,
            quantity: fsItem.quantity,
            inStock: fsItem.inStock,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        try {
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `products/${productId}`
          );
        } catch {}
      }
    }
  };

  const handleUpdateProductColorVariants = async (
    productId: string,
    hasColors: boolean,
    colorVariants: ProductColorVariant[]
  ) => {
    let updatedRef: ProductItem | null = null;

    setProducts((prev) => {
      const next = prev.map((p) => {
        if (p.id !== productId) return p;
        if (hasColors && colorVariants.length > 0) {
          const synced = syncProductFromColorVariants(
            colorVariants,
            p.sizeType
          );
          const updated: ProductItem = {
            ...p,
            hasColors: true,
            colorVariants,
            imageUrl: colorVariants[0]?.imageUrl || p.imageUrl,
            ...synced,
          };
          updatedRef = updated;
          return updated;
        }
        const fallbackTotal = sumSizeQuantities(p.sizes, p.sizeQuantities);
        const updated: ProductItem = {
          ...p,
          hasColors: false,
          colorVariants: [],
          quantity: fallbackTotal,
          inStock: fallbackTotal > 0,
        };
        updatedRef = updated;
        return updated;
      });
      pushServerCatalogPatch({ products: next });
      return next;
    });

    setActiveProductModal((prev) => {
      if (!prev || prev.id !== productId || !updatedRef) return prev;
      return updatedRef;
    });

    if (
      updatedRef &&
      currentUser &&
      isAuthorizedAdminEmail(currentUser.email, admins)
    ) {
      const target = updatedRef as ProductItem;
      try {
        await updateDoc(doc(db, 'products', productId), {
          hasColors: Boolean(target.hasColors),
          colorVariants: target.colorVariants || [],
          imageUrl: target.imageUrl,
          sizeType: target.sizeType,
          sizes: target.sizes,
          sizeQuantities: target.sizeQuantities,
          quantity: target.quantity,
          inStock: target.inStock,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `products/${productId}`
          );
        } catch {}
      }
    }
  };

  const handleUpdateProductMeta = async (
    productId: string,
    updates: Partial<
      Pick<
        ProductItem,
        | 'isNewArrival'
        | 'isFullSet'
        | 'category'
        | 'discountType'
        | 'discountValue'
        | 'imageUrl'
        | 'galleryUrls'
      >
    >
  ) => {
    setProducts((prev) => {
      const next = prev.map((p) => {
        if (p.id !== productId) return p;
        const nextIsNew =
          updates.isNewArrival !== undefined
            ? updates.isNewArrival
            : p.isNewArrival;
        return {
          ...p,
          ...updates,
          isNewArrival: nextIsNew,
          featured: nextIsNew,
        };
      });
      pushServerCatalogPatch({ products: next });
      return next;
    });

    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await updateDoc(doc(db, 'products', productId), {
          ...sanitizeFirestorePayload(updates as Record<string, unknown>),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `products/${productId}`
          );
        } catch {}
      }
    }
  };

  const handleToggleProductStock = async (
    productId: string,
    nextInStock: boolean
  ) => {
    let updatedRef: ProductItem | null = null;
    let syncedFullSets: ProductItem[] = [];

    setProducts((prev) => {
      const nextCatalog = prev.map((p) => {
        if (p.id !== productId) return p;
        const toggled = toggleProductInStockState(p, nextInStock);
        updatedRef = toggled;
        return toggled;
      });
      const withSyncedSets = syncFullSetsWithCatalog(nextCatalog);
      syncedFullSets = withSyncedSets.filter((p) => p.isFullSet);
      pushServerCatalogPatch({ products: withSyncedSets });
      return withSyncedSets;
    });

    setActiveProductModal((prev) => {
      if (!prev) return prev;
      if (prev.id === productId && updatedRef) return updatedRef;
      const syncedSet = syncedFullSets.find((s) => s.id === prev.id);
      return syncedSet || prev;
    });

    if (
      updatedRef &&
      currentUser &&
      isAuthorizedAdminEmail(currentUser.email, admins)
    ) {
      const target = updatedRef as ProductItem;
      try {
        await updateDoc(doc(db, 'products', productId), {
          sizeQuantities: target.sizeQuantities,
          colorVariants: target.colorVariants || [],
          quantity: target.quantity,
          inStock: target.inStock,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `products/${productId}`
          );
        } catch {}
      }
    }
  };

  const handleUpdateSiteBanners = async (nextBanners: SiteBannersConfig) => {
    const merged = mergeSiteBannersConfig(nextBanners, categories);
    setSiteBanners(merged);
    try {
      localStorage.setItem(STORAGE_KEYS.siteBanners, JSON.stringify(merged));
    } catch {}
    pushServerCatalogPatch({ siteBanners: merged });
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        const cleaned = deepCleanFirestorePayload({
          ...merged,
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'settings', 'site_banners_v2'), cleaned);
        console.log('[SAMO Atelier] Synced site_banners_v2 to Firestore successfully');
      } catch (err) {
        console.error('[SAMO Atelier] Failed to sync site_banners_v2 to Firestore:', err);
      }
    } else {
      console.warn(
        '[SAMO Atelier] Banners saved locally & server; sign in via Google Admin to sync to Firestore cloud'
      );
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setDeletedProductIds((prev) => {
      const nextDeleted = Array.from(new Set([...prev, id]));
      setProducts((currProds) => {
        const nextProds = currProds.filter((p) => p.id !== id);
        pushServerCatalogPatch({
          products: nextProds,
          deletedProductIds: nextDeleted,
        });
        return nextProds;
      });
      return nextDeleted;
    });
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
        } catch {}
      }
    }
  };

  const handleAddPromoCode = async (promo: Omit<PromoCodeItem, 'id'>) => {
    const id = `promo-${createSafeSlug(promo.code)}`;
    const newPromo: PromoCodeItem = {
      ...promo,
      id,
      createdAt: new Date().toISOString(),
    };
    setPromoCodes((prev) => [
      newPromo,
      ...prev.filter((p) => p.code.toUpperCase() !== promo.code.toUpperCase()),
    ]);

    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await setDoc(doc(db, 'promo_codes', id), {
          code: newPromo.code,
          discountType: newPromo.discountType,
          discountValue: newPromo.discountValue,
          active: newPromo.active,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, `promo_codes/${id}`);
        } catch {}
      }
    }
  };

  const handleDeletePromoCode = async (id: string) => {
    setPromoCodes((prev) => prev.filter((p) => p.id !== id));
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await deleteDoc(doc(db, 'promo_codes', id));
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.DELETE, `promo_codes/${id}`);
        } catch {}
      }
    }
  };

  const handleAddCustomMaterial = async (materialName: string) => {
    const clean = materialName.trim().slice(0, 60);
    if (!clean) return;
    setCustomMaterials((prev) =>
      prev.includes(clean) ? prev : [...prev, clean]
    );
    const id = `mat-${createSafeSlug(clean)}`;
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await setDoc(doc(db, 'materials', id), {
          name: clean,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, `materials/${id}`);
        } catch {}
      }
    }
  };

  const handleAddCustomColor = async (colorName: string) => {
    const clean = colorName.trim().slice(0, 40);
    if (!clean) return;
    setCustomColors((prev) =>
      prev.some((c) => c.toLowerCase() === clean.toLowerCase())
        ? prev
        : [...prev, clean]
    );
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus
  ) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const wasAlreadyAccepted = targetOrder?.status === 'accepted';

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );

    // When admin accepts an order, reduce the stock quantity of the bought size(s) / color(s)
    if (targetOrder && status === 'accepted' && !wasAlreadyAccepted) {
      const updatedCatalog = decrementStockForAcceptedOrder(
        products,
        targetOrder
      );
      setProducts(updatedCatalog);

      if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
        for (const updatedItem of updatedCatalog) {
          const prevItem = products.find((p) => p.id === updatedItem.id);
          if (
            prevItem &&
            (prevItem.quantity !== updatedItem.quantity ||
              updatedItem.isFullSet)
          ) {
            try {
              await updateDoc(doc(db, 'products', updatedItem.id), {
                sizeQuantities: updatedItem.sizeQuantities,
                setItems: updatedItem.setItems || [],
                colorVariants: updatedItem.colorVariants || [],
                quantity: updatedItem.quantity,
                inStock: updatedItem.inStock,
                updatedAt: serverTimestamp(),
              });
            } catch {}
          }
        }
      }
    }

    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
        } catch {}
      }
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
        } catch {}
      }
    }
  };

  const handleAddAdminByEmail = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const record: AdminRecord = {
      id: cleanEmail,
      email: cleanEmail,
      addedBy: currentUser?.email || 'apolokor@gmail.com',
      createdAt: new Date().toISOString(),
    };
    setAdmins((prev) =>
      prev.some((a) => a.email.toLowerCase() === cleanEmail)
        ? prev
        : [...prev, record]
    );
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await setDoc(doc(db, 'admins', cleanEmail), {
          email: cleanEmail,
          addedBy: currentUser.email,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `admins/${cleanEmail}`
          );
        } catch {}
      }
    }
  };

  const handleRemoveAdminByEmail = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    setAdmins((prev) =>
      prev.filter((a) => a.email.toLowerCase() !== cleanEmail)
    );
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, admins)) {
      try {
        await deleteDoc(doc(db, 'admins', cleanEmail));
      } catch (err) {
        try {
          handleFirestoreError(
            err,
            OperationType.DELETE,
            `admins/${cleanEmail}`
          );
        } catch {}
      }
    }
  };

  // AI Quick Search Filter Handler
  const handleAiQuickSearch = async (query: string) => {
    try {
      const res = await fetch('/api/ai/quick-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchPrompt: query }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.department === 'women') {
        handleNavigate('/women', data.category || 'all');
      } else if (data.department === 'kids') {
        handleNavigate('/kids', data.category || 'all');
      }
    } catch {}
  };

  const womenCategories = useMemo(
    () => getCategoriesByDepartment(categories, 'women'),
    [categories]
  );
  const kidsCategories = useMemo(
    () => getCategoriesByDepartment(categories, 'kids'),
    [categories]
  );

  const activeDepartment: Department | 'all' =
    currentRoute === '/women'
      ? 'women'
      : currentRoute === '/kids'
      ? 'kids'
      : 'all';

  // Compute displayed products based on current route (/new-arrivals, /gifts, /women, /kids)
  const displayedProducts = useMemo(() => {
    let baseList: ProductItem[];
    if (searchQuery.trim()) {
      baseList = filterCatalogProducts(products, {
        department: activeDepartment,
        category: selectedCategory,
        searchQuery,
      });
    } else if (currentRoute === '/new-arrivals') {
      baseList = filterNewArrivalProducts(products);
    } else if (currentRoute === '/gifts') {
      baseList = filterGiftsProducts(products);
    } else if (currentRoute === '/home') {
      baseList = filterNewArrivalProducts(products);
    } else {
      baseList = filterCatalogProducts(products, {
        department: activeDepartment,
        category: selectedCategory,
        searchQuery,
      });
    }

    if (catalogSortBy === 'price-asc') {
      return [...baseList].sort((a, b) => a.price - b.price);
    }
    if (catalogSortBy === 'price-desc') {
      return [...baseList].sort((a, b) => b.price - a.price);
    }
    return baseList;
  }, [
    products,
    currentRoute,
    activeDepartment,
    selectedCategory,
    searchQuery,
    catalogSortBy,
  ]);

  // Resolve active category in-feed banner to appear between products on category pages
  const activeCategoryBanner = useMemo(() => {
    let targetDept: Department = 'women';
    let targetCatName = 'Jacket';

    if (currentRoute === '/kids') {
      targetDept = 'kids';
      targetCatName =
        selectedCategory && selectedCategory !== 'all'
          ? selectedCategory
          : kidsCategories[0]?.name || 'MINIS 1 To 5';
    } else if (currentRoute === '/women') {
      targetDept = 'women';
      targetCatName =
        selectedCategory && selectedCategory !== 'all'
          ? selectedCategory
          : womenCategories[0]?.name || 'Jacket';
    } else if (currentRoute === '/gifts') {
      targetDept = 'women';
      targetCatName = 'Bags';
    } else if (currentRoute === '/new-arrivals') {
      targetDept = 'women';
      targetCatName = 'Jacket';
    }

    const key = getCategoryBannerKey(targetDept, targetCatName);
    const configured =
      siteBanners.categoryBanners?.[key] ||
      buildDefaultCategoryBannerForCategory(targetDept, targetCatName);

    return {
      ...configured,
      department: targetDept,
      categoryName: targetCatName,
    };
  }, [
    currentRoute,
    selectedCategory,
    siteBanners.categoryBanners,
    womenCategories,
    kidsCategories,
  ]);

  const categoryBannerSplitIndex = useMemo(() => {
    if (
      !activeCategoryBanner ||
      !activeCategoryBanner.enabled ||
      !activeCategoryBanner.imageUrl ||
      displayedProducts.length === 0
    ) {
      return -1;
    }
    return getCategoryBannerSplitIndex(
      displayedProducts.length,
      activeCategoryBanner.insertAfterCount
    );
  }, [activeCategoryBanner, displayedProducts.length]);

  // Home Section 2: Category tiles for active department (Women: 4 signature tiles matching Screenshot 1 & 2; Kids: MINIS 1 To 5, CHILDREN 6+, Teen 13+)
  const homeCategoryTiles = useMemo(() => {
    const preferredWomenNames = ['Bags', 'Jacket', 'Trench Coat', 'Full Set'];
    const activeCats =
      homeCategoryDept === 'women'
        ? [
            ...preferredWomenNames
              .map((name) =>
                womenCategories.find(
                  (c) => c.name.toLowerCase() === name.toLowerCase()
                )
              )
              .filter((c): c is CategoryItem => Boolean(c)),
            ...womenCategories.filter(
              (c) =>
                !preferredWomenNames.some(
                  (n) => n.toLowerCase() === c.name.toLowerCase()
                )
            ),
          ].slice(0, 4)
        : kidsCategories;
    const fallbackStudioMap: Record<string, { src: string; style: StyleType }> = {
      bags: { src: 'studio://women-bags-hourglass-burgundy', style: 'Accessories' },
      jacket: { src: 'studio://women-jacket-leather-biker', style: 'Fine Leather' },
      'trench coat': { src: 'studio://women-trench-suede-coat', style: 'Suede' },
      fur: { src: 'studio://women-fur-opera-coat', style: 'Fur' },
      trousers: { src: 'studio://women-trousers-wide-leather', style: 'Classic' },
      pants: { src: 'studio://women-pants-suede-flare', style: 'Suede' },
      skirts: { src: 'studio://women-skirts-pleated-leather', style: 'Sport Chic' },
      denim: { src: 'studio://women-denim-raw-indigo', style: 'Sport Chic' },
      tops: { src: 'studio://women-tops-silk-drape', style: 'Classic' },
      'full set': { src: 'studio://women-fullset-monolith', style: 'Fine Leather' },
      belts: { src: 'studio://women-belts-double-buckle', style: 'Accessories' },
      'minis 1 to 5': { src: 'studio://kids-baby-cashmere-knit-set', style: 'Classic' },
      'children 6+': { src: 'studio://kids-junior-leather-bomber', style: 'Sport Chic' },
      'teen 13+': { src: 'studio://kids-teen-suede-varsity', style: 'Suede' },
    };

    return activeCats.map((cat) => {
      const catLower = cat.name.toLowerCase();
      const matchingProd = products.find(
        (p) =>
          p.department === homeCategoryDept &&
          (p.category.toLowerCase() === catLower ||
            (catLower === 'full set' &&
              p.department === 'women' &&
              Boolean(p.isFullSet)))
      );
      const fallback = fallbackStudioMap[cat.name.toLowerCase()] || {
        src: 'studio://women-jacket-leather-biker',
        style: 'Fine Leather' as StyleType,
      };
      return {
        category: cat,
        imageUrl: matchingProd?.imageUrl || fallback.src,
        styleType: matchingProd?.style || fallback.style,
      };
    });
  }, [homeCategoryDept, womenCategories, kidsCategories, products]);

  // Home New Arrivals Carousel Products filtered by Women | Kids switcher
  const homeNewArrivalsProducts = useMemo(() => {
    const deptNewArrivals = filterNewArrivalProducts(products).filter(
      (p) => p.department === homeNewArrivalsDept
    );
    if (deptNewArrivals.length > 0) return deptNewArrivals;
    return filterCatalogProducts(products, {
      department: homeNewArrivalsDept,
      category: 'all',
      searchQuery: '',
    });
  }, [products, homeNewArrivalsDept]);

  const handleNewArrivalsScroll = () => {
    const el = newArrivalsScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 4) {
      setNewArrivalsScrollProgress(100);
      return;
    }
    const ratio = Math.min(1, Math.max(0, el.scrollLeft / maxScroll));
    setNewArrivalsScrollProgress(Math.round(25 + ratio * 75));
  };

  const scrollNewArrivalsCarousel = (direction: -1 | 1) => {
    const el = newArrivalsScrollRef.current;
    if (!el) return;
    const step = Math.max(280, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const totalCartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  // ROUTE: /admin — Strictly isolated Admin Mode
  if (currentRoute === '/admin') {
    return (
      <AdminDashboard
        currentUser={currentUser}
        aiAdminUnlocked={aiAdminUnlocked}
        onUnlockAiAdmin={() => {
          setAiAdminUnlocked(true);
          try {
            localStorage.setItem(STORAGE_KEYS.aiAdmin, 'true');
          } catch {}
        }}
        onGoogleSignIn={async () => {
          await signInWithPopup(auth, googleProvider);
        }}
        onSignOut={async () => {
          await firebaseSignOut(auth);
          setAiAdminUnlocked(false);
          try {
            localStorage.removeItem(STORAGE_KEYS.aiAdmin);
          } catch {}
        }}
        onNavigateHome={(route) => handleNavigate(route)}
        categories={categories}
        products={products}
        promoCodes={promoCodes}
        customMaterials={customMaterials}
        customColors={customColors}
        orders={orders}
        preorders={preorders}
        admins={admins}
        siteBanners={siteBanners}
        onUpdateSiteBanners={handleUpdateSiteBanners}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onAddProduct={handleAddProduct}
        onUpdateProductSizeQuantity={handleUpdateProductSizeQuantity}
        onUpdateProductColorVariants={handleUpdateProductColorVariants}
        onUpdateProductMeta={handleUpdateProductMeta}
        onToggleProductStock={handleToggleProductStock}
        onDeleteProduct={handleDeleteProduct}
        onAddPromoCode={handleAddPromoCode}
        onDeletePromoCode={handleDeletePromoCode}
        onAddCustomMaterial={handleAddCustomMaterial}
        onAddCustomColor={handleAddCustomColor}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onDeleteOrder={handleDeleteOrder}
        onUpdatePreorderStatus={handleUpdatePreorderStatus}
        onDeletePreorder={handleDeletePreorder}
        onAddAdminByEmail={handleAddAdminByEmail}
        onRemoveAdminByEmail={handleRemoveAdminByEmail}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-950">
      {/* Top Bar (Centered SAMO Logo, Left Links) & Search Bar */}
      <Navbar
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        womenCategories={womenCategories}
        kidsCategories={kidsCategories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAiQuickSearch={handleAiQuickSearch}
        cartCount={totalCartCount}
        onOpenCart={() => {
          setCartDrawerInitialStep('cart');
          setCartDrawerOpen(true);
        }}
        onOpenAiStylist={() => setAiStylistOpen(true)}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1">
        {/* ROUTE: /showroom — Dedicated SAMO Heritage (Since 1999) & Showroom Map Page */}
        {currentRoute === '/showroom' && !searchQuery ? (
          <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 space-y-14">
            {/* Showroom Hero & Heritage Story Since 1999 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 border border-zinc-950 bg-white overflow-hidden">
              <div className="lg:col-span-6 aspect-[4/5] lg:aspect-auto min-h-[420px] border-b lg:border-b-0 lg:border-r border-zinc-950 bg-[#EFEFEF]">
                <ProductImage
                  src={
                    siteBanners.showroomHeroBannerUrl ||
                    'studio://women-trench-suede-coat'
                  }
                  alt="SAMO Flagship Showroom & Atelier — Established 1999"
                  category="Trench Coat"
                  styleType="Suede"
                  className="h-full w-full"
                />
              </div>
              <div className="lg:col-span-6 p-8 md:p-14 flex flex-col justify-between space-y-8">
                <div className="space-y-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                    SAMO HOUSE HERITAGE · ESTABLISHED 1999
                  </div>
                  <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-[0.1em] uppercase text-zinc-950 leading-tight">
                    THE HOUSE OF SAMO — SINCE 1999
                  </h1>
                  <p className="text-xs md:text-sm text-zinc-700 leading-relaxed">
                    Founded in 1999, SAMO began as a dedicated leather and suede atelier crafting architectural outerwear, custom hides, and sculptural silhouettes. For over two decades, the house has remained true to its founding discipline: uncompromising raw materials—full-grain Italian cow leather, velvety calf suede, shearling fur, combed cashmere, and heavy silk—paired with bold, modernist tailoring.
                  </p>
                  <p className="text-xs md:text-sm text-zinc-700 leading-relaxed">
                    Today, the SAMO Showroom brings together our 11-category Women’s ready-to-wear and accessories archive alongside our precision centimeter-graded Kids collection (Baby, Junior, and Teen). Every garment is cut, finished, and inspected to the same exacting standards established in our studio in 1999.
                  </p>
                </div>

                <div className="pt-6 border-t border-zinc-200 grid grid-cols-3 gap-4 font-mono-tabular">
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-zinc-950">1999</div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Year Founded
                    </div>
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-zinc-950">14</div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      House Categories
                    </div>
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-zinc-950">100%</div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Atelier Grade Hides
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visit Our Showroom & Architectural Map Section */}
            <div className="border border-zinc-950 bg-zinc-950 text-white grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              <div className="lg:col-span-5 p-8 md:p-12 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                    <MapPin className="w-4 h-4 text-white" />
                    <span>FLAGSHIP DESTINATION</span>
                  </div>
                  <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-[0.12em] uppercase text-white">
                    VISIT OUR SHOWROOM
                  </h2>
                  <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                    Experience SAMO’s Fine Leather, Suede, Fur, and Kids collections in person. Private fittings, bespoke leather sizing consultations, and boutique order pickups are available daily.
                  </p>
                  <div className="pt-2 space-y-1 text-xs font-mono-tabular text-zinc-300">
                    <div>HOURS: MONDAY – SATURDAY · 10:00 AM – 8:00 PM</div>
                    <div>SERVICES: PRIVATE STYLING · BOUTIQUE PICKUP · ARCHIVE VIEWING</div>
                  </div>
                </div>

                <div className="pt-4">
                  <a
                    href="https://maps.app.goo.gl/3i4C59ucrmTFBvmx5"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 px-7 py-4 bg-white text-zinc-950 text-xs font-bold tracking-[0.16em] uppercase hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    <span>Open Showroom Location in Google Maps</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Monochrome Architectural Map Plate Styled to Match Website */}
              <div className="lg:col-span-7 relative min-h-[380px] bg-zinc-900 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col justify-between p-8 overflow-hidden">
                {/* Architectural Grid & Street Vector Overlay */}
                <svg
                  viewBox="0 0 800 500"
                  className="absolute inset-0 w-full h-full object-cover opacity-35"
                  aria-hidden="true"
                >
                  <defs>
                    <pattern
                      id="samo-map-grid"
                      width="40"
                      height="40"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="#52525b"
                        strokeWidth="0.7"
                      />
                    </pattern>
                  </defs>
                  <rect width="800" height="500" fill="url(#samo-map-grid)" />
                  <path
                    d="M 0 140 L 800 220 M 180 0 L 310 500 M 540 0 L 460 500 M 0 360 L 800 310 M 90 0 L 720 500"
                    stroke="#a1a1aa"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <path
                    d="M 240 165 L 510 192 L 485 332 L 265 345 Z"
                    fill="#27272a"
                    stroke="#e4e4e7"
                    strokeWidth="1.5"
                  />
                </svg>

                <div className="relative z-10 flex items-center justify-between text-[11px] font-mono-tabular uppercase tracking-widest text-zinc-400">
                  <span>SAMO ARCHITECTURAL MAP PLATE</span>
                  <span>EST. 1999</span>
                </div>

                {/* Center Map Pin Card */}
                <div className="relative z-10 my-auto mx-auto max-w-sm w-full bg-zinc-950/95 border border-white p-6 text-center space-y-3 shadow-2xl">
                  <div className="w-10 h-10 mx-auto bg-white text-zinc-950 flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="font-display text-sm font-extrabold tracking-[0.16em] uppercase text-white">
                    SAMO FLAGSHIP SHOWROOM
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Click below to launch turn-by-turn navigation directly to the SAMO Showroom on Google Maps.
                  </p>
                  <a
                    href="https://maps.app.goo.gl/3i4C59ucrmTFBvmx5"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-white text-zinc-950 text-[11px] font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-1.5 hover:bg-zinc-200 transition-colors"
                  >
                    <span>View on Google Maps</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="relative z-10 flex items-center justify-between text-[10px] font-mono-tabular uppercase tracking-widest text-zinc-400">
                  <span>MAPS.APP.GOO.GL/3I4C59UCRMTFBVMX5</span>
                  <span>DIRECT DIRECTIONS</span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* ROUTE: /home (Campaign Hero + Editorial 2-Col + Full-Bleed Kids Hero Image + 4-Item New Arrivals + Discover the House) */}
            {currentRoute === '/home' && !searchQuery && (
              <>
                {/* Section 1: Full-Bleed Campaign Video / Image Hero (Configurable in /admin) */}
                <HeroVideoSection
                  onNavigate={handleNavigate}
                  onSelectCategory={setSelectedCategory}
                  mediaType={siteBanners.homeHeroMediaType}
                  videoUrl={siteBanners.homeHeroVideoUrl}
                  imageUrl={siteBanners.homeHeroImageUrl}
                  kicker={siteBanners.homeHeroKicker}
                  title={siteBanners.homeHeroTitle}
                />

                {/* Section 2: Prada-Inspired Categories Section under Hero Video (Women | Kids Switcher + 2-Col Mobile / 4-Col Desktop 4:5 Studio Grid) */}
                <section className="w-full bg-white pt-10 pb-8">
                  <div className="max-w-xl mx-auto px-6 text-center space-y-5 mb-7">
                    <p className="text-xs sm:text-[13px] text-zinc-800 leading-relaxed font-normal">
                      Rooted in memory and shaped by transformation, evolving forms
                      and refined details reveal new expressions of individuality.
                    </p>

                    {/* Women | Kids Department Switcher Tabs */}
                    <div
                      className="flex items-center justify-center gap-7"
                      role="tablist"
                      aria-label="Select Department Categories"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={homeCategoryDept === 'women'}
                        onClick={() => setHomeCategoryDept('women')}
                        className={`pb-1.5 text-xs sm:text-[13px] tracking-[0.02em] transition-colors cursor-pointer ${
                          homeCategoryDept === 'women'
                            ? 'font-semibold text-zinc-950 border-b-2 border-zinc-950'
                            : 'font-normal text-zinc-500 hover:text-zinc-950 border-b-2 border-transparent'
                        }`}
                      >
                        Women
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={homeCategoryDept === 'kids'}
                        onClick={() => setHomeCategoryDept('kids')}
                        className={`pb-1.5 text-xs sm:text-[13px] tracking-[0.02em] transition-colors cursor-pointer ${
                          homeCategoryDept === 'kids'
                            ? 'font-semibold text-zinc-950 border-b-2 border-zinc-950'
                            : 'font-normal text-zinc-500 hover:text-zinc-950 border-b-2 border-transparent'
                        }`}
                      >
                        Kids
                      </button>
                    </div>
                  </div>

                  {/* Edge-to-Edge 2-Column Mobile / 4-Column Desktop 4:5 Category Tiles */}
                  <div
                    className={`grid grid-cols-2 ${
                      homeCategoryTiles.length === 3
                        ? 'lg:grid-cols-3'
                        : 'lg:grid-cols-4'
                    } gap-x-[2px] gap-y-2 bg-white`}
                  >
                    {homeCategoryTiles.map(({ category, imageUrl, styleType }) => (
                      <div
                        key={category.id}
                        onClick={() =>
                          handleNavigate(
                            homeCategoryDept === 'women' ? '/women' : '/kids',
                            category.name
                          )
                        }
                        className="group cursor-pointer bg-white flex flex-col"
                      >
                        <div className="aspect-[4/5] w-full bg-[#EFEFEF] overflow-hidden">
                          <ProductImage
                            src={imageUrl}
                            alt={`${category.name}`}
                            category={category.name}
                            styleType={styleType}
                            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.02]"
                          />
                        </div>
                        <div className="py-4 px-2 text-center bg-white">
                          <h2 className="text-xs sm:text-[13px] font-semibold tracking-[0.01em] text-zinc-950 group-hover:underline">
                            {homeCategoryDept === 'women'
                              ? `Women's ${category.name}`
                              : category.name}
                          </h2>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Section 3: Full-Bleed Middle Campaign Image Box (Configurable in /admin) */}
                <section className="relative w-full h-[74vh] min-h-[520px] max-h-[820px] bg-zinc-950 overflow-hidden border-y border-zinc-950">
                  <div className="h-full w-full opacity-90">
                    <ProductImage
                      src={
                        siteBanners.homeMiddleBannerUrl ||
                        'studio://kids-junior-leather-bomber'
                      }
                      alt={
                        siteBanners.homeMiddleTitle ||
                        'SAMO Kids Campaign — MINIS 1 To 5, CHILDREN 6+ & Teen 13+'
                      }
                      category="CHILDREN 6+"
                      styleType="Sport Chic"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Measured contrast scrim matching top HeroVideoSection */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25" />

                  {/* Bottom-Center Campaign Title, Text & Rectangular White CTA Button */}
                  <div className="absolute inset-x-0 bottom-10 z-20 flex flex-col items-center px-4 text-center">
                    <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-zinc-200 mb-2">
                      {siteBanners.homeMiddleKicker ||
                        'SAMO KIDS ATELIER · MINIS 1 TO 5 (80–100 CM) · CHILDREN 6+ (100–130 CM) · TEEN 13+ (130–160 CM)'}
                    </p>
                    <h2
                      className="font-display text-white font-extrabold tracking-[0.14em] uppercase mb-3"
                      style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', textWrap: 'balance' }}
                    >
                      {siteBanners.homeMiddleTitle || 'SAMO KIDS COLLECTION'}
                    </h2>
                    <p className="text-xs md:text-sm text-zinc-200 max-w-xl mb-6 leading-relaxed">
                      {siteBanners.homeMiddleSubtitle ||
                        'Architectural silhouettes in supple cow leather, brushed suede, and combed cashmere graded in precision centimeter sizing.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleNavigate('/kids');
                          setSelectedCategory('all');
                        }}
                        className="min-w-[180px] px-7 py-3.5 bg-white text-zinc-950 border border-zinc-950 text-xs font-bold tracking-[0.14em] uppercase hover:bg-zinc-950 hover:text-white hover:border-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Explore Kids
                      </button>
                    </div>
                  </div>
                </section>

                {/* Section 4: Prada-Inspired "New Arrivals" Horizontal 4:5 Carousel with Women | Kids Switcher & Progress Bar (Compact Height) */}
                <section className="w-full bg-white py-7 sm:py-8">
                  <div className="max-w-xl mx-auto px-6 text-center space-y-2 mb-4">
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950">
                      New Arrivals
                    </h2>
                    <p className="text-xs sm:text-[13px] text-zinc-800 leading-relaxed font-normal">
                      Rooted in memory and shaped by transformation, evolving forms
                      and refined details reveal new expressions of individuality.
                    </p>

                    <div
                      className="pt-0.5 flex items-center justify-center gap-7"
                      role="tablist"
                      aria-label="New Arrivals Department Switcher"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={homeNewArrivalsDept === 'women'}
                        onClick={() => {
                          setHomeNewArrivalsDept('women');
                          setNewArrivalsScrollProgress(28);
                          if (newArrivalsScrollRef.current) {
                            newArrivalsScrollRef.current.scrollTo({
                              left: 0,
                              behavior: 'smooth',
                            });
                          }
                        }}
                        className={`pb-1 text-xs sm:text-[13px] tracking-[0.02em] transition-colors cursor-pointer ${
                          homeNewArrivalsDept === 'women'
                            ? 'font-semibold text-zinc-950 border-b-2 border-zinc-950'
                            : 'font-normal text-zinc-500 hover:text-zinc-950 border-b-2 border-transparent'
                        }`}
                      >
                        Women
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={homeNewArrivalsDept === 'kids'}
                        onClick={() => {
                          setHomeNewArrivalsDept('kids');
                          setNewArrivalsScrollProgress(28);
                          if (newArrivalsScrollRef.current) {
                            newArrivalsScrollRef.current.scrollTo({
                              left: 0,
                              behavior: 'smooth',
                            });
                          }
                        }}
                        className={`pb-1 text-xs sm:text-[13px] tracking-[0.02em] transition-colors cursor-pointer ${
                          homeNewArrivalsDept === 'kids'
                            ? 'font-semibold text-zinc-950 border-b-2 border-zinc-950'
                            : 'font-normal text-zinc-500 hover:text-zinc-950 border-b-2 border-transparent'
                        }`}
                      >
                        Kids
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Swipeable / Scrollable 4:5 Carousel (Slightly smaller height) */}
                  <div className="relative w-full group/carousel">
                    <div
                      ref={newArrivalsScrollRef}
                      onScroll={handleNewArrivalsScroll}
                      className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-[2px] bg-white"
                    >
                      {homeNewArrivalsProducts.map((product) => (
                        <article
                          key={product.id}
                          onClick={() => setActiveProductModal(product)}
                          className="w-[62vw] sm:w-[40vw] lg:w-[calc(25%-1.5px)] shrink-0 snap-start cursor-pointer group bg-white flex flex-col"
                        >
                          <div className="aspect-[4/5] max-h-[310px] sm:max-h-[340px] lg:max-h-[360px] w-full bg-[#EFEFEF] overflow-hidden relative">
                            <ProductImage
                              src={product.imageUrl}
                              alt={product.name}
                              category={product.category}
                              styleType={product.style}
                              className="h-full w-full transition-transform duration-500 group-hover:scale-[1.02]"
                            />
                          </div>
                          <div className="py-2.5 px-3 text-center bg-white">
                            <h3 className="text-xs sm:text-[13px] font-semibold tracking-[0.01em] text-zinc-950 group-hover:underline truncate">
                              {product.name}
                            </h3>
                          </div>
                        </article>
                      ))}
                    </div>

                    {/* Desktop Left / Right Navigation Chevrons */}
                    <button
                      type="button"
                      onClick={() => scrollNewArrivalsCarousel(-1)}
                      aria-label="Scroll New Arrivals Left"
                      className="hidden lg:flex items-center justify-center w-8 h-8 absolute left-3 top-[42%] -translate-y-1/2 z-10 bg-white/80 hover:bg-white text-zinc-950 transition-opacity cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollNewArrivalsCarousel(1)}
                      aria-label="Scroll New Arrivals Right"
                      className="hidden lg:flex items-center justify-center w-8 h-8 absolute right-3 top-[42%] -translate-y-1/2 z-10 bg-white/80 hover:bg-white text-zinc-950 transition-opacity cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Centered Horizontal Scroll Progress Bar (matching Video 1) */}
                  <div className="mt-2.5 flex justify-center px-6">
                    <div className="w-44 sm:w-56 h-[2px] bg-zinc-200 relative overflow-hidden">
                      <div
                        className="h-full bg-zinc-950 transition-all duration-150"
                        style={{
                          width: `${Math.max(20, Math.min(100, newArrivalsScrollProgress))}%`,
                        }}
                      />
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* CATEGORY & PRODUCT LISTING VIEW (/women, /kids, /new-arrivals, /gifts, OR SEARCH) — Matching Video 2 & Screenshot 4 + Mid-Category Editorial Banner */}
            {(currentRoute !== '/home' || Boolean(searchQuery)) && (
              <section className="w-full bg-white pb-16">
                {/* Optional Header Strip for /new-arrivals, /gifts, or active search (since /women & /kids already have the Navbar subcategory bar) */}
                {(currentRoute === '/new-arrivals' ||
                  currentRoute === '/gifts' ||
                  Boolean(searchQuery)) && (
                  <div className="border-b border-zinc-200 px-4 md:px-8 py-4 bg-white">
                    <h1 className="text-sm sm:text-base font-bold tracking-[0.02em] text-zinc-950">
                      {searchQuery
                        ? `Search Results: "${searchQuery}"`
                        : currentRoute === '/new-arrivals'
                        ? 'New Arrivals'
                        : 'Gifts — Bags & Belts'}
                    </h1>
                  </div>
                )}

                {/* Prada-Style Toolbar Row: "{N} PRODUCTS" on Left · "FILTERS · SORT BY" on Right */}
                <div className="px-4 md:px-8 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-2 bg-white">
                  <div className="text-[11px] sm:text-xs font-normal uppercase tracking-[0.06em] text-zinc-500 whitespace-nowrap shrink-0">
                    {displayedProducts.length}{' '}
                    {displayedProducts.length === 1 ? 'PRODUCT' : 'PRODUCTS'}
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-[0.04em] text-zinc-950 whitespace-nowrap">
                    <span>FILTERS</span>
                    <span aria-hidden="true" className="text-zinc-400">
                      ·
                    </span>
                    <label htmlFor="samo-catalog-sort" className="text-zinc-950">
                      SORT BY:
                    </label>
                    <select
                      id="samo-catalog-sort"
                      value={catalogSortBy}
                      onChange={(e) =>
                        setCatalogSortBy(
                          e.target.value as 'suggested' | 'price-asc' | 'price-desc'
                        )
                      }
                      aria-label="Sort products by"
                      className="bg-transparent font-bold uppercase tracking-[0.04em] text-zinc-950 focus:outline-none cursor-pointer"
                    >
                      <option value="suggested">SUGGESTED</option>
                      <option value="price-asc">PRICE: LOW TO HIGH</option>
                      <option value="price-desc">PRICE: HIGH TO LOW</option>
                    </select>
                  </div>
                </div>

                {displayedProducts.length === 0 ? (
                  <div className="max-w-lg mx-auto my-16 text-center border border-zinc-200 bg-zinc-50 p-8 space-y-4">
                    <p className="font-display text-sm font-bold uppercase tracking-[0.14em] text-zinc-700">
                      No pieces match your current selection
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSearchQuery('');
                      }}
                      className="px-5 py-2.5 bg-zinc-950 text-white text-xs font-bold uppercase tracking-[0.14em] cursor-pointer"
                    >
                      Reset Catalog View
                    </button>
                  </div>
                ) : (
                  /* Edge-to-Edge 2-Column Mobile / 4-Column Desktop 4:5 Product Grid with Thin White Separating Line + Mid-Category Editorial Banner */
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-[2px] gap-y-6 lg:gap-y-8 bg-white">
                    {categoryBannerSplitIndex > 0 ? (
                      <>
                        {/* First Batch of Products before Category Editorial Banner */}
                        {displayedProducts
                          .slice(0, categoryBannerSplitIndex)
                          .map((product) => (
                            <CatalogProductCard
                              key={product.id}
                              product={product}
                              onSelectProduct={(prod) => setActiveProductModal(prod)}
                            />
                          ))}

                        {/* Full-Width Mid-Category Editorial Image Banner (Managed in /admin) */}
                        <div
                          data-testid="category-infeed-banner"
                          className="col-span-2 lg:col-span-4 my-2 relative w-full h-[38vh] sm:h-[46vh] min-h-[260px] max-h-[480px] bg-zinc-950 overflow-hidden border-y border-zinc-950"
                        >
                          <div className="h-full w-full opacity-90">
                            <ProductImage
                              src={activeCategoryBanner.imageUrl}
                              alt={
                                activeCategoryBanner.title ||
                                `${activeCategoryBanner.categoryName} Editorial`
                              }
                              category={activeCategoryBanner.categoryName}
                              styleType="Fine Leather"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/15" />
                          <div className="absolute inset-x-0 bottom-6 sm:bottom-8 z-10 px-5 sm:px-10 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-300">
                                {activeCategoryBanner.kicker ||
                                  'SAMO ATELIER CURATION · HAND-FINISHED IN OUR STUDIO'}
                              </div>
                              <h2 className="font-display text-lg sm:text-2xl md:text-3xl font-extrabold uppercase tracking-[0.12em] text-white">
                                {activeCategoryBanner.title ||
                                  `SAMO ${activeCategoryBanner.categoryName.toUpperCase()} ARCHIVE`}
                              </h2>
                            </div>
                            <span className="text-[10px] font-mono-tabular uppercase tracking-[0.18em] text-zinc-300 border border-white/30 bg-black/40 px-3 py-1.5 self-start sm:self-auto">
                              {activeCategoryBanner.department.toUpperCase()} ·{' '}
                              {activeCategoryBanner.categoryName.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Remaining Products after Category Editorial Banner */}
                        {displayedProducts
                          .slice(categoryBannerSplitIndex)
                          .map((product) => (
                            <CatalogProductCard
                              key={product.id}
                              product={product}
                              onSelectProduct={(prod) => setActiveProductModal(prod)}
                            />
                          ))}
                      </>
                    ) : (
                      displayedProducts.map((product) => (
                        <CatalogProductCard
                          key={product.id}
                          product={product}
                          onSelectProduct={(prod) => setActiveProductModal(prod)}
                        />
                      ))
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Section 5 (Requirement #7): DISCOVER THE HOUSE (New Arrivals, Gifts [Belts & Bags], Showroom [Since 1999 + Map]) */}
            {currentRoute === '/home' && !searchQuery && (
              <section className="max-w-[1440px] mx-auto px-4 md:px-8 pb-16 pt-4">
                <div className="border-t border-zinc-200 pt-10 mb-8 flex items-center justify-between">
                  <h2 className="font-display text-lg md:text-xl font-extrabold tracking-[0.14em] uppercase text-zinc-950">
                    DISCOVER THE HOUSE
                  </h2>
                  <span className="text-[11px] font-mono-tabular uppercase tracking-widest text-zinc-500">
                    SAMO ARCHIVE &amp; CURATIONS
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Box 1: New Arrivals */}
                  <div
                    onClick={() => handleNavigate('/new-arrivals')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNavigate('/new-arrivals');
                      }
                    }}
                    className="group cursor-pointer border border-zinc-200 hover:border-zinc-950 bg-white flex flex-col justify-between transition-all"
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden border-b border-zinc-100">
                      <ProductImage
                        src={
                          siteBanners.homeBottomNewArrivalsUrl ||
                          'studio://women-fur-opera-coat'
                        }
                        alt="Discover New Arrivals"
                        category="Fur"
                        styleType="Fur"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                          LATEST RUNWAY RELEASES
                        </div>
                        <h3 className="font-display text-sm md:text-base font-extrabold tracking-[0.14em] uppercase text-zinc-950 group-hover:underline mt-0.5">
                          NEW ARRIVALS
                        </h3>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-950" />
                    </div>
                  </div>

                  {/* Box 2: Gifts (All Belts & Bags) */}
                  <div
                    onClick={() => handleNavigate('/gifts')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNavigate('/gifts');
                      }
                    }}
                    className="group cursor-pointer border border-zinc-200 hover:border-zinc-950 bg-white flex flex-col justify-between transition-all"
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden border-b border-zinc-100">
                      <ProductImage
                        src={
                          siteBanners.homeBottomGiftsUrl ||
                          'studio://women-bags-hourglass-burgundy'
                        }
                        alt="Discover Gifts — Bags & Belts"
                        category="Bags"
                        styleType="Accessories"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                          LEATHER BAGS &amp; BELTS CURATION
                        </div>
                        <h3 className="font-display text-sm md:text-base font-extrabold tracking-[0.14em] uppercase text-zinc-950 group-hover:underline mt-0.5">
                          GIFTS
                        </h3>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-950" />
                    </div>
                  </div>

                  {/* Box 3: Showroom (Since 1999 & Map) */}
                  <div
                    onClick={() => handleNavigate('/showroom')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNavigate('/showroom');
                      }
                    }}
                    className="group cursor-pointer border border-zinc-200 hover:border-zinc-950 bg-white flex flex-col justify-between transition-all"
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden border-b border-zinc-100">
                      <ProductImage
                        src={
                          siteBanners.homeBottomShowroomUrl ||
                          'studio://women-trench-suede-coat'
                        }
                        alt="Discover SAMO Showroom — Since 1999"
                        category="Trench Coat"
                        styleType="Suede"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                          HOUSE HERITAGE SINCE 1999 · VISIT US
                        </div>
                        <h3 className="font-display text-sm md:text-base font-extrabold tracking-[0.14em] uppercase text-zinc-950 group-hover:underline mt-0.5">
                          SHOWROOM
                        </h3>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-950" />
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* SOLE ITEM POP-UP MODAL */}
      <ProductModal
        product={activeProductModal}
        onClose={() => setActiveProductModal(null)}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        onSubmitPreorder={handleSubmitPreorder}
      />

      {/* SHOPPING BAG & FULL LOCATION CHECKOUT DRAWER */}
      <CartCheckoutDrawer
        isOpen={cartDrawerOpen}
        initialStep={cartDrawerInitialStep}
        cartItems={cartItems}
        products={products}
        promoCodes={promoCodes}
        onClose={() => setCartDrawerOpen(false)}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onAddToCart={handleAddToCart}
        onSelectProduct={(prod) => setActiveProductModal(prod)}
        onSubmitOrder={handleSubmitOrder}
      />

      {/* AI ATELIER STYLIST MODAL */}
      <AiStylistModal
        isOpen={aiStylistOpen}
        onClose={() => setAiStylistOpen(false)}
        onSelectDepartment={(dept, cat) => {
          handleNavigate(dept === 'women' ? '/women' : '/kids', cat || 'all');
        }}
      />

      {/* BALENCIAGA-INSPIRED ARCHITECTURAL MULTI-COLUMN FOOTER */}
      <footer className="bg-[#D4D4D4] text-zinc-950 border-t border-zinc-950 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-zinc-400 border-b border-zinc-400">
          {/* Col 1: Newsletter */}
          <div className="p-6 space-y-3">
            <div className="font-display font-bold uppercase tracking-[0.14em]">
              SAMO Newsletter
            </div>
            {newsletterSubscribed ? (
              <p className="text-[11px] font-medium text-emerald-900">
                Subscribed to SAMO Atelier dispatches.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newsletterEmail.trim()) {
                    setNewsletterSubscribed(true);
                    setNewsletterEmail('');
                  }
                }}
                className="space-y-2"
              >
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter client email..."
                  className="w-full px-2.5 py-1.5 text-[11px] bg-white border border-zinc-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="underline text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  Subscribe to our newsletter
                </button>
              </form>
            )}
          </div>

          {/* Col 2: Women Categories */}
          <div className="p-6 space-y-2">
            <div className="font-display font-bold uppercase tracking-[0.14em] mb-2">
              Women Categories
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              {womenCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleNavigate('/women', c.name)}
                  className="text-left hover:underline truncate cursor-pointer"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Col 3: Kids Categories */}
          <div className="p-6 space-y-2">
            <div className="font-display font-bold uppercase tracking-[0.14em] mb-2">
              Kids (CM Sizing)
            </div>
            <ul className="space-y-1.5 text-[11px]">
              {kidsCategories.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleNavigate('/kids', c.name)}
                    className="hover:underline cursor-pointer"
                  >
                    {c.name} Collection
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Discover the House */}
          <div className="p-6 space-y-2">
            <div className="font-display font-bold uppercase tracking-[0.14em] mb-2">
              Discover the House
            </div>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('/new-arrivals')}
                  className="hover:underline cursor-pointer"
                >
                  New Arrivals
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('/gifts')}
                  className="hover:underline cursor-pointer"
                >
                  Gifts (Bags &amp; Belts)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('/showroom')}
                  className="hover:underline cursor-pointer"
                >
                  Showroom — Since 1999
                </button>
              </li>
            </ul>
          </div>

          {/* Col 5: Materials & Craft */}
          <div className="p-6 space-y-2">
            <div className="font-display font-bold uppercase tracking-[0.14em] mb-2">
              Materials &amp; House
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-800">
              Cow Leather · Suede · Fur · Cashmere · Silk · Wool · Linen · Raw Denim · Satin · Chantilly Lace
            </p>
          </div>

          {/* Col 6: Contact & Routes */}
          <div className="p-6 space-y-2">
            <div className="font-display font-bold uppercase tracking-[0.14em] mb-2">
              Direct Routes
            </div>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <a
                  href="/home"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate('/home');
                  }}
                  className="underline"
                >
                  domain.com/home
                </a>
              </li>
              <li>
                <a
                  href="/new-arrivals"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate('/new-arrivals');
                  }}
                  className="underline"
                >
                  domain.com/new-arrivals
                </a>
              </li>
              <li>
                <a
                  href="/gifts"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate('/gifts');
                  }}
                  className="underline"
                >
                  domain.com/gifts
                </a>
              </li>
              <li>
                <a
                  href="/showroom"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate('/showroom');
                  }}
                  className="underline"
                >
                  domain.com/showroom
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-[11px] uppercase tracking-wider text-zinc-800">
          <span>© 2026 SAMO LUXURY HOUSE (EST. 1999) — ALL RIGHTS RESERVED</span>
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('/admin');
            }}
            className="text-[10px] text-zinc-700 hover:text-zinc-950 underline"
          >
            Atelier Admin Portal (/admin)
          </a>
        </div>
      </footer>
    </div>
  );
}
