import {
  CategoryItem,
  Department,
  ProductItem,
  RoutePath,
  SeoConfigState,
  SiteBannersConfig,
} from '../types/samo';
import {
  buildCategoryUrl,
  buildProductUrl,
  createSafeSlug,
  getCategoriesByDepartment,
  getEffectiveProductPrice,
  normalizeKidsCategoryName,
} from './catalogLogic';

export const SAMO_CANONICAL_DOMAIN = 'https://samoweave.com';

export const LUXURY_FASHION_CORE_KEYWORDS: readonly string[] = [
  'SAMO',
  'SAMO Weave',
  'luxury fashion house',
  'architectural ready-to-wear',
  'Italian cow leather jacket',
  'calf suede trench coat',
  'luxury women outerwear',
  'couture tailoring',
  'designer leather bags',
  'luxury kids wear',
  'precision centimeter sizing',
  'fine leather atelier',
  'sport chic luxury',
  'Beirut Paris Milan luxury fashion',
];

/**
 * Generates an industry-standard luxury fashion SEO alt & title attribute for any product or editorial image.
 */
export function buildProductImageSeoAlt(params: {
  name?: string;
  alt?: string;
  department?: Department | string;
  category?: string;
  style?: string;
  materials?: string[];
  colorName?: string;
}): string {
  const rawName = (params.name || params.alt || '').trim();
  if (!rawName) {
    return 'SAMO Weave (Est. 1999) — Architectural Luxury Ready-to-Wear, Fine Leather, Suede & Fur';
  }

  // If the alt text already includes the full SAMO SEO signature, return as-is
  if (rawName.includes('SAMO') && rawName.includes('Luxury Ready-to-Wear')) {
    return rawName;
  }

  const deptLabel =
    params.department === 'kids'
      ? 'SAMO Kids'
      : params.department === 'women'
      ? 'SAMO Women'
      : 'SAMO Weave';

  const catLabel = (params.category || '').trim();
  const styleLabel = (params.style || '').trim();
  const colorLabel = (params.colorName || '').trim();
  const materialsList = Array.isArray(params.materials)
    ? params.materials.map((m) => m.trim()).filter(Boolean)
    : [];

  const parts: string[] = [`${deptLabel}${catLabel ? ` ${catLabel}` : ''}`];
  parts.push(colorLabel ? `${rawName} (${colorLabel})` : rawName);

  if (materialsList.length > 0) {
    parts.push(`Crafted in ${materialsList.slice(0, 3).join(', ')}`);
  }
  if (styleLabel) {
    parts.push(`${styleLabel} Luxury Ready-to-Wear`);
  } else {
    parts.push('Architectural Luxury Ready-to-Wear');
  }
  parts.push('SAMO Weave (Est. 1999)');

  return parts.join(' — ');
}

/**
 * Scans all products, categories, and banners to build a complete, up-to-date SEO & Image Metadata state.
 * Triggered automatically or via the Admin Dashboard's one-click "Update Website SEO & Image Metadata" button.
 */
export function generateCatalogSeoSnapshot(
  products: ProductItem[],
  categories: CategoryItem[],
  siteBanners?: SiteBannersConfig,
  customKeywords?: string[]
): SeoConfigState {
  const activeCoreKeywords =
    Array.isArray(customKeywords)
      ? Array.from(
          new Set(customKeywords.map((k) => k.trim()).filter(Boolean))
        )
      : [...LUXURY_FASHION_CORE_KEYWORDS];

  const productSeoMap: SeoConfigState['productSeoMap'] = {};
  const categorySeoMap: SeoConfigState['categorySeoMap'] = {};
  let totalImagesIndexed = 0;

  // 1. Index all categories (Women & Kids)
  const womenCats = getCategoriesByDepartment(categories, 'women');
  const kidsCats = getCategoriesByDepartment(categories, 'kids');
  const allValidCategories = [...womenCats, ...kidsCats];

  for (const cat of allValidCategories) {
    const deptTitle = cat.department === 'kids' ? 'SAMO Kids' : 'SAMO Women';
    const cleanName =
      cat.department === 'kids'
        ? normalizeKidsCategoryName(cat.name)
        : cat.name.trim();
    const slug = createSafeSlug(cleanName);
    const key = `${cat.department}:${slug}`;
    const canonicalPath = buildCategoryUrl(cat.department, cleanName);

    const matchingProducts = products.filter(
      (p) =>
        p.department === cat.department &&
        (cat.department === 'kids'
          ? normalizeKidsCategoryName(p.category).toLowerCase() ===
            cleanName.toLowerCase()
          : p.category.trim().toLowerCase() === cleanName.toLowerCase())
    );

    const materialSet = new Set<string>();
    for (const mp of matchingProducts) {
      for (const m of mp.materials || []) {
        if (m.trim()) materialSet.add(m.trim());
      }
    }
    const topMaterials = Array.from(materialSet).slice(0, 4);

    const title = `${cleanName} — ${deptTitle} Luxury Collection | SAMO Weave (Est. 1999)`;
    const description =
      cat.description && cat.description.trim().length > 20
        ? `${cat.description.trim()} Explore ${matchingProducts.length || 'exclusive'} pieces in ${
            topMaterials.length > 0
              ? topMaterials.join(', ')
              : 'Italian cow leather, suede, cashmere, and silk'
          } at SAMO Weave.`
        : `Discover SAMO ${deptTitle} ${cleanName}. Architectural luxury silhouettes tailored in ${
            topMaterials.length > 0
              ? topMaterials.join(', ')
              : 'fine leather, brushed suede, and couture fabrics'
          }.`;

    const keywords = Array.from(
      new Set([
        `SAMO ${cleanName}`,
        `${deptTitle} ${cleanName}`,
        `luxury ${cleanName.toLowerCase()}`,
        ...topMaterials.map((m) => `${m.toLowerCase()} ${cleanName.toLowerCase()}`),
        'SAMO Weave',
        'architectural luxury fashion',
        ...activeCoreKeywords.slice(0, 6),
      ])
    );

    categorySeoMap[key] = {
      title,
      description: description.slice(0, 160),
      keywords,
      canonicalPath,
    };
  }

  // 2. Index all products and count all product + variant + gallery images
  for (const prod of products) {
    const deptTitle = prod.department === 'kids' ? 'SAMO Kids' : 'SAMO Women';
    const { effectivePrice, hasDiscount, discountBadge } =
      getEffectiveProductPrice(prod);
    const materialsText =
      Array.isArray(prod.materials) && prod.materials.length > 0
        ? prod.materials.join(', ')
        : 'Luxury Weave Fabrics';
    const colorNames = Array.isArray(prod.colorVariants)
      ? prod.colorVariants.map((v) => v.colorName).filter(Boolean)
      : [];

    const imageAlt = buildProductImageSeoAlt({
      name: prod.name,
      department: prod.department,
      category: prod.category,
      style: prod.style,
      materials: prod.materials,
      colorName: colorNames[0],
    });

    const title = `${prod.name} — ${deptTitle} ${prod.category} | SAMO Weave`;
    const priceSnippet = hasDiscount
      ? `$${effectivePrice.toLocaleString()} (${discountBadge})`
      : `$${effectivePrice.toLocaleString()}`;
    const rawDesc =
      prod.description && prod.description.trim()
        ? prod.description.trim()
        : `${prod.name} by ${deptTitle}. Crafted in ${materialsText}.`;

    const description = `${rawDesc} ${priceSnippet} · ${materialsText}. Shop authentic SAMO Weave luxury ready-to-wear.`.slice(
      0,
      160
    );

    const keywords = Array.from(
      new Set([
        prod.name,
        `SAMO ${prod.category}`,
        `${deptTitle} ${prod.category}`,
        `${prod.style} ${prod.category}`,
        ...(prod.materials || []).map((m) => `${m} ${prod.category}`),
        ...colorNames.map((c) => `${c} ${prod.name}`),
        'SAMO Weave',
        ...activeCoreKeywords.slice(0, 5),
      ])
    );

    productSeoMap[prod.id] = {
      title,
      description,
      keywords,
      imageAlt,
      canonicalPath: buildProductUrl(prod),
    };

    if (prod.imageUrl) totalImagesIndexed += 1;
    if (Array.isArray(prod.galleryUrls)) {
      totalImagesIndexed += prod.galleryUrls.filter(Boolean).length;
    }
    if (Array.isArray(prod.colorVariants)) {
      for (const cv of prod.colorVariants) {
        if (cv.imageUrl) totalImagesIndexed += 1;
        if (Array.isArray(cv.galleryUrls)) {
          totalImagesIndexed += cv.galleryUrls.filter(Boolean).length;
        }
      }
    }
  }

  if (siteBanners) {
    totalImagesIndexed += 5; // Hero, middle, and bottom editorial banners
    if (siteBanners.categoryBanners) {
      totalImagesIndexed += Object.values(siteBanners.categoryBanners).filter(
        (b) => b && b.enabled && b.imageUrl
      ).length;
    }
  }

  return {
    lastUpdatedAt: new Date().toISOString(),
    siteTitleSuffix: 'SAMO — Architectural Luxury Fashion House | Est. 1999',
    defaultDescription:
      'SAMO (Est. 1999) — Architectural luxury ready-to-wear for Women and Kids. Discover Classic, Sport Chic, Fine Leather, Suede, Fur, Bags, and Belts.',
    defaultKeywords: activeCoreKeywords,
    customKeywords: activeCoreKeywords,
    indexedProductsCount: products.length,
    indexedCategoriesCount: allValidCategories.length,
    indexedImagesCount: totalImagesIndexed,
    productSeoMap,
    categorySeoMap,
  };
}

export interface DynamicPageSeoResult {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  ogType: 'website' | 'product';
  jsonLd: Record<string, unknown>;
}

/**
 * Computes dynamic route, category, and product SEO metadata + Schema.org JSON-LD.
 */
export function buildDynamicPageSeo(params: {
  route: RoutePath;
  selectedCategory: string;
  activeProduct?: ProductItem | null;
  categories: CategoryItem[];
  products: ProductItem[];
  seoConfig?: SeoConfigState | null;
}): DynamicPageSeoResult {
  const {
    route,
    selectedCategory,
    activeProduct,
    categories,
    products,
    seoConfig,
  } = params;

  const baseImage = `${SAMO_CANONICAL_DOMAIN}/assets/aistudio/women_jacket_black_leather_biker_ebca0f57.png`;

  // 1. If a Product Pop-Up Modal is open, prioritize Product-level SEO & Schema.org Product JSON-LD
  if (activeProduct) {
    const { effectivePrice, originalPrice, hasDiscount } =
      getEffectiveProductPrice(activeProduct);
    const snap = seoConfig?.productSeoMap?.[activeProduct.id];
    const deptLabel =
      activeProduct.department === 'kids' ? 'SAMO Kids' : 'SAMO Women';
    const title =
      snap?.title ||
      `${activeProduct.name} — ${deptLabel} ${activeProduct.category} | SAMO Weave`;
    const description =
      snap?.description ||
      `${activeProduct.description || activeProduct.name} — Crafted in ${(
        activeProduct.materials || []
      ).join(', ')}. $${effectivePrice.toLocaleString()} at SAMO Weave.`.slice(
        0,
        160
      );
    const keywordsList = snap?.keywords || [
      activeProduct.name,
      `SAMO ${activeProduct.category}`,
      ...(activeProduct.materials || []),
      ...LUXURY_FASHION_CORE_KEYWORDS.slice(0, 6),
    ];
    const canonicalUrl = `${SAMO_CANONICAL_DOMAIN}${buildProductUrl(
      activeProduct
    )}`;
    const productImg =
      activeProduct.imageUrl && activeProduct.imageUrl.startsWith('http')
        ? activeProduct.imageUrl
        : baseImage;

    return {
      title,
      description,
      keywords: keywordsList.join(', '),
      canonicalUrl,
      ogTitle: title,
      ogDescription: description,
      ogUrl: canonicalUrl,
      ogImage: productImg,
      ogType: 'product',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${SAMO_CANONICAL_DOMAIN}/#organization`,
            name: 'SAMO Weave',
            alternateName: 'SAMO Luxury House',
            foundingDate: '1999',
            url: SAMO_CANONICAL_DOMAIN,
          },
          {
            '@type': 'Product',
            '@id': canonicalUrl,
            name: activeProduct.name,
            description: activeProduct.description || description,
            sku: activeProduct.id,
            category: `${deptLabel} > ${activeProduct.category}`,
            material: (activeProduct.materials || []).join(', '),
            image: [productImg],
            brand: {
              '@type': 'Brand',
              name: 'SAMO',
            },
            offers: {
              '@type': 'Offer',
              url: canonicalUrl,
              priceCurrency: 'USD',
              price: effectivePrice,
              ...(hasDiscount
                ? {
                    priceSpecification: {
                      '@type': 'UnitPriceSpecification',
                      price: effectivePrice,
                      priceCurrency: 'USD',
                      referenceQuantity: {
                        '@type': 'QuantitativeValue',
                        value: originalPrice,
                      },
                    },
                  }
                : {}),
              availability: activeProduct.inStock
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              itemCondition: 'https://schema.org/NewCondition',
            },
          },
        ],
      },
    };
  }

  // 2. Category-specific SEO on /women or /kids
  if (
    (route === '/women' || route === '/kids') &&
    selectedCategory &&
    selectedCategory.toLowerCase() !== 'all'
  ) {
    const dept: Department = route === '/kids' ? 'kids' : 'women';
    const cleanCat =
      dept === 'kids'
        ? normalizeKidsCategoryName(selectedCategory)
        : selectedCategory.trim();
    const slug = createSafeSlug(cleanCat);
    const key = `${dept}:${slug}`;
    const snap = seoConfig?.categorySeoMap?.[key];
    const matchedCat = getCategoriesByDepartment(categories, dept).find(
      (c) => c.name.toLowerCase() === cleanCat.toLowerCase()
    );

    const deptTitle = dept === 'kids' ? 'SAMO Kids' : 'SAMO Women';
    const title =
      snap?.title ||
      `${cleanCat} — ${deptTitle} Luxury Collection | SAMO Weave (Est. 1999)`;
    const description =
      snap?.description ||
      matchedCat?.description ||
      `Explore ${deptTitle} ${cleanCat} at SAMO Weave. Architectural ready-to-wear in Italian cow leather, calf suede, cashmere, and silk.`;
    const keywords = (
      snap?.keywords || [
        `SAMO ${cleanCat}`,
        `${deptTitle} ${cleanCat}`,
        ...LUXURY_FASHION_CORE_KEYWORDS.slice(0, 8),
      ]
    ).join(', ');
    const canonicalUrl = `${SAMO_CANONICAL_DOMAIN}${buildCategoryUrl(
      dept,
      cleanCat
    )}`;

    return {
      title,
      description,
      keywords,
      canonicalUrl,
      ogTitle: title,
      ogDescription: description,
      ogUrl: canonicalUrl,
      ogImage: baseImage,
      ogType: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonicalUrl,
        isPartOf: {
          '@type': 'WebSite',
          name: 'SAMO Weave',
          url: SAMO_CANONICAL_DOMAIN,
        },
      },
    };
  }

  // 3. Route-level SEO (/home, /women, /kids, /new-arrivals, /gifts, /showroom, /admin)
  const routeMetaMap: Record<
    RoutePath,
    { title: string; description: string; path: string }
  > = {
    '/home': {
      title: 'SAMO — Architectural Luxury Fashion House | Est. 1999',
      description:
        seoConfig?.defaultDescription ||
        'SAMO (Est. 1999) — Architectural luxury ready-to-wear for Women and Kids. Discover Classic, Sport Chic, Fine Leather, Suede, Fur, Bags, and Belts.',
      path: '/home',
    },
    '/women': {
      title:
        'SAMO Women — Leather Jackets, Trench Coats, Tailoring, Fur & Bags | SAMO Weave',
      description:
        'Shop SAMO Women ready-to-wear: architectural Italian cow leather biker jackets, oversized calf suede trench coats, full sets, silk tops, fur coats, and signature bags.',
      path: '/women',
    },
    '/kids': {
      title:
        'SAMO Kids — Minis (1–5), Children (6+) & Teen (13+) Luxury Collection | SAMO Weave',
      description:
        'Explore SAMO Kids architectural luxury outerwear, cashmere knit sets, leather bombers, and tailored denim graded in precision centimeter sizing (80 cm – 160 cm).',
      path: '/kids',
    },
    '/new-arrivals': {
      title:
        'New Arrivals — Latest Runway Releases | SAMO Weave (Est. 1999)',
      description:
        'Discover the latest SAMO Weave arrivals for Women and Kids in vegetable-tanned leather, cognac calf suede, shearling fur, and heavy silk.',
      path: '/new-arrivals',
    },
    '/gifts': {
      title:
        'SAMO Gifts — Signature Leather Bags, Hourglass Top-Handles & Brass Belts | SAMO Weave',
      description:
        'Curated luxury gifts from SAMO Weave: concave top-handle leather bags, Rodeo totes, and Italian cow leather belts with brushed palladium hardware.',
      path: '/gifts',
    },
    '/showroom': {
      title:
        'SAMO Showroom & Private Client Appointments | Architecture & Heritage (Est. 1999)',
      description:
        'Visit the SAMO flagship showroom for private fittings, bespoke leather and fur consultations, and same-day showroom pickup reservations.',
      path: '/showroom',
    },
    '/admin': {
      title: 'SAMO Weave Admin Portal | Catalog, Inventory & SEO Management',
      description: 'SAMO Weave internal management portal.',
      path: '/admin',
    },
  };

  const chosen = routeMetaMap[route] || routeMetaMap['/home'];
  const canonicalUrl = `${SAMO_CANONICAL_DOMAIN}${chosen.path}`;

  return {
    title: chosen.title,
    description: chosen.description,
    keywords: (seoConfig?.defaultKeywords || LUXURY_FASHION_CORE_KEYWORDS).join(
      ', '
    ),
    canonicalUrl,
    ogTitle: chosen.title,
    ogDescription: chosen.description,
    ogUrl: canonicalUrl,
    ogImage: baseImage,
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${SAMO_CANONICAL_DOMAIN}/#organization`,
          name: 'SAMO Weave',
          alternateName: 'SAMO — Architectural Luxury Fashion House',
          foundingDate: '1999',
          url: SAMO_CANONICAL_DOMAIN,
        },
        {
          '@type': 'WebSite',
          '@id': `${SAMO_CANONICAL_DOMAIN}/#website`,
          url: SAMO_CANONICAL_DOMAIN,
          name: 'SAMO Weave',
          description: chosen.description,
          publisher: {
            '@id': `${SAMO_CANONICAL_DOMAIN}/#organization`,
          },
        },
        {
          '@type': 'CollectionPage',
          '@id': canonicalUrl,
          name: chosen.title,
          description: chosen.description,
          url: canonicalUrl,
          numberOfItems: products.length,
        },
      ],
    },
  };
}

/**
 * Applies the computed SEO tags and Schema.org JSON-LD directly to document.head in real time.
 */
export function applyDocumentSeoTags(seo: DynamicPageSeoResult): void {
  if (typeof document === 'undefined') return;

  document.title = seo.title;

  const setMetaTag = (
    attrName: 'name' | 'property',
    attrValue: string,
    content: string
  ) => {
    let el = document.head.querySelector(
      `meta[${attrName}="${attrValue}"]`
    ) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMetaTag('name', 'description', seo.description);
  setMetaTag('name', 'keywords', seo.keywords);
  setMetaTag('property', 'og:title', seo.ogTitle);
  setMetaTag('property', 'og:description', seo.ogDescription);
  setMetaTag('property', 'og:url', seo.ogUrl);
  setMetaTag('property', 'og:image', seo.ogImage);
  setMetaTag('property', 'og:type', seo.ogType);
  setMetaTag('name', 'twitter:title', seo.ogTitle);
  setMetaTag('name', 'twitter:description', seo.ogDescription);
  setMetaTag('name', 'twitter:image', seo.ogImage);

  let canonicalEl = document.head.querySelector(
    'link[rel="canonical"]'
  ) as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', seo.canonicalUrl);

  let scriptEl = document.getElementById(
    'samo-dynamic-jsonld'
  ) as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'samo-dynamic-jsonld';
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(seo.jsonLd);
}
