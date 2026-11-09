import {
  AdminRecord,
  CategoryBannerConfig,
  CategoryItem,
  DeliveryMethod,
  Department,
  DiscountType,
  NewsletterPopupConfig,
  OrderItem,
  ProductColorVariant,
  ProductItem,
  PromoCodeItem,
  RoutePath,
  SiteBannersConfig,
  SizeType,
} from '../types/samo';

export const PREBUILT_MATERIALS: readonly string[] = [
  'Cow Leather',
  'Suede',
  'Cotton',
  'Wool',
  'Cashmere',
  'Silk',
  'Linen',
  'Denim',
  'Satin',
  'Lace',
];

export const PREBUILT_COLORS: readonly string[] = [
  'Black',
  'Brown',
  'Burgundy',
  'Ivory',
  'Camel',
];

export const LETTER_SIZES: readonly string[] = ['XS', 'S', 'M', 'L', 'XL'];
export const NUMERIC_SIZES: readonly string[] = ['34', '36', '38', '40', '42', '44'];
export const MONTHS_SIZES: readonly string[] = [
  '3-6 Months',
  '6-12 Months',
  '12-18 Months',
  '18-24 Months',
];
export const YEARS_SIZES: readonly string[] = [
  '2-3 Years',
  '4-5 Years',
  '6-7 Years',
  '8-9 Years',
];
export const CM_SIZES: readonly string[] = [
  '80 cm',
  '90 cm',
  '100 cm',
  '110 cm',
  '120 cm',
  '130 cm',
  '140 cm',
  '150 cm',
];

const decodeAdminSig = (sig: string): string => {
  try {
    if (typeof atob !== 'undefined') return atob(sig);
    if (typeof Buffer !== 'undefined') return Buffer.from(sig, 'base64').toString('utf-8');
    return '';
  } catch {
    return '';
  }
};

export const SECURE_PROTECTED_ADMIN_SIGS: readonly string[] = [
  'YXBvbG9rb3JAZ21haWwuY29t',
  'am9leWtvcmFiODhAZ21haWwuY29t',
  'c2Ftb2JvdWdoYXJpb3NAZ21haWwuY29t',
];

export const SUPER_ADMIN_EMAILS: readonly string[] =
  SECURE_PROTECTED_ADMIN_SIGS.map(decodeAdminSig);

/**
 * Maps any color name (prebuilt or custom) to a clean hex swatch code for UI display.
 */
export function getColorSwatchHex(colorName: string): string {
  const c = (colorName || '').trim().toLowerCase();
  const map: Record<string, string> = {
    black: '#111113',
    brown: '#4A2C1D',
    espresso: '#3B2317',
    burgundy: '#5E131D',
    oxblood: '#58111A',
    ivory: '#F4F1EA',
    white: '#FAFAFA',
    camel: '#B88B58',
    beige: '#D6C7B2',
    sand: '#CBB89D',
    grey: '#71717A',
    gray: '#71717A',
    charcoal: '#27272A',
    navy: '#172554',
    blue: '#1E3A8A',
    olive: '#3F4D34',
    green: '#14532D',
    red: '#991B1B',
    gold: '#C5A059',
    silver: '#A1A1AA',
    pink: '#D8B4BB',
    taupe: '#8B7D70',
    cognac: '#7C3F23',
  };
  if (map[c]) return map[c];
  for (const [key, hex] of Object.entries(map)) {
    if (c.includes(key)) return hex;
  }
  return '#52525B';
}

/**
 * Merges 5 prebuilt colors with custom admin-added colors without duplicates.
 */
export function mergeColorsList(customColors: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const col of [...PREBUILT_COLORS, ...customColors]) {
    const clean = col.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }
  return result;
}

/**
 * Maps any browser pathname to one of the canonical routes:
 * /home, /women, /kids, /new-arrivals, /gifts, /showroom, or /admin.
 * Ensures /admin is strictly isolated to the /admin path.
 */
export function parsePathnameToRoute(pathname: string): RoutePath {
  const clean = (pathname || '').trim().toLowerCase().replace(/\/+$/, '');
  if (clean === '/admin' || clean.startsWith('/admin/')) {
    return '/admin';
  }
  if (clean === '/women' || clean.startsWith('/women/')) {
    return '/women';
  }
  if (clean === '/kids' || clean.startsWith('/kids/')) {
    return '/kids';
  }
  if (clean === '/new-arrivals' || clean.startsWith('/new-arrivals/')) {
    return '/new-arrivals';
  }
  if (clean === '/gifts' || clean.startsWith('/gifts/')) {
    return '/gifts';
  }
  if (clean === '/showroom' || clean.startsWith('/showroom/')) {
    return '/showroom';
  }
  return '/home';
}

/**
 * Generates a URL-safe slug matching ^[a-z0-9\-]+$ for Firestore rules compliance.
 */
export function createSafeSlug(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug || 'item';
}

/**
 * Returns a URL-friendly slug for a product based on its name (e.g. 'avenue-heavy-cow-leather-biker-jacket').
 */
export function getProductSlug(product: Pick<ProductItem, 'name' | 'id'>): string {
  return createSafeSlug(product.name || product.id);
}

/**
 * Builds a clean category URL path, e.g.:
 * - /women/jacket
 * - /women/full-set
 * - /kids/minis-1-to-5
 * - /women (when categoryName is 'all' or empty)
 * - /new-arrivals
 * - /gifts
 * - /home
 */
export function buildCategoryUrl(
  routeOrDept: RoutePath | Department | string,
  categoryName?: string
): string {
  const rawClean = (routeOrDept || '').trim().toLowerCase();
  const withLeadingSlash = rawClean.startsWith('/') ? rawClean : `/${rawClean}`;
  const cleanRoute = parsePathnameToRoute(withLeadingSlash);
  if (cleanRoute === '/admin' || cleanRoute === '/showroom') {
    return cleanRoute;
  }
  if (cleanRoute === '/new-arrivals' || cleanRoute === '/gifts') {
    return cleanRoute;
  }
  if (cleanRoute === '/women' || cleanRoute === '/kids') {
    const dept = cleanRoute === '/kids' ? 'kids' : 'women';
    const cat = (categoryName || 'all').trim();
    if (!cat || cat.toLowerCase() === 'all') {
      return `/${dept}`;
    }
    const normalized =
      dept === 'kids' ? normalizeKidsCategoryName(cat) : cat;
    return `/${dept}/${createSafeSlug(normalized)}`;
  }
  return '/home';
}

/**
 * Builds a clean, shareable product URL path, e.g.:
 * - /women/jacket/avenue-heavy-cow-leather-biker-jacket
 * - /kids/minis-1-to-5/baby-cashmere-knit-set
 */
export function buildProductUrl(
  product: ProductItem,
  _fallbackRoute?: RoutePath,
  fallbackCategory?: string
): string {
  const dept = product.department === 'kids' ? 'kids' : 'women';
  const rawCat = product.category || fallbackCategory || 'all';
  const normalizedCat =
    dept === 'kids' ? normalizeKidsCategoryName(rawCat) : rawCat.trim();
  const catSlug =
    normalizedCat.toLowerCase() === 'all'
      ? 'item'
      : createSafeSlug(normalizedCat);
  const prodSlug = getProductSlug(product);

  return `/${dept}/${catSlug}/${prodSlug}`;
}

/**
 * Finds a matching CategoryItem by slug or normalized name in a given department.
 */
export function findCategoryBySlug(
  categories: CategoryItem[],
  slugOrName: string,
  department?: Department
): CategoryItem | undefined {
  const rawClean = (slugOrName || '').trim();
  if (!rawClean) return undefined;
  const targetSlug = createSafeSlug(rawClean);

  return categories.find((c) => {
    if (department && c.department !== department) return false;
    const catSlug = c.slug ? c.slug.toLowerCase() : createSafeSlug(c.name);
    if (catSlug === targetSlug) return true;
    if (createSafeSlug(c.name) === targetSlug) return true;
    if (c.name.trim().toLowerCase() === rawClean.toLowerCase()) return true;

    if (department === 'kids' || c.department === 'kids') {
      const norm = normalizeKidsCategoryName(c.name);
      if (createSafeSlug(norm) === targetSlug) return true;
      const targetNorm = normalizeKidsCategoryName(rawClean);
      if (norm.toLowerCase() === targetNorm.toLowerCase()) return true;
    }
    return false;
  });
}

/**
 * Finds a matching ProductItem by slug, name, or ID.
 */
export function findProductBySlug(
  products: ProductItem[],
  slugOrId: string,
  department?: Department
): ProductItem | undefined {
  const rawClean = (slugOrId || '').trim();
  if (!rawClean) return undefined;
  const targetSlug = createSafeSlug(rawClean);

  // 1. Exact ID match (case-sensitive then insensitive)
  const byId = products.find(
    (p) => p.id === rawClean || p.id.toLowerCase() === rawClean.toLowerCase()
  );
  if (byId) return byId;

  // 2. Slug match within department (if provided)
  if (department) {
    const deptMatch = products.find(
      (p) =>
        p.department === department &&
        (getProductSlug(p) === targetSlug || createSafeSlug(p.name) === targetSlug)
    );
    if (deptMatch) return deptMatch;
  }

  // 3. Slug match across all products
  return products.find(
    (p) => getProductSlug(p) === targetSlug || createSafeSlug(p.name) === targetSlug
  );
}

export interface ParsedCatalogUrlState {
  route: RoutePath;
  selectedCategory: string;
  matchedProduct: ProductItem | null;
  productSlugCandidate?: string;
}

/**
 * Parses any incoming URL path (e.g. /women/jacket, /women/jacket/biker-jacket, /kids/minis-1-to-5)
 * and resolves the matching route, category, and direct product pop-up state.
 */
export function parseCatalogUrlState(
  pathname: string,
  categories: CategoryItem[],
  products: ProductItem[],
  searchParams?: URLSearchParams
): ParsedCatalogUrlState {
  const cleanPath = (pathname || '').trim().replace(/\/+$/, '');
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length === 0) {
    return {
      route: '/home',
      selectedCategory: 'all',
      matchedProduct: null,
    };
  }

  const firstSeg = segments[0].toLowerCase();

  if (firstSeg === 'admin') {
    return { route: '/admin', selectedCategory: 'all', matchedProduct: null };
  }
  if (firstSeg === 'showroom') {
    return { route: '/showroom', selectedCategory: 'all', matchedProduct: null };
  }
  if (firstSeg === 'home') {
    const prodSlug = segments[1];
    const matched = prodSlug ? findProductBySlug(products, prodSlug) : null;
    return {
      route: '/home',
      selectedCategory: 'all',
      matchedProduct: matched || null,
      productSlugCandidate: prodSlug,
    };
  }
  if (firstSeg === 'new-arrivals') {
    const prodSlug = segments[1];
    const matched = prodSlug ? findProductBySlug(products, prodSlug) : null;
    return {
      route: '/new-arrivals',
      selectedCategory: 'all',
      matchedProduct: matched || null,
      productSlugCandidate: prodSlug,
    };
  }
  if (firstSeg === 'gifts') {
    const prodSlug = segments[1];
    const matched = prodSlug ? findProductBySlug(products, prodSlug) : null;
    return {
      route: '/gifts',
      selectedCategory: 'all',
      matchedProduct: matched || null,
      productSlugCandidate: prodSlug,
    };
  }

  if (firstSeg === 'women' || firstSeg === 'kids') {
    const dept: Department = firstSeg as Department;
    const route: RoutePath = `/${dept}` as RoutePath;

    // Check query params fallback (e.g. ?category=... or ?product=...)
    const queryCat = searchParams?.get('category');
    const queryProd = searchParams?.get('product');

    if (segments.length === 1) {
      let matchedProd: ProductItem | null = null;
      let matchedCategory = 'all';

      if (queryCat) {
        const foundCat = findCategoryBySlug(categories, queryCat, dept);
        if (foundCat) matchedCategory = foundCat.name;
      }
      if (queryProd) {
        matchedProd = findProductBySlug(products, queryProd, dept) || null;
        if (matchedProd && matchedCategory === 'all') {
          matchedCategory = matchedProd.category;
        }
      }

      return {
        route,
        selectedCategory: matchedCategory,
        matchedProduct: matchedProd,
      };
    }

    if (segments.length === 2) {
      // Could be /women/jacket (category) OR /women/biker-jacket (product)
      const secondSeg = segments[1];
      const matchedCat = findCategoryBySlug(categories, secondSeg, dept);

      if (matchedCat) {
        let matchedProd: ProductItem | null = null;
        if (queryProd) {
          matchedProd = findProductBySlug(products, queryProd, dept) || null;
        }
        return {
          route,
          selectedCategory: matchedCat.name,
          matchedProduct: matchedProd,
        };
      }

      // Check if second segment is a direct product slug
      const directProd = findProductBySlug(products, secondSeg, dept);
      if (directProd) {
        return {
          route,
          selectedCategory: directProd.category,
          matchedProduct: directProd,
          productSlugCandidate: secondSeg,
        };
      }

      // Fallback: treat as category name
      return {
        route,
        selectedCategory: secondSeg,
        matchedProduct: null,
      };
    }

    // segments.length >= 3: /women/jacket/avenue-heavy-cow-leather-biker-jacket
    const categorySeg = segments[1];
    const productSeg = segments[2];

    const matchedCat = findCategoryBySlug(categories, categorySeg, dept);
    const matchedProd = findProductBySlug(products, productSeg, dept);

    return {
      route,
      selectedCategory: matchedCat?.name || matchedProd?.category || categorySeg,
      matchedProduct: matchedProd || null,
      productSlugCandidate: productSeg,
    };
  }

  // Fallback for any unknown root
  return {
    route: parsePathnameToRoute(pathname),
    selectedCategory: 'all',
    matchedProduct: null,
  };
}

/**
 * Normalizes a size string according to the selected SizeType ('letter' | 'numeric' | 'months' | 'years' | 'cm').
 */
export function normalizeSizeEntry(raw: string, sizeType: SizeType): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (sizeType === 'letter') {
    const upper = trimmed.toUpperCase();
    const aliases: Record<string, string> = {
      XSMALL: 'XS',
      'X-SMALL': 'XS',
      SMALL: 'S',
      MEDIUM: 'M',
      LARGE: 'L',
      XLARGE: 'XL',
      'X-LARGE': 'XL',
    };
    return (aliases[upper] || upper).slice(0, 40);
  }

  if (sizeType === 'numeric') {
    const numMatch = trimmed.match(/\d+/);
    return numMatch ? numMatch[0].slice(0, 10) : trimmed.slice(0, 40);
  }

  if (sizeType === 'months') {
    const mMatch = trimmed.match(/^(\d+(?:\s*[-–]\s*\d+)?)\s*(?:m|mo|mos|months?)?$/i);
    if (mMatch) {
      return `${mMatch[1].replace(/\s+/g, '')} Months`;
    }
    if (!/months?$/i.test(trimmed)) {
      return `${trimmed} Months`.slice(0, 40);
    }
    return trimmed.replace(/months?$/i, 'Months').slice(0, 40);
  }

  if (sizeType === 'years') {
    const yMatch = trimmed.match(/^(\d+(?:\s*[-–]\s*\d+)?)\s*(?:y|yr|yrs|years?)?$/i);
    if (yMatch) {
      return `${yMatch[1].replace(/\s+/g, '')} Years`;
    }
    if (!/years?$/i.test(trimmed)) {
      return `${trimmed} Years`.slice(0, 40);
    }
    return trimmed.replace(/years?$/i, 'Years').slice(0, 40);
  }

  // sizeType === 'cm'
  const cmNumberMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:cm|centimeters?)?$/i);
  if (cmNumberMatch) {
    return `${cmNumberMatch[1]} cm`;
  }
  if (!trimmed.toLowerCase().endsWith('cm')) {
    return `${trimmed} cm`.slice(0, 40);
  }
  return trimmed.slice(0, 40);
}

/**
 * Returns default preset sizes for a given SizeType.
 */
export function getDefaultSizesForType(sizeType: SizeType): string[] {
  if (sizeType === 'letter') return [...LETTER_SIZES];
  if (sizeType === 'numeric') return ['36', '38', '40', '42'];
  if (sizeType === 'months') return [...MONTHS_SIZES];
  if (sizeType === 'years') return [...YEARS_SIZES];
  return ['90 cm', '100 cm', '110 cm', '120 cm', '130 cm'];
}

/**
 * Resolves a single quantity value: if admin did not enter a valid quantity, defaults to 5.
 */
export function resolveProductQuantity(rawInput: string | number | undefined | null): number {
  if (rawInput === undefined || rawInput === null) return 5;
  const str = String(rawInput).trim();
  if (str === '') return 5;
  const parsed = Math.floor(Number(str));
  if (Number.isNaN(parsed) || parsed < 0) return 5;
  return parsed;
}

/**
 * Builds a per-size quantity map where each size defaults to 5 whenever left blank.
 */
export function buildSizeQuantitiesMap(
  sizes: string[],
  rawPerSizeInputs?: Record<string, string | number | undefined | null>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const size of sizes) {
    const raw = rawPerSizeInputs ? rawPerSizeInputs[size] : undefined;
    map[size] = resolveProductQuantity(raw);
  }
  return map;
}

/**
 * Sums total quantity across all sizes of a product.
 */
export function sumSizeQuantities(
  sizes: string[],
  sizeQuantities?: Record<string, number>
): number {
  if (!sizeQuantities || typeof sizeQuantities !== 'object') {
    return sizes.length * 5;
  }
  return sizes.reduce((sum, sz) => {
    const val = sizeQuantities[sz];
    const resolved =
      typeof val === 'number' && !Number.isNaN(val) ? Math.max(0, Math.floor(val)) : 5;
    return sum + resolved;
  }, 0);
}

/**
 * Synchronizes aggregate product fields (sizes, sizeQuantities, quantity, inStock, sizeType)
 * from its colorVariants when hasColors is true.
 */
export function syncProductFromColorVariants(
  colorVariants: ProductColorVariant[],
  fallbackSizeType: SizeType = 'letter'
): {
  sizeType: SizeType;
  sizes: string[];
  sizeQuantities: Record<string, number>;
  quantity: number;
  inStock: boolean;
} {
  const safeVariants = Array.isArray(colorVariants) ? colorVariants : [];
  const combinedSizes: string[] = [];
  const combinedQuantities: Record<string, number> = {};
  let totalQuantity = 0;

  for (const variant of safeVariants) {
    const vSizes = Array.isArray(variant.sizes) ? variant.sizes : [];
    const vMap = buildSizeQuantitiesMap(vSizes, variant.sizeQuantities);
    for (const sz of vSizes) {
      if (!combinedSizes.includes(sz)) {
        combinedSizes.push(sz);
      }
      const q = vMap[sz] ?? 0;
      combinedQuantities[sz] = (combinedQuantities[sz] || 0) + q;
      totalQuantity += q;
    }
  }

  return {
    sizeType: safeVariants[0]?.sizeType || fallbackSizeType,
    sizes: combinedSizes.length > 0 ? combinedSizes : ['M'],
    sizeQuantities: combinedQuantities,
    quantity: totalQuantity,
    inStock: totalQuantity > 0,
  };
}

/**
 * Returns the available stock for a specific size of a product (or for a specific color + size).
 */
export function getSizeQuantity(
  product: Pick<ProductItem, 'sizes' | 'sizeQuantities' | 'hasColors' | 'colorVariants'>,
  size: string,
  colorName?: string
): number {
  if (
    product.hasColors &&
    Array.isArray(product.colorVariants) &&
    product.colorVariants.length > 0
  ) {
    if (colorName) {
      const matchedVariant = product.colorVariants.find(
        (v) => v.colorName.trim().toLowerCase() === colorName.trim().toLowerCase()
      );
      if (matchedVariant) {
        if (!matchedVariant.sizes.includes(size)) return 0;
        const q = matchedVariant.sizeQuantities?.[size];
        return typeof q === 'number' && !Number.isNaN(q) ? Math.max(0, Math.floor(q)) : 5;
      }
    }
    // If no colorName passed on a multi-color product, sum across variants for that size
    return product.colorVariants.reduce((sum, v) => {
      if (!v.sizes.includes(size)) return sum;
      const q = v.sizeQuantities?.[size];
      const val = typeof q === 'number' && !Number.isNaN(q) ? Math.max(0, Math.floor(q)) : 5;
      return sum + val;
    }, 0);
  }

  if (product.sizeQuantities && typeof product.sizeQuantities[size] === 'number') {
    return Math.max(0, Math.floor(product.sizeQuantities[size]));
  }
  return 5;
}

/**
 * Computes the effective unit price of a product after applying its discount ($ or %).
 */
export function getEffectiveProductPrice(
  product: Pick<ProductItem, 'price' | 'discountType' | 'discountValue'>
): {
  originalPrice: number;
  effectivePrice: number;
  hasDiscount: boolean;
  discountBadge: string;
} {
  const originalPrice = Math.max(0, Number(product.price) || 0);
  const discountType: DiscountType = product.discountType || 'none';
  const discountValue = Math.max(0, Number(product.discountValue) || 0);

  if (discountType === 'none' || discountValue <= 0) {
    return {
      originalPrice,
      effectivePrice: originalPrice,
      hasDiscount: false,
      discountBadge: '',
    };
  }

  if (discountType === 'percentage') {
    const pct = Math.min(99, discountValue);
    const effectivePrice = Math.max(1, Math.round(originalPrice * (1 - pct / 100)));
    return {
      originalPrice,
      effectivePrice,
      hasDiscount: effectivePrice < originalPrice,
      discountBadge: `Save ${pct}%`,
    };
  }

  // fixed dollar discount
  const effectivePrice = Math.max(1, Math.round(originalPrice - discountValue));
  return {
    originalPrice,
    effectivePrice,
    hasDiscount: effectivePrice < originalPrice,
    discountBadge: `Save $${discountValue.toLocaleString()}`,
  };
}

/**
 * Filters orders in AdminDashboard by customer name or order number.
 */
export function filterOrdersByQuery(orders: OrderItem[], searchQuery: string): OrderItem[] {
  const q = (searchQuery || '').trim().toLowerCase();
  if (!q) return orders;
  return orders.filter(
    (order) =>
      order.customerName.toLowerCase().includes(q) ||
      order.orderNumber.toLowerCase().includes(q)
  );
}

/**
 * Synchronizes all Full Set products in the catalog with their linked standalone products.
 * Whenever a standalone product's per-size (or per-color + per-size) stock changes,
 * any Full Set referencing that standalone product automatically reflects the updated stock.
 */
export function syncFullSetsWithCatalog(products: ProductItem[]): ProductItem[] {
  const byId = new Map<string, ProductItem>();
  const byName = new Map<string, ProductItem>();
  for (const p of products) {
    byId.set(p.id, p);
    byName.set(p.name.trim().toLowerCase(), p);
  }

  return products.map((prod) => {
    if (!prod.isFullSet || !Array.isArray(prod.setItems) || prod.setItems.length === 0) {
      return prod;
    }

    const syncedSetItems = prod.setItems.map((subItem) => {
      const linked =
        (subItem.productId ? byId.get(subItem.productId) : undefined) ||
        (subItem.productName ? byName.get(subItem.productName.trim().toLowerCase()) : undefined);

      if (linked && linked.id !== prod.id) {
        // If linked standalone product has multiple color variants, sync the allowed colors (defaulting to first color)
        if (
          linked.hasColors &&
          Array.isArray(linked.colorVariants) &&
          linked.colorVariants.length > 0
        ) {
          const requestedColors = Array.isArray(subItem.selectedColors)
            ? subItem.selectedColors.map((c) => c.trim()).filter(Boolean)
            : [];
          const matchedVariants =
            requestedColors.length > 0
              ? linked.colorVariants.filter((v) =>
                  requestedColors.some(
                    (rc) => rc.toLowerCase() === v.colorName.trim().toLowerCase()
                  )
                )
              : [linked.colorVariants[0]];
          const finalVariants =
            matchedVariants.length > 0 ? matchedVariants : [linked.colorVariants[0]];

          const syncedVariants: ProductColorVariant[] = finalVariants.map((v) => ({
            ...v,
            sizes: [...v.sizes],
            sizeQuantities: buildSizeQuantitiesMap(v.sizes, v.sizeQuantities),
          }));

          const primaryVar = syncedVariants[0];
          return {
            ...subItem,
            productId: linked.id,
            productName: subItem.productName || linked.name,
            sizeType: primaryVar.sizeType,
            sizes: [...primaryVar.sizes],
            sizeQuantities: buildSizeQuantitiesMap(
              primaryVar.sizes,
              primaryVar.sizeQuantities
            ),
            selectedColors: syncedVariants.map((v) => v.colorName),
            colorVariants: syncedVariants,
          };
        }

        const sizes =
          Array.isArray(subItem.sizes) && subItem.sizes.length > 0
            ? subItem.sizes
            : linked.sizes && linked.sizes.length > 0
            ? [...linked.sizes]
            : getDefaultSizesForType(subItem.sizeType || 'letter');

        const baseQuantities = buildSizeQuantitiesMap(sizes, subItem.sizeQuantities);
        const syncedQuantities: Record<string, number> = {};
        for (const sz of sizes) {
          if (linked.sizes.includes(sz)) {
            syncedQuantities[sz] = getSizeQuantity(linked, sz);
          } else {
            syncedQuantities[sz] = baseQuantities[sz] ?? 5;
          }
        }
        return {
          ...subItem,
          productId: linked.id,
          productName: subItem.productName || linked.name,
          sizeType: linked.sizeType || subItem.sizeType,
          sizes,
          sizeQuantities: syncedQuantities,
          selectedColors: [],
          colorVariants: [],
        };
      }

      const sizes =
        Array.isArray(subItem.sizes) && subItem.sizes.length > 0
          ? subItem.sizes
          : getDefaultSizesForType(subItem.sizeType || 'letter');
      const baseQuantities = buildSizeQuantitiesMap(sizes, subItem.sizeQuantities);

      return {
        ...subItem,
        sizes,
        sizeQuantities: baseQuantities,
      };
    });

    const primaryPiece = syncedSetItems[0];
    const pieceTotals = syncedSetItems.map((si) => {
      if (Array.isArray(si.colorVariants) && si.colorVariants.length > 0) {
        return syncProductFromColorVariants(si.colorVariants, si.sizeType).quantity;
      }
      return sumSizeQuantities(si.sizes, si.sizeQuantities);
    });
    const minPieceTotal =
      pieceTotals.length > 0 ? Math.min(...pieceTotals) : 0;
    const allPiecesHaveStock = pieceTotals.every((t) => t > 0);

    return {
      ...prod,
      isFullSet: true,
      setItems: syncedSetItems,
      sizeType: primaryPiece?.sizeType || prod.sizeType,
      sizes: primaryPiece?.sizes || prod.sizes,
      sizeQuantities: primaryPiece?.sizeQuantities || prod.sizeQuantities,
      quantity: minPieceTotal,
      inStock: prod.inStock === false ? false : allPiecesHaveStock,
    };
  });
}

/**
 * Decrements per-size (and per-color when hasColors is true, or both linked pieces when isFullSet is true)
 * product stock quantities when an order transitions to 'accepted'.
 * Simultaneously decreases stock in standalone products and any Full Set referencing them.
 */
export function decrementStockForAcceptedOrder(
  products: ProductItem[],
  order: OrderItem
): ProductItem[] {
  const rawLines =
    Array.isArray(order.orderedItems) && order.orderedItems.length > 0
      ? order.orderedItems
      : [
          {
            productId: '',
            productName: order.primaryProductName,
            selectedSize: order.primaryProductSize,
            quantity: Math.max(1, order.itemsCount || 1),
          },
        ];

  // Expand Full Set orders into component piece deductions so standalone products are simultaneously decremented
  interface ExpandedDeduction {
    productId: string;
    productName: string;
    selectedColor?: string;
    selectedSize?: string;
    quantity: number;
    parentFullSetId?: string;
    setPieceIndex?: number;
  }

  const deductions: ExpandedDeduction[] = [];

  for (const line of rawLines) {
    const qtyBought = Math.max(1, Math.floor(Number(line.quantity) || 1));
    const matchedProd = products.find(
      (p) =>
        (line.productId && p.id === line.productId) ||
        (line.productName &&
          p.name.trim().toLowerCase() === line.productName.trim().toLowerCase())
    );

    if (Array.isArray(line.selectedSetSizes) && line.selectedSetSizes.length > 0) {
      for (let i = 0; i < line.selectedSetSizes.length; i++) {
        const piece = line.selectedSetSizes[i];
        const fallbackSub = matchedProd?.setItems?.[i];
        const resolvedColor =
          piece.selectedColor ||
          fallbackSub?.selectedColors?.[0] ||
          fallbackSub?.colorVariants?.[0]?.colorName;
        deductions.push({
          productId: piece.productId,
          productName: piece.productName,
          selectedColor: resolvedColor,
          selectedSize: piece.selectedSize,
          quantity: qtyBought,
          parentFullSetId: matchedProd?.id || line.productId,
          setPieceIndex: i,
        });
      }
    } else if (
      matchedProd?.isFullSet &&
      Array.isArray(matchedProd.setItems) &&
      matchedProd.setItems.length > 0
    ) {
      // Parse "Size1 / Size2" fallback if selectedSetSizes wasn't explicitly populated
      const parts = (line.selectedSize || order.primaryProductSize || '')
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean);
      matchedProd.setItems.forEach((sub, idx) => {
        const chosenSz = parts[idx] || sub.sizes[0] || '';
        const defaultColor =
          sub.selectedColors?.[0] || sub.colorVariants?.[0]?.colorName;
        deductions.push({
          productId: sub.productId,
          productName: sub.productName,
          selectedColor: defaultColor,
          selectedSize: chosenSz,
          quantity: qtyBought,
          parentFullSetId: matchedProd.id,
          setPieceIndex: idx,
        });
      });
    } else {
      deductions.push({
        productId: line.productId,
        productName: line.productName,
        selectedColor: line.selectedColor,
        selectedSize: line.selectedSize,
        quantity: qtyBought,
      });
    }
  }

  const afterDirectDeductions = products.map((prod) => {
    // Handle Full Set internal setItems deduction first (for unlinked or direct set pieces)
    let updatedSetItems = prod.setItems;
    if (prod.isFullSet && Array.isArray(prod.setItems) && prod.setItems.length > 0) {
      updatedSetItems = prod.setItems.map((subItem, idx) => {
        const pieceDeductions = deductions.filter(
          (d) =>
            (d.parentFullSetId === prod.id && d.setPieceIndex === idx) ||
            (d.productId && d.productId === subItem.productId) ||
            (d.productName &&
              subItem.productName &&
              d.productName.trim().toLowerCase() ===
                subItem.productName.trim().toLowerCase())
        );
        if (pieceDeductions.length === 0) return subItem;

        const nextMap = buildSizeQuantitiesMap(subItem.sizes, subItem.sizeQuantities);
        for (const pd of pieceDeductions) {
          const targetSz =
            pd.selectedSize && subItem.sizes.includes(pd.selectedSize)
              ? pd.selectedSize
              : subItem.sizes[0];
          if (targetSz && targetSz in nextMap) {
            nextMap[targetSz] = Math.max(0, nextMap[targetSz] - pd.quantity);
          }
        }
        return {
          ...subItem,
          sizeQuantities: nextMap,
        };
      });
    }

    const matchingLines = deductions.filter((d) => {
      const idMatches = d.productId && d.productId === prod.id;
      const nameMatches =
        !idMatches &&
        d.productName &&
        d.productName.trim().toLowerCase() === prod.name.trim().toLowerCase();
      return Boolean(idMatches || nameMatches);
    });

    if (matchingLines.length === 0) {
      return updatedSetItems !== prod.setItems
        ? { ...prod, setItems: updatedSetItems }
        : prod;
    }

    // Multi-color product stock deduction
    if (prod.hasColors && Array.isArray(prod.colorVariants) && prod.colorVariants.length > 0) {
      const nextVariants: ProductColorVariant[] = prod.colorVariants.map((v) => ({
        ...v,
        sizes: [...v.sizes],
        sizeQuantities: buildSizeQuantitiesMap(v.sizes, v.sizeQuantities),
      }));

      for (const line of matchingLines) {
        const qtyBought = Math.max(1, Math.floor(Number(line.quantity) || 1));
        const targetVariant =
          (line.selectedColor
            ? nextVariants.find(
                (v) =>
                  v.colorName.trim().toLowerCase() ===
                  line.selectedColor!.trim().toLowerCase()
              )
            : undefined) || nextVariants[0];

        if (targetVariant) {
          const targetSize =
            (line.selectedSize && targetVariant.sizes.includes(line.selectedSize)
              ? line.selectedSize
              : order.primaryProductSize &&
                targetVariant.sizes.includes(order.primaryProductSize)
              ? order.primaryProductSize
              : targetVariant.sizes.find(
                  (s) => (targetVariant.sizeQuantities[s] ?? 5) > 0
                ) || targetVariant.sizes[0]) || '';

          if (targetSize && targetSize in targetVariant.sizeQuantities) {
            targetVariant.sizeQuantities[targetSize] = Math.max(
              0,
              targetVariant.sizeQuantities[targetSize] - qtyBought
            );
          }
        }
      }

      const synced = syncProductFromColorVariants(nextVariants, prod.sizeType);
      return {
        ...prod,
        setItems: updatedSetItems,
        colorVariants: nextVariants,
        sizes: synced.sizes,
        sizeQuantities: synced.sizeQuantities,
        quantity: synced.quantity,
        inStock: synced.inStock,
      };
    }

    // Standard single-color product stock deduction
    const currentSizeMap = buildSizeQuantitiesMap(prod.sizes, prod.sizeQuantities);
    for (const line of matchingLines) {
      const qtyBought = Math.max(1, Math.floor(Number(line.quantity) || 1));
      const targetSize =
        (line.selectedSize && prod.sizes.includes(line.selectedSize)
          ? line.selectedSize
          : order.primaryProductSize && prod.sizes.includes(order.primaryProductSize)
          ? order.primaryProductSize
          : prod.sizes.find((s) => (currentSizeMap[s] ?? 5) > 0) || prod.sizes[0]) || '';

      if (targetSize && targetSize in currentSizeMap) {
        currentSizeMap[targetSize] = Math.max(0, currentSizeMap[targetSize] - qtyBought);
      }
    }

    const nextTotalQty = sumSizeQuantities(prod.sizes, currentSizeMap);
    return {
      ...prod,
      setItems: updatedSetItems,
      sizeQuantities: currentSizeMap,
      quantity: nextTotalQty,
      inStock: nextTotalQty > 0,
    };
  });

  return syncFullSetsWithCatalog(afterDirectDeductions);
}

/**
 * Restores per-size (and per-color when hasColors is true, or all linked pieces when isFullSet is true)
 * product stock quantities when an already-'accepted' order is canceled ('rejected' / 'pending') or deleted.
 * Simultaneously restores stock in standalone products and any Full Set referencing them.
 */
export function restoreStockForCanceledOrder(
  products: ProductItem[],
  order: OrderItem
): ProductItem[] {
  const rawLines =
    Array.isArray(order.orderedItems) && order.orderedItems.length > 0
      ? order.orderedItems
      : [
          {
            productId: '',
            productName: order.primaryProductName,
            selectedSize: order.primaryProductSize,
            quantity: Math.max(1, order.itemsCount || 1),
          },
        ];

  interface ExpandedRestoration {
    productId: string;
    productName: string;
    selectedColor?: string;
    selectedSize?: string;
    quantity: number;
    parentFullSetId?: string;
    setPieceIndex?: number;
  }

  const restorations: ExpandedRestoration[] = [];

  for (const line of rawLines) {
    const qtyRestored = Math.max(1, Math.floor(Number(line.quantity) || 1));
    const matchedProd = products.find(
      (p) =>
        (line.productId && p.id === line.productId) ||
        (line.productName &&
          p.name.trim().toLowerCase() === line.productName.trim().toLowerCase())
    );

    if (Array.isArray(line.selectedSetSizes) && line.selectedSetSizes.length > 0) {
      for (let i = 0; i < line.selectedSetSizes.length; i++) {
        const piece = line.selectedSetSizes[i];
        const fallbackSub = matchedProd?.setItems?.[i];
        const resolvedColor =
          piece.selectedColor ||
          fallbackSub?.selectedColors?.[0] ||
          fallbackSub?.colorVariants?.[0]?.colorName;
        restorations.push({
          productId: piece.productId,
          productName: piece.productName,
          selectedColor: resolvedColor,
          selectedSize: piece.selectedSize,
          quantity: qtyRestored,
          parentFullSetId: matchedProd?.id || line.productId,
          setPieceIndex: i,
        });
      }
    } else if (
      matchedProd?.isFullSet &&
      Array.isArray(matchedProd.setItems) &&
      matchedProd.setItems.length > 0
    ) {
      const parts = (line.selectedSize || order.primaryProductSize || '')
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean);
      matchedProd.setItems.forEach((sub, idx) => {
        const chosenSz = parts[idx] || sub.sizes[0] || '';
        const defaultColor =
          sub.selectedColors?.[0] || sub.colorVariants?.[0]?.colorName;
        restorations.push({
          productId: sub.productId,
          productName: sub.productName,
          selectedColor: defaultColor,
          selectedSize: chosenSz,
          quantity: qtyRestored,
          parentFullSetId: matchedProd.id,
          setPieceIndex: idx,
        });
      });
    } else {
      restorations.push({
        productId: line.productId,
        productName: line.productName,
        selectedColor: line.selectedColor,
        selectedSize: line.selectedSize,
        quantity: qtyRestored,
      });
    }
  }

  const afterDirectRestorations = products.map((prod) => {
    let updatedSetItems = prod.setItems;
    if (prod.isFullSet && Array.isArray(prod.setItems) && prod.setItems.length > 0) {
      updatedSetItems = prod.setItems.map((subItem, idx) => {
        const pieceRestorations = restorations.filter(
          (r) =>
            (r.parentFullSetId === prod.id && r.setPieceIndex === idx) ||
            (r.productId && r.productId === subItem.productId) ||
            (r.productName &&
              subItem.productName &&
              r.productName.trim().toLowerCase() ===
                subItem.productName.trim().toLowerCase())
        );
        if (pieceRestorations.length === 0) return subItem;

        const nextMap = buildSizeQuantitiesMap(subItem.sizes, subItem.sizeQuantities);
        for (const pr of pieceRestorations) {
          const targetSz =
            pr.selectedSize && subItem.sizes.includes(pr.selectedSize)
              ? pr.selectedSize
              : subItem.sizes[0];
          if (targetSz && targetSz in nextMap) {
            nextMap[targetSz] = Math.max(0, nextMap[targetSz] + pr.quantity);
          }
        }
        return {
          ...subItem,
          sizeQuantities: nextMap,
        };
      });
    }

    const matchingLines = restorations.filter((r) => {
      const idMatches = r.productId && r.productId === prod.id;
      const nameMatches =
        !idMatches &&
        r.productName &&
        r.productName.trim().toLowerCase() === prod.name.trim().toLowerCase();
      return Boolean(idMatches || nameMatches);
    });

    if (matchingLines.length === 0) {
      return updatedSetItems !== prod.setItems
        ? { ...prod, setItems: updatedSetItems }
        : prod;
    }

    // Multi-color product stock restoration
    if (prod.hasColors && Array.isArray(prod.colorVariants) && prod.colorVariants.length > 0) {
      const nextVariants: ProductColorVariant[] = prod.colorVariants.map((v) => ({
        ...v,
        sizes: [...v.sizes],
        sizeQuantities: buildSizeQuantitiesMap(v.sizes, v.sizeQuantities),
      }));

      for (const line of matchingLines) {
        const qtyRestored = Math.max(1, Math.floor(Number(line.quantity) || 1));
        const targetVariant =
          (line.selectedColor
            ? nextVariants.find(
                (v) =>
                  v.colorName.trim().toLowerCase() ===
                  line.selectedColor!.trim().toLowerCase()
              )
            : undefined) || nextVariants[0];

        if (targetVariant) {
          const targetSize =
            (line.selectedSize && targetVariant.sizes.includes(line.selectedSize)
              ? line.selectedSize
              : order.primaryProductSize &&
                targetVariant.sizes.includes(order.primaryProductSize)
              ? order.primaryProductSize
              : targetVariant.sizes[0]) || '';

          if (targetSize && targetSize in targetVariant.sizeQuantities) {
            targetVariant.sizeQuantities[targetSize] = Math.max(
              0,
              targetVariant.sizeQuantities[targetSize] + qtyRestored
            );
          }
        }
      }

      const synced = syncProductFromColorVariants(nextVariants, prod.sizeType);
      return {
        ...prod,
        setItems: updatedSetItems,
        colorVariants: nextVariants,
        sizes: synced.sizes,
        sizeQuantities: synced.sizeQuantities,
        quantity: synced.quantity,
        inStock: synced.inStock,
      };
    }

    // Standard single-color product stock restoration
    const currentSizeMap = buildSizeQuantitiesMap(prod.sizes, prod.sizeQuantities);
    for (const line of matchingLines) {
      const qtyRestored = Math.max(1, Math.floor(Number(line.quantity) || 1));
      const targetSize =
        (line.selectedSize && prod.sizes.includes(line.selectedSize)
          ? line.selectedSize
          : order.primaryProductSize && prod.sizes.includes(order.primaryProductSize)
          ? order.primaryProductSize
          : prod.sizes[0]) || '';

      if (targetSize && targetSize in currentSizeMap) {
        currentSizeMap[targetSize] = Math.max(0, currentSizeMap[targetSize] + qtyRestored);
      }
    }

    const nextTotalQty = sumSizeQuantities(prod.sizes, currentSizeMap);
    return {
      ...prod,
      setItems: updatedSetItems,
      sizeQuantities: currentSizeMap,
      quantity: nextTotalQty,
      inStock: nextTotalQty > 0,
    };
  });

  return syncFullSetsWithCatalog(afterDirectRestorations);
}

/**
 * Merges prebuilt materials with custom admin-added materials without duplicates.
 */
export function mergeMaterialsList(customMaterials: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const mat of [...PREBUILT_MATERIALS, ...customMaterials]) {
    const clean = mat.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }
  return result;
}

/**
 * Checks whether an email address is authorized for Admin Mode.
 */
export function isAuthorizedAdminEmail(
  email: string | null | undefined,
  extraAdmins: Pick<AdminRecord, 'email'>[] = []
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(normalized)) {
    return true;
  }
  return extraAdmins.some((admin) => admin.email.trim().toLowerCase() === normalized);
}

/**
 * Calculates delivery fee, promo code discount, and total order price.
 */
export function calculateOrderTotals(
  items: { price: number; quantity: number }[],
  deliveryMethod: DeliveryMethod,
  appliedPromo?: Pick<PromoCodeItem, 'discountType' | 'discountValue' | 'active'> | null
): {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalPrice: number;
  itemsCount: number;
} {
  const subtotal = items.reduce((acc, item) => {
    const price = Math.max(0, Number(item.price) || 0);
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    return acc + price * qty;
  }, 0);

  const itemsCount = items.reduce(
    (acc, item) => acc + Math.max(1, Math.floor(Number(item.quantity) || 1)),
    0
  );

  let discountAmount = 0;
  if (appliedPromo && appliedPromo.active && subtotal > 0) {
    const val = Math.max(0, Number(appliedPromo.discountValue) || 0);
    if (appliedPromo.discountType === 'percentage') {
      const pct = Math.min(100, val);
      discountAmount = Math.round(subtotal * (pct / 100));
    } else if (appliedPromo.discountType === 'fixed') {
      discountAmount = Math.min(subtotal, Math.round(val));
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  let deliveryFee = 0;
  if (deliveryMethod === 'Standard Delivery') {
    deliveryFee = discountedSubtotal >= 80 || subtotal === 0 ? 0 : 6;
  } else {
    deliveryFee = 0; // SAMO Showroom Pickup (Free / Reserved for 1 Day)
  }

  return {
    subtotal,
    discountAmount,
    deliveryFee,
    totalPrice: discountedSubtotal + deliveryFee,
    itemsCount,
  };
}

/**
 * Selects complementary upsell products for the Shopping Bag drawer from the same
 * department (Women or Kids — matching Baby/Junior/Teen when Kids is selected),
 * excluding items already in the cart.
 */
export function getComplementaryUpsellProducts(
  cartItems: { product: ProductItem }[],
  allProducts: ProductItem[],
  limit = 2
): ProductItem[] {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return [];
  const inCartIds = new Set(cartItems.map((ci) => ci.product.id));
  const anchor = cartItems[cartItems.length - 1].product;

  const availablePool = allProducts.filter((p) => {
    if (inCartIds.has(p.id)) return false;
    const totalStock = sumSizeQuantities(p.sizes, p.sizeQuantities);
    return p.inStock && totalStock > 0 && p.department === anchor.department;
  });

  const scored = availablePool.map((candidate) => {
    let score = 0;
    const sameCategory =
      candidate.category.trim().toLowerCase() ===
      anchor.category.trim().toLowerCase();
    const sameStyle =
      candidate.style.trim().toLowerCase() === anchor.style.trim().toLowerCase();

    if (anchor.department === 'kids') {
      // For Kids (Baby, Junior, Teen), prioritize the exact same age/size sub-category first
      if (sameCategory) score += 10;
      if (sameStyle) score += 4;
    } else {
      // For Women, prioritize complementary categories (e.g., Bags/Belts/Tops/Trousers with Jackets) or matching style
      if (!sameCategory) score += 6;
      if (sameStyle) score += 5;
      const catLower = candidate.category.trim().toLowerCase();
      if (catLower === 'bags' || catLower === 'belts') score += 3;
    }
    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((entry) => entry.candidate);
}

/**
 * Normalizes legacy Kids category names ('Baby', 'Junior', 'Teen', 'Full Set')
 * to the canonical SAMO Kids categories:
 * - 'MINIS 1 To 5'
 * - 'CHILDREN 6+'
 * - 'Teen 13+'
 */
export function normalizeKidsCategoryName(rawCategory: string): string {
  const clean = (rawCategory || '').trim();
  const lower = clean.toLowerCase();
  if (lower === 'baby' || lower === 'minis' || lower === 'minis 1 to 5') {
    return 'MINIS 1 To 5';
  }
  if (
    lower === 'junior' ||
    lower === 'children' ||
    lower === 'children 6+' ||
    lower === 'full set'
  ) {
    return 'CHILDREN 6+';
  }
  if (lower === 'teen' || lower === 'teen 13+') {
    return 'Teen 13+';
  }
  return clean;
}

/**
 * Filters products by department, category, and search query.
 */
export function filterCatalogProducts(
  products: ProductItem[],
  options: {
    department?: Department | 'all';
    category?: string | 'all';
    searchQuery?: string;
    style?: string | 'all';
  }
): ProductItem[] {
  const dept = options.department || 'all';
  const rawCat = (options.category || 'all').trim();
  const cat =
    dept === 'kids' && rawCat.toLowerCase() !== 'all'
      ? normalizeKidsCategoryName(rawCat).toLowerCase()
      : rawCat.toLowerCase();
  const style = (options.style || 'all').trim().toLowerCase();
  const q = (options.searchQuery || '').trim().toLowerCase();

  return products.filter((item) => {
    // Exclude any legacy Kids Full Set items since Full Set is removed from Kids
    if (
      item.department === 'kids' &&
      (item.isFullSet || item.category.trim().toLowerCase() === 'full set')
    ) {
      return false;
    }
    if (dept !== 'all' && item.department !== dept) {
      return false;
    }
    const itemCatNormalized =
      item.department === 'kids'
        ? normalizeKidsCategoryName(item.category).toLowerCase()
        : item.category.trim().toLowerCase();
    const matchesCategory =
      cat === 'all' ||
      itemCatNormalized === cat ||
      (cat === 'full set' && item.department === 'women' && Boolean(item.isFullSet));
    if (!matchesCategory) {
      return false;
    }
    if (style !== 'all' && item.style.trim().toLowerCase() !== style) {
      return false;
    }
    if (q) {
      const colorNames = (item.colorVariants || []).map((v) => v.colorName);
      const haystack = [
        item.name,
        item.category,
        itemCatNormalized,
        item.department,
        item.style,
        item.description,
        ...(item.materials || []),
        ...item.sizes,
        ...colorNames,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Returns products marked for the dedicated New Arrivals page.
 */
export function filterNewArrivalProducts(products: ProductItem[]): ProductItem[] {
  return products.filter(
    (p) =>
      (p.isNewArrival !== undefined
        ? Boolean(p.isNewArrival)
        : Boolean(p.featured)) &&
      !(
        p.department === 'kids' &&
        (p.isFullSet || p.category.trim().toLowerCase() === 'full set')
      )
  );
}

/**
 * Returns all Belts and Bags items for the dedicated Gifts page.
 */
export function filterGiftsProducts(products: ProductItem[]): ProductItem[] {
  return products.filter((p) => {
    const cat = p.category.trim().toLowerCase();
    return cat === 'bags' || cat === 'bag' || cat === 'belts' || cat === 'belt';
  });
}

/**
 * Validates and sorts categories for a given department by sortOrder (supporting integers and decimals like 1.5, 2.5).
 * For 'kids', normalizes legacy names to 'MINIS 1 To 5', 'CHILDREN 6+', 'Teen 13+'
 * and strictly removes 'Full Set' from the Kids department only.
 */
export function getCategoriesByDepartment(
  categories: CategoryItem[],
  department: Department
): CategoryItem[] {
  const seen = new Set<string>();
  const rawDeptList: { item: CategoryItem; initialOrder: number }[] = [];

  for (const c of categories) {
    if (c.department !== department) continue;
    if (
      department === 'kids' &&
      c.name.trim().toLowerCase() === 'full set'
    ) {
      continue;
    }
    const normalizedName =
      department === 'kids' ? normalizeKidsCategoryName(c.name) : c.name.trim();
    const key = normalizedName.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      const fallbackOrder = rawDeptList.length + 1;
      const numericOrder =
        typeof c.sortOrder === 'number' && Number.isFinite(c.sortOrder)
          ? c.sortOrder
          : fallbackOrder;
      rawDeptList.push({
        item: {
          ...c,
          name: normalizedName,
          slug: createSafeSlug(normalizedName),
          sortOrder: numericOrder,
        },
        initialOrder: fallbackOrder,
      });
    }
  }

  rawDeptList.sort((a, b) => {
    const orderA = a.item.sortOrder ?? a.initialOrder;
    const orderB = b.item.sortOrder ?? b.initialOrder;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.initialOrder - b.initialOrder;
  });

  return rawDeptList.map((entry) => entry.item);
}

/**
 * Toggles a product's inStock state from the Admin Dashboard toggle switch.
 * When toggled OFF (false), marks inStock: false so the product appears Out of Stock on the storefront.
 * When toggled ON (true), marks inStock: true and restores default 5 per size if all sizes were at 0.
 */
export function toggleProductInStockState(
  product: ProductItem,
  nextInStock: boolean
): ProductItem {
  if (!nextInStock) {
    return {
      ...product,
      inStock: false,
    };
  }

  // Toggling ON: ensure at least some stock exists if all sizes were zeroed out
  if (
    product.hasColors &&
    Array.isArray(product.colorVariants) &&
    product.colorVariants.length > 0
  ) {
    const currentSynced = syncProductFromColorVariants(
      product.colorVariants,
      product.sizeType
    );
    if (currentSynced.quantity > 0) {
      return {
        ...product,
        inStock: true,
      };
    }
    const refilledVariants: ProductColorVariant[] = product.colorVariants.map(
      (v) => {
        const sizes = v.sizes.length > 0 ? v.sizes : ['M'];
        const sizeQuantities: Record<string, number> = {};
        for (const sz of sizes) {
          sizeQuantities[sz] = 5;
        }
        return {
          ...v,
          sizes,
          sizeQuantities,
        };
      }
    );
    const synced = syncProductFromColorVariants(
      refilledVariants,
      product.sizeType
    );
    return {
      ...product,
      colorVariants: refilledVariants,
      ...synced,
      inStock: true,
    };
  }

  const sizes = product.sizes.length > 0 ? product.sizes : ['M'];
  const currentTotal = sumSizeQuantities(sizes, product.sizeQuantities);
  if (currentTotal > 0) {
    return {
      ...product,
      inStock: true,
    };
  }

  const refilledMap: Record<string, number> = {};
  for (const sz of sizes) {
    refilledMap[sz] = 5;
  }
  const nextTotal = sumSizeQuantities(sizes, refilledMap);
  return {
    ...product,
    sizes,
    sizeQuantities: refilledMap,
    quantity: nextTotal,
    inStock: true,
  };
}

/**
 * Computes the canonical key for a category in-feed banner based on route/department and category name.
 */
export function getCategoryBannerKey(
  routeOrDept: RoutePath | Department,
  selectedCategory: string
): string {
  const cleanCat = (selectedCategory || 'all').trim();
  const lowerCat = cleanCat.toLowerCase();

  if (routeOrDept === '/new-arrivals') {
    return 'collection:new-arrivals';
  }
  if (routeOrDept === '/gifts') {
    return 'collection:gifts';
  }

  const dept: Department =
    routeOrDept === '/kids' || routeOrDept === 'kids' ? 'kids' : 'women';

  if (lowerCat === 'all' || !cleanCat) {
    return `${dept}:all`;
  }

  const normalizedName =
    dept === 'kids' ? normalizeKidsCategoryName(cleanCat) : cleanCat;
  return `${dept}:${createSafeSlug(normalizedName)}`;
}

const DEFAULT_CATEGORY_STUDIO_IMAGES: Record<string, string> = {
  'women:all': 'studio://women-jacket-black-leather-biker',
  'women:jacket': 'studio://women-jacket-burgundy-leather-biker',
  'women:trousers': 'studio://women-trousers-wide-leather',
  'women:pants': 'studio://women-pants-suede-flare',
  'women:skirts': 'studio://women-skirts-pleated-leather',
  'women:denim': 'studio://women-denim-raw-indigo',
  'women:tops': 'studio://women-tops-silk-drape',
  'women:full-set': 'studio://women-fullset-monolith',
  'women:trench-coat': 'studio://women-trench-suede-coat',
  'women:fur': 'studio://women-fur-opera-coat',
  'women:bags': 'studio://women-bags-hourglass-burgundy',
  'women:belts': 'studio://women-belts-double-buckle',
  'kids:all': 'studio://kids-junior-leather-bomber',
  'kids:minis-1-to-5': 'studio://kids-baby-cashmere-knit-set',
  'kids:children-6': 'studio://kids-junior-leather-bomber',
  'kids:children-6-plus': 'studio://kids-junior-leather-bomber',
  'kids:teen-13': 'studio://kids-teen-suede-varsity',
  'kids:teen-13-plus': 'studio://kids-teen-suede-varsity',
  'collection:new-arrivals': 'studio://women-fur-opera-coat',
  'collection:gifts': 'studio://women-bags-hourglass-burgundy',
};

export function buildDefaultCategoryBannerForCategory(
  department: Department | 'collection',
  categoryName: string,
  explicitKey?: string
): CategoryBannerConfig {
  const key =
    explicitKey ||
    (department === 'collection'
      ? `collection:${createSafeSlug(categoryName)}`
      : getCategoryBannerKey(department, categoryName));

  const imageUrl =
    DEFAULT_CATEGORY_STUDIO_IMAGES[key] ||
    (department === 'kids'
      ? 'studio://kids-junior-leather-bomber'
      : 'studio://women-jacket-black-leather-biker');

  const displayCat =
    categoryName.toLowerCase() === 'all'
      ? department === 'kids'
        ? 'Kids Collection'
        : 'Women Collection'
      : categoryName;

  return {
    categoryKey: key,
    department,
    categoryName,
    imageUrl,
    kicker: `SAMO WEAVE · ${displayCat.toUpperCase()}`,
    title: `${displayCat.toUpperCase()} EDITORIAL ARCHIVE`,
    enabled: true,
    insertAfterCount: 4,
    updatedAt: new Date().toISOString(),
  };
}

export function buildDefaultSiteBanners(
  categories: CategoryItem[]
): SiteBannersConfig {
  const categoryBanners: Record<string, CategoryBannerConfig> = {};

  // Department-wide "All" views & collection views
  categoryBanners['women:all'] = buildDefaultCategoryBannerForCategory(
    'women',
    'All Women',
    'women:all'
  );
  categoryBanners['kids:all'] = buildDefaultCategoryBannerForCategory(
    'kids',
    'All Kids',
    'kids:all'
  );
  categoryBanners['collection:new-arrivals'] =
    buildDefaultCategoryBannerForCategory(
      'collection',
      'New Arrivals',
      'collection:new-arrivals'
    );
  categoryBanners['collection:gifts'] = buildDefaultCategoryBannerForCategory(
    'collection',
    'Gifts (Bags & Belts)',
    'collection:gifts'
  );

  // Every Women & Kids Category
  for (const cat of categories) {
    if (
      cat.department === 'kids' &&
      cat.name.trim().toLowerCase() === 'full set'
    ) {
      continue;
    }
    const cleanName =
      cat.department === 'kids'
        ? normalizeKidsCategoryName(cat.name)
        : cat.name.trim();
    const key = getCategoryBannerKey(cat.department, cleanName);
    categoryBanners[key] = buildDefaultCategoryBannerForCategory(
      cat.department,
      cleanName,
      key
    );
  }

  return {
    homeHeroMediaType: 'video',
    homeHeroVideoUrl: '/assets/aistudio/recording-2026-10-20_ae756f63.webm',
    homeHeroImageUrl: 'studio://women-jacket-black-leather-biker',
    homeHeroKicker:
      'SAMO WEAVE · CLASSIC · SPORT CHIC · FINE LEATHER · SUEDE · FUR',
    homeHeroTitle: 'NEW ARRIVALS',
    homeMiddleBannerUrl: 'studio://kids-junior-leather-bomber',
    homeMiddleKicker:
      'SAMO KIDS · MINIS 1 TO 5 (80–100 CM) · CHILDREN 6+ (100–130 CM) · TEEN 13+ (130–160 CM)',
    homeMiddleTitle: 'SAMO KIDS COLLECTION',
    homeMiddleSubtitle:
      'Architectural silhouettes in supple cow leather, brushed suede, and combed cashmere graded in precision centimeter sizing.',
    homeBottomNewArrivalsUrl: 'studio://women-fur-opera-coat',
    homeBottomGiftsUrl: 'studio://women-bags-hourglass-burgundy',
    homeBottomShowroomUrl: 'studio://women-trench-suede-coat',
    showroomHeroBannerUrl: 'studio://women-trench-suede-coat',
    categoryBanners,
  };
}

export function mergeSiteBannersConfig(
  stored: Partial<SiteBannersConfig> | null | undefined,
  categories: CategoryItem[]
): SiteBannersConfig {
  const defaults = buildDefaultSiteBanners(categories);
  if (!stored || typeof stored !== 'object') {
    return defaults;
  }

  const mergedCategoryBanners: Record<string, CategoryBannerConfig> = {
    ...defaults.categoryBanners,
  };

  if (stored.categoryBanners && typeof stored.categoryBanners === 'object') {
    for (const [key, val] of Object.entries(stored.categoryBanners)) {
      if (val && typeof val === 'object') {
        const fallback = mergedCategoryBanners[key];
        const rawKicker =
          typeof val.kicker === 'string'
            ? val.kicker.replace(/SAMO ATELIER/gi, 'SAMO WEAVE')
            : fallback?.kicker || 'SAMO WEAVE';
        mergedCategoryBanners[key] = {
          categoryKey: key,
          department: val.department || fallback?.department || 'women',
          categoryName: val.categoryName || fallback?.categoryName || key,
          imageUrl:
            typeof val.imageUrl === 'string'
              ? val.imageUrl
              : fallback?.imageUrl || '',
          kicker: rawKicker,
          title:
            typeof val.title === 'string'
              ? val.title
              : fallback?.title || 'COLLECTION ARCHIVE',
          enabled:
            typeof val.enabled === 'boolean'
              ? val.enabled
              : fallback?.enabled ?? true,
          insertAfterCount:
            typeof val.insertAfterCount === 'number' && val.insertAfterCount >= 2
              ? val.insertAfterCount
              : fallback?.insertAfterCount ?? 4,
          updatedAt:
            typeof val.updatedAt === 'string' && val.updatedAt
              ? val.updatedAt
              : fallback?.updatedAt || new Date().toISOString(),
        };
      }
    }
  }

  return {
    homeHeroMediaType:
      stored.homeHeroMediaType === 'image' ? 'image' : 'video',
    homeHeroVideoUrl:
      typeof stored.homeHeroVideoUrl === 'string' &&
      stored.homeHeroVideoUrl.trim()
        ? stored.homeHeroVideoUrl.trim()
        : defaults.homeHeroVideoUrl,
    homeHeroImageUrl:
      typeof stored.homeHeroImageUrl === 'string' &&
      stored.homeHeroImageUrl.trim()
        ? stored.homeHeroImageUrl.trim()
        : defaults.homeHeroImageUrl,
    homeHeroKicker:
      typeof stored.homeHeroKicker === 'string' && stored.homeHeroKicker.trim()
        ? stored.homeHeroKicker.replace(/SAMO ATELIER/gi, 'SAMO WEAVE')
        : defaults.homeHeroKicker,
    homeHeroTitle:
      typeof stored.homeHeroTitle === 'string' && stored.homeHeroTitle.trim()
        ? stored.homeHeroTitle
        : defaults.homeHeroTitle,
    homeMiddleBannerUrl:
      typeof stored.homeMiddleBannerUrl === 'string' &&
      stored.homeMiddleBannerUrl.trim()
        ? stored.homeMiddleBannerUrl.trim()
        : defaults.homeMiddleBannerUrl,
    homeMiddleKicker:
      typeof stored.homeMiddleKicker === 'string' &&
      stored.homeMiddleKicker.trim()
        ? stored.homeMiddleKicker.replace(/SAMO KIDS ATELIER/gi, 'SAMO KIDS').replace(/SAMO ATELIER/gi, 'SAMO WEAVE')
        : defaults.homeMiddleKicker,
    homeMiddleTitle:
      typeof stored.homeMiddleTitle === 'string' &&
      stored.homeMiddleTitle.trim()
        ? stored.homeMiddleTitle
        : defaults.homeMiddleTitle,
    homeMiddleSubtitle:
      typeof stored.homeMiddleSubtitle === 'string' &&
      stored.homeMiddleSubtitle.trim()
        ? stored.homeMiddleSubtitle
        : defaults.homeMiddleSubtitle,
    homeBottomNewArrivalsUrl:
      typeof stored.homeBottomNewArrivalsUrl === 'string' &&
      stored.homeBottomNewArrivalsUrl.trim()
        ? stored.homeBottomNewArrivalsUrl.trim()
        : defaults.homeBottomNewArrivalsUrl,
    homeBottomGiftsUrl:
      typeof stored.homeBottomGiftsUrl === 'string' &&
      stored.homeBottomGiftsUrl.trim()
        ? stored.homeBottomGiftsUrl.trim()
        : defaults.homeBottomGiftsUrl,
    homeBottomShowroomUrl:
      typeof stored.homeBottomShowroomUrl === 'string' &&
      stored.homeBottomShowroomUrl.trim()
        ? stored.homeBottomShowroomUrl.trim()
        : defaults.homeBottomShowroomUrl,
    showroomHeroBannerUrl:
      typeof stored.showroomHeroBannerUrl === 'string' &&
      stored.showroomHeroBannerUrl.trim()
        ? stored.showroomHeroBannerUrl.trim()
        : defaults.showroomHeroBannerUrl,
    categoryBanners: mergedCategoryBanners,
  };
}

/**
 * Determines the product index at which to insert the in-feed Category Editorial Banner
 * so that products appear before the banner and remaining products appear after it.
 */
export function getCategoryBannerSplitIndex(
  totalProducts: number,
  insertAfterCount = 4
): number {
  if (totalProducts <= 0) return 0;
  const preferred = Math.max(2, Math.floor(Number(insertAfterCount) || 4));
  if (totalProducts > preferred) {
    return preferred;
  }
  if (totalProducts > 2) {
    return 2;
  }
  if (totalProducts === 2) {
    return 1;
  }
  return 1;
}

/**
 * Generates a tailored luxury editorial product description from product attributes
 * so "Auto-Draft Editorial Notes" works instantaneously both with AI and offline/on live static hosting.
 */
export function buildEditorialProductDescription(
  params: {
    name?: string;
    department?: Department;
    category?: string;
    style?: string;
    materials?: string[];
    colors?: string[];
  },
  variationIndex = 0
): string {
  const cleanName = (params.name || '').trim();
  const deptLabel = params.department === 'kids' ? 'SAMO Kids' : 'SAMO Women';
  const categoryLabel = (params.category || 'Signature Piece').trim();
  const styleLabel = (params.style || 'Classic').trim();
  const materialsList = Array.isArray(params.materials)
    ? params.materials.map((m) => m.trim()).filter(Boolean)
    : [];
  const colorsList = Array.isArray(params.colors)
    ? params.colors.map((c) => c.trim()).filter(Boolean)
    : [];

  const subjectPhrase = cleanName
    ? `${cleanName} — ${deptLabel.toLowerCase()} ${categoryLabel.toLowerCase()}`
    : `Architectural ${deptLabel.toLowerCase()} ${categoryLabel.toLowerCase()} silhouette`;

  const materialPhrase =
    materialsList.length > 0
      ? ` crafted in supple ${materialsList.join(', ')}`
      : '';

  const colorPhrase =
    colorsList.length > 0
      ? ` Available in ${colorsList.join(', ')} colorway${colorsList.length > 1 ? 's' : ''}.`
      : '';

  const templates = [
    `${subjectPhrase}${materialPhrase}. Tailored in the house's signature ${styleLabel.toLowerCase()} proportions with clean architectural lines and precision finishing.${colorPhrase}`,
    `Designed for the ${deptLabel} collection, this ${categoryLabel.toLowerCase()}${materialPhrase} balances structured ${styleLabel.toLowerCase()} construction with effortless movement and refined hardware details.${colorPhrase}`,
    `SAMO Weave ${styleLabel.toLowerCase()} ${categoryLabel.toLowerCase()}${materialPhrase}, cut with a sharp silhouette, tonal seam work, and enduring house craftsmanship.${colorPhrase}`,
  ];

  const idx = Math.abs(variationIndex) % templates.length;
  return templates[idx].slice(0, 950);
}

/**
 * Updates a category's sortOrder number (supporting integers like 1, 2, 3 and decimals like 1.5, 2.5).
 */
export function updateCategorySortOrder(
  categories: CategoryItem[],
  categoryId: string,
  newSortOrder: number
): CategoryItem[] {
  const safeOrder = Number.isFinite(newSortOrder)
    ? Math.max(0.01, Math.round(newSortOrder * 100) / 100)
    : 1;
  return categories.map((cat) =>
    cat.id === categoryId
      ? {
          ...cat,
          sortOrder: safeOrder,
        }
      : cat
  );
}

/**
 * Swaps a category one position up or down within its department (Women or Kids)
 * and re-assigns clean sequential numbers (1, 2, 3...) to that department.
 */
export function moveCategoryInDepartment(
  categories: CategoryItem[],
  department: Department,
  categoryId: string,
  direction: 'up' | 'down'
): CategoryItem[] {
  const deptCategories = getCategoriesByDepartment(categories, department);
  const currentIndex = deptCategories.findIndex((c) => c.id === categoryId);
  if (currentIndex === -1) return categories;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= deptCategories.length) {
    return categories;
  }

  const reordered = [...deptCategories];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, moved);

  const orderById = new Map<string, number>();
  reordered.forEach((cat, idx) => {
    orderById.set(cat.id, idx + 1);
  });

  const updated = categories.map((cat) => {
    if (cat.department === department && orderById.has(cat.id)) {
      return {
        ...cat,
        sortOrder: orderById.get(cat.id)!,
      };
    }
    return cat;
  });

  // Also sort the underlying array by department + sortOrder so any direct iteration stays in sync
  return [...updated].sort((a, b) => {
    if (a.department !== b.department) {
      return a.department === 'women' ? -1 : 1;
    }
    return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
  });
}

/**
 * Cleanly re-numbers all categories in a department as 1, 2, 3, 4... in their current sorted order.
 */
export function renumberDepartmentCategoriesSequentially(
  categories: CategoryItem[],
  department: Department
): CategoryItem[] {
  const deptCategories = getCategoriesByDepartment(categories, department);
  const orderById = new Map<string, number>();
  deptCategories.forEach((cat, idx) => {
    orderById.set(cat.id, idx + 1);
  });

  return categories.map((cat) =>
    cat.department === department && orderById.has(cat.id)
      ? {
          ...cat,
          sortOrder: orderById.get(cat.id)!,
        }
      : cat
  );
}

export const DEFAULT_NEWSLETTER_POPUP_CONFIG: NewsletterPopupConfig = {
  enabled: true,
  delaySeconds: 10,
  maxTimesPerDay: 2,
  kicker: '',
  title: 'Subscribe to Samo Weave',
  subtitle:
    'Enter your email or phone number to receive early access to new arrivals, latest offers, and seasonal sales.',
  buttonText: 'Unlock your code',
  promoCode: 'SAMO10',
  discountText: '10% OFF',
};

const LEGACY_POPUP_TITLES = new Set([
  'UNLOCK 10% OFF YOUR FIRST ACQUISITION',
]);
const LEGACY_POPUP_SUBTITLES = new Set([
  'Enter your email and phone number to join the SAMO Atelier private list and immediately unlock your 10% privilege promo code (SAMO10).',
  'Enter your email and phone number to join the SAMO Atelier private list and immediately unlock your 10% privilege promo code.',
]);
const LEGACY_POPUP_BUTTONS = new Set([
  'UNLOCK 10% PRIVILEGE CODE',
]);
const LEGACY_POPUP_KICKERS = new Set([
  'SAMO ATELIER · PRIVATE CLIENT INVITATION',
]);

export function mergeNewsletterPopupConfig(
  stored?: Partial<NewsletterPopupConfig> | null
): NewsletterPopupConfig {
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_NEWSLETTER_POPUP_CONFIG };
  }

  const rawTitle =
    typeof stored.title === 'string'
      ? LEGACY_POPUP_TITLES.has(stored.title.trim())
        ? DEFAULT_NEWSLETTER_POPUP_CONFIG.title
        : stored.title
      : DEFAULT_NEWSLETTER_POPUP_CONFIG.title;

  const rawSubtitle =
    typeof stored.subtitle === 'string'
      ? LEGACY_POPUP_SUBTITLES.has(stored.subtitle.trim())
        ? DEFAULT_NEWSLETTER_POPUP_CONFIG.subtitle
        : stored.subtitle.replace(/SAMO Atelier/gi, 'SAMO Weave')
      : DEFAULT_NEWSLETTER_POPUP_CONFIG.subtitle;

  const rawButton =
    typeof stored.buttonText === 'string'
      ? LEGACY_POPUP_BUTTONS.has(stored.buttonText.trim())
        ? DEFAULT_NEWSLETTER_POPUP_CONFIG.buttonText
        : stored.buttonText
      : DEFAULT_NEWSLETTER_POPUP_CONFIG.buttonText;

  const rawKicker =
    typeof stored.kicker === 'string'
      ? LEGACY_POPUP_KICKERS.has(stored.kicker.trim())
        ? ''
        : stored.kicker.replace(/SAMO ATELIER/gi, 'SAMO WEAVE')
      : DEFAULT_NEWSLETTER_POPUP_CONFIG.kicker;

  return {
    enabled:
      typeof stored.enabled === 'boolean'
        ? stored.enabled
        : DEFAULT_NEWSLETTER_POPUP_CONFIG.enabled,
    delaySeconds:
      typeof stored.delaySeconds === 'number' &&
      Number.isFinite(stored.delaySeconds) &&
      stored.delaySeconds >= 0
        ? Math.min(300, Math.max(0, Math.round(stored.delaySeconds)))
        : DEFAULT_NEWSLETTER_POPUP_CONFIG.delaySeconds,
    maxTimesPerDay:
      typeof stored.maxTimesPerDay === 'number' &&
      Number.isFinite(stored.maxTimesPerDay) &&
      stored.maxTimesPerDay >= 1
        ? Math.min(50, Math.max(1, Math.round(stored.maxTimesPerDay)))
        : DEFAULT_NEWSLETTER_POPUP_CONFIG.maxTimesPerDay,
    kicker: rawKicker,
    title: rawTitle,
    subtitle: rawSubtitle,
    buttonText: rawButton,
    promoCode:
      typeof stored.promoCode === 'string'
        ? stored.promoCode.toUpperCase()
        : DEFAULT_NEWSLETTER_POPUP_CONFIG.promoCode,
    discountText:
      typeof stored.discountText === 'string' && stored.discountText.trim()
        ? stored.discountText
        : DEFAULT_NEWSLETTER_POPUP_CONFIG.discountText,
    updatedAt:
      typeof stored.updatedAt === 'string' ? stored.updatedAt : undefined,
  };
}

/**
 * Validates the Homepage Newsletter Pop-Up submission:
 * Supports both:
 * 1) Single-box input ("Enter your Email Or Number", e.g. "johndoe@gmail.com", "70 123 456", or "johndoe@gmail.com, 70 123 456")
 * 2) Two-argument (rawEmail, rawPhone) calls.
 */
export function validateNewsletterPopupInputs(
  rawEmailOrCombined: string,
  rawPhone?: string
): {
  valid: boolean;
  emailValid: boolean;
  phoneValid: boolean;
  cleanEmail: string;
  cleanPhone: string;
  errorMessage?: string;
} {
  // Mode A: Explicit 2-argument call (when rawPhone is passed as a string)
  if (typeof rawPhone === 'string') {
    const cleanEmail = (rawEmailOrCombined || '').trim().toLowerCase();
    const cleanPhone = rawPhone.trim();
    const phoneDigits = cleanPhone.replace(/\D/g, '');

    const hasAtAndDotCom =
      cleanEmail.includes('@') &&
      cleanEmail.includes('.com') &&
      /^[^\s@]+@[^\s@]+\.com(?:\.[a-z]{2,})?$/i.test(cleanEmail);

    const hasMinEightDigits = phoneDigits.length >= 8;

    if (!hasAtAndDotCom && !hasMinEightDigits) {
      return {
        valid: false,
        emailValid: false,
        phoneValid: false,
        cleanEmail,
        cleanPhone,
        errorMessage:
          'Please enter a valid email address or phone number (at least 8 digits).',
      };
    }

    if (!hasAtAndDotCom) {
      return {
        valid: false,
        emailValid: false,
        phoneValid: true,
        cleanEmail,
        cleanPhone,
        errorMessage:
          'Please enter a valid email address containing "@" and ".com".',
      };
    }

    if (!hasMinEightDigits) {
      return {
        valid: false,
        emailValid: true,
        phoneValid: false,
        cleanEmail,
        cleanPhone,
        errorMessage:
          'Please enter a valid phone number containing at least 8 digits.',
      };
    }

    return {
      valid: true,
      emailValid: true,
      phoneValid: true,
      cleanEmail,
      cleanPhone,
    };
  }

  // Mode B: Single-box input ("Enter your Email Or Number")
  const combined = (rawEmailOrCombined || '').trim();
  if (!combined) {
    return {
      valid: false,
      emailValid: false,
      phoneValid: false,
      cleanEmail: '',
      cleanPhone: '',
      errorMessage:
        'Please enter your email address or phone number (e.g., johndoe@gmail.com, 70 123 456).',
    };
  }

  // Extract email candidate if '@' is present
  const emailMatch = combined.match(/[^\s,;]+@[^\s,;]+/i);
  const candidateEmail = emailMatch ? emailMatch[0].trim().toLowerCase() : '';
  const emailValid =
    Boolean(candidateEmail) &&
    candidateEmail.includes('@') &&
    candidateEmail.includes('.') &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(candidateEmail);

  // Extract phone part by removing any email token and checking digits
  const remainderWithoutEmail = candidateEmail
    ? combined.replace(emailMatch![0], '').replace(/^[\s,;|/]+|[\s,;|/]+$/g, '')
    : combined;
  const phoneDigits = remainderWithoutEmail.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 8;

  // If the user typed '@' but the email is incomplete and no valid phone is provided
  if (combined.includes('@') && !emailValid && !phoneValid) {
    return {
      valid: false,
      emailValid: false,
      phoneValid: false,
      cleanEmail: candidateEmail,
      cleanPhone: '',
      errorMessage:
        'Please enter a valid email address (e.g., johndoe@gmail.com) or an 8-digit phone number (e.g., 70 123 456).',
    };
  }

  if (!emailValid && !phoneValid) {
    return {
      valid: false,
      emailValid: false,
      phoneValid: false,
      cleanEmail: '',
      cleanPhone: remainderWithoutEmail,
      errorMessage:
        'Please enter a valid email address or a phone number with at least 8 digits (e.g., johndoe@gmail.com, 70 123 456).',
    };
  }

  return {
    valid: true,
    emailValid,
    phoneValid,
    cleanEmail: emailValid ? candidateEmail : '',
    cleanPhone: phoneValid ? remainderWithoutEmail : '',
  };
}





