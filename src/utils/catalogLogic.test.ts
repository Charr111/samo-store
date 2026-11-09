import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSizeQuantitiesMap,
  calculateOrderTotals,
  decrementStockForAcceptedOrder,
  filterGiftsProducts,
  filterNewArrivalProducts,
  filterOrdersByQuery,
  getComplementaryUpsellProducts,
  getEffectiveProductPrice,
  getSizeQuantity,
  isAuthorizedAdminEmail,
  mergeColorsList,
  mergeMaterialsList,
  normalizeSizeEntry,
  parsePathnameToRoute,
  PREBUILT_COLORS,
  resolveProductQuantity,
  sumSizeQuantities,
  SUPER_ADMIN_EMAILS,
  syncFullSetsWithCatalog,
  syncProductFromColorVariants,
} from './catalogLogic';
import { OrderItem, ProductItem } from '../types/samo';

test('parsePathnameToRoute resolves /home, /women, /kids, /new-arrivals, /gifts, /showroom, and isolates /admin', () => {
  assert.equal(parsePathnameToRoute('/'), '/home');
  assert.equal(parsePathnameToRoute('/home'), '/home');
  assert.equal(parsePathnameToRoute('/women'), '/women');
  assert.equal(parsePathnameToRoute('/kids'), '/kids');
  assert.equal(parsePathnameToRoute('/new-arrivals'), '/new-arrivals');
  assert.equal(parsePathnameToRoute('/gifts'), '/gifts');
  assert.equal(parsePathnameToRoute('/showroom'), '/showroom');
  assert.equal(parsePathnameToRoute('/admin'), '/admin');
  assert.equal(parsePathnameToRoute('/admin/orders'), '/admin');
});

test('normalizeSizeEntry handles letter, numeric, and cm size systems', () => {
  assert.equal(normalizeSizeEntry('small', 'letter'), 'S');
  assert.equal(normalizeSizeEntry('xsmall', 'letter'), 'XS');
  assert.equal(normalizeSizeEntry('38', 'numeric'), '38');
  assert.equal(normalizeSizeEntry('100', 'cm'), '100 cm');
  assert.equal(normalizeSizeEntry('120 cm', 'cm'), '120 cm');
});

test('mergeMaterialsList and mergeColorsList combine 5 prebuilt colors and custom colors without duplicates', () => {
  assert.equal(PREBUILT_COLORS.length, 5);
  const mergedColors = mergeColorsList(['Olive', 'black', 'Navy']);
  assert.equal(mergedColors.includes('Black'), true);
  assert.equal(mergedColors.includes('Olive'), true);
  assert.equal(mergedColors.includes('Navy'), true);
  assert.equal(mergedColors.filter((c) => c.toLowerCase() === 'black').length, 1);

  const merged = mergeMaterialsList(['Shearling', 'cow leather', 'Merino Wool']);
  assert.equal(merged.includes('Cow Leather'), true);
  assert.equal(merged.includes('Shearling'), true);
});

test('isAuthorizedAdminEmail grants access to super admins and dynamically added admins', () => {
  assert.equal(isAuthorizedAdminEmail(SUPER_ADMIN_EMAILS[0], []), true);
  assert.equal(isAuthorizedAdminEmail(SUPER_ADMIN_EMAILS[0].toUpperCase(), []), true);
  assert.equal(isAuthorizedAdminEmail(SUPER_ADMIN_EMAILS[1], []), true);
  assert.equal(isAuthorizedAdminEmail(SUPER_ADMIN_EMAILS[1].toUpperCase(), []), true);
  assert.equal(isAuthorizedAdminEmail(SUPER_ADMIN_EMAILS[2], []), true);
  assert.equal(isAuthorizedAdminEmail(SUPER_ADMIN_EMAILS[2].toUpperCase(), []), true);
  assert.equal(isAuthorizedAdminEmail('stranger@gmail.com', []), false);
  assert.equal(
    isAuthorizedAdminEmail('partner@gmail.com', [{ email: 'partner@gmail.com' }]),
    true
  );
});

test('calculateOrderTotals computes subtotal, promo code discount, delivery fee ($80 threshold / $6 fee or SAMO Showroom Pickup), and total price accurately', () => {
  const standardUnder80 = calculateOrderTotals(
    [{ price: 50, quantity: 1 }],
    'Standard Delivery'
  );
  assert.equal(standardUnder80.subtotal, 50);
  assert.equal(standardUnder80.deliveryFee, 6);
  assert.equal(standardUnder80.totalPrice, 56);

  const pickupUnder80 = calculateOrderTotals(
    [{ price: 50, quantity: 1 }],
    'SAMO Showroom Pickup'
  );
  assert.equal(pickupUnder80.deliveryFee, 0);
  assert.equal(pickupUnder80.totalPrice, 50);

  const withPctPromo = calculateOrderTotals(
    [{ price: 1000, quantity: 1 }],
    'Standard Delivery',
    { discountType: 'percentage', discountValue: 20, active: true }
  );
  assert.equal(withPctPromo.subtotal, 1000);
  assert.equal(withPctPromo.discountAmount, 200);
  assert.equal(withPctPromo.deliveryFee, 0);
  assert.equal(withPctPromo.totalPrice, 800);
});

test('getComplementaryUpsellProducts returns items from the same department/category excluding cart items', () => {
  const makeProd = (
    id: string,
    department: 'women' | 'kids',
    category: string
  ): ProductItem => ({
    id,
    name: id.toUpperCase(),
    department,
    category,
    style: 'Fine Leather',
    price: 500,
    quantity: 5,
    sizeQuantities: { M: 5 },
    isNewArrival: true,
    imageUrl: 'studio://img',
    galleryUrls: [],
    sizeType: 'letter',
    sizes: ['M'],
    materials: ['Cow Leather'],
    description: 'desc',
    inStock: true,
    featured: true,
  });

  const pWomenJacket = makeProd('w-jacket', 'women', 'Jacket');
  const pWomenBag = makeProd('w-bag', 'women', 'Bags');
  const pKidsBaby1 = makeProd('k-baby-1', 'kids', 'Baby');
  const pKidsBaby2 = makeProd('k-baby-2', 'kids', 'Baby');
  const pKidsJunior = makeProd('k-junior', 'kids', 'Junior');
  const all = [pWomenJacket, pWomenBag, pKidsBaby1, pKidsBaby2, pKidsJunior];

  const womenUpsell = getComplementaryUpsellProducts(
    [{ product: pWomenJacket }],
    all,
    2
  );
  assert.equal(womenUpsell.length, 1);
  assert.equal(womenUpsell[0].id, 'w-bag');

  const kidsBabyUpsell = getComplementaryUpsellProducts(
    [{ product: pKidsBaby1 }],
    all,
    2
  );
  assert.equal(kidsBabyUpsell[0].id, 'k-baby-2');
});

test('buildSizeQuantitiesMap defaults blank sizes to 5 and sumSizeQuantities totals per-size stock', () => {
  const sizes = ['S', 'M', 'L'];
  const map = buildSizeQuantitiesMap(sizes, { S: '', M: 0, L: '3' });
  assert.deepEqual(map, { S: 5, M: 0, L: 3 });
  assert.equal(sumSizeQuantities(sizes, map), 8);
  assert.equal(resolveProductQuantity(''), 5);
});

test('syncProductFromColorVariants and decrementStockForAcceptedOrder handle per-color per-size quantities', () => {
  const variants = [
    {
      colorName: 'Black',
      imageUrl: 'studio://black-jacket',
      sizeType: 'letter' as const,
      sizes: ['S', 'M'],
      sizeQuantities: { S: 5, M: 2 },
    },
    {
      colorName: 'Burgundy',
      imageUrl: 'studio://burgundy-jacket',
      sizeType: 'letter' as const,
      sizes: ['S', 'M'],
      sizeQuantities: { S: 0, M: 4 },
    },
  ];

  const synced = syncProductFromColorVariants(variants, 'letter');
  assert.equal(synced.quantity, 11);
  assert.deepEqual(synced.sizeQuantities, { S: 5, M: 6 });

  const prod: ProductItem = {
    id: 'p-color',
    name: 'MULTI COLOR JACKET',
    department: 'women',
    category: 'Jacket',
    style: 'Fine Leather',
    price: 3000,
    quantity: synced.quantity,
    sizeQuantities: synced.sizeQuantities,
    hasColors: true,
    colorVariants: variants,
    isNewArrival: true,
    imageUrl: 'studio://black-jacket',
    galleryUrls: [],
    sizeType: 'letter',
    sizes: synced.sizes,
    materials: ['Cow Leather'],
    description: 'desc',
    inStock: true,
    featured: true,
  };

  assert.equal(getSizeQuantity(prod, 'S', 'Black'), 5);
  assert.equal(getSizeQuantity(prod, 'S', 'Burgundy'), 0);
  assert.equal(getSizeQuantity(prod, 'M', 'Burgundy'), 4);

  const order: OrderItem = {
    id: 'o-col',
    orderNumber: 'SAMO-7914',
    customerName: 'Buyer',
    customerEmail: 'b@test.com',
    customerPhone: '111',
    shippingLocation: 'Loc',
    deliveryMethod: 'Standard Delivery',
    deliveryFee: 0,
    subtotal: 3000,
    totalPrice: 3000,
    itemsSummary: '1x MULTI COLOR JACKET',
    itemsCount: 1,
    primaryProductName: 'MULTI COLOR JACKET',
    primaryProductSize: 'M',
    primaryProductImage: 'studio://burgundy-jacket',
    orderedItems: [
      {
        productId: 'p-color',
        productName: 'MULTI COLOR JACKET',
        selectedColor: 'Burgundy',
        selectedSize: 'M',
        quantity: 2,
      },
    ],
    status: 'accepted',
    createdAt: '2026-10-20T00:00:00Z',
  };

  const afterOrder = decrementStockForAcceptedOrder([prod], order);
  assert.equal(getSizeQuantity(afterOrder[0], 'M', 'Burgundy'), 2);
  assert.equal(getSizeQuantity(afterOrder[0], 'M', 'Black'), 2);
  assert.equal(afterOrder[0].quantity, 9);
});

test('Full Set products simultaneously decrement standalone component products and sync back', () => {
  const standaloneTop: ProductItem = {
    id: 'top-1',
    name: 'SATIN TOP',
    department: 'women',
    category: 'Tops',
    style: 'Classic',
    price: 900,
    quantity: 10,
    sizeQuantities: { S: 5, M: 5 },
    isNewArrival: true,
    imageUrl: 'studio://top',
    galleryUrls: [],
    sizeType: 'letter',
    sizes: ['S', 'M'],
    materials: ['Silk'],
    description: 'desc',
    inStock: true,
    featured: true,
  };

  const standaloneTrouser: ProductItem = {
    id: 'trouser-1',
    name: 'WOOL TROUSERS',
    department: 'women',
    category: 'Trousers',
    style: 'Classic',
    price: 1200,
    quantity: 10,
    sizeQuantities: { '36': 5, '38': 5 },
    isNewArrival: true,
    imageUrl: 'studio://trouser',
    galleryUrls: [],
    sizeType: 'numeric',
    sizes: ['36', '38'],
    materials: ['Wool'],
    description: 'desc',
    inStock: true,
    featured: true,
  };

  const fullSetProd: ProductItem = {
    id: 'set-1',
    name: 'RUNWAY FULL SET',
    department: 'women',
    category: 'Full Set',
    style: 'Classic',
    price: 1950,
    quantity: 10,
    sizeQuantities: { S: 5, M: 5 },
    isFullSet: true,
    setItems: [
      {
        productId: 'top-1',
        productName: 'SATIN TOP',
        pieceLabel: 'Top / Shirt',
        sizeType: 'letter',
        sizes: ['S', 'M'],
        sizeQuantities: { S: 5, M: 5 },
      },
      {
        productId: 'trouser-1',
        productName: 'WOOL TROUSERS',
        pieceLabel: 'Trousers / Bottom',
        sizeType: 'numeric',
        sizes: ['36', '38'],
        sizeQuantities: { '36': 5, '38': 5 },
      },
    ],
    isNewArrival: true,
    imageUrl: 'studio://set',
    galleryUrls: [],
    sizeType: 'letter',
    sizes: ['S', 'M'],
    materials: ['Silk', 'Wool'],
    description: 'desc',
    inStock: true,
    featured: true,
  };

  const orderFullSet: OrderItem = {
    id: 'ord-set-1',
    orderNumber: 'SAMO-9001',
    customerName: 'Buyer',
    customerEmail: 'b@test.com',
    customerPhone: '123',
    shippingLocation: 'Beirut',
    deliveryMethod: 'Standard Delivery',
    deliveryFee: 0,
    subtotal: 1950,
    totalPrice: 1950,
    itemsSummary: '1x RUNWAY FULL SET',
    itemsCount: 1,
    primaryProductName: 'RUNWAY FULL SET',
    primaryProductSize: 'M / 36',
    primaryProductImage: 'studio://set',
    orderedItems: [
      {
        productId: 'set-1',
        productName: 'RUNWAY FULL SET',
        selectedSize: 'M / 36',
        selectedSetSizes: [
          { productId: 'top-1', productName: 'SATIN TOP', selectedSize: 'M' },
          { productId: 'trouser-1', productName: 'WOOL TROUSERS', selectedSize: '36' },
        ],
        quantity: 2,
      },
    ],
    status: 'accepted',
    createdAt: '2026-10-20T00:00:00Z',
  };

  const updated = decrementStockForAcceptedOrder(
    [standaloneTop, standaloneTrouser, fullSetProd],
    orderFullSet
  );
  const nextTop = updated.find((p) => p.id === 'top-1')!;
  const nextTrouser = updated.find((p) => p.id === 'trouser-1')!;
  const nextSet = updated.find((p) => p.id === 'set-1')!;

  // Standalone top size M decreased from 5 -> 3
  assert.equal(nextTop.sizeQuantities['M'], 3);
  // Standalone trouser size 36 decreased from 5 -> 3
  assert.equal(nextTrouser.sizeQuantities['36'], 3);
  // Full Set's setItems also reflect the decreased quantities (3 and 3)
  assert.equal(nextSet.setItems![0].sizeQuantities['M'], 3);
  assert.equal(nextSet.setItems![1].sizeQuantities['36'], 3);

  // Now test ordering the standalone top alone and verify the Full Set also decreases simultaneously
  const orderStandaloneTop: OrderItem = {
    ...orderFullSet,
    id: 'ord-top-only',
    orderedItems: [
      {
        productId: 'top-1',
        productName: 'SATIN TOP',
        selectedSize: 'M',
        quantity: 1,
      },
    ],
  };
  const updated2 = decrementStockForAcceptedOrder(updated, orderStandaloneTop);
  const nextTop2 = updated2.find((p) => p.id === 'top-1')!;
  const nextSet2 = updated2.find((p) => p.id === 'set-1')!;
  assert.equal(nextTop2.sizeQuantities['M'], 2);
  assert.equal(nextSet2.setItems![0].sizeQuantities['M'], 2);
});

test('getEffectiveProductPrice and filterOrdersByQuery work as expected', () => {
  const pctDisc = getEffectiveProductPrice({
    price: 1000,
    discountType: 'percentage',
    discountValue: 15,
  });
  assert.equal(pctDisc.hasDiscount, true);
  assert.equal(pctDisc.effectivePrice, 850);
  assert.equal(pctDisc.discountBadge, 'Save 15%');

  const fixedDisc = getEffectiveProductPrice({
    price: 1000,
    discountType: 'fixed',
    discountValue: 10,
  });
  assert.equal(fixedDisc.hasDiscount, true);
  assert.equal(fixedDisc.effectivePrice, 990);
  assert.equal(fixedDisc.discountBadge, 'Save $10');

  const sampleOrders: OrderItem[] = [
    {
      id: '1',
      orderNumber: 'SAMO-8491',
      customerName: 'Céline Moreau',
      customerEmail: 'celine@paris.fr',
      customerPhone: '123',
      shippingLocation: 'Paris',
      deliveryMethod: 'Standard Delivery',
      deliveryFee: 0,
      subtotal: 3250,
      totalPrice: 3250,
      itemsSummary: '1x Jacket',
      itemsCount: 1,
      primaryProductName: 'Jacket',
      primaryProductSize: 'M',
      primaryProductImage: 'img',
      status: 'pending',
      createdAt: '2026-10-20T00:00:00Z',
    },
  ];
  assert.equal(filterOrdersByQuery(sampleOrders, '8491').length, 1);
  assert.equal(filterNewArrivalProducts([]).length, 0);
  assert.equal(filterGiftsProducts([]).length, 0);
  assert.equal(syncFullSetsWithCatalog([]).length, 0);
});

import {
  calculateCLimitDimensions,
  sanitizeUploadFileName,
} from './imageCompression';

test('calculateCLimitDimensions downscales large images proportionally (c_limit 720x960) and never upscales smaller images', () => {
  // Already smaller than 720x960 -> never upscaled
  assert.deepEqual(calculateCLimitDimensions(500, 600, 720, 960), {
    width: 500,
    height: 600,
  });

  // Portrait camera photo 3000x4000 -> 720x960
  assert.deepEqual(calculateCLimitDimensions(3000, 4000, 720, 960), {
    width: 720,
    height: 960,
  });

  // Landscape photo 4000x2000 -> constrained by maxWidth 720 -> 720x360
  assert.deepEqual(calculateCLimitDimensions(4000, 2000, 720, 960), {
    width: 720,
    height: 360,
  });

  // Tall vertical image 1000x3000 -> constrained by maxHeight 960 -> 320x960
  assert.deepEqual(calculateCLimitDimensions(1000, 3000, 720, 960), {
    width: 320,
    height: 960,
  });
});

test('sanitizeUploadFileName creates clean timestamped .webp filenames', () => {
  const sanitized = sanitizeUploadFileName(
    'SAMO Leather Jacket (Front View) #1.JPG',
    1760000000000
  );
  assert.equal(
    sanitized,
    '1760000000000-samo-leather-jacket-front-view-1.webp'
  );

  const fallback = sanitizeUploadFileName('   .png', 1760000000001);
  assert.equal(fallback, '1760000000001-samo-item.webp');
});

import {
  getCategoriesByDepartment,
  normalizeKidsCategoryName,
} from './catalogLogic';

test('normalizeKidsCategoryName maps Baby to MINIS 1 To 5, Junior to CHILDREN 6+, Teen to Teen 13+, and getCategoriesByDepartment removes Full Set from Kids only', () => {
  assert.equal(normalizeKidsCategoryName('Baby'), 'MINIS 1 To 5');
  assert.equal(normalizeKidsCategoryName('Junior'), 'CHILDREN 6+');
  assert.equal(normalizeKidsCategoryName('Teen'), 'Teen 13+');

  const rawCategories = [
    {
      id: 'w-fs',
      name: 'Full Set',
      slug: 'full-set',
      department: 'women' as const,
      description: 'Women full set',
    },
    {
      id: 'k-baby',
      name: 'Baby',
      slug: 'baby',
      department: 'kids' as const,
      description: 'Kids minis',
    },
    {
      id: 'k-junior',
      name: 'Junior',
      slug: 'junior',
      department: 'kids' as const,
      description: 'Kids children',
    },
    {
      id: 'k-teen',
      name: 'Teen',
      slug: 'teen',
      department: 'kids' as const,
      description: 'Kids teen',
    },
    {
      id: 'k-fs',
      name: 'Full Set',
      slug: 'full-set',
      department: 'kids' as const,
      description: 'Legacy kids full set',
    },
  ];

  const womenCats = getCategoriesByDepartment(rawCategories, 'women');
  const kidsCats = getCategoriesByDepartment(rawCategories, 'kids');

  assert.equal(womenCats.some((c) => c.name === 'Full Set'), true);
  assert.deepEqual(
    kidsCats.map((c) => c.name),
    ['MINIS 1 To 5', 'CHILDREN 6+', 'Teen 13+']
  );
  assert.equal(kidsCats.some((c) => c.name === 'Full Set'), false);
});

import { filterCatalogProducts } from './catalogLogic';

test('Women product added to both Full Set and New Arrivals appears in both Full Set category and New Arrivals', () => {
  const dualProd: ProductItem = {
    id: 'samo-women-test-set',
    name: 'ATELIER SUEDE MONOLITH SET',
    department: 'women',
    category: 'Full Set',
    style: 'Suede',
    price: 1850,
    quantity: 15,
    sizeQuantities: { S: 5, M: 5, L: 5 },
    isFullSet: true,
    isNewArrival: true,
    imageUrl: 'https://images.samoweave.com/products/test-set.webp',
    galleryUrls: [],
    sizeType: 'letter',
    sizes: ['S', 'M', 'L'],
    materials: ['Suede'],
    description: 'Two-piece suede full set.',
    inStock: true,
    featured: true,
  };

  const fullSetMatches = filterCatalogProducts([dualProd], {
    department: 'women',
    category: 'Full Set',
  });
  const newArrivalMatches = filterNewArrivalProducts([dualProd]);

  assert.equal(fullSetMatches.length, 1);
  assert.equal(fullSetMatches[0].id, 'samo-women-test-set');
  assert.equal(newArrivalMatches.length, 1);
  assert.equal(newArrivalMatches[0].id, 'samo-women-test-set');
  assert.equal(
    sanitizeUploadFileName('photo.HEIC', 1760000000002, 'image/jpeg'),
    '1760000000002-photo.jpg'
  );
});

import {
  buildDefaultSiteBanners,
  getCategoryBannerKey,
  getCategoryBannerSplitIndex,
  mergeSiteBannersConfig,
  toggleProductInStockState,
} from './catalogLogic';
import { INITIAL_CATEGORIES } from '../data/seedCatalog';

test('toggleProductInStockState sets inStock=false when toggled off and restores inStock=true when toggled on', () => {
  const sample: ProductItem = {
    id: 'samo-w-toggle-1',
    name: 'NOIR LEATHER TRENCH',
    department: 'women',
    category: 'Trench Coat',
    style: 'Fine Leather',
    price: 3800,
    quantity: 10,
    sizeQuantities: { S: 5, M: 5 },
    isNewArrival: true,
    imageUrl: 'studio://women-trench-suede-coat',
    galleryUrls: [],
    sizeType: 'letter',
    sizes: ['S', 'M'],
    materials: ['Cow Leather'],
    description: 'desc',
    inStock: true,
    featured: true,
  };

  const toggledOff = toggleProductInStockState(sample, false);
  assert.equal(toggledOff.inStock, false);

  const toggledBackOn = toggleProductInStockState(toggledOff, true);
  assert.equal(toggledBackOn.inStock, true);
  assert.equal(toggledBackOn.quantity, 10);

  // Also test when all sizes had 0 stock and admin toggles ON -> refills default 5 per size
  const zeroStock: ProductItem = {
    ...sample,
    quantity: 0,
    sizeQuantities: { S: 0, M: 0 },
    inStock: false,
  };
  const refilled = toggleProductInStockState(zeroStock, true);
  assert.equal(refilled.inStock, true);
  assert.equal(refilled.quantity, 10);
  assert.deepEqual(refilled.sizeQuantities, { S: 5, M: 5 });
});

test('getCategoryBannerKey, getCategoryBannerSplitIndex, and mergeSiteBannersConfig manage site & category in-feed banners', () => {
  assert.equal(getCategoryBannerKey('women', 'Jacket'), 'women:jacket');
  assert.equal(getCategoryBannerKey('kids', 'Baby'), 'kids:minis-1-to-5');

  // When 6 products exist and insertAfterCount is 4 -> split at 4
  assert.equal(getCategoryBannerSplitIndex(6, 4), 4);
  // When 2 products exist and insertAfterCount is 4 -> split at 1 (so banner appears between the 2 products)
  assert.equal(getCategoryBannerSplitIndex(2, 4), 1);
  // When 1 product exists -> split at 1 (banner appears right after the first product)
  assert.equal(getCategoryBannerSplitIndex(1, 4), 1);
  assert.equal(getCategoryBannerSplitIndex(0, 4), 0);

  const defaults = buildDefaultSiteBanners(INITIAL_CATEGORIES);
  assert.equal(defaults.homeHeroMediaType, 'video');
  assert.equal(Boolean(defaults.categoryBanners['women:jacket']?.enabled), true);
  assert.equal(Boolean(defaults.categoryBanners['kids:minis-1-to-5']?.enabled), true);

  const merged = mergeSiteBannersConfig(
    {
      homeHeroMediaType: 'image',
      homeHeroImageUrl: 'https://images.samoweave.com/products/custom-hero.webp',
      categoryBanners: {
        'women:jacket': {
          categoryKey: 'women:jacket',
          department: 'women',
          categoryName: 'Jacket',
          enabled: true,
          imageUrl: 'https://images.samoweave.com/products/jacket-banner.webp',
          title: 'CUSTOM JACKET ARCHIVE',
          kicker: 'LIMITED EDITION',
          insertAfterCount: 6,
        },
      },
    },
    INITIAL_CATEGORIES
  );
  assert.equal(merged.homeHeroMediaType, 'image');
  assert.equal(
    merged.categoryBanners['women:jacket'].imageUrl,
    'https://images.samoweave.com/products/jacket-banner.webp'
  );
  assert.equal(merged.categoryBanners['women:jacket'].insertAfterCount, 6);
  // Other categories retain their defaults
  assert.equal(Boolean(merged.categoryBanners['women:bags']?.imageUrl), true);
});

import {
  getDefaultSizesForType,
  MONTHS_SIZES,
  YEARS_SIZES,
} from './catalogLogic';

test('Months and Years size types provide 4 prebuilt sizes each and normalize custom sizes', () => {
  assert.equal(MONTHS_SIZES.length, 4);
  assert.deepEqual(getDefaultSizesForType('months'), [
    '3-6 Months',
    '6-12 Months',
    '12-18 Months',
    '18-24 Months',
  ]);
  assert.equal(YEARS_SIZES.length, 4);
  assert.deepEqual(getDefaultSizesForType('years'), [
    '2-3 Years',
    '4-5 Years',
    '6-7 Years',
    '8-9 Years',
  ]);

  assert.equal(normalizeSizeEntry('0-3', 'months'), '0-3 Months');
  assert.equal(normalizeSizeEntry('24-36 Months', 'months'), '24-36 Months');
  assert.equal(normalizeSizeEntry('10-11', 'years'), '10-11 Years');
  assert.equal(normalizeSizeEntry('12-13 Years', 'years'), '12-13 Years');
});

test('Full Set with multi-color linked pieces defaults to first color if none selected, syncs color variants, and deducts exact color+size stock from original products when bought', () => {
  const multiColorShirt: ProductItem = {
    id: 'shirt-multi-1',
    name: 'SILK ATELIER SHIRT',
    department: 'women',
    category: 'Tops',
    style: 'Classic',
    price: 900,
    quantity: 20,
    sizeQuantities: { S: 5, M: 5 },
    hasColors: true,
    colorVariants: [
      {
        colorName: 'Ivory',
        colorHex: '#FFFFF0',
        imageUrl: 'ivory.jpg',
        sizeType: 'letter',
        sizes: ['S', 'M'],
        sizeQuantities: { S: 5, M: 5 },
      },
      {
        colorName: 'Noir',
        colorHex: '#09090B',
        imageUrl: 'noir.jpg',
        sizeType: 'letter',
        sizes: ['S', 'M'],
        sizeQuantities: { S: 4, M: 6 },
      },
    ],
    isNewArrival: true,
    imageUrl: 'ivory.jpg',
    galleryUrls: [],
    sizeType: 'letter',
    sizes: ['S', 'M'],
    materials: ['Silk'],
    description: 'Shirt',
    inStock: true,
    featured: true,
  };

  const trousers: ProductItem = {
    id: 'trousers-1',
    name: 'TAILORED WOOL TROUSERS',
    department: 'women',
    category: 'Pants',
    style: 'Classic',
    price: 1100,
    quantity: 10,
    sizeQuantities: { '36': 5, '38': 5 },
    hasColors: false,
    colorVariants: [],
    isNewArrival: true,
    imageUrl: 'trousers.jpg',
    galleryUrls: [],
    sizeType: 'numeric',
    sizes: ['36', '38'],
    materials: ['Wool'],
    description: 'Trousers',
    inStock: true,
    featured: true,
  };

  const fullSetDefaultColor: ProductItem = {
    id: 'fullset-default-col',
    name: 'SILK & WOOL MONOLITH SET',
    department: 'women',
    category: 'Full Set',
    style: 'Classic',
    price: 1850,
    quantity: 10,
    sizeQuantities: { S: 5, M: 5 },
    isFullSet: true,
    setItems: [
      {
        productId: 'shirt-multi-1',
        productName: 'SILK ATELIER SHIRT',
        pieceLabel: 'Shirt',
        sizeType: 'letter',
        sizes: ['S', 'M'],
        sizeQuantities: { S: 5, M: 5 },
        // selectedColors omitted -> should default to first color ('Ivory')
      },
      {
        productId: 'trousers-1',
        productName: 'TAILORED WOOL TROUSERS',
        pieceLabel: 'Trousers',
        sizeType: 'numeric',
        sizes: ['36', '38'],
        sizeQuantities: { '36': 5, '38': 5 },
      },
    ],
    isNewArrival: true,
    imageUrl: 'set.jpg',
    galleryUrls: [],
    sizeType: 'letter',
    sizes: ['S', 'M'],
    materials: [],
    description: 'Set',
    inStock: true,
    featured: true,
  };

  const syncedDefault = syncFullSetsWithCatalog([
    multiColorShirt,
    trousers,
    fullSetDefaultColor,
  ]);
  const syncedSet1 = syncedDefault.find((p) => p.id === 'fullset-default-col')!;
  assert.deepEqual(syncedSet1.setItems![0].selectedColors, ['Ivory']);
  assert.equal(syncedSet1.setItems![0].colorVariants?.length, 1);

  // Now test when admin selects BOTH colors ('Ivory' and 'Noir') and user buys 'Noir' size 'M' + Trousers size '38'
  const fullSetAllColors: ProductItem = {
    ...fullSetDefaultColor,
    setItems: [
      {
        ...fullSetDefaultColor.setItems![0],
        selectedColors: ['Ivory', 'Noir'],
      },
      fullSetDefaultColor.setItems![1],
    ],
  };

  const catalogBeforeOrder = syncFullSetsWithCatalog([
    multiColorShirt,
    trousers,
    fullSetAllColors,
  ]);

  const order: OrderItem = {
    id: 'ord-fs-1',
    orderNumber: 'SAMO-9001',
    customerName: 'Aria',
    customerEmail: 'aria@samo.com',
    customerPhone: '123456',
    shippingLocation: 'Paris',
    deliveryMethod: 'Standard Delivery',
    deliveryFee: 0,
    subtotal: 3700,
    totalPrice: 3700,
    itemsSummary: '2x SILK & WOOL MONOLITH SET',
    itemsCount: 2,
    primaryProductName: 'SILK & WOOL MONOLITH SET',
    primaryProductSize: 'Shirt: Noir · M / Trousers: 38',
    primaryProductImage: 'set.jpg',
    orderedItems: [
      {
        productId: 'fullset-default-col',
        productName: 'SILK & WOOL MONOLITH SET',
        selectedSize: 'Shirt: Noir · M / Trousers: 38',
        selectedSetSizes: [
          {
            productId: 'shirt-multi-1',
            productName: 'SILK ATELIER SHIRT',
            selectedSize: 'M',
            selectedColor: 'Noir',
          },
          {
            productId: 'trousers-1',
            productName: 'TAILORED WOOL TROUSERS',
            selectedSize: '38',
          },
        ],
        quantity: 2,
      },
    ],
    status: 'accepted',
    createdAt: '2026-11-08T10:00:00Z',
  };

  const afterOrder = decrementStockForAcceptedOrder(catalogBeforeOrder, order);
  const updatedShirt = afterOrder.find((p) => p.id === 'shirt-multi-1')!;
  const updatedTrousers = afterOrder.find((p) => p.id === 'trousers-1')!;
  const updatedFullSet = afterOrder.find((p) => p.id === 'fullset-default-col')!;

  // Noir M was 6 -> now 4; Ivory M stays 5
  const noirVar = updatedShirt.colorVariants!.find((v) => v.colorName === 'Noir')!;
  const ivoryVar = updatedShirt.colorVariants!.find((v) => v.colorName === 'Ivory')!;
  assert.equal(noirVar.sizeQuantities.M, 4);
  assert.equal(ivoryVar.sizeQuantities.M, 5);

  // Trousers '38' was 5 -> now 3
  assert.equal(updatedTrousers.sizeQuantities!['38'], 3);

  // Full Set synced piece colorVariants also reflect Noir M = 4 and Trousers 38 = 3
  const fsShirtNoir = updatedFullSet.setItems![0].colorVariants!.find(
    (v) => v.colorName === 'Noir'
  )!;
  assert.equal(fsShirtNoir.sizeQuantities.M, 4);
  assert.equal(updatedFullSet.setItems![1].sizeQuantities['38'], 3);
});
