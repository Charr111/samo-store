import React, { useState, useRef, useMemo } from 'react';
import {
  Check,
  X,
  Plus,
  Minus,
  Trash2,
  ShieldCheck,
  LogOut,
  Package,
  FolderTree,
  ShoppingBag,
  Users,
  Cloud,
  ArrowLeft,
  Download,
  Search,
  Tag,
  Palette,
  BellRing,
  Layers,
  Image as ImageIcon,
  Upload,
  LayoutDashboard,
  Pencil,
  Film,
  Menu,
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronRight,
  Sun,
  Moon,
  Mail,
} from 'lucide-react';
import {
  AdminRecord,
  CategoryBannerConfig,
  CategoryItem,
  Department,
  DiscountType,
  FullSetSubItem,
  NewsletterSubscriber,
  OrderItem,
  OrderStatus,
  PreorderItem,
  PreorderStatus,
  ProductColorVariant,
  ProductItem,
  PromoCodeItem,
  RoutePath,
  SiteBannersConfig,
  SizeType,
  StyleType,
} from '../types/samo';
import {
  buildDefaultCategoryBannerForCategory,
  buildDefaultSiteBanners,
  buildEditorialProductDescription,
  buildSizeQuantitiesMap,
  CM_SIZES,
  createSafeSlug,
  filterOrdersByQuery,
  getCategoryBannerKey,
  getColorSwatchHex,
  getCategoriesByDepartment,
  getDefaultSizesForType,
  getEffectiveProductPrice,
  getSizeQuantity,
  isAuthorizedAdminEmail,
  LETTER_SIZES,
  mergeColorsList,
  mergeMaterialsList,
  MONTHS_SIZES,
  normalizeKidsCategoryName,
  normalizeSizeEntry,
  NUMERIC_SIZES,
  sumSizeQuantities,
  SUPER_ADMIN_EMAILS,
  syncProductFromColorVariants,
  YEARS_SIZES,
} from '../utils/catalogLogic';
import { ProductImage } from './ProductImage';
import {
  deleteMediaFromR2,
  getShrinkUploadsEnabled,
  ImageCompressionOptions,
  setShrinkUploadsEnabled,
  uploadCompressedImageToR2,
  uploadVideoFileToR2,
} from '../utils/imageCompression';
import { User } from 'firebase/auth';

interface R2ImageUploadButtonProps {
  onUploaded: (url: string) => void;
  ariaLabel: string;
  compact?: boolean;
  label?: string;
  compressionOptions?: ImageCompressionOptions;
}

export const R2ImageUploadButton: React.FC<R2ImageUploadButtonProps> = ({
  onUploaded,
  ariaLabel,
  compact = false,
  label = 'Upload Photo',
  compressionOptions,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const result = await uploadCompressedImageToR2(file, compressionOptions);
      onUploaded(result.url);
      if (result.wasShrunk) {
        setStatusMessage(
          `✓ Shrunk ${result.reductionPercent}% (${result.originalSizeKB} KB → ${result.compressedSizeKB} KB)`
        );
      } else {
        setStatusMessage(
          `✓ Uploaded Original (${result.compressedSizeKB} KB — Shrink Off)`
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to upload photo.';
      setErrorMessage(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const shrinkActive = getShrinkUploadsEnabled();

  return (
    <div className="inline-flex flex-col items-end shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp"
        onChange={handleFileChange}
        aria-label={`${ariaLabel} File Input`}
        className="hidden"
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        aria-label={ariaLabel}
        className={`${
          compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-[11px]'
        } bg-white text-zinc-950 font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-200 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-sm`}
      >
        <Upload className="w-3.5 h-3.5 shrink-0" />
        <span>
          {uploading
            ? shrinkActive
              ? 'Shrinking & Uploading...'
              : 'Uploading Original...'
            : label}
        </span>
      </button>
      {statusMessage && (
        <span className="text-[10px] font-mono-tabular font-bold text-emerald-400 mt-1">
          {statusMessage}
        </span>
      )}
      {errorMessage && (
        <span className="text-[10px] font-semibold text-red-400 mt-1 max-w-[220px] text-right">
          {errorMessage}
        </span>
      )}
    </div>
  );
};

interface R2VideoUploadButtonProps {
  onUploaded: (url: string) => void;
  ariaLabel: string;
}

const R2VideoUploadButton: React.FC<R2VideoUploadButtonProps> = ({
  onUploaded,
  ariaLabel,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const result = await uploadVideoFileToR2(file);
      onUploaded(result.url);
      setStatusMessage(`✓ Uploaded Video (${result.sizeKB} KB)`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to upload video.';
      setErrorMessage(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="inline-flex flex-col items-end shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.hevc,.m4v"
        onChange={handleFileChange}
        aria-label={`${ariaLabel} File Input`}
        className="hidden"
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        aria-label={ariaLabel}
        className="px-3 py-2 text-[11px] bg-white text-zinc-950 font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-200 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
      >
        <Film className="w-3.5 h-3.5 shrink-0" />
        <span>{uploading ? 'Uploading Video...' : 'Upload Video'}</span>
      </button>
      {statusMessage && (
        <span className="text-[10px] font-mono-tabular font-bold text-emerald-400 mt-1">
          {statusMessage}
        </span>
      )}
      {errorMessage && (
        <span className="text-[10px] font-semibold text-red-400 mt-1 max-w-[220px] text-right">
          {errorMessage}
        </span>
      )}
    </div>
  );
};

interface DraftColorConfig {
  colorName: string;
  colorHex?: string;
  imageUrl: string;
  galleryUrls?: string[];
  sizeType: SizeType;
  sizes: string[];
  rawQuantities: Record<string, string>;
  customSizeInput: string;
}

const LUXURY_PALETTE_SWATCHES: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Black', hex: '#111113' },
  { name: 'Brown', hex: '#4A2C1D' },
  { name: 'Burgundy', hex: '#5E131D' },
  { name: 'Ivory', hex: '#F4F1EA' },
  { name: 'Camel', hex: '#B88B58' },
  { name: 'Olive', hex: '#3F4D34' },
  { name: 'Midnight Navy', hex: '#172554' },
  { name: 'Warm Taupe', hex: '#8B7D70' },
  { name: 'Cognac', hex: '#7C3F23' },
  { name: 'Charcoal', hex: '#27272A' },
  { name: 'Slate Grey', hex: '#71717A' },
  { name: 'Blush Pink', hex: '#D8B4BB' },
  { name: 'Crimson Red', hex: '#991B1B' },
  { name: 'Emerald Green', hex: '#14532D' },
  { name: 'Brushed Gold', hex: '#C5A059' },
  { name: 'Silver', hex: '#A1A1AA' },
];

type AdminSectionTab =
  | 'dashboard'
  | 'items'
  | 'categories'
  | 'banners'
  | 'orders'
  | 'preorders'
  | 'promos'
  | 'newsletter'
  | 'admins';

interface AdminDashboardProps {
  currentUser: User | null;
  aiAdminUnlocked: boolean;
  onUnlockAiAdmin: () => void;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onNavigateHome: (route: RoutePath) => void;
  categories: CategoryItem[];
  products: ProductItem[];
  promoCodes: PromoCodeItem[];
  customMaterials: string[];
  customColors: string[];
  orders: OrderItem[];
  preorders: PreorderItem[];
  admins: AdminRecord[];
  newsletterSubscribers?: NewsletterSubscriber[];
  onDeleteNewsletterSubscriber?: (id: string) => Promise<void>;
  siteBanners: SiteBannersConfig;
  onUpdateSiteBanners: (nextBanners: SiteBannersConfig) => Promise<void>;
  onToggleProductStock: (
    productId: string,
    nextInStock: boolean
  ) => Promise<void>;
  onAddCategory: (cat: Omit<CategoryItem, 'id'>) => Promise<void>;
  onUpdateCategory: (
    categoryId: string,
    newName: string,
    newDescription?: string
  ) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onAddProduct: (prod: Omit<ProductItem, 'id'>) => Promise<void>;
  onUpdateProductSizeQuantity: (
    productId: string,
    size: string,
    nextQuantity: number
  ) => Promise<void>;
  onUpdateProductColorVariants: (
    productId: string,
    hasColors: boolean,
    colorVariants: ProductColorVariant[]
  ) => Promise<void>;
  onUpdateProductMeta: (
    productId: string,
    updates: Partial<ProductItem>
  ) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onAddPromoCode: (promo: Omit<PromoCodeItem, 'id'>) => Promise<void>;
  onDeletePromoCode: (id: string) => Promise<void>;
  onAddCustomMaterial: (materialName: string) => Promise<void>;
  onAddCustomColor: (colorName: string) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  autoAcceptOrders: boolean;
  onToggleAutoAcceptOrders: (nextEnabled: boolean) => Promise<void>;
  showLowStockCount?: boolean;
  onToggleShowLowStockCount?: (nextEnabled: boolean) => Promise<void>;
  onUpdatePreorderStatus: (
    preorderId: string,
    status: PreorderStatus
  ) => Promise<void>;
  onDeletePreorder: (preorderId: string) => Promise<void>;
  onAddAdminByEmail: (email: string) => Promise<void>;
  onRemoveAdminByEmail: (email: string) => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  aiAdminUnlocked,
  onGoogleSignIn,
  onSignOut,
  onNavigateHome,
  categories,
  products,
  promoCodes,
  customMaterials,
  customColors,
  orders,
  preorders,
  admins,
  newsletterSubscribers = [],
  onDeleteNewsletterSubscriber,
  siteBanners,
  onUpdateSiteBanners,
  onToggleProductStock,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddProduct,
  onUpdateProductSizeQuantity,
  onUpdateProductColorVariants,
  onUpdateProductMeta,
  onDeleteProduct,
  onAddPromoCode,
  onDeletePromoCode,
  onAddCustomMaterial,
  onAddCustomColor,
  onUpdateOrderStatus,
  onDeleteOrder,
  autoAcceptOrders,
  onToggleAutoAcceptOrders,
  showLowStockCount = false,
  onToggleShowLowStockCount,
  onUpdatePreorderStatus,
  onDeletePreorder,
  onAddAdminByEmail,
  onRemoveAdminByEmail,
}) => {
  const [activeTab, setActiveTab] = useState<AdminSectionTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [adminTheme, setAdminTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('samo_admin_theme_v1') === 'light'
        ? 'light'
        : 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleAdminTheme = () => {
    setAdminTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('samo_admin_theme_v1', next);
      } catch {}
      return next;
    });
  };

  // Toggle ON/OFF for Auto-Shrink Image Upload
  const [shrinkUploadsEnabled, setShrinkUploadsState] = useState<boolean>(() =>
    getShrinkUploadsEnabled()
  );

  const handleToggleShrinkUploads = () => {
    const next = !shrinkUploadsEnabled;
    setShrinkUploadsState(next);
    setShrinkUploadsEnabled(next);
    setItemFeedback(
      next
        ? 'Auto-Shrink Image Upload turned ON (photos will shrink by 60%–70%, e.g. 2 MB → 500–800 KB).'
        : 'Auto-Shrink Image Upload turned OFF (photos will upload at original full quality).'
    );
  };

  // Dashboard & Product List Filtering States
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [productStockFilter, setProductStockFilter] = useState<
    'all' | 'out-of-stock'
  >('all');
  const [selectedQuickCategory, setSelectedQuickCategory] =
    useState<string>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<
    Department | 'all'
  >('all');

  // Modals State: Add Product, Add Category, Edit Category, Edit Product, Delete Product/Image/Category Confirmations
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(
    null
  );
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [categoryPendingDelete, setCategoryPendingDelete] =
    useState<CategoryItem | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProdCustomSizeInput, setEditProdCustomSizeInput] = useState('');
  const [editProdNewMaterialInput, setEditProdNewMaterialInput] = useState('');
  const [productPendingDelete, setProductPendingDelete] =
    useState<ProductItem | null>(null);
  const [imagePendingDelete, setImagePendingDelete] = useState<{
    label: string;
    imageUrl: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const [authError, setAuthError] = useState<string>('');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [bannerFeedback, setBannerFeedback] = useState<string>('');
  const [newsletterSearchQuery, setNewsletterSearchQuery] = useState<string>('');
  const [copiedNewsletter, setCopiedNewsletter] = useState<boolean>(false);

  // Create Product Form State
  const [itemName, setItemName] = useState('');
  const [itemDept, setItemDept] = useState<Department>('women');
  const [itemCategory, setItemCategory] = useState('Jacket');
  const [itemStyle, setItemStyle] = useState<StyleType>('Fine Leather');
  const [itemPrice, setItemPrice] = useState('1290');
  const [itemDiscountType, setItemDiscountType] =
    useState<DiscountType>('none');
  const [itemDiscountValue, setItemDiscountValue] = useState('0');
  const [itemIsNewArrival, setItemIsNewArrival] = useState<boolean>(true);
  const [itemIsFullSet, setItemIsFullSet] = useState<boolean>(false);
  const [linkTwoSetPieces, setLinkTwoSetPieces] = useState<boolean>(false);

  // Up to 4 Image URLs for the product
  const [itemUrl, setItemUrl] = useState('');
  const [itemUrl2, setItemUrl2] = useState('');
  const [itemUrl3, setItemUrl3] = useState('');
  const [itemUrl4, setItemUrl4] = useState('');

  // Single-product Size & Quantity State
  const [itemSizeType, setItemSizeType] = useState<SizeType>('letter');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([
    'XS',
    'S',
    'M',
    'L',
  ]);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [perSizeRawQuantities, setPerSizeRawQuantities] = useState<
    Record<string, string>
  >({});

  // Multi-Color Variant State for New Product
  const [itemHasColors, setItemHasColors] = useState<boolean>(false);
  const [draftColors, setDraftColors] = useState<DraftColorConfig[]>([]);
  const [newColorInput, setNewColorInput] = useState('');
  const [newColorHexInput, setNewColorHexInput] = useState('#3F4D34');
  const [customColorHexMap, setCustomColorHexMap] = useState<
    Record<string, string>
  >({});

  // Full Set 2-Piece Builder State
  const [setPiece1ProductId, setSetPiece1ProductId] = useState<string>('');
  const [setPiece1Search, setSetPiece1Search] = useState<string>('');
  const [setPiece1Label, setSetPiece1Label] = useState<string>('Top / Jacket');
  const [setPiece1SizeType, setSetPiece1SizeType] =
    useState<SizeType>('letter');
  const [setPiece1Sizes, setSetPiece1Sizes] = useState<string[]>([
    'XS',
    'S',
    'M',
    'L',
  ]);
  const [setPiece1Colors, setSetPiece1Colors] = useState<string[]>([]);
  const [setPiece1Category, setSetPiece1Category] = useState<string>('');

  const [setPiece2ProductId, setSetPiece2ProductId] = useState<string>('');
  const [setPiece2Search, setSetPiece2Search] = useState<string>('');
  const [setPiece2Label, setSetPiece2Label] = useState<string>(
    'Bottom / Trousers'
  );
  const [setPiece2SizeType, setSetPiece2SizeType] =
    useState<SizeType>('numeric');
  const [setPiece2Sizes, setSetPiece2Sizes] = useState<string[]>([
    '36',
    '38',
    '40',
    '42',
  ]);
  const [setPiece2Colors, setSetPiece2Colors] = useState<string[]>([]);
  const [setPiece2Category, setSetPiece2Category] = useState<string>('');

  // Custom Months & Years Presets Added by Admin
  const [customMonthsSizes, setCustomMonthsSizes] = useState<string[]>([]);
  const [customYearsSizes, setCustomYearsSizes] = useState<string[]>([]);

  // Existing Catalog Item Custom Color / Size Input State
  const [catalogCustomColorInputs, setCatalogCustomColorInputs] = useState<
    Record<string, string>
  >({});
  const [catalogCustomColorHexInputs, setCatalogCustomColorHexInputs] =
    useState<Record<string, string>>({});
  const [catalogCustomSizeInputs, setCatalogCustomSizeInputs] = useState<
    Record<string, string>
  >({});

  const [itemHasMaterials, setItemHasMaterials] = useState<boolean>(false);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([
    'Cow Leather',
  ]);
  const [newMaterialInput, setNewMaterialInput] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemFeedback, setItemFeedback] = useState('');
  const [aiGeneratingCopy, setAiGeneratingCopy] = useState(false);
  const [draftVariationIndex, setDraftVariationIndex] = useState(0);
  const [copyDraftedNotice, setCopyDraftedNotice] = useState(false);

  // Promo Code Form State
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'fixed'>(
    'percentage'
  );
  const [newPromoValue, setNewPromoValue] = useState('15');
  const [promoFeedback, setPromoFeedback] = useState('');

  // Add Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDept, setNewCatDept] = useState<Department>('women');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catFeedback, setCatFeedback] = useState('');

  // Add Admin Form State
  const [newAdminGmail, setNewAdminGmail] = useState('');
  const [adminFeedback, setAdminFeedback] = useState('');

  const allMaterials = mergeMaterialsList(customMaterials);
  const allColors = mergeColorsList(customColors);
  const deptCategories = getCategoriesByDepartment(categories, itemDept);

  const isEmailAuthorized = isAuthorizedAdminEmail(currentUser?.email, admins);
  const isAuthorized = isEmailAuthorized || aiAdminUnlocked;

  const isFullSetCategorySelected =
    itemDept === 'women' &&
    (itemIsFullSet || itemCategory.trim().toLowerCase() === 'full set');

  const standaloneProductsForDept = products.filter(
    (p) =>
      p.department === itemDept &&
      !p.isFullSet &&
      p.category.trim().toLowerCase() !== 'full set'
  );
  const allStandaloneProducts = products.filter(
    (p) => !p.isFullSet && p.category.trim().toLowerCase() !== 'full set'
  );
  const womenCategories = getCategoriesByDepartment(categories, 'women').filter(
    (c) => c.name.trim().toLowerCase() !== 'full set'
  );
  const womenStandaloneProducts = products.filter(
    (p) =>
      p.department === 'women' &&
      !p.isFullSet &&
      p.category.trim().toLowerCase() !== 'full set'
  );

  const getPresetsForSizeType = (st: SizeType): string[] => {
    if (st === 'letter') return [...LETTER_SIZES];
    if (st === 'numeric') return [...NUMERIC_SIZES];
    if (st === 'months') {
      return Array.from(new Set([...MONTHS_SIZES, ...customMonthsSizes]));
    }
    if (st === 'years' || st === 'cm') {
      return Array.from(new Set([...YEARS_SIZES, ...customYearsSizes]));
    }
    return [...LETTER_SIZES];
  };

  const registerCustomSizePreset = (st: SizeType, normalizedSize: string) => {
    if (st === 'months') {
      setCustomMonthsSizes((prev) =>
        prev.includes(normalizedSize) || MONTHS_SIZES.includes(normalizedSize)
          ? prev
          : [...prev, normalizedSize]
      );
    } else if (st === 'years' || st === 'cm') {
      setCustomYearsSizes((prev) =>
        prev.includes(normalizedSize) || YEARS_SIZES.includes(normalizedSize)
          ? prev
          : [...prev, normalizedSize]
      );
    }
  };

  const handleSelectSetPieceProduct = (
    pieceNum: 1 | 2,
    selectedProdId: string
  ) => {
    const found = products.find((p) => p.id === selectedProdId);
    if (pieceNum === 1) {
      setSetPiece1ProductId(selectedProdId);
      if (found) {
        setSetPiece1Category(found.category);
        setSetPiece1Label(found.category || 'Piece 1');
        setSetPiece1SizeType(found.sizeType);
        setSetPiece1Sizes([...found.sizes]);
        if (
          Boolean(found.hasColors) &&
          Array.isArray(found.colorVariants) &&
          found.colorVariants.length > 0
        ) {
          setSetPiece1Colors([found.colorVariants[0].colorName]);
        } else {
          setSetPiece1Colors([]);
        }
      }
    } else {
      setSetPiece2ProductId(selectedProdId);
      if (found) {
        setSetPiece2Category(found.category);
        setSetPiece2Label(found.category || 'Piece 2');
        setSetPiece2SizeType(found.sizeType);
        setSetPiece2Sizes([...found.sizes]);
        if (
          Boolean(found.hasColors) &&
          Array.isArray(found.colorVariants) &&
          found.colorVariants.length > 0
        ) {
          setSetPiece2Colors([found.colorVariants[0].colorName]);
        } else {
          setSetPiece2Colors([]);
        }
      }
    }
  };

  const handleSizeTypeChange = (type: SizeType) => {
    setItemSizeType(type);
    setSelectedSizes(getPresetsForSizeType(type));
    setPerSizeRawQuantities({});
    setCustomSizeInput('');
  };

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handleAddCustomSize = () => {
    if (!customSizeInput.trim()) return;
    const rawParts = customSizeInput
      .split(',')
      .map((s) => normalizeSizeEntry(s, itemSizeType))
      .filter(Boolean);
    if (rawParts.length === 0) return;

    for (const part of rawParts) {
      registerCustomSizePreset(itemSizeType, part);
    }

    setSelectedSizes((prev) => {
      const next = [...prev];
      for (const part of rawParts) {
        if (!next.includes(part)) next.push(part);
      }
      return next.slice(0, 16);
    });
    setCustomSizeInput('');
  };

  const toggleDraftColor = (colorName: string, explicitHex?: string) => {
    setDraftColors((prev) => {
      const exists = prev.some(
        (c) => c.colorName.toLowerCase() === colorName.toLowerCase()
      );
      if (exists) {
        return prev.filter(
          (c) => c.colorName.toLowerCase() !== colorName.toLowerCase()
        );
      }
      const defaultType: SizeType =
        itemDept === 'kids'
          ? itemCategory.toLowerCase().includes('1 to 5')
            ? 'months'
            : 'years'
          : itemSizeType;
      const resolvedHex =
        explicitHex ||
        customColorHexMap[colorName.toLowerCase()] ||
        getColorSwatchHex(colorName);
      return [
        ...prev,
        {
          colorName,
          colorHex: resolvedHex,
          imageUrl: itemUrl.trim(),
          galleryUrls: ['', '', ''],
          sizeType: defaultType,
          sizes: getPresetsForSizeType(defaultType),
          rawQuantities: {},
          customSizeInput: '',
        },
      ];
    });
  };

  const handleAddAndCheckCustomColor = async (
    overrideName?: string,
    overrideHex?: string
  ) => {
    const rawName = (overrideName ?? newColorInput).trim();
    const rawHex = (overrideHex ?? newColorHexInput).trim();
    const cleanHex = /^#[0-9a-fA-F]{3,6}$/.test(rawHex) ? rawHex : '#3F4D34';
    const clean = rawName || cleanHex.toUpperCase();
    if (!clean) return;
    await onAddCustomColor(clean);
    setCustomColorHexMap((prev) => ({
      ...prev,
      [clean.toLowerCase()]: cleanHex,
    }));
    const exists = draftColors.some(
      (c) => c.colorName.toLowerCase() === clean.toLowerCase()
    );
    if (!exists) {
      const defaultType: SizeType =
        itemDept === 'kids'
          ? itemCategory.toLowerCase().includes('1 to 5')
            ? 'months'
            : 'years'
          : itemSizeType;
      setDraftColors((prev) => [
        ...prev,
        {
          colorName: clean,
          colorHex: cleanHex,
          imageUrl: itemUrl.trim(),
          galleryUrls: ['', '', ''],
          sizeType: defaultType,
          sizes: getPresetsForSizeType(defaultType),
          rawQuantities: {},
          customSizeInput: '',
        },
      ]);
    } else {
      setDraftColors((prev) =>
        prev.map((c) =>
          c.colorName.toLowerCase() === clean.toLowerCase()
            ? { ...c, colorHex: cleanHex }
            : c
        )
      );
    }
    setItemHasColors(true);
    setNewColorInput('');
  };

  const updateDraftColorField = (
    colorName: string,
    updater: (prev: DraftColorConfig) => DraftColorConfig
  ) => {
    setDraftColors((prev) =>
      prev.map((c) =>
        c.colorName.toLowerCase() === colorName.toLowerCase() ? updater(c) : c
      )
    );
  };

  const toggleMaterial = (mat: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(mat) ? prev.filter((m) => m !== mat) : [...prev, mat]
    );
  };

  const handleAddAndCheckCustomMaterial = async () => {
    const clean = newMaterialInput.trim();
    if (!clean) return;
    await onAddCustomMaterial(clean);
    setSelectedMaterials((prev) =>
      prev.includes(clean) ? prev : [...prev, clean]
    );
    setNewMaterialInput('');
  };

  const handleGenerateAiCopy = async () => {
    setAiGeneratingCopy(true);
    setCopyDraftedNotice(false);
    const nextVariation = draftVariationIndex + 1;
    setDraftVariationIndex(nextVariation);

    const activeColors = itemHasColors
      ? draftColors.map((v) => v.colorName).filter(Boolean)
      : [];
    const activeMats = itemHasMaterials ? selectedMaterials : [];

    const fallbackDraft = buildEditorialProductDescription(
      {
        name: itemName,
        department: itemDept,
        category: itemCategory,
        style: itemStyle,
        materials: activeMats,
        colors: activeColors,
      },
      nextVariation - 1
    );

    try {
      if (itemName.trim()) {
        const res = await fetch('/api/ai/product-copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: itemName.trim(),
            department: itemDept,
            category: itemCategory,
            style: itemStyle,
            materials: activeMats,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.description === 'string' && data.description.trim()) {
            setItemDescription(data.description.trim());
            setCopyDraftedNotice(true);
            return;
          }
        }
      }
      setItemDescription(fallbackDraft);
      setCopyDraftedNotice(true);
    } catch {
      setItemDescription(fallbackDraft);
      setCopyDraftedNotice(true);
    } finally {
      setAiGeneratingCopy(false);
    }
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemFeedback('');

    const cleanName = itemName.trim();
    if (!cleanName) {
      setItemFeedback('Product Name is required.');
      return;
    }
    if (!isFullSetCategorySelected && itemHasMaterials && selectedMaterials.length === 0) {
      setItemFeedback(
        'Please checkmark at least one Material, or uncheck "Add Material to Product".'
      );
      return;
    }

    const effectiveMaterials =
      !isFullSetCategorySelected && itemHasMaterials ? selectedMaterials : [];
    const defaultMaterialClause =
      effectiveMaterials.length > 0
        ? ` crafted in ${effectiveMaterials.join(', ')}`
        : '';

    const numericPrice = Math.max(1, Number(itemPrice) || 0);
    const numericDiscountVal =
      itemDiscountType === 'none'
        ? 0
        : Math.max(0, Number(itemDiscountValue) || 0);

    const fallbackStudioUri = `studio://${itemDept}-${createSafeSlug(
      itemCategory
    )}-${createSafeSlug(cleanName)}`;
    const primaryImage = itemUrl.trim() || fallbackStudioUri;

    const additionalUrls = [itemUrl2, itemUrl3, itemUrl4]
      .map((u) => u.trim())
      .filter((u) => Boolean(u) && u !== primaryImage);

    // CASE A: 2-PIECE LINKED FULL SET PRODUCT
    if (isFullSetCategorySelected) {
      const pool =
        womenStandaloneProducts.length > 0
          ? womenStandaloneProducts
          : allStandaloneProducts;
      const p1Id = setPiece1ProductId || pool[0]?.id || '';
      const p2Id = setPiece2ProductId || pool[1]?.id || pool[0]?.id || '';
      const prod1 = products.find((p) => p.id === p1Id);
      const prod2 = products.find((p) => p.id === p2Id);

      if (!prod1 || !prod2) {
        setItemFeedback(
          'Please select two existing store products from Women categories to link into this Full Set.'
        );
        return;
      }

      const buildPieceSubItem = (
        linked: ProductItem,
        chosenColors: string[],
        fallbackLabel: string
      ): FullSetSubItem => {
        const linkedHasColors =
          Boolean(linked.hasColors) &&
          Array.isArray(linked.colorVariants) &&
          linked.colorVariants.length > 0;

        if (linkedHasColors && linked.colorVariants) {
          const validChosen = chosenColors.filter((colName) =>
            linked.colorVariants!.some(
              (v) =>
                v.colorName.trim().toLowerCase() === colName.trim().toLowerCase()
            )
          );
          const effectiveColorNames =
            validChosen.length > 0
              ? validChosen
              : [linked.colorVariants[0].colorName];
          const filteredVariants = linked.colorVariants.filter((v) =>
            effectiveColorNames.some(
              (c) => c.trim().toLowerCase() === v.colorName.trim().toLowerCase()
            )
          );
          const leadVar = filteredVariants[0] || linked.colorVariants[0];
          const leadSizes =
            Array.isArray(leadVar.sizes) && leadVar.sizes.length > 0
              ? [...leadVar.sizes]
              : [...linked.sizes];
          const leadQtyMap = buildSizeQuantitiesMap(
            leadSizes,
            leadVar.sizeQuantities
          );
          return {
            productId: linked.id,
            productName: linked.name,
            pieceLabel: fallbackLabel.trim() || linked.category || 'Piece',
            sizeType: leadVar.sizeType || linked.sizeType,
            sizes: leadSizes,
            sizeQuantities: leadQtyMap,
            selectedColors: filteredVariants.map((v) => v.colorName),
            colorVariants: filteredVariants.map((v) => ({
              ...v,
              sizes: [...v.sizes],
              sizeQuantities: { ...v.sizeQuantities },
            })),
          };
        }

        const pSizes = [...linked.sizes];
        const pQtyMap: Record<string, number> = {};
        for (const sz of pSizes) {
          pQtyMap[sz] = getSizeQuantity(linked, sz);
        }
        return {
          productId: linked.id,
          productName: linked.name,
          pieceLabel: fallbackLabel.trim() || linked.category || 'Piece',
          sizeType: linked.sizeType,
          sizes: pSizes,
          sizeQuantities: pQtyMap,
          selectedColors: [],
          colorVariants: [],
        };
      };

      const sub1 = buildPieceSubItem(
        prod1,
        setPiece1Colors,
        setPiece1Label || prod1.category || 'Shirt / Top'
      );
      const sub2 = buildPieceSubItem(
        prod2,
        setPiece2Colors,
        setPiece2Label || prod2.category || 'Trousers / Bottom'
      );
      const setItemsPayload: FullSetSubItem[] = [sub1, sub2];

      const computeSubTotal = (sub: FullSetSubItem): number => {
        if (Array.isArray(sub.colorVariants) && sub.colorVariants.length > 0) {
          return sub.colorVariants.reduce(
            (acc, v) => acc + sumSizeQuantities(v.sizes, v.sizeQuantities),
            0
          );
        }
        return sumSizeQuantities(sub.sizes, sub.sizeQuantities);
      };

      const total1 = computeSubTotal(sub1);
      const total2 = computeSubTotal(sub2);
      const minSetTotal = Math.min(total1, total2);

      const autoGallery =
        additionalUrls.length > 0
          ? additionalUrls
          : [prod1.imageUrl, prod2.imageUrl].filter(
              (u) => Boolean(u) && u !== primaryImage
            );

      await onAddProduct({
        name: cleanName.toUpperCase(),
        department: itemDept,
        category: itemCategory,
        style: itemStyle,
        price: numericPrice,
        quantity: minSetTotal,
        sizeQuantities: sub1.sizeQuantities,
        hasColors: false,
        colorVariants: [],
        isFullSet: true,
        setItems: setItemsPayload,
        isNewArrival: itemIsNewArrival,
        discountType: itemDiscountType,
        discountValue: numericDiscountVal,
        imageUrl: itemUrl.trim() || prod1.imageUrl || fallbackStudioUri,
        galleryUrls: autoGallery.slice(0, 3),
        sizeType: sub1.sizeType,
        sizes: sub1.sizes,
        materials: [],
        description:
          itemDescription.trim() ||
          `${cleanName} — Coordinated 2-piece SAMO Full Set linking ${prod1.name} and ${prod2.name}.`,
        inStock: total1 > 0 && total2 > 0,
        featured: itemIsNewArrival,
      });

      setItemName('');
      setItemUrl('');
      setItemUrl2('');
      setItemUrl3('');
      setItemUrl4('');
      setItemDescription('');
      setItemHasColors(false);
      setDraftColors([]);
      setItemHasMaterials(false);
      setItemFeedback(
        `Added 2-Piece Full Set "${cleanName.toUpperCase()}" to ${itemDept.toUpperCase()} / Full Set.`
      );
      setIsAddProductModalOpen(false);
      return;
    }

    // CASE B: MULTI-COLOR PRODUCT
    if (itemHasColors) {
      if (draftColors.length === 0) {
        setItemFeedback(
          'Please checkmark at least one Color or uncheck "Product Has Multiple Colors".'
        );
        return;
      }

      const builtVariants: ProductColorVariant[] = [];
      for (const dc of draftColors) {
        if (dc.sizes.length === 0) {
          setItemFeedback(
            `Please select at least one size for color "${dc.colorName}".`
          );
          return;
        }
        const sq = buildSizeQuantitiesMap(dc.sizes, dc.rawQuantities);
        const variantImg =
          dc.imageUrl.trim() ||
          itemUrl.trim() ||
          `${fallbackStudioUri}-${createSafeSlug(dc.colorName)}`;
        const variantGallery = (dc.galleryUrls || [])
          .map((u) => (u || '').trim())
          .filter((u) => Boolean(u) && u !== variantImg)
          .slice(0, 3);
        builtVariants.push({
          colorName: dc.colorName,
          colorHex:
            dc.colorHex ||
            customColorHexMap[dc.colorName.toLowerCase()] ||
            getColorSwatchHex(dc.colorName),
          imageUrl: variantImg,
          galleryUrls: variantGallery,
          sizeType: dc.sizeType,
          sizes: dc.sizes,
          sizeQuantities: sq,
        });
      }

      const synced = syncProductFromColorVariants(builtVariants, itemSizeType);
      const mainImg = builtVariants[0]?.imageUrl || primaryImage;
      const mergedGallery =
        additionalUrls.length > 0
          ? additionalUrls
          : builtVariants[0]?.galleryUrls || [];

      await onAddProduct({
        name: cleanName.toUpperCase(),
        department: itemDept,
        category: itemCategory,
        style: itemStyle,
        price: numericPrice,
        quantity: synced.quantity,
        sizeQuantities: synced.sizeQuantities,
        hasColors: true,
        colorVariants: builtVariants,
        isFullSet: isFullSetCategorySelected,
        isNewArrival: itemIsNewArrival,
        discountType: itemDiscountType,
        discountValue: numericDiscountVal,
        imageUrl: mainImg,
        galleryUrls: mergedGallery,
        sizeType: synced.sizeType,
        sizes: synced.sizes,
        materials: effectiveMaterials,
        description:
          itemDescription.trim() ||
          `${cleanName}${defaultMaterialClause} for SAMO ${
            itemDept === 'women' ? 'Women' : 'Kids'
          }.`,
        inStock: synced.inStock,
        featured: itemIsNewArrival,
      });
    } else {
      // CASE C: STANDARD SINGLE-COLOR PRODUCT (No color variants added)
      if (selectedSizes.length === 0) {
        setItemFeedback('Please select or add at least one Size.');
        return;
      }

      const sizeQuantities = buildSizeQuantitiesMap(
        selectedSizes,
        perSizeRawQuantities
      );
      const totalQuantity = sumSizeQuantities(selectedSizes, sizeQuantities);

      await onAddProduct({
        name: cleanName.toUpperCase(),
        department: itemDept,
        category: itemCategory,
        style: itemStyle,
        price: numericPrice,
        quantity: totalQuantity,
        sizeQuantities,
        hasColors: false,
        colorVariants: [],
        isFullSet: isFullSetCategorySelected,
        isNewArrival: itemIsNewArrival,
        discountType: itemDiscountType,
        discountValue: numericDiscountVal,
        imageUrl: primaryImage,
        galleryUrls: additionalUrls,
        sizeType: itemSizeType,
        sizes: selectedSizes,
        materials: effectiveMaterials,
        description:
          itemDescription.trim() ||
          `${cleanName}${defaultMaterialClause} for SAMO ${
            itemDept === 'women' ? 'Women' : 'Kids'
          }.`,
        inStock: totalQuantity > 0,
        featured: itemIsNewArrival,
      });
    }

    setItemName('');
    setItemUrl('');
    setItemUrl2('');
    setItemUrl3('');
    setItemUrl4('');
    setItemDescription('');
    setPerSizeRawQuantities({});
    setItemDiscountType('none');
    setItemDiscountValue('0');
    setItemIsNewArrival(true);
    setItemIsFullSet(false);
    setLinkTwoSetPieces(false);
    setItemHasColors(false);
    setDraftColors([]);
    setItemHasMaterials(false);
    setItemFeedback(
      `Published "${cleanName.toUpperCase()}" to ${itemDept.toUpperCase()} / ${itemCategory}.`
    );
    setIsAddProductModalOpen(false);
  };

  // Existing Catalog Product Color Variant Handlers
  const handleToggleCatalogProductColorMode = async (
    prod: ProductItem,
    enable: boolean
  ) => {
    if (!enable) {
      await onUpdateProductColorVariants(prod.id, false, []);
      return;
    }
    const existing =
      prod.colorVariants && prod.colorVariants.length > 0
        ? prod.colorVariants
        : [
            {
              colorName: 'Black',
              colorHex: getColorSwatchHex('Black'),
              imageUrl: prod.imageUrl,
              sizeType: prod.sizeType,
              sizes: [...prod.sizes],
              sizeQuantities: { ...prod.sizeQuantities },
            },
          ];
    await onUpdateProductColorVariants(prod.id, true, existing);
  };

  const handleToggleCatalogProductColorItem = async (
    prod: ProductItem,
    colorName: string,
    explicitHex?: string
  ) => {
    const current = prod.colorVariants || [];
    const exists = current.some(
      (v) => v.colorName.toLowerCase() === colorName.toLowerCase()
    );
    let next: ProductColorVariant[];
    if (exists) {
      next = current.filter(
        (v) => v.colorName.toLowerCase() !== colorName.toLowerCase()
      );
    } else {
      const defaultSizes = getDefaultSizesForType(prod.sizeType);
      const resolvedHex =
        explicitHex ||
        customColorHexMap[colorName.toLowerCase()] ||
        getColorSwatchHex(colorName);
      next = [
        ...current,
        {
          colorName,
          colorHex: resolvedHex,
          imageUrl: prod.imageUrl,
          galleryUrls: [],
          sizeType: prod.sizeType,
          sizes: defaultSizes,
          sizeQuantities: buildSizeQuantitiesMap(defaultSizes, {}),
        },
      ];
    }
    await onUpdateProductColorVariants(prod.id, next.length > 0, next);
  };

  const handleCatalogVariantChange = async (
    prod: ProductItem,
    colorName: string,
    updater: (v: ProductColorVariant) => ProductColorVariant
  ) => {
    const current = prod.colorVariants || [];
    const next = current.map((v) =>
      v.colorName.toLowerCase() === colorName.toLowerCase() ? updater(v) : v
    );
    await onUpdateProductColorVariants(prod.id, true, next);
  };

  const handleCatalogAddCustomColorToProduct = async (
    prod: ProductItem,
    overrideName?: string,
    overrideHex?: string
  ) => {
    const rawName = (
      overrideName ??
      catalogCustomColorInputs[prod.id] ??
      ''
    ).trim();
    const rawHex = (
      overrideHex ??
      catalogCustomColorHexInputs[prod.id] ??
      '#3F4D34'
    ).trim();
    const cleanHex = /^#[0-9a-fA-F]{3,6}$/.test(rawHex) ? rawHex : '#3F4D34';
    const raw = rawName || cleanHex.toUpperCase();
    if (!raw) return;
    await onAddCustomColor(raw);
    setCustomColorHexMap((prev) => ({
      ...prev,
      [raw.toLowerCase()]: cleanHex,
    }));
    const exists = (prod.colorVariants || []).some(
      (v) => v.colorName.toLowerCase() === raw.toLowerCase()
    );
    if (!exists) {
      await handleToggleCatalogProductColorItem(prod, raw, cleanHex);
    } else {
      await handleCatalogVariantChange(prod, raw, (v) => ({
        ...v,
        colorHex: cleanHex,
      }));
    }
    setCatalogCustomColorInputs((prev) => ({ ...prev, [prod.id]: '' }));
  };

  const handleCreatePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoFeedback('');
    const code = newPromoCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    const val = Math.max(1, Number(newPromoValue) || 0);
    if (!code) {
      setPromoFeedback('Enter a valid promo code (e.g. SAMO20).');
      return;
    }
    await onAddPromoCode({
      code,
      discountType: newPromoType,
      discountValue: val,
      active: true,
    });
    setNewPromoCode('');
    setPromoFeedback(
      `Promo code "${code}" (${
        newPromoType === 'percentage' ? `${val}% Off` : `$${val} Off`
      }) is now live.`
    );
  };

  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatFeedback('');
    const rawName = newCatName.trim();
    if (!rawName) return;
    const cleanName =
      newCatDept === 'kids' ? normalizeKidsCategoryName(rawName) : rawName;
    if (
      newCatDept === 'kids' &&
      cleanName.trim().toLowerCase() === 'full set'
    ) {
      setCatFeedback('Full Set is only available in the Women department.');
      return;
    }

    await onAddCategory({
      name: cleanName,
      slug: createSafeSlug(cleanName),
      department: newCatDept,
      description:
        newCatDesc.trim() ||
        `Curated ${cleanName} collection for SAMO ${newCatDept}.`,
    });

    setNewCatName('');
    setNewCatDesc('');
    setCatFeedback(
      `Category "${cleanName}" added to ${newCatDept.toUpperCase()}.`
    );
    setIsAddCategoryModalOpen(false);
  };

  const handleAddAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFeedback('');
    const cleanEmail = newAdminGmail.trim().toLowerCase();
    if (!cleanEmail.endsWith('@gmail.com')) {
      setAdminFeedback(
        'Please enter a valid @gmail.com address for Google Auth access.'
      );
      return;
    }
    await onAddAdminByEmail(cleanEmail);
    setNewAdminGmail('');
    setAdminFeedback(`Granted /admin access to ${cleanEmail}.`);
  };

  const handleExportCloudflareJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      brand: 'SAMO (Est. 1999)',
      categories,
      products,
      promoCodes,
      customMaterials,
      customColors,
      orders,
      preorders,
      admins,
      siteBanners,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'samo-catalog-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Update a single field of siteBanners
  const updateSiteBannerField = async <K extends keyof SiteBannersConfig>(
    field: K,
    value: SiteBannersConfig[K],
    feedbackLabel?: string
  ) => {
    const next: SiteBannersConfig = {
      ...siteBanners,
      [field]: value,
    };
    await onUpdateSiteBanners(next);
    if (feedbackLabel) {
      setBannerFeedback(`✓ Updated ${feedbackLabel}`);
      setTimeout(() => setBannerFeedback(''), 3500);
    }
  };

  // Update or toggle a category in-feed banner
  const updateCategoryBanner = async (
    categoryKey: string,
    department: Department | 'collection',
    categoryName: string,
    updater: (prev: CategoryBannerConfig) => CategoryBannerConfig,
    feedbackLabel?: string
  ) => {
    const existing =
      siteBanners.categoryBanners?.[categoryKey] ||
      buildDefaultCategoryBannerForCategory(
        department,
        categoryName,
        categoryKey
      );
    const updatedItem = {
      ...updater(existing),
      updatedAt: new Date().toISOString(),
    };
    const next: SiteBannersConfig = {
      ...siteBanners,
      categoryBanners: {
        ...(siteBanners.categoryBanners || {}),
        [categoryKey]: updatedItem,
      },
    };
    await onUpdateSiteBanners(next);
    if (feedbackLabel) {
      setBannerFeedback(`✓ ${feedbackLabel}`);
      setTimeout(() => setBannerFeedback(''), 3500);
    }
  };

  const filteredOrders = filterOrdersByQuery(orders, orderSearchQuery);
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );
  const validPreorders = useMemo(
    () => preorders.filter((p) => Boolean(p.productName)),
    [preorders]
  );
  const pendingPreorders = useMemo(
    () => validPreorders.filter((p) => p.status === 'pending'),
    [validPreorders]
  );

  // Quick Categories with item counts (Women + Kids)
  const quickCategoriesWithCounts = useMemo(() => {
    const womenCats = getCategoriesByDepartment(categories, 'women');
    const kidsCats = getCategoriesByDepartment(categories, 'kids');
    const combined = [...womenCats, ...kidsCats];

    return combined.map((cat) => {
      const count = products.filter((p) => {
        if (p.department !== cat.department) return false;
        const pCat =
          p.department === 'kids'
            ? normalizeKidsCategoryName(p.category).toLowerCase()
            : p.category.trim().toLowerCase();
        if (
          cat.department === 'women' &&
          cat.name.toLowerCase() === 'full set' &&
          p.isFullSet
        ) {
          return true;
        }
        return pCat === cat.name.toLowerCase();
      }).length;
      return {
        ...cat,
        count,
      };
    });
  }, [categories, products]);

  // Filtered Products for the Products List (matching Quick Category, Department, All/Out-of-Stock tab, and Search)
  const displayedAdminProducts = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    return products.filter((prod) => {
      const hasColors =
        Boolean(prod.hasColors) &&
        Array.isArray(prod.colorVariants) &&
        prod.colorVariants.length > 0;
      const totalQty = hasColors
        ? syncProductFromColorVariants(prod.colorVariants!, prod.sizeType)
            .quantity
        : sumSizeQuantities(prod.sizes, prod.sizeQuantities);
      const isItemOutOfStock = totalQty <= 0 || !prod.inStock;

      if (productStockFilter === 'out-of-stock' && !isItemOutOfStock) {
        return false;
      }
      if (
        selectedDeptFilter !== 'all' &&
        prod.department !== selectedDeptFilter
      ) {
        return false;
      }
      if (selectedQuickCategory !== 'all') {
        const [targetDept, targetCatName] = selectedQuickCategory.split('::');
        if (targetDept && prod.department !== targetDept) return false;
        const prodCatNorm =
          prod.department === 'kids'
            ? normalizeKidsCategoryName(prod.category).toLowerCase()
            : prod.category.trim().toLowerCase();
        const isFullSetMatch =
          targetCatName?.toLowerCase() === 'full set' &&
          prod.department === 'women' &&
          Boolean(prod.isFullSet);
        if (
          !isFullSetMatch &&
          prodCatNorm !== (targetCatName || '').toLowerCase()
        ) {
          return false;
        }
      }
      if (q) {
        const hay =
          `${prod.name} ${prod.category} ${prod.department} ${prod.style} ${(prod.materials || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    products,
    productStockFilter,
    selectedDeptFilter,
    selectedQuickCategory,
    globalSearchQuery,
  ]);

  const outOfStockCount = useMemo(
    () =>
      products.filter((prod) => {
        const hasColors =
          Boolean(prod.hasColors) &&
          Array.isArray(prod.colorVariants) &&
          prod.colorVariants.length > 0;
        const totalQty = hasColors
          ? syncProductFromColorVariants(prod.colorVariants!, prod.sizeType)
              .quantity
          : sumSizeQuantities(prod.sizes, prod.sizeQuantities);
        return totalQty <= 0 || !prod.inStock;
      }).length,
    [products]
  );

  const editingProduct = useMemo(
    () =>
      editingProductId
        ? products.find((p) => p.id === editingProductId) || null
        : null,
    [products, editingProductId]
  );

  // LOCKED GATE IF NOT YET AUTHENTICATED
  if (!isAuthorized) {
    return (
      <div
        className={`samo-admin-root ${
          adminTheme === 'light' ? 'samo-admin-light' : 'samo-admin-dark'
        } min-h-screen bg-[#0E0E10] text-white flex flex-col justify-between p-6 md:p-12`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-extrabold tracking-[0.16em] uppercase">
              SAMO
            </span>
            <span className="text-xs text-zinc-400 uppercase tracking-widest">
              /admin · Restricted Atelier Portal
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleAdminTheme}
              aria-label={
                adminTheme === 'light'
                  ? 'Switch Admin to Dark Mode'
                  : 'Switch Admin to Light Mode'
              }
              className="px-3 py-1.5 rounded-lg bg-[#18181C] border border-zinc-800 text-zinc-200 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              {adminTheme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light Mode</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigateHome('/home')}
              className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to /home</span>
            </button>
          </div>
        </div>

        <div className="max-w-md w-full mx-auto my-8 sm:my-12 p-5 sm:p-8 bg-[#18181C] border border-zinc-800 rounded-2xl space-y-6">
          <div className="flex items-center gap-3 text-white">
            <ShieldCheck className="w-6 h-6 shrink-0" />
            <div>
              <h1 className="font-display text-base sm:text-lg font-extrabold tracking-[0.12em] uppercase">
                SAMO Admin Authentication
              </h1>
              <p className="text-xs text-zinc-400">
                Restricted to Authorized Atelier Administration Accounts
              </p>
            </div>
          </div>

          {currentUser && !isEmailAuthorized && (
            <div className="p-3.5 bg-red-950/60 border border-red-700 rounded-xl text-xs text-red-200 space-y-2">
              <p className="font-bold uppercase tracking-wider">
                Unauthorized Account: {currentUser.email}
              </p>
              <p>
                Only authorized Atelier administration accounts verified in the
                database can access <code>/admin</code>.
              </p>
            </div>
          )}

          {authError && (
            <div className="p-3 bg-amber-950/60 border border-amber-700 rounded-xl text-xs text-amber-200">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={async () => {
                setAuthError('');
                try {
                  await onGoogleSignIn();
                } catch (err) {
                  setAuthError(
                    err instanceof Error
                      ? err.message
                      : 'Google Sign-In popup could not complete in this window.'
                  );
                }
              }}
              className="w-full py-3.5 px-4 bg-white text-zinc-950 rounded-xl text-xs font-bold tracking-[0.12em] uppercase hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Sign In with Google (Authorized Admin)
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            This portal is isolated to <code>samoweave.com/admin</code> and hidden
            from public storefront navigation.
          </p>
        </div>

        <div className="text-center text-[11px] text-zinc-600 uppercase tracking-widest">
          SAMO Atelier Security Active
        </div>
      </div>
    );
  }

  const navItems: {
    id: AdminSectionTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      shortLabel: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'items',
      label: 'Items & Products',
      shortLabel: 'Products',
      icon: <Package className="w-4 h-4 shrink-0" />,
      badge: products.length,
    },
    {
      id: 'categories',
      label: 'Categories & Feed Banners',
      shortLabel: 'Categories',
      icon: <FolderTree className="w-4 h-4 shrink-0" />,
      badge: categories.length,
    },
    {
      id: 'banners',
      label: 'Site Banners & Video',
      shortLabel: 'Banners',
      icon: <Film className="w-4 h-4 shrink-0" />,
      badge: 6,
    },
    {
      id: 'orders',
      label: 'Client Orders',
      shortLabel: 'Orders',
      icon: <ShoppingBag className="w-4 h-4 shrink-0" />,
      badge: pendingOrders.length > 0 ? pendingOrders.length : orders.length,
    },
    {
      id: 'preorders',
      label: 'Preorders Alerts',
      shortLabel: 'Preorders',
      icon: <BellRing className="w-4 h-4 shrink-0" />,
      badge:
        pendingPreorders.length > 0
          ? pendingPreorders.length
          : validPreorders.length,
    },
    {
      id: 'promos',
      label: 'Promo Codes',
      shortLabel: 'Promos',
      icon: <Tag className="w-4 h-4 shrink-0" />,
      badge: promoCodes.length,
    },
    {
      id: 'newsletter',
      label: 'SAMO Newsletter',
      shortLabel: 'Newsletter',
      icon: <Mail className="w-4 h-4 shrink-0" />,
      badge: newsletterSubscribers.length,
    },
    {
      id: 'admins',
      label: 'Admin Access',
      shortLabel: 'Admins',
      icon: <Users className="w-4 h-4 shrink-0" />,
      badge: admins.length,
    },
  ];

  const activeNavMeta =
    navItems.find((n) => n.id === activeTab) || navItems[0];

  const handleSelectNav = (tab: AdminSectionTab) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
  };

  // Reusable Product List Row Component (matching Reference Image: Thumbnail + Name/Category + Price + Toggle + Edit + Delete)
  const renderProductRow = (prod: ProductItem) => {
    const hasColors =
      Boolean(prod.hasColors) &&
      Array.isArray(prod.colorVariants) &&
      prod.colorVariants.length > 0;
    const totalQty = hasColors
      ? syncProductFromColorVariants(prod.colorVariants!, prod.sizeType)
          .quantity
      : sumSizeQuantities(prod.sizes, prod.sizeQuantities);
    const isItemInStock = Boolean(prod.inStock) && totalQty > 0;
    const pricing = getEffectiveProductPrice(prod);

    return (
      <div
        key={prod.id}
        className="py-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-zinc-800/35 transition-colors"
      >
        {/* Left: Thumbnail + Product Name + Category */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-12 h-14 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700/80 shrink-0">
            <ProductImage
              src={prod.imageUrl}
              alt={prod.name}
              category={prod.category}
              styleType={prod.style}
              compact={true}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-semibold text-white truncate">
              {prod.name}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
              <span className="capitalize">{prod.department}</span>
              <span aria-hidden="true">·</span>
              <span>{prod.category}</span>
              {prod.isNewArrival && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-zinc-200 font-medium">New Arrival</span>
                </>
              )}
              {prod.isFullSet && prod.department === 'women' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-zinc-200 font-medium">Full Set</span>
                </>
              )}
              {!isItemInStock && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-red-400 font-semibold">
                    Out of Stock
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Price + In-Stock Toggle Switch + Edit Pencil + Delete Trash */}
        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/70 shrink-0">
          <div className="text-left sm:text-right font-mono-tabular min-w-[76px]">
            <div className="text-xs sm:text-sm font-bold text-white">
              ${pricing.effectivePrice.toLocaleString()}
            </div>
            {pricing.hasDiscount ? (
              <div className="text-[10px] text-emerald-400">
                <span className="line-through text-zinc-500 mr-1">
                  ${pricing.originalPrice.toLocaleString()}
                </span>
                {pricing.discountBadge}
              </div>
            ) : (
              <div className="text-[10px] text-zinc-500">
                Stock: {isItemInStock ? totalQty : 0}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* In-Stock Toggle Switch (When toggled off, product appears Out of Stock on user website) */}
            <button
              type="button"
              role="switch"
              aria-checked={isItemInStock}
              aria-label={`Toggle stock status for ${prod.name}`}
              title={
                isItemInStock
                  ? 'In Stock (Click to mark Out of Stock on website)'
                  : 'Out of Stock (Click to mark In Stock on website)'
              }
              onClick={() => onToggleProductStock(prod.id, !isItemInStock)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 items-center ${
                isItemInStock
                  ? 'bg-white border-white'
                  : 'bg-zinc-800 border-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ${
                  isItemInStock
                    ? 'translate-x-5 bg-zinc-950'
                    : 'translate-x-1 bg-zinc-400'
                }`}
              />
            </button>

            {/* Edit Item Button */}
            <button
              type="button"
              onClick={() => setEditingProductId(prod.id)}
              aria-label={`Edit product ${prod.name}`}
              title="Edit Product Details, Sizes & Photos"
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Delete Item Button (Opens "Are you sure you want to delete?" Popup) */}
            <button
              type="button"
              onClick={() => setProductPendingDelete(prod)}
              aria-label={`Delete product ${prod.name}`}
              title="Delete Product"
              className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-800/60 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`samo-admin-root ${
        adminTheme === 'light' ? 'samo-admin-light' : 'samo-admin-dark'
      } min-h-screen bg-[#0E0E10] text-zinc-100 flex flex-col lg:flex-row pb-20 lg:pb-0 transition-colors duration-200`}
    >
      {/* MOBILE SLIDE-OVER SIDEBAR DRAWER BACKDROP */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* LEFT SIDEBAR NAVIGATION (Matches Reference Image Layout & SAMO Colors) */}
      <aside
        className={`w-64 bg-[#141417] border-r border-zinc-800/90 flex-col justify-between shrink-0 ${
          mobileSidebarOpen
            ? 'flex fixed inset-y-0 left-0 z-50 h-screen shadow-2xl'
            : 'hidden lg:flex lg:sticky lg:top-0 lg:h-screen'
        }`}
      >
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Brand Lockup */}
          <div className="flex items-center justify-between px-2 pt-1">
            <button
              type="button"
              onClick={() => handleSelectNav('dashboard')}
              className="text-left group cursor-pointer"
            >
              <span className="font-display text-2xl font-extrabold tracking-[0.18em] uppercase text-white block">
                SAMO
              </span>
              <span className="text-[10px] font-mono-tabular uppercase tracking-[0.2em] text-zinc-400 block mt-0.5">
                Atelier Admin
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden p-2 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Return to Live Website Button */}
          <div className="lg:hidden px-1">
            <button
              type="button"
              onClick={() => {
                setMobileSidebarOpen(false);
                onNavigateHome('/home');
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Live Website</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1" aria-label="Admin Sidebar Navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-admin-tab={item.id}
                  onClick={() => handleSelectNav(item.id)}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-800/90 text-white border-l-2 border-white shadow-xs'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
                  }`}
                >
                  <span className="flex items-center gap-3 truncate">
                    <span
                      className={isActive ? 'text-white' : 'text-zinc-400'}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono-tabular rounded-full ${
                        isActive
                          ? 'bg-white text-zinc-950 font-bold'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Theme Toggle, Storefront & Logout Actions */}
        <div className="p-4 border-t border-zinc-800/80 space-y-2">
          <button
            type="button"
            onClick={toggleAdminTheme}
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              {adminTheme === 'light' ? (
                <Moon className="w-4 h-4 shrink-0" />
              ) : (
                <Sun className="w-4 h-4 shrink-0" />
              )}
              <span>
                {adminTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              </span>
            </span>
            <span className="text-[10px] font-mono-tabular uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
              {adminTheme === 'light' ? 'Light' : 'Dark'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateHome('/home')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Storefront (/home)</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full px-3.5 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER BAR (Matches Reference Image: Breadcrumb Left, Search + Theme Toggle + Bell + Admin Profile Right) */}
        <header className="sticky top-0 z-30 bg-[#0E0E10]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            {/* Left: Hamburger (Mobile) + Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open admin menu"
                className="lg:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white cursor-pointer"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
                <span className="text-zinc-500 hidden sm:inline">
                  Dashboard
                </span>
                <span className="text-zinc-600 hidden sm:inline">/</span>
                <span className="font-semibold text-white truncate">
                  {activeNavMeta.label}
                </span>
              </div>
            </div>

            {/* Right: Search Bar + Light/Dark Mode Toggle + Notification Bell + Admin Profile */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative w-32 sm:w-60">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder="Search items..."
                  aria-label="Search admin products"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#18181C] border border-zinc-800 rounded-lg text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              {/* Admin Light / Dark Mode Toggle Button */}
              <button
                type="button"
                onClick={toggleAdminTheme}
                data-testid="admin-theme-toggle"
                aria-label={
                  adminTheme === 'light'
                    ? 'Switch Admin Dashboard to Dark Mode'
                    : 'Switch Admin Dashboard to Light Mode'
                }
                title={
                  adminTheme === 'light'
                    ? 'Switch Admin Dashboard to Dark Mode'
                    : 'Switch Admin Dashboard to Light Mode'
                }
                className="px-2.5 py-1.5 rounded-lg bg-[#18181C] border border-zinc-800 text-zinc-200 hover:text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                {adminTheme === 'light' ? (
                  <>
                    <Moon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Light Mode</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSelectNav('orders')}
                aria-label="View pending orders"
                title="Client Orders Queue"
                className="relative p-2 rounded-lg bg-[#18181C] border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer shrink-0"
              >
                <BellRing className="w-4 h-4" />
                {pendingOrders.length + pendingPreorders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-zinc-950 text-[9px] font-bold flex items-center justify-center">
                    {pendingOrders.length + pendingPreorders.length}
                  </span>
                )}
              </button>

              <div className="hidden md:flex items-center gap-2.5 pl-2 border-l border-zinc-800">
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[11px] font-bold text-white uppercase">
                  {(currentUser?.email || 'A')[0]}
                </div>
                <div className="text-xs leading-tight">
                  <div className="font-semibold text-white">Admin (Main)</div>
                  <div className="text-[10px] text-zinc-400 truncate max-w-[140px]">
                    {currentUser?.email || 'Authorized Admin'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                data-testid="admin-header-logout-btn"
                title="Log Out of Admin Dashboard"
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/80 text-zinc-200 hover:text-red-200 border border-zinc-800 hover:border-red-800/70 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {(itemFeedback || catFeedback || bannerFeedback) && (
            <div className="p-3.5 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-3 shadow-md">
              <span>{itemFeedback || catFeedback || bannerFeedback}</span>
              <button
                type="button"
                onClick={() => {
                  setItemFeedback('');
                  setCatFeedback('');
                  setBannerFeedback('');
                }}
                className="text-zinc-600 hover:text-zinc-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* =====================================================================
              SECTION 1 & 2: DASHBOARD OVERVIEW & ITEMS / PRODUCTS CATALOG
              (Matches Reference Image: Welcome Back, Admin! + Add Product / Add Category
               + Quick Categories + Products List with In-Stock Toggle, Edit, Delete)
             ===================================================================== */}
          {(activeTab === 'dashboard' || activeTab === 'items') && (
            <div className="space-y-6">
              {/* Top Greeting & Primary Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {activeTab === 'dashboard'
                      ? 'Welcome Back, Admin!'
                      : `Items & Products (${products.length})`}
                  </h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Toggle any item switch off to mark it Out of Stock on the
                    storefront, click the pencil to edit name/sizes/colors/photos,
                    or add new products.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddProductModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-bold tracking-wider uppercase hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddCategoryModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-[#18181C] text-white border border-zinc-700 text-xs font-bold tracking-wider uppercase hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Category</span>
                  </button>
                </div>
              </div>

              {/* Main Dashboard Image Upload Auto-Shrink Toggle Bar */}
              <div className="bg-[#18181C] border border-zinc-800/90 rounded-2xl p-4 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-white">
                        Auto-Shrink Image Uploads
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          shrinkUploadsEnabled
                            ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/70'
                            : 'bg-amber-950/90 text-amber-300 border border-amber-700/70'
                        }`}
                      >
                        {shrinkUploadsEnabled
                          ? 'ON · Shrinking by 60%–70% (e.g. 2 MB → 500–800 KB)'
                          : 'OFF · Original Full Quality'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {shrinkUploadsEnabled
                        ? 'Uploaded item & banner photos are automatically shrunk by 60%–70% of their original file size (e.g. a 2 MB photo becomes ~500–800 KB). Turn off anytime to upload original uncompressed resolution.'
                        : 'Image shrinking is currently turned OFF. Uploaded item & banner photos will be stored at their original resolution without shrinking.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80 shrink-0">
                  <span className="text-xs font-semibold text-zinc-300">
                    {shrinkUploadsEnabled ? 'Shrink ON' : 'Shrink OFF'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={shrinkUploadsEnabled}
                    data-testid="toggle-shrink-uploads"
                    aria-label="Toggle Auto-Shrink Image Uploads On or Off"
                    onClick={handleToggleShrinkUploads}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 items-center ${
                      shrinkUploadsEnabled
                        ? 'bg-white border-white'
                        : 'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ${
                        shrinkUploadsEnabled
                          ? 'translate-x-5 bg-zinc-950'
                          : 'translate-x-1 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Product Section Toggle: Show "1 left / 2 left" Low-Stock Indicator on Live Product Pop-Up (ONLY in Products section, OFF by default) */}
              {activeTab === 'items' && (
                <div className="bg-[#18181C] border border-zinc-800/90 rounded-2xl p-4 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white">
                          Show &ldquo;1 Left / 2 Left&rdquo; on Product Pop-Up
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            showLowStockCount
                              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/70'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {showLowStockCount
                            ? 'ON · Showing on Live Website'
                            : 'OFF · Hidden on Live Website'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {showLowStockCount
                          ? 'Sizes with only 1 or 2 pieces remaining display "1 left" or "2 left" inside the customer product pop-up.'
                          : 'Currently OFF — "1 left" and "2 left" low-stock counts are hidden from customers on the live website product pop-up.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80 shrink-0">
                    <span className="text-xs font-semibold text-zinc-300">
                      {showLowStockCount
                        ? '1 Left / 2 Left ON'
                        : '1 Left / 2 Left OFF'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showLowStockCount}
                      data-testid="toggle-show-low-stock"
                      aria-label="Toggle 1 left and 2 left indicator on product pop-up"
                      onClick={() => {
                        if (onToggleShowLowStockCount) {
                          onToggleShowLowStockCount(!showLowStockCount);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 items-center ${
                        showLowStockCount
                          ? 'bg-white border-white'
                          : 'bg-zinc-800 border-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ${
                          showLowStockCount
                            ? 'translate-x-5 bg-zinc-950'
                            : 'translate-x-1 bg-zinc-400'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Categories Row (Matches Reference Image + Edit Category Name Button) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-semibold text-zinc-200">
                      Quick Categories
                    </h2>
                    <span className="text-[11px] text-zinc-500 hidden sm:inline">
                      (Click pencil icon on any category to rename it)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {(
                      [
                        { id: 'all', label: 'All Depts' },
                        { id: 'women', label: 'Women' },
                        { id: 'kids', label: 'Kids' },
                      ] as const
                    ).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDeptFilter(d.id);
                          setSelectedQuickCategory('all');
                        }}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                          selectedDeptFilter === d.id
                            ? 'bg-white text-zinc-950'
                            : 'bg-[#18181C] text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedQuickCategory('all')}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      selectedQuickCategory === 'all'
                        ? 'bg-white text-zinc-950 border-white'
                        : 'bg-[#18181C] text-zinc-200 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>All Categories</span>
                    <span
                      className={`text-[11px] font-mono-tabular ${
                        selectedQuickCategory === 'all'
                          ? 'text-zinc-700'
                          : 'text-zinc-500'
                      }`}
                    >
                      ({products.length})
                    </span>
                  </button>

                  {quickCategoriesWithCounts
                    .filter(
                      (c) =>
                        selectedDeptFilter === 'all' ||
                        c.department === selectedDeptFilter
                    )
                    .map((cat) => {
                      const catFilterKey = `${cat.department}::${cat.name}`;
                      const isSelected = selectedQuickCategory === catFilterKey;
                      return (
                        <div
                          key={cat.id}
                          className={` rounded-xl border text-xs font-semibold flex items-center whitespace-nowrap shrink-0 transition-all ${
                            isSelected
                              ? 'bg-white text-zinc-950 border-white'
                              : 'bg-[#18181C] text-zinc-200 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedQuickCategory(
                                isSelected ? 'all' : catFilterKey
                              )
                            }
                            className="pl-3.5 pr-2 py-2.5 flex items-center gap-2 cursor-pointer"
                          >
                            <span>
                              {cat.department === 'kids'
                                ? `Kids · ${cat.name}`
                                : cat.name}
                            </span>
                            <span
                              className={`text-[11px] font-mono-tabular ${
                                isSelected ? 'text-zinc-700' : 'text-zinc-500'
                              }`}
                            >
                              ({cat.count})
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCategory(cat);
                              setEditCatName(cat.name);
                              setEditCatDesc(cat.description || '');
                            }}
                            aria-label={`Edit category name ${cat.name}`}
                            title={`Rename "${cat.name}" category`}
                            className={`pr-2.5 pl-1 py-2.5 cursor-pointer transition-colors ${
                              isSelected
                                ? 'text-zinc-600 hover:text-zinc-950'
                                : 'text-zinc-500 hover:text-white'
                            }`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}

                  <button
                    type="button"
                    onClick={() => setIsAddCategoryModalOpen(true)}
                    aria-label="Quick add category"
                    title="Add New Category"
                    className="w-9 h-9 rounded-full bg-[#18181C] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Grid: Products List (Left 8 cols on Dashboard, 12 cols on Items) + Pending Orders & Banners Shortcut (Right 4 cols on Dashboard) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Products List Card */}
                <div
                  className={`${
                    activeTab === 'dashboard'
                      ? 'lg:col-span-8'
                      : 'lg:col-span-12'
                  } space-y-3`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      Products List
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleSelectNav('banners')}
                      className="text-[11px] font-semibold text-zinc-300 hover:text-white underline cursor-pointer flex items-center gap-1"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Manage Homepage &amp; Category Banners →</span>
                    </button>
                  </div>

                  {/* All Products | Out of Stock Tabs */}
                  <div className="flex items-center gap-6 border-b border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setProductStockFilter('all')}
                      className={`pb-2.5 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
                        productStockFilter === 'all'
                          ? 'text-white border-white'
                          : 'text-zinc-400 hover:text-zinc-200 border-transparent'
                      }`}
                    >
                      All Products ({products.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductStockFilter('out-of-stock')}
                      className={`pb-2.5 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
                        productStockFilter === 'out-of-stock'
                          ? 'text-white border-white'
                          : 'text-zinc-400 hover:text-zinc-200 border-transparent'
                      }`}
                    >
                      Out of Stock ({outOfStockCount})
                    </button>
                  </div>

                  {/* Products Rows Container */}
                  <div className="bg-[#18181C] border border-zinc-800/90 rounded-2xl divide-y divide-zinc-800/80 overflow-hidden">
                    {displayedAdminProducts.length === 0 ? (
                      <div className="p-10 text-center space-y-3">
                        <p className="text-xs text-zinc-400">
                          {productStockFilter === 'out-of-stock'
                            ? 'No products are currently marked Out of Stock.'
                            : 'No products match the selected filter.'}
                        </p>
                        {selectedQuickCategory !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setSelectedQuickCategory('all')}
                            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-semibold cursor-pointer"
                          >
                            Show All Categories
                          </button>
                        )}
                      </div>
                    ) : (
                      displayedAdminProducts.map((prod) =>
                        renderProductRow(prod)
                      )
                    )}
                  </div>
                </div>

                {/* Right Column on Dashboard: Pending Client Orders & Quick Site Banners Card (Instead of Customer Reviews) */}
                {activeTab === 'dashboard' && (
                  <div className="lg:col-span-4 space-y-6">
                    {/* Pending Orders Queue Card */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm sm:text-base font-bold text-white">
                          Pending Orders{' '}
                          <span className="text-zinc-400 font-normal">
                            ({pendingOrders.length})
                          </span>
                        </h2>
                        <button
                          type="button"
                          onClick={() => handleSelectNav('orders')}
                          className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                        >
                          View All ({orders.length})
                        </button>
                      </div>

                      {/* Simple Auto-Accept Orders Toggle */}
                      <div className="bg-[#18181C] border border-zinc-800/90 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-white">
                              Auto-Accept Orders
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                autoAcceptOrders
                                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/70'
                                  : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                              }`}
                            >
                              {autoAcceptOrders ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            Automatically approve incoming orders &amp; deduct stock.
                          </p>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={autoAcceptOrders}
                          data-testid="dashboard-toggle-auto-accept-orders"
                          aria-label="Toggle Auto-Accept Orders On or Off"
                          onClick={() =>
                            onToggleAutoAcceptOrders(!autoAcceptOrders)
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 items-center ${
                            autoAcceptOrders
                              ? 'bg-white border-white'
                              : 'bg-zinc-800 border-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ${
                              autoAcceptOrders
                                ? 'translate-x-5 bg-zinc-950'
                                : 'translate-x-1 bg-zinc-400'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="bg-[#18181C] border border-zinc-800/90 rounded-2xl divide-y divide-zinc-800/80 overflow-hidden">
                        {orders.slice(0, 4).map((ord) => (
                          <div key={ord.id} className="p-4 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-white">
                                {ord.customerName}
                              </span>
                              <span className="font-mono-tabular text-xs font-bold text-zinc-200">
                                ${ord.totalPrice.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 line-clamp-2">
                              {ord.orderNumber} · {ord.itemsSummary}
                            </p>
                            <div className="flex items-center justify-between pt-1">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider ${
                                  ord.status === 'accepted'
                                    ? 'text-emerald-400'
                                    : ord.status === 'rejected'
                                    ? 'text-red-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {ord.status}
                              </span>
                              <div className="flex items-center gap-3 text-xs font-semibold">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateOrderStatus(ord.id, 'accepted')
                                  }
                                  className="text-emerald-400 hover:underline cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateOrderStatus(ord.id, 'rejected')
                                  }
                                  className="text-zinc-400 hover:text-red-400 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Shortcut Card to Site & Category Banners */}
                    <div className="bg-[#18181C] border border-zinc-800/90 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                        <Film className="w-4 h-4" />
                        <span>Site &amp; Category Banners</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Change the Homepage Hero Video/Image, Middle Campaign
                        Banner, 3 Bottom Section Banners, Showroom Banner, or
                        the in-feed banners inside every product category.
                      </p>
                      <div className="grid grid-cols-1 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectNav('banners')}
                          className="w-full py-2.5 px-3.5 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <span>Edit Homepage &amp; Showroom Banners</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectNav('categories')}
                          className="w-full py-2.5 px-3.5 rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700 text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <span>Edit Category Mid-Page Banners</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 3: SITE BANNERS & VIDEO MANAGER
              (Clearly marked slots for Homepage Video, Homepage Middle Banner,
               3 Homepage Bottom Banners, and Showroom Page Hero Banner)
             ===================================================================== */}
          {activeTab === 'banners' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-white uppercase tracking-wider">
                    Site Banners &amp; Video Manager
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    Every banner on the Homepage and Showroom page is clearly
                    numbered and marked below. Upload iPhone videos (.hevc, .mov, .mp4) or
                    photos with the automatic WebP shrinker (~35–60 KB) or paste a direct URL anytime.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 self-start">
                  <button
                    type="button"
                    onClick={async () => {
                      await onUpdateSiteBanners(siteBanners);
                      setBannerFeedback(
                        '✓ All Banners & Videos Published to Cloud Database & Live Website'
                      );
                    }}
                    className="px-4 py-2 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save &amp; Publish All Banners</span>
                  </button>
                </div>
              </div>

              {!currentUser && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-300">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Cloud Sync Note:</span>
                    <span>To permanently save banner/video changes to the live website (samoweave.com), sign in with your authorized admin Google account.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onGoogleSignIn()}
                    className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                  >
                    Sign In with Google
                  </button>
                </div>
              )}

              {/* BANNER #1: HOMEPAGE TOP HERO VIDEO / IMAGE BANNER */}
              <div className="bg-[#18181C] border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                  <div>
                    <span className="text-[10px] font-mono-tabular uppercase tracking-widest text-zinc-400 block">
                      BANNER SLOT #1 · HOMEPAGE TOP SECTION (UNDER NAVBAR)
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                      1. Homepage — Top Hero Video or Image Banner
                    </h2>
                  </div>

                  {/* Mode Switcher: Video vs Image */}
                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() =>
                        updateSiteBannerField(
                          'homeHeroMediaType',
                          'video',
                          'Homepage Hero Mode (Video)'
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                        siteBanners.homeHeroMediaType === 'video'
                          ? 'bg-white text-zinc-950'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Use Video
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSiteBannerField(
                          'homeHeroMediaType',
                          'image',
                          'Homepage Hero Mode (Image)'
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                        siteBanners.homeHeroMediaType === 'image'
                          ? 'bg-white text-zinc-950'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Use Photo Banner
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Live Preview */}
                  <div className="lg:col-span-5 aspect-video rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 relative">
                    {siteBanners.homeHeroMediaType === 'video' ? (
                      <video
                        key={siteBanners.homeHeroVideoUrl}
                        src={siteBanners.homeHeroVideoUrl}
                        muted
                        loop
                        autoPlay
                        playsInline
                        onError={(e) => {
                          const defaultVid =
                            '/assets/aistudio/recording-2026-10-20_ae756f63.webm';
                          if (e.currentTarget.src.indexOf(defaultVid) === -1) {
                            e.currentTarget.src = defaultVid;
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ProductImage
                        src={siteBanners.homeHeroImageUrl}
                        alt="Homepage Top Hero Banner"
                        category="Jacket"
                        styleType="Fine Leather"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/75 text-white text-[10px] font-mono-tabular uppercase rounded">
                      Active Mode:{' '}
                      {siteBanners.homeHeroMediaType.toUpperCase()}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="lg:col-span-7 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                          Hero Video URL (.mp4 or .webm) — Active when &ldquo;Use
                          Video&rdquo; is selected
                        </label>
                        {siteBanners.homeHeroVideoUrl !==
                          '/assets/aistudio/recording-2026-10-20_ae756f63.webm' && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateSiteBanners({
                                ...siteBanners,
                                homeHeroMediaType: 'video',
                                homeHeroVideoUrl:
                                  '/assets/aistudio/recording-2026-10-20_ae756f63.webm',
                              });
                              setBannerFeedback(
                                '✓ Restored Original SAMO Homepage Hero Video'
                              );
                            }}
                            className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                          >
                            Restore Original Video
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                        <input
                          type="text"
                          value={siteBanners.homeHeroVideoUrl}
                          onChange={(e) =>
                            updateSiteBannerField(
                              'homeHeroVideoUrl',
                              e.target.value
                            )
                          }
                          placeholder="https://... (.mp4 or .webm video URL)"
                          className="flex-1 px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                        />
                        <R2VideoUploadButton
                          ariaLabel="Upload Homepage Hero Video"
                          onUploaded={(url) => {
                            onUpdateSiteBanners({
                              ...siteBanners,
                              homeHeroMediaType: 'video',
                              homeHeroVideoUrl: url,
                            });
                            setBannerFeedback(
                              '✓ Uploaded & Activated New Homepage Hero Video'
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                        Hero Photo Banner URL (Auto-Shrink WebP) — Active when
                        &ldquo;Use Photo Banner&rdquo; is selected
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                        <input
                          type="text"
                          value={siteBanners.homeHeroImageUrl}
                          onChange={(e) =>
                            updateSiteBannerField(
                              'homeHeroImageUrl',
                              e.target.value
                            )
                          }
                          placeholder="https://... (Hero Image URL)"
                          className="flex-1 px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                        />
                        <R2ImageUploadButton
                          ariaLabel="Upload Homepage Hero Image Banner"
                          label="Upload & Shrink Banner"
                          onUploaded={(url) => {
                            onUpdateSiteBanners({
                              ...siteBanners,
                              homeHeroMediaType: 'image',
                              homeHeroImageUrl: url,
                            });
                            setBannerFeedback(
                              '✓ Uploaded & Activated Homepage Hero Image Banner'
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                          Hero Headline Text
                        </label>
                        <input
                          type="text"
                          value={siteBanners.homeHeroTitle}
                          onChange={(e) =>
                            updateSiteBannerField(
                              'homeHeroTitle',
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                          Hero Top Subtitle Kicker
                        </label>
                        <input
                          type="text"
                          value={siteBanners.homeHeroKicker}
                          onChange={(e) =>
                            updateSiteBannerField(
                              'homeHeroKicker',
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BANNER #2: HOMEPAGE MIDDLE FULL-WIDTH BANNER */}
              <div className="bg-[#18181C] border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="border-b border-zinc-800 pb-3">
                  <span className="text-[10px] font-mono-tabular uppercase tracking-widest text-zinc-400 block">
                    BANNER SLOT #2 · HOMEPAGE MIDDLE SECTION (BETWEEN CATEGORIES
                    &amp; NEW ARRIVALS)
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    2. Homepage — Middle Full-Width Campaign Banner (Kids
                    Collection Section)
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-4 aspect-[4/3] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
                    <ProductImage
                      src={siteBanners.homeMiddleBannerUrl}
                      alt="Homepage Middle Campaign Banner"
                      category="CHILDREN 6+"
                      styleType="Sport Chic"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="lg:col-span-8 space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                        Middle Banner Image URL (Paste URL or Auto-Shrink &amp;
                        Upload Photo)
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                        <input
                          type="text"
                          value={siteBanners.homeMiddleBannerUrl}
                          onChange={(e) =>
                            updateSiteBannerField(
                              'homeMiddleBannerUrl',
                              e.target.value,
                              'Homepage Middle Banner'
                            )
                          }
                          placeholder="https://..."
                          className="flex-1 px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                        />
                        <R2ImageUploadButton
                          ariaLabel="Upload Homepage Middle Banner Photo"
                          label="Upload & Shrink Photo"
                          onUploaded={(url) =>
                            updateSiteBannerField(
                              'homeMiddleBannerUrl',
                              url,
                              'Homepage Middle Banner'
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                          Middle Banner Title
                        </label>
                        <input
                          type="text"
                          value={siteBanners.homeMiddleTitle}
                          onChange={(e) =>
                            updateSiteBannerField(
                              'homeMiddleTitle',
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                          Middle Banner Subtitle
                        </label>
                        <input
                          type="text"
                          value={siteBanners.homeMiddleSubtitle}
                          onChange={(e) =>
                            updateSiteBannerField(
                              'homeMiddleSubtitle',
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BANNERS #3A, #3B, #3C: HOMEPAGE 3 BOTTOM "DISCOVER THE HOUSE" BANNERS */}
              <div className="bg-[#18181C] border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="border-b border-zinc-800 pb-3">
                  <span className="text-[10px] font-mono-tabular uppercase tracking-widest text-zinc-400 block">
                    BANNER SLOTS #3A, #3B, #3C · HOMEPAGE BOTTOM 3-COLUMN
                    SECTION (&ldquo;DISCOVER THE HOUSE&rdquo;)
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    3. Homepage — 3 End Section Banners (New Arrivals, Gifts,
                    Showroom)
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 3A: New Arrivals Card */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-white uppercase tracking-wider">
                      3A. Left Box — &ldquo;New Arrivals&rdquo;
                    </div>
                    <div className="aspect-[4/5] w-full rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
                      <ProductImage
                        src={siteBanners.homeBottomNewArrivalsUrl}
                        alt="New Arrivals Bottom Banner"
                        category="Fur"
                        styleType="Fur"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <input
                      type="text"
                      value={siteBanners.homeBottomNewArrivalsUrl}
                      onChange={(e) =>
                        updateSiteBannerField(
                          'homeBottomNewArrivalsUrl',
                          e.target.value,
                          'Bottom Left Banner (New Arrivals)'
                        )
                      }
                      placeholder="Image URL..."
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg text-white"
                    />
                    <div className="flex justify-end">
                      <R2ImageUploadButton
                        ariaLabel="Upload Bottom Left New Arrivals Banner"
                        onUploaded={(url) =>
                          updateSiteBannerField(
                            'homeBottomNewArrivalsUrl',
                            url,
                            'Bottom Left Banner (New Arrivals)'
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* 3B: Gifts Card */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-white uppercase tracking-wider">
                      3B. Middle Box — &ldquo;Gifts (Bags &amp; Belts)&rdquo;
                    </div>
                    <div className="aspect-[4/5] w-full rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
                      <ProductImage
                        src={siteBanners.homeBottomGiftsUrl}
                        alt="Gifts Bottom Banner"
                        category="Bags"
                        styleType="Accessories"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <input
                      type="text"
                      value={siteBanners.homeBottomGiftsUrl}
                      onChange={(e) =>
                        updateSiteBannerField(
                          'homeBottomGiftsUrl',
                          e.target.value,
                          'Bottom Middle Banner (Gifts)'
                        )
                      }
                      placeholder="Image URL..."
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg text-white"
                    />
                    <div className="flex justify-end">
                      <R2ImageUploadButton
                        ariaLabel="Upload Bottom Middle Gifts Banner"
                        onUploaded={(url) =>
                          updateSiteBannerField(
                            'homeBottomGiftsUrl',
                            url,
                            'Bottom Middle Banner (Gifts)'
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* 3C: Showroom Card */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-white uppercase tracking-wider">
                      3C. Right Box — &ldquo;Showroom&rdquo;
                    </div>
                    <div className="aspect-[4/5] w-full rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
                      <ProductImage
                        src={siteBanners.homeBottomShowroomUrl}
                        alt="Showroom Bottom Banner"
                        category="Trench Coat"
                        styleType="Suede"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <input
                      type="text"
                      value={siteBanners.homeBottomShowroomUrl}
                      onChange={(e) =>
                        updateSiteBannerField(
                          'homeBottomShowroomUrl',
                          e.target.value,
                          'Bottom Right Banner (Showroom)'
                        )
                      }
                      placeholder="Image URL..."
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg text-white"
                    />
                    <div className="flex justify-end">
                      <R2ImageUploadButton
                        ariaLabel="Upload Bottom Right Showroom Banner"
                        onUploaded={(url) =>
                          updateSiteBannerField(
                            'homeBottomShowroomUrl',
                            url,
                            'Bottom Right Banner (Showroom)'
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BANNER #4: SHOWROOM PAGE (/showroom) TOP HERO BANNER */}
              <div className="bg-[#18181C] border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="border-b border-zinc-800 pb-3">
                  <span className="text-[10px] font-mono-tabular uppercase tracking-widest text-zinc-400 block">
                    BANNER SLOT #4 · SHOWROOM PAGE (/showroom) TOP HERITAGE
                    IMAGE
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    4. Showroom Page (/showroom) — Main Heritage Banner Image
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-4 aspect-[4/5] max-h-72 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
                    <ProductImage
                      src={siteBanners.showroomHeroBannerUrl}
                      alt="Showroom Page Hero Banner"
                      category="Trench Coat"
                      styleType="Suede"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="lg:col-span-8 space-y-3">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      Showroom Page Banner Image URL (Paste URL or Auto-Shrink
                      &amp; Upload Photo)
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                      <input
                        type="text"
                        value={siteBanners.showroomHeroBannerUrl}
                        onChange={(e) =>
                          updateSiteBannerField(
                            'showroomHeroBannerUrl',
                            e.target.value,
                            'Showroom Page Banner'
                          )
                        }
                        placeholder="https://..."
                        className="flex-1 px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                      />
                      <R2ImageUploadButton
                        ariaLabel="Upload Showroom Page Banner Photo"
                        label="Upload & Shrink Photo"
                        onUploaded={(url) =>
                          updateSiteBannerField(
                            'showroomHeroBannerUrl',
                            url,
                            'Showroom Page Banner'
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 4: CATEGORIES & IN-FEED CATEGORY BANNERS (BETWEEN PRODUCTS)
             ===================================================================== */}
          {activeTab === 'categories' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-white uppercase tracking-wider">
                    Categories &amp; Mid-Page Product Banners
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    Manage Women &amp; Kids categories and customize the
                    editorial image banner that appears between products inside
                    every category page. You can upload/replace or delete any
                    category’s banner at any time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Category</span>
                </button>
              </div>

              {/* Women Categories & In-Feed Banners */}
              <div className="space-y-4">
                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  Women Categories &amp; In-Feed Banners (
                  {getCategoriesByDepartment(categories, 'women').length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {getCategoriesByDepartment(categories, 'women').map((cat) => {
                    const bKey = getCategoryBannerKey('women', cat.name);
                    const bannerCfg =
                      siteBanners.categoryBanners?.[bKey] ||
                      buildDefaultCategoryBannerForCategory(
                        'women',
                        cat.name,
                        bKey
                      );

                    return (
                      <div
                        key={cat.id}
                        className="bg-[#18181C] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                          <div>
                            <div className="text-xs font-bold uppercase text-white flex flex-wrap items-center gap-2">
                              <span>Women · {cat.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setEditCatName(cat.name);
                                  setEditCatDesc(cat.description || '');
                                }}
                                aria-label={`Edit category section name ${cat.name}`}
                                title="Edit Category Name"
                                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                                <span>Rename</span>
                              </button>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Banner appears between products in /women (
                              {cat.name})
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateCategoryBanner(
                                  bKey,
                                  'women',
                                  cat.name,
                                  (prev) => ({
                                    ...prev,
                                    enabled: !prev.enabled,
                                  }),
                                  `${cat.name} Banner ${
                                    bannerCfg.enabled ? 'Removed/Hidden' : 'Added/Enabled'
                                  }`
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer ${
                                bannerCfg.enabled
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/70'
                                  : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                              }`}
                            >
                              {bannerCfg.enabled ? (
                                <>
                                  <Eye className="w-3 h-3" />
                                  <span>Banner Active</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3 h-3" />
                                  <span>Banner Deleted</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setCategoryPendingDelete(cat)}
                              aria-label={`Delete category ${cat.name}`}
                              title="Delete Category"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Banner Preview + Upload / Replace / Delete Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                          <div className="sm:col-span-4 aspect-[4/3] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 relative">
                            {bannerCfg.enabled && bannerCfg.imageUrl ? (
                              <ProductImage
                                src={bannerCfg.imageUrl}
                                alt={`${cat.name} In-Feed Banner`}
                                category={cat.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500 uppercase tracking-wider text-center p-2">
                                No Banner Active
                              </div>
                            )}
                          </div>

                          <div className="sm:col-span-8 space-y-2.5">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                In-Feed Banner Image URL for {cat.name}
                              </label>
                              <input
                                type="text"
                                value={bannerCfg.imageUrl}
                                onChange={(e) =>
                                  updateCategoryBanner(
                                    bKey,
                                    'women',
                                    cat.name,
                                    (prev) => ({
                                      ...prev,
                                      imageUrl: e.target.value,
                                      enabled: true,
                                    })
                                  )
                                }
                                placeholder="https://... (Banner Image URL)"
                                className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                              />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                                <span>Show after:</span>
                                <select
                                  value={bannerCfg.insertAfterCount || 4}
                                  onChange={(e) =>
                                    updateCategoryBanner(
                                      bKey,
                                      'women',
                                      cat.name,
                                      (prev) => ({
                                        ...prev,
                                        insertAfterCount: Number(
                                          e.target.value
                                        ),
                                      }),
                                      `Updated ${cat.name} banner position`
                                    )
                                  }
                                  className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white"
                                >
                                  <option value={2}>2 products</option>
                                  <option value={4}>4 products</option>
                                  <option value={6}>6 products</option>
                                  <option value={8}>8 products</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-2">
                                <R2ImageUploadButton
                                  compact={true}
                                  ariaLabel={`Upload banner photo for ${cat.name}`}
                                  label="Replace Photo"
                                  onUploaded={(url) =>
                                    updateCategoryBanner(
                                      bKey,
                                      'women',
                                      cat.name,
                                      (prev) => ({
                                        ...prev,
                                        imageUrl: url,
                                        enabled: true,
                                      }),
                                      `Uploaded new banner for ${cat.name}`
                                    )
                                  }
                                />
                                {bannerCfg.enabled && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCategoryBanner(
                                        bKey,
                                        'women',
                                        cat.name,
                                        (prev) => ({
                                          ...prev,
                                          enabled: false,
                                        }),
                                        `Deleted banner from ${cat.name}`
                                      )
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 text-red-200 border border-red-800/70 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                                  >
                                    Delete Banner
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kids Categories & In-Feed Banners */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  Kids Categories &amp; In-Feed Banners (
                  {getCategoriesByDepartment(categories, 'kids').length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {getCategoriesByDepartment(categories, 'kids').map((cat) => {
                    const bKey = getCategoryBannerKey('kids', cat.name);
                    const bannerCfg =
                      siteBanners.categoryBanners?.[bKey] ||
                      buildDefaultCategoryBannerForCategory(
                        'kids',
                        cat.name,
                        bKey
                      );

                    return (
                      <div
                        key={cat.id}
                        className="bg-[#18181C] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                          <div>
                            <div className="text-xs font-bold uppercase text-white flex flex-wrap items-center gap-2">
                              <span>Kids · {cat.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setEditCatName(cat.name);
                                  setEditCatDesc(cat.description || '');
                                }}
                                aria-label={`Edit category section name ${cat.name}`}
                                title="Edit Category Name"
                                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                                <span>Rename</span>
                              </button>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Banner appears between products in /kids (
                              {cat.name})
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateCategoryBanner(
                                  bKey,
                                  'kids',
                                  cat.name,
                                  (prev) => ({
                                    ...prev,
                                    enabled: !prev.enabled,
                                  }),
                                  `${cat.name} Banner ${
                                    bannerCfg.enabled
                                      ? 'Removed/Hidden'
                                      : 'Added/Enabled'
                                  }`
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer ${
                                bannerCfg.enabled
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/70'
                                  : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                              }`}
                            >
                              {bannerCfg.enabled ? (
                                <>
                                  <Eye className="w-3 h-3" />
                                  <span>Banner Active</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3 h-3" />
                                  <span>Banner Deleted</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setCategoryPendingDelete(cat)}
                              aria-label={`Delete category ${cat.name}`}
                              title="Delete Category"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                          <div className="sm:col-span-4 aspect-[4/3] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 relative">
                            {bannerCfg.enabled && bannerCfg.imageUrl ? (
                              <ProductImage
                                src={bannerCfg.imageUrl}
                                alt={`${cat.name} In-Feed Banner`}
                                category={cat.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500 uppercase tracking-wider text-center p-2">
                                No Banner Active
                              </div>
                            )}
                          </div>

                          <div className="sm:col-span-8 space-y-2.5">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                In-Feed Banner Image URL for {cat.name}
                              </label>
                              <input
                                type="text"
                                value={bannerCfg.imageUrl}
                                onChange={(e) =>
                                  updateCategoryBanner(
                                    bKey,
                                    'kids',
                                    cat.name,
                                    (prev) => ({
                                      ...prev,
                                      imageUrl: e.target.value,
                                      enabled: true,
                                    })
                                  )
                                }
                                placeholder="https://... (Banner Image URL)"
                                className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                              />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                                <span>Show after:</span>
                                <select
                                  value={bannerCfg.insertAfterCount || 4}
                                  onChange={(e) =>
                                    updateCategoryBanner(
                                      bKey,
                                      'kids',
                                      cat.name,
                                      (prev) => ({
                                        ...prev,
                                        insertAfterCount: Number(
                                          e.target.value
                                        ),
                                      }),
                                      `Updated ${cat.name} banner position`
                                    )
                                  }
                                  className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white"
                                >
                                  <option value={2}>2 products</option>
                                  <option value={4}>4 products</option>
                                  <option value={6}>6 products</option>
                                  <option value={8}>8 products</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-2">
                                <R2ImageUploadButton
                                  compact={true}
                                  ariaLabel={`Upload banner photo for ${cat.name}`}
                                  label="Replace Photo"
                                  onUploaded={(url) =>
                                    updateCategoryBanner(
                                      bKey,
                                      'kids',
                                      cat.name,
                                      (prev) => ({
                                        ...prev,
                                        imageUrl: url,
                                        enabled: true,
                                      }),
                                      `Uploaded new banner for ${cat.name}`
                                    )
                                  }
                                />
                                {bannerCfg.enabled && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCategoryBanner(
                                        bKey,
                                        'kids',
                                        cat.name,
                                        (prev) => ({
                                          ...prev,
                                          enabled: false,
                                        }),
                                        `Deleted banner from ${cat.name}`
                                      )
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 text-red-200 border border-red-800/70 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                                  >
                                    Delete Banner
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 5: ORDERS QUEUE
             ===================================================================== */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <h1 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                    Client Orders Queue
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    Review incoming orders with full client name, delivery
                    location, product color/size, delivery fee, and total price.
                    Click Accept (✓) to reduce stock or Reject (✕).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 sm:gap-5 text-xs font-mono-tabular text-zinc-300">
                  <span>
                    Pending: <strong className="text-white">{pendingOrders.length}</strong>
                  </span>
                  <span>
                    Accepted:{' '}
                    <strong className="text-emerald-400">
                      {orders.filter((o) => o.status === 'accepted').length}
                    </strong>
                  </span>
                  <span>
                    Rejected:{' '}
                    <strong className="text-red-400">
                      {orders.filter((o) => o.status === 'rejected').length}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Simple ON / OFF Toggle for Auto-Accepting Orders */}
              <div className="bg-[#18181C] border border-zinc-800/90 rounded-2xl p-4 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-white">
                        Auto-Accept Orders
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          autoAcceptOrders
                            ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/70'
                            : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {autoAcceptOrders
                          ? 'ON · Automatically Accepting Orders'
                          : 'OFF · Manual Review'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {autoAcceptOrders
                        ? 'Auto-Accept is turned ON. All incoming orders are automatically accepted and item stock quantities are updated immediately.'
                        : 'Turn on to automatically accept incoming customer orders and deduct item stock without manual approval.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80 shrink-0">
                  <span className="text-xs font-semibold text-zinc-300">
                    {autoAcceptOrders ? 'Auto-Accept ON' : 'Auto-Accept OFF'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoAcceptOrders}
                    data-testid="toggle-auto-accept-orders"
                    aria-label="Toggle Auto-Accept Orders On or Off"
                    onClick={() => onToggleAutoAcceptOrders(!autoAcceptOrders)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 items-center ${
                      autoAcceptOrders
                        ? 'bg-white border-white'
                        : 'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ${
                        autoAcceptOrders
                          ? 'translate-x-5 bg-zinc-950'
                          : 'translate-x-1 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#18181C] border border-zinc-800 rounded-xl px-4 py-2.5">
                <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  type="search"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search orders by customer name or order number (e.g. SAMO-8491)..."
                  aria-label="Filter orders by customer name or order number"
                  className="w-full text-xs text-white placeholder:text-zinc-500 focus:outline-none bg-transparent"
                />
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-12 bg-[#18181C] border border-zinc-800 rounded-2xl text-center text-xs text-zinc-400 uppercase tracking-wider">
                  No orders matching your selection.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-[#18181C] border border-zinc-800 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center"
                    >
                      <div className="lg:col-span-3 flex items-center gap-4">
                        <div className="w-16 h-20 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                          <ProductImage
                            src={order.primaryProductImage}
                            alt={order.primaryProductName}
                            compact={true}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-mono-tabular text-xs font-bold text-white">
                            {order.orderNumber}
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                          <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wider">
                            Status:{' '}
                            <span
                              className={
                                order.status === 'accepted'
                                  ? 'text-emerald-400'
                                  : order.status === 'rejected'
                                  ? 'text-red-400'
                                  : 'text-amber-400'
                              }
                            >
                              {order.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-3 text-xs space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Client &amp; Delivery Location
                        </div>
                        <div className="font-bold text-white">
                          {order.customerName}
                        </div>
                        <div className="text-zinc-300">
                          {order.shippingLocation}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {order.customerPhone} · {order.customerEmail}
                        </div>
                      </div>

                      <div className="lg:col-span-3 text-xs space-y-1.5 min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Ordered Garments &amp; Total
                        </div>
                        <div className="font-semibold text-white">
                          {order.primaryProductName} — Size:{' '}
                          <span className="underline">
                            {order.primaryProductSize}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 leading-relaxed break-words">
                          {order.itemsSummary}
                        </div>
                        <div className="pt-1 flex flex-wrap items-center gap-2 font-mono-tabular text-[11px] text-zinc-300">
                          <span>
                            Subtotal:{' '}
                            <strong>${order.subtotal.toLocaleString()}</strong>
                          </span>
                          <span>·</span>
                          <span className="text-white font-bold text-xs">
                            Total: ${order.totalPrice.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="lg:col-span-3 flex flex-wrap items-center justify-start lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-800/80 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateOrderStatus(order.id, 'accepted')
                          }
                          aria-label={`Accept order ${order.orderNumber}`}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                            order.status === 'accepted'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-zinc-900 text-emerald-400 border-emerald-700 hover:bg-emerald-600 hover:text-white'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>Accept</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onUpdateOrderStatus(order.id, 'rejected')
                          }
                          aria-label={`Reject order ${order.orderNumber}`}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                            order.status === 'rejected'
                              ? 'bg-red-600 text-white border-red-500'
                              : 'bg-zinc-900 text-red-400 border-red-700 hover:bg-red-600 hover:text-white'
                          }`}
                        >
                          <X className="w-4 h-4" />
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteOrder(order.id)}
                          aria-label={`Delete order ${order.orderNumber}`}
                          className="p-2 rounded-xl text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-800 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              SECTION 6: PREORDERS / OUT-OF-STOCK ALERTS
             ===================================================================== */}
          {activeTab === 'preorders' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <h1 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                    Client Preorders &amp; Out-of-Stock Alerts
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    Customer requests submitted for out-of-stock sizes or items
                    toggled off in the catalog.
                  </p>
                </div>
              </div>

              {validPreorders.length === 0 ? (
                <div className="p-12 bg-[#18181C] border border-zinc-800 rounded-2xl text-center text-xs text-zinc-400 uppercase tracking-wider">
                  No out-of-stock preorders received yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {validPreorders.map((pre) => (
                    <div
                      key={pre.id}
                      className="bg-[#18181C] border border-zinc-800 rounded-2xl p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                    >
                      <div className="lg:col-span-4 flex items-center gap-3.5">
                        <div className="w-14 h-16 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                          <ProductImage
                            src={pre.productImage}
                            alt={pre.productName}
                            compact={true}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            {(pre.department || 'women').toUpperCase()} ·{' '}
                            {pre.category || 'Collection'}
                          </div>
                          <div className="text-xs font-bold text-white truncate">
                            {pre.productName}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-zinc-400 mt-0.5">
                            {new Date(pre.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-3 text-xs space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Requested Size / Color
                        </div>
                        <div className="font-mono-tabular font-bold text-white">
                          Size: {pre.selectedSize}
                          {pre.selectedColor
                            ? ` · Color: ${pre.selectedColor}`
                            : ''}
                        </div>
                      </div>

                      <div className="lg:col-span-3 text-xs space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Customer Contact
                        </div>
                        <div className="font-mono-tabular font-bold text-white break-all">
                          {pre.customerContact}
                        </div>
                      </div>

                      <div className="lg:col-span-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdatePreorderStatus(
                              pre.id,
                              pre.status === 'pending' ? 'notified' : 'pending'
                            )
                          }
                          className={`px-3 py-2 rounded-xl border text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                            pre.status === 'notified'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-white text-zinc-950 border-white hover:bg-zinc-200'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            {pre.status === 'notified'
                              ? 'Notified'
                              : 'Mark Notified'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeletePreorder(pre.id)}
                          aria-label={`Delete preorder for ${pre.productName}`}
                          className="p-2 rounded-xl text-zinc-400 hover:text-red-400 border border-zinc-800 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              SECTION 7: PROMO CODES (% OR $)
             ===================================================================== */}
          {activeTab === 'promos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-[#18181C] border border-zinc-800 rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                    Add Promo Code (% or $)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Create checkout promo codes with either a percentage (%) or
                    fixed dollar ($) discount.
                  </p>
                </div>

                {promoFeedback && (
                  <div className="p-3 rounded-xl bg-white text-zinc-950 text-xs font-semibold">
                    {promoFeedback}
                  </div>
                )}

                <form onSubmit={handleCreatePromoSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                      Promo Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPromoCode}
                      onChange={(e) =>
                        setNewPromoCode(e.target.value.toUpperCase())
                      }
                      placeholder="E.g. SAMO20 or VIP150"
                      className="w-full px-3 py-2 text-xs font-mono-tabular uppercase bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                        Discount Type *
                      </label>
                      <select
                        value={newPromoType}
                        onChange={(e) =>
                          setNewPromoType(
                            e.target.value as 'percentage' | 'fixed'
                          )
                        }
                        className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Dollar Amount ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                        Amount ({newPromoType === 'percentage' ? '%' : '$'}) *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={newPromoValue}
                        onChange={(e) => setNewPromoValue(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono-tabular bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 cursor-pointer"
                  >
                    + Create Promo Code
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 bg-[#18181C] border border-zinc-800 rounded-2xl p-6">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white pb-3 border-b border-zinc-800">
                  Active Promo Codes ({promoCodes.length})
                </h3>
                <div className="divide-y divide-zinc-800 mt-2">
                  {promoCodes.map((promo) => (
                    <div
                      key={promo.id}
                      className="py-3.5 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="font-mono-tabular text-xs font-bold text-white">
                          {promo.code}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {promo.discountType === 'percentage'
                            ? `${promo.discountValue}% Off Order Subtotal`
                            : `$${promo.discountValue.toLocaleString()} Off Order Subtotal`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeletePromoCode(promo.id)}
                        aria-label={`Delete promo code ${promo.code}`}
                        className="p-2 rounded-lg text-zinc-400 hover:text-red-400 border border-zinc-800 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 8: SAMO NEWSLETTER SUBSCRIBERS (PERSISTED TO CLOUDFLARE R2)
             ===================================================================== */}
          {activeTab === 'newsletter' && (
            <div className="space-y-6">
              <div className="bg-[#18181C] border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                        SAMO Newsletter Subscribers
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono-tabular font-bold bg-white text-zinc-950">
                        {newsletterSubscribers.length}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Client emails submitted via the storefront footer newsletter, automatically saved to Cloudflare R2 storage.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={newsletterSubscribers.length === 0}
                      onClick={() => {
                        const emailList = newsletterSubscribers
                          .map((s) => s.email)
                          .join(', ');
                        navigator.clipboard.writeText(emailList);
                        setCopiedNewsletter(true);
                        setTimeout(() => setCopiedNewsletter(false), 2500);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {copiedNewsletter ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">
                            Copied Emails!
                          </span>
                        </>
                      ) : (
                        <span>Copy All Emails</span>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={newsletterSubscribers.length === 0}
                      onClick={() => {
                        const csvHeader = 'Email,SubscribedAt\n';
                        const csvRows = newsletterSubscribers
                          .map((s) => `"${s.email}","${s.subscribedAt}"`)
                          .join('\n');
                        const blob = new Blob([csvHeader + csvRows], {
                          type: 'text/csv',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `samo-newsletter-subscribers-${new Date()
                          .toISOString()
                          .slice(0, 10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={newsletterSearchQuery}
                      onChange={(e) => setNewsletterSearchQuery(e.target.value)}
                      placeholder="Search subscriber email..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                    />
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Storage:{' '}
                    <code className="text-zinc-300">samo-images</code> /{' '}
                    <code className="text-zinc-300">
                      newsletter/subscribers.json
                    </code>
                  </div>
                </div>

                <div className="divide-y divide-zinc-800 border-t border-zinc-800 mt-4">
                  {(() => {
                    const filtered = newsletterSubscribers.filter((s) =>
                      s.email
                        .toLowerCase()
                        .includes(newsletterSearchQuery.toLowerCase())
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="py-12 text-center text-xs text-zinc-500">
                          {newsletterSubscribers.length === 0
                            ? 'No newsletter subscriptions yet. Submissions from the website footer will automatically appear here and sync to Cloudflare R2.'
                            : 'No subscribers matching your search.'}
                        </div>
                      );
                    }

                    return filtered.map((sub, index) => {
                      const dateStr = sub.subscribedAt
                        ? new Date(sub.subscribedAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'Recent';

                      return (
                        <div
                          key={sub.id || sub.email}
                          className="py-3.5 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[11px] font-mono-tabular text-zinc-500 w-6">
                              {index + 1}.
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {sub.email}
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                Subscribed: {dateStr}
                              </div>
                            </div>
                          </div>

                          {onDeleteNewsletterSubscriber && (
                            <button
                              type="button"
                              onClick={() =>
                                onDeleteNewsletterSubscriber(sub.id)
                              }
                              aria-label={`Delete subscriber ${sub.email}`}
                              title="Remove subscriber"
                              className="p-2 rounded-lg text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/50 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 9: ADMIN ACCESS & CLOUDFLARE / FIREBASE GUIDE
             ===================================================================== */}
          {activeTab === 'admins' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-[#18181C] border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                    Grant Admin Access by Gmail
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Primary access is verified securely against the Firebase admin directory and the AI Studio owner session. Add trusted team members by their Gmail address below.
                  </p>

                  {adminFeedback && (
                    <div className="p-3 rounded-xl bg-white text-zinc-950 text-xs font-semibold">
                      {adminFeedback}
                    </div>
                  )}

                  <form onSubmit={handleAddAdminSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                        Team Member Gmail Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={newAdminGmail}
                        onChange={(e) => setNewAdminGmail(e.target.value)}
                        placeholder="manager@gmail.com"
                        className="w-full px-3 py-2.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-white focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 px-4 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 cursor-pointer"
                    >
                      + Authorize Gmail Admin
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 bg-[#18181C] border border-zinc-800 rounded-2xl p-6">
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white pb-3 border-b border-zinc-800">
                    Authorized Admin Directory ({admins.length})
                  </h3>
                  <div className="divide-y divide-zinc-800 mt-2">
                    {admins.map((adm) => {
                      const isSuper = SUPER_ADMIN_EMAILS.includes(
                        adm.email.toLowerCase()
                      );
                      return (
                        <div
                          key={adm.email}
                          className="py-3.5 flex items-center justify-between gap-4"
                        >
                          <div>
                            <div className="text-xs font-bold text-white">
                              {adm.email}
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Added by: {adm.addedBy}
                            </div>
                          </div>
                          {isSuper ? (
                            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                              Protected Owner
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onRemoveAdminByEmail(adm.email)}
                              aria-label={`Remove admin ${adm.email}`}
                              className="p-2 rounded-lg text-zinc-400 hover:text-red-400 border border-zinc-800 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Store Catalog Export Card */}
              <div className="bg-[#18181C] border border-zinc-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    SAMO Store Catalog Backup
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Export a complete JSON snapshot of your catalog, banners,
                    categories, and orders at any time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCloudflareJson}
                  className="px-4 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Catalog JSON</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Optimized for iPhone & Android Thumb Reach) */}
      <nav
        aria-label="Mobile Admin Bottom Bar"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#141417]/95 backdrop-blur-md border-t border-zinc-800 grid grid-cols-5 h-16 px-1"
      >
        {(
          [
            {
              id: 'dashboard' as AdminSectionTab,
              label: 'Dashboard',
              icon: <LayoutDashboard className="w-4 h-4" />,
            },
            {
              id: 'items' as AdminSectionTab,
              label: 'Products',
              icon: <Package className="w-4 h-4" />,
            },
            {
              id: 'categories' as AdminSectionTab,
              label: 'Categories',
              icon: <FolderTree className="w-4 h-4" />,
            },
            {
              id: 'banners' as AdminSectionTab,
              label: 'Banners',
              icon: <Film className="w-4 h-4" />,
            },
            {
              id: 'orders' as AdminSectionTab,
              label: 'Orders',
              icon: <ShoppingBag className="w-4 h-4" />,
            },
          ] as const
        ).map((mTab) => {
          const active = activeTab === mTab.id;
          return (
            <button
              key={mTab.id}
              type="button"
              onClick={() => handleSelectNav(mTab.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mTab.icon}
              <span className="truncate max-w-full px-1">{mTab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* =========================================================================
          POP-UP MODAL 1: DELETE ITEM CONFIRMATION ("Are you sure you want to delete?")
         ========================================================================= */}
      {productPendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#18181C] border border-zinc-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3
                  id="delete-confirm-title"
                  className="text-base font-bold text-white"
                >
                  Are you sure you want to delete this item?
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You are about to permanently remove{' '}
                  <strong className="text-white">
                    {productPendingDelete.name}
                  </strong>{' '}
                  ({productPendingDelete.department} ·{' '}
                  {productPendingDelete.category}) from the SAMO storefront and
                  permanently delete its uploaded images.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setProductPendingDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = productPendingDelete;
                  setProductPendingDelete(null);
                  if (editingProductId === target.id) {
                    setEditingProductId(null);
                  }
                  await onDeleteProduct(target.id);
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Yes, Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          POP-UP MODAL 1B: DELETE SINGLE IMAGE CONFIRMATION ("Are you sure?")
         ========================================================================= */}
      {imagePendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-image-confirm-title"
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#18181C] border border-zinc-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3
                  id="delete-image-confirm-title"
                  className="text-base font-bold text-white"
                >
                  Are you sure you want to delete this image?
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You are about to remove{' '}
                  <strong className="text-white">
                    {imagePendingDelete.label}
                  </strong>{' '}
                  from this item and permanently delete the image file.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setImagePendingDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = imagePendingDelete;
                  setImagePendingDelete(null);
                  await deleteMediaFromR2(target.imageUrl);
                  await target.onConfirm();
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Yes, Delete Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          POP-UP MODAL 1C: DELETE CATEGORY CONFIRMATION ("Are you sure?")
         ========================================================================= */}
      {categoryPendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-cat-confirm-title"
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#18181C] border border-zinc-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3
                  id="delete-cat-confirm-title"
                  className="text-base font-bold text-white"
                >
                  Are you sure you want to delete this category?
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You are about to remove the{' '}
                  <strong className="text-white">
                    {categoryPendingDelete.name}
                  </strong>{' '}
                  ({categoryPendingDelete.department.toUpperCase()}) category
                  section.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setCategoryPendingDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = categoryPendingDelete;
                  setCategoryPendingDelete(null);
                  await onDeleteCategory(target.id);
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Yes, Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          POP-UP MODAL 2A: EDIT CATEGORY SECTION NAME MODAL
         ========================================================================= */}
      {editingCategory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-category-modal-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-[#18181C] border border-zinc-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2
                  id="edit-category-modal-title"
                  className="font-display text-base font-bold uppercase tracking-wider text-white"
                >
                  Edit Category Section Name
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {editingCategory.department.toUpperCase()} Department ·
                  Updates category section &amp; all linked items
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                aria-label="Close Edit Category Modal"
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const clean = editCatName.trim();
                if (!clean) return;
                await onUpdateCategory(
                  editingCategory.id,
                  clean,
                  editCatDesc.trim()
                );
                setCatFeedback(
                  `Renamed category "${editingCategory.name}" to "${clean}".`
                );
                setEditingCategory(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  placeholder="Enter new category section name..."
                  className="w-full px-3 py-2.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editCatDesc}
                  onChange={(e) => setEditCatDesc(e.target.value)}
                  placeholder="Editorial description..."
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 cursor-pointer"
                >
                  Save Category Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POP-UP MODAL 2B: ADD NEW CATEGORY MODAL
         ========================================================================= */}
      {isAddCategoryModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-category-modal-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-[#18181C] border border-zinc-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2
                id="add-category-modal-title"
                className="font-display text-base font-bold uppercase tracking-wider text-white"
              >
                Add New Category
              </h2>
              <button
                type="button"
                onClick={() => setIsAddCategoryModalOpen(false)}
                aria-label="Close Add Category Modal"
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Main Department *
                </label>
                <select
                  value={newCatDept}
                  onChange={(e) => setNewCatDept(e.target.value as Department)}
                  className="w-full px-3 py-2.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                >
                  <option value="women">Women</option>
                  <option value="kids">Kids</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="E.g. Eyewear, Boots, Knitwear..."
                  className="w-full px-3 py-2.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Editorial description..."
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 cursor-pointer"
                >
                  + Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POP-UP MODAL 3: EDIT EXISTING PRODUCT MODAL (Opened via Pencil Icon)
         ========================================================================= */}
      {editingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-product-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white text-zinc-950 border border-zinc-300 rounded-2xl max-w-2xl w-full p-3.5 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[92vh] overflow-y-auto overflow-x-hidden">
            <div className="flex items-start sm:items-center justify-between gap-2 border-b border-zinc-200 pb-3 sticky top-0 bg-white z-10">
              <div className="min-w-0">
                <h2
                  id="edit-product-modal-title"
                  className="font-display text-sm sm:text-base font-extrabold uppercase tracking-wider text-zinc-950 break-words"
                >
                  Edit Product: {editingProduct.name}
                </h2>
                <p className="text-[11px] text-zinc-500">
                  {editingProduct.department.toUpperCase()} ·{' '}
                  {editingProduct.category} · {editingProduct.style}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProductId(null)}
                aria-label="Close Edit Product Modal"
                className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const prod = editingProduct;
              const isEditingFullSet =
                prod.department === 'women' &&
                (Boolean(prod.isFullSet) ||
                  prod.category.trim().toLowerCase() === 'full set');
              const hasColors =
                Boolean(prod.hasColors) &&
                Array.isArray(prod.colorVariants) &&
                prod.colorVariants.length > 0;
              const editDeptCats = getCategoriesByDepartment(
                categories,
                prod.department
              );

              return (
                <div className="space-y-4 text-xs">
                  {/* Full Product Core Details Editor: Name, Price, Department, Category, Style, Description, Materials */}
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3.5">
                    <div className="font-bold uppercase tracking-wider text-zinc-900">
                      Product Name, Price, Category &amp; Details:
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          value={prod.name}
                          onChange={(e) =>
                            onUpdateProductMeta(prod.id, {
                              name: e.target.value.toUpperCase(),
                            })
                          }
                          aria-label="Edit Product Name"
                          placeholder="Product Name"
                          className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-zinc-300 focus:border-zinc-950 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                          Price (USD $) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={prod.price}
                          onChange={(e) =>
                            onUpdateProductMeta(prod.id, {
                              price: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          aria-label="Edit Product Price"
                          className="w-full px-2.5 py-1.5 text-xs font-mono-tabular font-bold bg-white border border-zinc-300 focus:border-zinc-950 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                          Department
                        </label>
                        <select
                          value={prod.department}
                          onChange={(e) => {
                            const nextDept = e.target.value as Department;
                            const nextDeptCats = getCategoriesByDepartment(
                              categories,
                              nextDept
                            );
                            const nextCat =
                              nextDeptCats[0]?.name || prod.category;
                            onUpdateProductMeta(prod.id, {
                              department: nextDept,
                              category: nextCat,
                              ...(nextDept === 'kids'
                                ? { isFullSet: false }
                                : {}),
                            });
                          }}
                          aria-label="Edit Product Department"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300 uppercase"
                        >
                          <option value="women">Women</option>
                          <option value="kids">Kids</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                          Category Section
                        </label>
                        <select
                          value={prod.category}
                          onChange={(e) => {
                            const nextCat = e.target.value;
                            onUpdateProductMeta(prod.id, {
                              category: nextCat,
                              isFullSet:
                                prod.department === 'women' &&
                                nextCat.trim().toLowerCase() === 'full set',
                            });
                          }}
                          aria-label="Edit Product Category"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                        >
                          {editDeptCats.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                          Aesthetic Style
                        </label>
                        <select
                          value={prod.style}
                          onChange={(e) =>
                            onUpdateProductMeta(prod.id, {
                              style: e.target.value as StyleType,
                            })
                          }
                          aria-label="Edit Product Style"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                        >
                          <option value="Classic">Classic</option>
                          <option value="Sport Chic">Sport Chic</option>
                          <option value="Fine Leather">Fine Leather</option>
                          <option value="Suede">Suede</option>
                          <option value="Fur">Fur</option>
                          <option value="Accessories">Accessories</option>
                        </select>
                      </div>
                    </div>

                    {/* Show in New Arrivals Checkbox (Keep in original category & toggle New Arrivals showcase) */}
                    <div className="p-3 bg-white border border-zinc-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="flex items-start sm:items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(prod.isNewArrival)}
                          onChange={(e) =>
                            onUpdateProductMeta(prod.id, {
                              isNewArrival: e.target.checked,
                              featured: e.target.checked,
                            })
                          }
                          className="w-4 h-4 mt-0.5 sm:mt-0 accent-zinc-950 cursor-pointer shrink-0"
                        />
                        <div>
                          <span className="block text-xs font-bold uppercase tracking-wider text-zinc-950">
                            Show in New Arrivals (/new-arrivals)
                          </span>
                          <span className="block text-[11px] text-zinc-500">
                            Uncheck to remove this product from New Arrivals while keeping it in its category ({prod.category}).
                          </span>
                        </div>
                      </label>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider self-start sm:self-center shrink-0 ${
                          prod.isNewArrival
                            ? 'bg-zinc-950 text-white'
                            : 'bg-zinc-100 text-zinc-500 border border-zinc-300'
                        }`}
                      >
                        {prod.isNewArrival ? 'In New Arrivals' : `${prod.category} Only`}
                      </span>
                    </div>

                    {/* Description Editor */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700">
                          Product Notes / Description
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVar = draftVariationIndex + 1;
                            setDraftVariationIndex(nextVar);
                            const drafted = buildEditorialProductDescription(
                              {
                                name: prod.name,
                                department: prod.department,
                                category: prod.category,
                                style: prod.style,
                                materials: prod.materials || [],
                                colors:
                                  prod.hasColors && Array.isArray(prod.colorVariants)
                                    ? prod.colorVariants.map((v) => v.colorName)
                                    : [],
                              },
                              nextVar - 1
                            );
                            onUpdateProductMeta(prod.id, {
                              description: drafted,
                            });
                          }}
                          className="px-2.5 py-1 rounded-md bg-zinc-950 text-white hover:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Auto-Draft Editorial Notes</span>
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={prod.description || ''}
                        onChange={(e) =>
                          onUpdateProductMeta(prod.id, {
                            description: e.target.value,
                          })
                        }
                        aria-label="Edit Product Description"
                        placeholder="Editorial notes and construction details..."
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                      />
                    </div>

                    {/* Materials Editor (With Checkbox to Add / Hide Material on Website) — Hidden for Full Set */}
                    {!isEditingFullSet && (
                      <div className="space-y-2.5 pt-2 border-t border-zinc-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-950 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={(prod.materials || []).length > 0}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (checked) {
                                  const defaultMat =
                                    allMaterials[0] || 'Cow Leather';
                                  onUpdateProductMeta(prod.id, {
                                    materials: [defaultMat],
                                  });
                                } else {
                                  onUpdateProductMeta(prod.id, {
                                    materials: [],
                                  });
                                }
                              }}
                              className="w-4 h-4 accent-zinc-950 cursor-pointer"
                            />
                            <span>Add / Show Material on Website</span>
                          </label>
                          {(prod.materials || []).length > 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              {(prod.materials || []).length} Selected
                            </span>
                          )}
                        </div>

                        {(prod.materials || []).length > 0 && (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              {allMaterials.map((mat) => {
                                const active = (prod.materials || []).includes(
                                  mat
                                );
                                return (
                                  <button
                                    key={mat}
                                    type="button"
                                    onClick={() => {
                                      const currentMats = prod.materials || [];
                                      const nextMats = active
                                        ? currentMats.filter((m) => m !== mat)
                                        : [...currentMats, mat];
                                      onUpdateProductMeta(prod.id, {
                                        materials: nextMats,
                                      });
                                    }}
                                    className={`px-2 py-1 text-[10px] font-semibold border flex items-center gap-1 cursor-pointer ${
                                      active
                                        ? 'bg-zinc-950 text-white border-zinc-950'
                                        : 'bg-white text-zinc-700 border-zinc-300'
                                    }`}
                                  >
                                    {active && <Check className="w-2.5 h-2.5" />}
                                    <span>{mat}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                              <input
                                type="text"
                                value={editProdNewMaterialInput}
                                onChange={(e) =>
                                  setEditProdNewMaterialInput(e.target.value)
                                }
                                placeholder="Add custom material..."
                                className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const clean = editProdNewMaterialInput.trim();
                                  if (!clean) return;
                                  await onAddCustomMaterial(clean);
                                  const currentMats = prod.materials || [];
                                  if (!currentMats.includes(clean)) {
                                    await onUpdateProductMeta(prod.id, {
                                      materials: [...currentMats, clean],
                                    });
                                  }
                                  setEditProdNewMaterialInput('');
                                }}
                                className="px-3 py-1.5 bg-zinc-900 text-white text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap shrink-0"
                              >
                                + Add Material
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Placement Checkboxes & Color Variant Toggle */}
                  {!isEditingFullSet && (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                      <label className="flex items-center gap-2 font-bold uppercase tracking-wider text-zinc-900 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hasColors}
                          onChange={(e) =>
                            handleToggleCatalogProductColorMode(
                              prod,
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 accent-zinc-950 cursor-pointer"
                        />
                        <span>Enable Multi-Color Variants</span>
                      </label>

                      <label className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(prod.isNewArrival)}
                          onChange={(e) =>
                            onUpdateProductMeta(prod.id, {
                              isNewArrival: e.target.checked,
                              featured: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-zinc-950 cursor-pointer"
                        />
                        <span>Show in New Arrivals</span>
                      </label>
                    </div>
                  )}

                  {/* 2-Piece Full Set Linked Items & Colors Editor */}
                  {isEditingFullSet && (
                    <div className="p-4 bg-zinc-50 border-2 border-zinc-950 rounded-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
                        <div>
                          <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-950 flex items-center gap-1.5">
                            <Layers className="w-4 h-4" />
                            <span>
                              2-Piece Full Set Linked Items &amp; Colors
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-600 mt-0.5">
                            Sizes, colors, and stock quantities are synced from
                            the two linked store items below. When a customer
                            buys this Full Set, stock is deducted from both
                            original items.
                          </p>
                        </div>
                      </div>

                      {[0, 1].map((pieceIdx) => {
                        const currentSetItems: FullSetSubItem[] =
                          Array.isArray(prod.setItems) &&
                          prod.setItems.length >= 2
                            ? prod.setItems
                            : [
                                prod.setItems?.[0] || {
                                  productId:
                                    allStandaloneProducts[0]?.id || '',
                                  productName:
                                    allStandaloneProducts[0]?.name ||
                                    'Piece 1',
                                  pieceLabel: 'Top / Shirt',
                                  sizeType:
                                    allStandaloneProducts[0]?.sizeType ||
                                    'letter',
                                  sizes:
                                    allStandaloneProducts[0]?.sizes || ['S', 'M'],
                                  sizeQuantities:
                                    allStandaloneProducts[0]?.sizeQuantities ||
                                    {},
                                },
                                prod.setItems?.[1] || {
                                  productId:
                                    allStandaloneProducts[1]?.id ||
                                    allStandaloneProducts[0]?.id ||
                                    '',
                                  productName:
                                    allStandaloneProducts[1]?.name ||
                                    'Piece 2',
                                  pieceLabel: 'Bottom / Trousers',
                                  sizeType:
                                    allStandaloneProducts[1]?.sizeType ||
                                    'numeric',
                                  sizes:
                                    allStandaloneProducts[1]?.sizes || [
                                      '36',
                                      '38',
                                    ],
                                  sizeQuantities:
                                    allStandaloneProducts[1]?.sizeQuantities ||
                                    {},
                                },
                              ];

                        const piece = currentSetItems[pieceIdx];
                        const linkedProd =
                          allStandaloneProducts.find(
                            (p) => p.id === piece?.productId
                          ) ||
                          allStandaloneProducts[pieceIdx] ||
                          allStandaloneProducts[0];

                        const linkedHasColors =
                          Boolean(linkedProd?.hasColors) &&
                          Array.isArray(linkedProd?.colorVariants) &&
                          linkedProd!.colorVariants!.length > 0;

                        const activeColorNames: string[] = linkedHasColors
                          ? Array.isArray(piece?.selectedColors) &&
                            piece.selectedColors.length > 0
                            ? piece.selectedColors
                            : [linkedProd!.colorVariants![0].colorName]
                          : [];

                        const handleUpdateEditFullSetPiece = (
                          nextProd: ProductItem,
                          nextLabel: string,
                          nextColorNames: string[]
                        ) => {
                          const nextHasColors =
                            Boolean(nextProd.hasColors) &&
                            Array.isArray(nextProd.colorVariants) &&
                            nextProd.colorVariants.length > 0;
                          const resolvedColors = nextHasColors
                            ? nextColorNames.length > 0
                              ? nextColorNames
                              : [nextProd.colorVariants![0].colorName]
                            : [];
                          const filteredVars = nextHasColors
                            ? nextProd.colorVariants!.filter((v) =>
                                resolvedColors.some(
                                  (c) =>
                                    c.trim().toLowerCase() ===
                                    v.colorName.trim().toLowerCase()
                                )
                              )
                            : [];
                          const leadVar =
                            filteredVars[0] || nextProd.colorVariants?.[0];
                          const nextSizes =
                            nextHasColors && leadVar
                              ? [...leadVar.sizes]
                              : [...nextProd.sizes];
                          const nextQtyMap =
                            nextHasColors && leadVar
                              ? buildSizeQuantitiesMap(
                                  nextSizes,
                                  leadVar.sizeQuantities
                                )
                              : buildSizeQuantitiesMap(
                                  nextSizes,
                                  nextProd.sizeQuantities
                                );

                          const updatedSub: FullSetSubItem = {
                            productId: nextProd.id,
                            productName: nextProd.name,
                            pieceLabel:
                              nextLabel.trim() ||
                              nextProd.category ||
                              `Piece ${pieceIdx + 1}`,
                            sizeType:
                              (nextHasColors && leadVar?.sizeType) ||
                              nextProd.sizeType,
                            sizes: nextSizes,
                            sizeQuantities: nextQtyMap,
                            selectedColors: filteredVars.map(
                              (v) => v.colorName
                            ),
                            colorVariants: filteredVars.map((v) => ({
                              ...v,
                              sizes: [...v.sizes],
                              sizeQuantities: { ...v.sizeQuantities },
                            })),
                          };

                          const nextSetItems = [...currentSetItems];
                          nextSetItems[pieceIdx] = updatedSub;
                          onUpdateProductMeta(prod.id, {
                            isFullSet: true,
                            materials: [],
                            hasColors: false,
                            colorVariants: [],
                            setItems: nextSetItems,
                          });
                        };

                        return (
                          <div
                            key={pieceIdx}
                            className="p-3.5 bg-white border border-zinc-300 rounded-lg space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-950">
                                Piece {pieceIdx + 1}:{' '}
                                {pieceIdx === 0
                                  ? 'Shirt / Top / Jacket'
                                  : 'Trousers / Skirt / Bottom'}
                              </span>
                              {linkedProd && (
                                <span className="text-[10px] font-mono-tabular text-zinc-500 uppercase">
                                  Category: {linkedProd.category}
                                </span>
                              )}
                            </div>

                            {(() => {
                              const editPieceCat =
                                linkedProd?.category ||
                                womenCategories[pieceIdx]?.name ||
                                womenCategories[0]?.name ||
                                '';
                              const pieceProdsForCat =
                                womenStandaloneProducts.filter(
                                  (p) =>
                                    p.category.trim().toLowerCase() ===
                                    editPieceCat.trim().toLowerCase()
                                );

                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                                      Category (Women Only) *
                                    </label>
                                    <select
                                      aria-label={`Select Piece ${pieceIdx + 1} Category`}
                                      value={editPieceCat}
                                      onChange={(e) => {
                                        const newCat = e.target.value;
                                        const matchingProds =
                                          womenStandaloneProducts.filter(
                                            (p) =>
                                              p.category.trim().toLowerCase() ===
                                              newCat.trim().toLowerCase()
                                          );
                                        if (matchingProds.length > 0) {
                                          const picked = matchingProds[0];
                                          const defaultCols =
                                            picked.hasColors &&
                                            picked.colorVariants?.length
                                              ? [
                                                  picked.colorVariants[0]
                                                    .colorName,
                                                ]
                                              : [];
                                          handleUpdateEditFullSetPiece(
                                            picked,
                                            picked.category ||
                                              `Piece ${pieceIdx + 1}`,
                                            defaultCols
                                          );
                                        }
                                      }}
                                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                                    >
                                      {womenCategories.map((wc) => (
                                        <option key={wc.id} value={wc.name}>
                                          {wc.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                                      Product in Category *
                                    </label>
                                    <select
                                      aria-label={`Select Piece ${pieceIdx + 1} Product`}
                                      value={linkedProd?.id || ''}
                                      onChange={(e) => {
                                        const picked = products.find(
                                          (p) => p.id === e.target.value
                                        );
                                        if (!picked) return;
                                        const defaultCols =
                                          picked.hasColors &&
                                          picked.colorVariants?.length
                                            ? [
                                                picked.colorVariants[0]
                                                  .colorName,
                                              ]
                                            : [];
                                        handleUpdateEditFullSetPiece(
                                          picked,
                                          picked.category ||
                                            `Piece ${pieceIdx + 1}`,
                                          defaultCols
                                        );
                                      }}
                                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                                    >
                                      {pieceProdsForCat.length > 0 ? (
                                        pieceProdsForCat.map((sp) => (
                                          <option key={sp.id} value={sp.id}>
                                            {sp.name} (${sp.price})
                                          </option>
                                        ))
                                      ) : (
                                        <option value="">
                                          No products in this category
                                        </option>
                                      )}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                                      Piece Label Shown on Website
                                    </label>
                                    <input
                                      type="text"
                                      value={piece?.pieceLabel || ''}
                                      onChange={(e) => {
                                        if (!linkedProd) return;
                                        handleUpdateEditFullSetPiece(
                                          linkedProd,
                                          e.target.value,
                                          activeColorNames
                                        );
                                      }}
                                      placeholder={
                                        pieceIdx === 0
                                          ? 'e.g. Shirt / Top'
                                          : 'e.g. Trousers / Pants'
                                      }
                                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                                    />
                                  </div>
                                </div>
                              );
                            })()}

                            {linkedHasColors && linkedProd?.colorVariants && (
                              <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">
                                    Colors to Show in Full Set for{' '}
                                    {linkedProd.name} (Defaults to 1st color if
                                    none selected):
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allColNames =
                                        linkedProd.colorVariants!.map(
                                          (v) => v.colorName
                                        );
                                      handleUpdateEditFullSetPiece(
                                        linkedProd,
                                        piece?.pieceLabel ||
                                          linkedProd.category,
                                        allColNames
                                      );
                                    }}
                                    className="px-2 py-0.5 bg-zinc-900 text-white text-[10px] font-bold uppercase cursor-pointer"
                                  >
                                    Select All Colors
                                  </button>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  {linkedProd.colorVariants.map((cv) => {
                                    const isColSelected = activeColorNames.some(
                                      (c) =>
                                        c.trim().toLowerCase() ===
                                        cv.colorName.trim().toLowerCase()
                                    );
                                    return (
                                      <button
                                        key={cv.colorName}
                                        type="button"
                                        onClick={() => {
                                          const exists = activeColorNames.some(
                                            (c) =>
                                              c.trim().toLowerCase() ===
                                              cv.colorName.trim().toLowerCase()
                                          );
                                          const nextCols = exists
                                            ? activeColorNames.filter(
                                                (c) =>
                                                  c.trim().toLowerCase() !==
                                                  cv.colorName
                                                    .trim()
                                                    .toLowerCase()
                                              )
                                            : [
                                                ...activeColorNames,
                                                cv.colorName,
                                              ];
                                          handleUpdateEditFullSetPiece(
                                            linkedProd,
                                            piece?.pieceLabel ||
                                              linkedProd.category,
                                            nextCols.length > 0
                                              ? nextCols
                                              : [
                                                  linkedProd.colorVariants![0]
                                                    .colorName,
                                                ]
                                          );
                                        }}
                                        className={`px-2.5 py-1 text-[10px] font-bold uppercase border flex items-center gap-1.5 cursor-pointer ${
                                          isColSelected
                                            ? 'bg-zinc-950 text-white border-zinc-950'
                                            : 'bg-white text-zinc-700 border-zinc-300'
                                        }`}
                                      >
                                        <span
                                          className="w-2.5 h-2.5 rounded-full border border-zinc-400 shrink-0"
                                          style={{
                                            backgroundColor:
                                              cv.colorHex ||
                                              getColorSwatchHex(cv.colorName),
                                          }}
                                        />
                                        <span>{cv.colorName}</span>
                                        {isColSelected && (
                                          <Check className="w-2.5 h-2.5" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Per-Size or Per-Color Stock Controls */}
                  {!isEditingFullSet && (hasColors && prod.colorVariants ? (
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                      <div className="font-bold uppercase tracking-wider text-zinc-900">
                        Select Active Colors for {prod.name}:
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {allColors.map((colName) => {
                          const existingVar = prod.colorVariants!.find(
                            (v) =>
                              v.colorName.toLowerCase() ===
                              colName.toLowerCase()
                          );
                          const active = Boolean(existingVar);
                          const hex =
                            existingVar?.colorHex ||
                            customColorHexMap[colName.toLowerCase()] ||
                            getColorSwatchHex(colName);
                          return (
                            <button
                              key={colName}
                              type="button"
                              onClick={() =>
                                handleToggleCatalogProductColorItem(
                                  prod,
                                  colName
                                )
                              }
                              className={`px-2.5 py-1 text-[10px] font-bold uppercase border flex items-center gap-1.5 cursor-pointer ${
                                active
                                  ? 'bg-zinc-950 text-white border-zinc-950'
                                  : 'bg-white text-zinc-700 border-zinc-300'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 border border-zinc-400 shrink-0"
                                style={{ backgroundColor: hex }}
                              />
                              <span>{colName}</span>
                              {active && <Check className="w-2.5 h-2.5" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Add Custom Color Name, Hex Code, or Pick from Color Palette */}
                      <div className="p-3 bg-white border border-zinc-300 rounded-lg space-y-2.5">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-800">
                          Add New Color (Name, Hex Code, or Color Palette):
                        </span>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            value={catalogCustomColorInputs[prod.id] || ''}
                            onChange={(e) =>
                              setCatalogCustomColorInputs((prev) => ({
                                ...prev,
                                [prod.id]: e.target.value,
                              }))
                            }
                            placeholder="Color Name (e.g. Olive, Royal Blue)..."
                            className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                          />
                          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={
                                  /^#([0-9A-Fa-f]{6})$/.test(
                                    catalogCustomColorHexInputs[prod.id] || ''
                                  )
                                    ? catalogCustomColorHexInputs[prod.id]
                                    : '#3D4F2F'
                                }
                                onChange={(e) =>
                                  setCatalogCustomColorHexInputs((prev) => ({
                                    ...prev,
                                    [prod.id]: e.target.value,
                                  }))
                                }
                                aria-label="Pick custom color from color wheel"
                                className="w-8 h-8 p-0.5 bg-white border border-zinc-300 cursor-pointer shrink-0"
                              />
                              <input
                                type="text"
                                value={
                                  catalogCustomColorHexInputs[prod.id] ||
                                  '#3D4F2F'
                                }
                                onChange={(e) =>
                                  setCatalogCustomColorHexInputs((prev) => ({
                                    ...prev,
                                    [prod.id]: e.target.value,
                                  }))
                                }
                                placeholder="#HEX"
                                className="w-24 sm:w-28 px-2 py-1.5 text-xs font-mono-tabular bg-white border border-zinc-300"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCatalogAddCustomColorToProduct(prod)
                              }
                              className="px-3 py-1.5 bg-zinc-950 text-white text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap shrink-0"
                            >
                              + Add Color
                            </button>
                          </div>
                        </div>

                        {/* Quick Color Palette Swatches */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold uppercase text-zinc-500 mr-1">
                            Palette:
                          </span>
                          {LUXURY_PALETTE_SWATCHES.map((sw) => (
                            <button
                              key={sw.hex}
                              type="button"
                              title={`${sw.name} (${sw.hex})`}
                              onClick={() => {
                                setCatalogCustomColorInputs((prev) => ({
                                  ...prev,
                                  [prod.id]: prev[prod.id]?.trim()
                                    ? prev[prod.id]
                                    : sw.name,
                                }));
                                setCatalogCustomColorHexInputs((prev) => ({
                                  ...prev,
                                  [prod.id]: sw.hex,
                                }));
                              }}
                              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 cursor-pointer"
                            >
                              <span
                                className="w-3 h-3 border border-zinc-400 shrink-0"
                                style={{ backgroundColor: sw.hex }}
                              />
                              <span className="text-zinc-700">{sw.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        {prod.colorVariants.map((variant) => {
                          const hex =
                            variant.colorHex ||
                            customColorHexMap[
                              variant.colorName.toLowerCase()
                            ] ||
                            getColorSwatchHex(variant.colorName);
                          const sizeInputKey = `${prod.id}-${variant.colorName}`;
                          const presetList = getPresetsForSizeType(
                            variant.sizeType
                          );
                          const gUrls = variant.galleryUrls || [];
                          return (
                            <div
                              key={variant.colorName}
                              className="p-3.5 bg-white border border-zinc-300 rounded-lg space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-200">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={
                                      /^#([0-9A-Fa-f]{6})$/.test(hex)
                                        ? hex
                                        : '#09090B'
                                    }
                                    onChange={(e) => {
                                      const nextHex = e.target.value;
                                      setCustomColorHexMap((prev) => ({
                                        ...prev,
                                        [variant.colorName.toLowerCase()]:
                                          nextHex,
                                      }));
                                      handleCatalogVariantChange(
                                        prod,
                                        variant.colorName,
                                        (v) => ({
                                          ...v,
                                          colorHex: nextHex,
                                        })
                                      );
                                    }}
                                    title="Click to adjust color swatch hex"
                                    className="w-6 h-6 p-0.5 bg-white border border-zinc-400 cursor-pointer shrink-0"
                                  />
                                  <span className="font-extrabold uppercase text-zinc-950 text-xs">
                                    {variant.colorName}
                                  </span>
                                  <span className="text-[10px] font-mono-tabular text-zinc-500">
                                    ({hex})
                                  </span>
                                </div>
                              </div>

                              {/* 4 Upload Photos for this Color */}
                              <div className="space-y-2 p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">
                                  4 Photos for {variant.colorName} (Photo #1
                                  shows on website card when color is clicked;
                                  all 4 appear in item pop-up):
                                </div>
                                {/* Photo 1 (Main Color Photo) */}
                                <div>
                                  <span className="block text-[10px] font-bold uppercase text-zinc-700 mb-0.5">
                                    1. Primary Photo (Shown on Website Card &amp; First in Pop-up) *
                                  </span>
                                  <div className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                                    <input
                                      type="text"
                                      value={variant.imageUrl}
                                      onChange={(e) =>
                                        handleCatalogVariantChange(
                                          prod,
                                          variant.colorName,
                                          (v) => ({
                                            ...v,
                                            imageUrl: e.target.value,
                                          })
                                        )
                                      }
                                      placeholder={`Photo #1 URL for ${variant.colorName}`}
                                      className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                                    />
                                    <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                                      <R2ImageUploadButton
                                        compact={true}
                                        label={
                                          variant.imageUrl?.trim()
                                            ? 'Replace Photo'
                                            : 'Upload Photo'
                                        }
                                        ariaLabel={`Upload Photo 1 for ${prod.name} color ${variant.colorName}`}
                                        onUploaded={(url) =>
                                          handleCatalogVariantChange(
                                            prod,
                                            variant.colorName,
                                            (v) => ({
                                              ...v,
                                              imageUrl: url,
                                            })
                                          )
                                        }
                                      />
                                      {Boolean(variant.imageUrl?.trim()) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setImagePendingDelete({
                                              label: `${prod.name} (${variant.colorName} · Photo #1)`,
                                              imageUrl: variant.imageUrl,
                                              onConfirm: () =>
                                                handleCatalogVariantChange(
                                                  prod,
                                                  variant.colorName,
                                                  (v) => ({
                                                    ...v,
                                                    imageUrl: '',
                                                  })
                                                ),
                                            })
                                          }
                                          aria-label={`Delete Photo 1 for ${prod.name} color ${variant.colorName}`}
                                          title="Delete this image"
                                          className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>Delete</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Photos 2, 3, 4 (Pop-up Gallery Photos for this Color) */}
                                {[0, 1, 2].map((gIdx) => (
                                  <div key={gIdx}>
                                    <span className="block text-[10px] font-bold uppercase text-zinc-600 mb-0.5">
                                      {gIdx + 2}. Color Photo #{gIdx + 2} (Shown in Product Pop-up)
                                    </span>
                                    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                                      <input
                                        type="text"
                                        value={gUrls[gIdx] || ''}
                                        onChange={(e) => {
                                          const nextVal = e.target.value;
                                          handleCatalogVariantChange(
                                            prod,
                                            variant.colorName,
                                            (v) => {
                                              const nextGallery = [
                                                ...(v.galleryUrls || [
                                                  '',
                                                  '',
                                                  '',
                                                ]),
                                              ];
                                              while (nextGallery.length < 3) {
                                                nextGallery.push('');
                                              }
                                              nextGallery[gIdx] = nextVal;
                                              return {
                                                ...v,
                                                galleryUrls: nextGallery,
                                              };
                                            }
                                          );
                                        }}
                                        placeholder={`Photo #${gIdx + 2} URL for ${variant.colorName} (Optional)`}
                                        className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                                      />
                                      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                                        <R2ImageUploadButton
                                          compact={true}
                                          label={
                                            gUrls[gIdx]?.trim()
                                              ? 'Replace Photo'
                                              : 'Upload Photo'
                                          }
                                          ariaLabel={`Upload Photo ${gIdx + 2} for ${prod.name} color ${variant.colorName}`}
                                          onUploaded={(url) =>
                                            handleCatalogVariantChange(
                                              prod,
                                              variant.colorName,
                                              (v) => {
                                                const nextGallery = [
                                                  ...(v.galleryUrls || [
                                                    '',
                                                    '',
                                                    '',
                                                  ]),
                                                ];
                                                while (nextGallery.length < 3) {
                                                  nextGallery.push('');
                                                }
                                                nextGallery[gIdx] = url;
                                                return {
                                                  ...v,
                                                  galleryUrls: nextGallery,
                                                };
                                              }
                                            )
                                          }
                                        />
                                        {Boolean(gUrls[gIdx]?.trim()) && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setImagePendingDelete({
                                                label: `${prod.name} (${variant.colorName} · Photo #${gIdx + 2})`,
                                                imageUrl: gUrls[gIdx],
                                                onConfirm: () =>
                                                  handleCatalogVariantChange(
                                                    prod,
                                                    variant.colorName,
                                                    (v) => {
                                                      const nextGallery = [
                                                        ...(v.galleryUrls || [
                                                          '',
                                                          '',
                                                          '',
                                                        ]),
                                                      ];
                                                      while (
                                                        nextGallery.length < 3
                                                      ) {
                                                        nextGallery.push('');
                                                      }
                                                      nextGallery[gIdx] = '';
                                                      return {
                                                        ...v,
                                                        galleryUrls: nextGallery,
                                                      };
                                                    }
                                                  ),
                                              })
                                            }
                                            aria-label={`Delete Photo ${gIdx + 2} for ${prod.name} color ${variant.colorName}`}
                                            title="Delete this image"
                                            className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            <span>Delete</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* 4 Size Type Buttons for this Color */}
                              <div className="space-y-2">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-800">
                                  Size Type for {variant.colorName} (Choose
                                  Letter, Number, Months, or Years):
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                  {(
                                    [
                                      {
                                        id: 'letter',
                                        label: '1. Letter (XS–XL)',
                                      },
                                      {
                                        id: 'numeric',
                                        label: '2. Number (36, 38...)',
                                      },
                                      {
                                        id: 'months',
                                        label: '3. Months (Baby)',
                                      },
                                      {
                                        id: 'years',
                                        label: '4. Years (Kids)',
                                      },
                                    ] as { id: SizeType; label: string }[]
                                  ).map((st) => (
                                    <button
                                      key={st.id}
                                      type="button"
                                      onClick={() => {
                                        const nextSizes =
                                          getPresetsForSizeType(st.id);
                                        handleCatalogVariantChange(
                                          prod,
                                          variant.colorName,
                                          (v) => ({
                                            ...v,
                                            sizeType: st.id,
                                            sizes: nextSizes,
                                            sizeQuantities:
                                              buildSizeQuantitiesMap(
                                                nextSizes,
                                                {}
                                              ),
                                          })
                                        );
                                      }}
                                      className={`py-1.5 px-2 text-[10px] font-bold uppercase border cursor-pointer ${
                                        variant.sizeType === st.id
                                          ? 'bg-zinc-950 text-white border-zinc-950'
                                          : 'bg-white text-zinc-700 border-zinc-300'
                                      }`}
                                    >
                                      {st.label}
                                    </button>
                                  ))}
                                </div>

                                {/* Preset Sizes Toggle */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {presetList.map((presetSz) => {
                                    const active =
                                      variant.sizes.includes(presetSz);
                                    return (
                                      <button
                                        key={presetSz}
                                        type="button"
                                        onClick={() =>
                                          handleCatalogVariantChange(
                                            prod,
                                            variant.colorName,
                                            (v) => {
                                              const nextSizes = active
                                                ? v.sizes.filter(
                                                    (s) => s !== presetSz
                                                  )
                                                : [...v.sizes, presetSz];
                                              return {
                                                ...v,
                                                sizes: nextSizes,
                                                sizeQuantities:
                                                  buildSizeQuantitiesMap(
                                                    nextSizes,
                                                    v.sizeQuantities
                                                  ),
                                              };
                                            }
                                          )
                                        }
                                        className={`px-2 py-1 text-[10px] font-mono-tabular font-semibold border flex items-center gap-1 cursor-pointer ${
                                          active
                                            ? 'bg-zinc-950 text-white border-zinc-950'
                                            : 'bg-white text-zinc-700 border-zinc-300'
                                        }`}
                                      >
                                        {active && (
                                          <Check className="w-2.5 h-2.5" />
                                        )}
                                        <span>{presetSz}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Per-Size Stock (Writable Input + Minus/Plus) & Custom Size Input */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {variant.sizes.map((sz) => {
                                  const q = variant.sizeQuantities?.[sz] ?? 5;
                                  const isZero = q <= 0;
                                  return (
                                    <div
                                      key={sz}
                                      className={`flex items-center border px-1.5 py-0.5 text-[10px] font-mono-tabular ${
                                        isZero
                                          ? 'border-red-300 bg-red-50/50 text-zinc-400'
                                          : 'border-zinc-300 bg-zinc-50 text-zinc-950'
                                      }`}
                                    >
                                      <span className="px-1 font-bold">
                                        {sz}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCatalogVariantChange(
                                            prod,
                                            variant.colorName,
                                            (v) => ({
                                              ...v,
                                              sizeQuantities: {
                                                ...v.sizeQuantities,
                                                [sz]: Math.max(0, q - 1),
                                              },
                                            })
                                          )
                                        }
                                        aria-label={`Decrease quantity for ${prod.name} (${variant.colorName}) size ${sz}`}
                                        className="p-0.5 hover:bg-zinc-200 cursor-pointer"
                                      >
                                        <Minus className="w-2.5 h-2.5" />
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        value={q}
                                        aria-label={`Quantity for ${prod.name} (${variant.colorName}) size ${sz}`}
                                        onChange={(e) => {
                                          const rawVal = e.target.value;
                                          const parsed =
                                            rawVal === ''
                                              ? 0
                                              : Math.max(
                                                  0,
                                                  Math.floor(
                                                    Number(rawVal) || 0
                                                  )
                                                );
                                          handleCatalogVariantChange(
                                            prod,
                                            variant.colorName,
                                            (v) => ({
                                              ...v,
                                              sizeQuantities: {
                                                ...v.sizeQuantities,
                                                [sz]: parsed,
                                              },
                                            })
                                          );
                                        }}
                                        className="w-12 px-1 py-0.5 text-center font-mono-tabular font-bold bg-white border border-zinc-300 text-zinc-950 focus:border-zinc-950 focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCatalogVariantChange(
                                            prod,
                                            variant.colorName,
                                            (v) => ({
                                              ...v,
                                              sizeQuantities: {
                                                ...v.sizeQuantities,
                                                [sz]: q + 1,
                                              },
                                            })
                                          )
                                        }
                                        aria-label={`Increase quantity for ${prod.name} (${variant.colorName}) size ${sz}`}
                                        className="p-0.5 hover:bg-zinc-200 cursor-pointer"
                                      >
                                        <Plus className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  );
                                })}

                                <div className="flex items-center gap-1.5 w-full sm:w-auto pt-1 sm:pt-0">
                                  <input
                                    type="text"
                                    value={
                                      catalogCustomSizeInputs[sizeInputKey] ||
                                      ''
                                    }
                                    onChange={(e) =>
                                      setCatalogCustomSizeInputs((prev) => ({
                                        ...prev,
                                        [sizeInputKey]: e.target.value,
                                      }))
                                    }
                                    placeholder={
                                      variant.sizeType === 'months'
                                        ? 'Custom Months (e.g. 0-3 Months)'
                                        : variant.sizeType === 'years'
                                        ? 'Custom Years (e.g. 10-11 Years)'
                                        : 'Custom size (e.g. 36, XXL)'
                                    }
                                    className="flex-1 sm:w-44 min-w-0 px-2 py-1 text-[10px] border border-zinc-300"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const rawSz = (
                                        catalogCustomSizeInputs[sizeInputKey] ||
                                        ''
                                      ).trim();
                                      if (!rawSz) return;
                                      const normalized = normalizeSizeEntry(
                                        rawSz,
                                        variant.sizeType
                                      );
                                      if (!normalized) return;
                                      registerCustomSizePreset(
                                        variant.sizeType,
                                        normalized
                                      );
                                      handleCatalogVariantChange(
                                        prod,
                                        variant.colorName,
                                        (v) => ({
                                          ...v,
                                          sizes: v.sizes.includes(normalized)
                                            ? v.sizes
                                            : [...v.sizes, normalized],
                                          sizeQuantities: {
                                            ...v.sizeQuantities,
                                            [normalized]:
                                              v.sizeQuantities?.[normalized] ??
                                              5,
                                          },
                                        })
                                      );
                                      setCatalogCustomSizeInputs((prev) => ({
                                        ...prev,
                                        [sizeInputKey]: '',
                                      }));
                                    }}
                                    className="px-2.5 py-1 bg-zinc-900 text-white text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    + Add Size
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                      <span className="block font-bold uppercase tracking-wider text-zinc-800">
                        Size Type, Sizes &amp; Per-Size Stock Controls (
                        {prod.sizeType}):
                      </span>

                      {/* 4 Size Type Buttons for Single-Color Product */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {(
                          [
                            { id: 'letter', label: '1. Letter (XS–XL)' },
                            { id: 'numeric', label: '2. Number (36, 38...)' },
                            { id: 'months', label: '3. Months (Baby)' },
                            { id: 'years', label: '4. Years (Kids)' },
                          ] as { id: SizeType; label: string }[]
                        ).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              const nextSizes = getPresetsForSizeType(st.id);
                              onUpdateProductMeta(prod.id, {
                                sizeType: st.id,
                                sizes: nextSizes,
                                sizeQuantities: buildSizeQuantitiesMap(
                                  nextSizes,
                                  {}
                                ),
                              });
                            }}
                            className={`py-1.5 px-2 text-[10px] font-bold uppercase border cursor-pointer ${
                              prod.sizeType === st.id
                                ? 'bg-zinc-950 text-white border-zinc-950'
                                : 'bg-white text-zinc-700 border-zinc-300'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>

                      {/* Preset Sizes Toggle for Single-Color Product */}
                      <div className="flex flex-wrap gap-1.5">
                        {getPresetsForSizeType(prod.sizeType).map(
                          (presetSz) => {
                            const active = prod.sizes.includes(presetSz);
                            return (
                              <button
                                key={presetSz}
                                type="button"
                                onClick={() => {
                                  const nextSizes = active
                                    ? prod.sizes.filter((s) => s !== presetSz)
                                    : [...prod.sizes, presetSz];
                                  if (nextSizes.length === 0) return;
                                  onUpdateProductMeta(prod.id, {
                                    sizes: nextSizes,
                                    sizeQuantities: buildSizeQuantitiesMap(
                                      nextSizes,
                                      prod.sizeQuantities
                                    ),
                                  });
                                }}
                                className={`px-2 py-1 text-[10px] font-mono-tabular font-semibold border flex items-center gap-1 cursor-pointer ${
                                  active
                                    ? 'bg-zinc-950 text-white border-zinc-950'
                                    : 'bg-white text-zinc-700 border-zinc-300'
                                }`}
                              >
                                {active && <Check className="w-2.5 h-2.5" />}
                                <span>{presetSz}</span>
                              </button>
                            );
                          }
                        )}
                      </div>

                      {/* Per-Size Quantity Adjusters (Writable Input + Minus/Plus) + Custom Size Input */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {prod.sizes.map((sz) => {
                          const szQty = getSizeQuantity(prod, sz);
                          const isZero = szQty <= 0;
                          return (
                            <div
                              key={sz}
                              className={`flex items-center border px-2 py-1 text-xs font-mono-tabular ${
                                isZero
                                  ? 'border-red-300 bg-red-50/50 text-zinc-400'
                                  : 'border-zinc-300 bg-white text-zinc-950'
                              }`}
                            >
                              <span className="px-1 font-bold">{sz}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateProductSizeQuantity(
                                    prod.id,
                                    sz,
                                    Math.max(0, szQty - 1)
                                  )
                                }
                                aria-label={`Decrease quantity for ${prod.name} size ${sz}`}
                                className="p-1 text-zinc-700 hover:bg-zinc-200 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={szQty}
                                aria-label={`Quantity for ${prod.name} size ${sz}`}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  const parsed =
                                    rawVal === ''
                                      ? 0
                                      : Math.max(
                                          0,
                                          Math.floor(Number(rawVal) || 0)
                                        );
                                  onUpdateProductSizeQuantity(
                                    prod.id,
                                    sz,
                                    parsed
                                  );
                                }}
                                className="w-14 px-1 py-0.5 text-center font-mono-tabular font-bold bg-zinc-50 border border-zinc-300 text-zinc-950 focus:border-zinc-950 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateProductSizeQuantity(
                                    prod.id,
                                    sz,
                                    szQty + 1
                                  )
                                }
                                aria-label={`Increase quantity for ${prod.name} size ${sz}`}
                                className="p-1 text-zinc-700 hover:bg-zinc-200 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}

                        <div className="flex items-center gap-1.5 w-full sm:w-auto pt-1 sm:pt-0">
                          <input
                            type="text"
                            value={editProdCustomSizeInput}
                            onChange={(e) =>
                              setEditProdCustomSizeInput(e.target.value)
                            }
                            placeholder={
                              prod.sizeType === 'months'
                                ? 'Custom Months (e.g. 0-3 Months)'
                                : prod.sizeType === 'years'
                                ? 'Custom Years (e.g. 10-11 Years)'
                                : 'Custom size (e.g. 36, XXL)'
                            }
                            className="flex-1 sm:w-44 min-w-0 px-2 py-1 text-[10px] bg-white border border-zinc-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const rawSz = editProdCustomSizeInput.trim();
                              if (!rawSz) return;
                              const normalized = normalizeSizeEntry(
                                rawSz,
                                prod.sizeType
                              );
                              if (!normalized) return;
                              registerCustomSizePreset(
                                prod.sizeType,
                                normalized
                              );
                              const nextSizes = prod.sizes.includes(normalized)
                                ? prod.sizes
                                : [...prod.sizes, normalized];
                              onUpdateProductMeta(prod.id, {
                                sizes: nextSizes,
                                sizeQuantities: {
                                  ...prod.sizeQuantities,
                                  [normalized]:
                                    prod.sizeQuantities?.[normalized] ?? 5,
                                },
                              });
                              setEditProdCustomSizeInput('');
                            }}
                            className="px-2.5 py-1 bg-zinc-900 text-white text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap shrink-0"
                          >
                            + Add Size
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Discount Editor */}
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-wrap items-center gap-3">
                    <span className="font-bold uppercase tracking-wider text-zinc-800">
                      Item Discount:
                    </span>
                    <select
                      value={prod.discountType || 'none'}
                      onChange={(e) =>
                        onUpdateProductMeta(prod.id, {
                          discountType: e.target.value as DiscountType,
                          discountValue:
                            e.target.value === 'none'
                              ? 0
                              : prod.discountValue || 10,
                        })
                      }
                      className="px-2.5 py-1.5 border border-zinc-300 bg-white text-xs"
                    >
                      <option value="none">No Discount</option>
                      <option value="percentage">Percentage (% Off)</option>
                      <option value="fixed">Dollar Amount ($ Off)</option>
                    </select>
                    {prod.discountType && prod.discountType !== 'none' && (
                      <input
                        type="number"
                        min="0"
                        value={prod.discountValue ?? 0}
                        onChange={(e) =>
                          onUpdateProductMeta(prod.id, {
                            discountValue: Math.max(
                              0,
                              Number(e.target.value) || 0
                            ),
                          })
                        }
                        className="w-24 px-2.5 py-1.5 border border-zinc-300 bg-white font-mono-tabular text-xs"
                      />
                    )}
                  </div>

                  {/* Up to 4 Product Image URLs Editor (with Replace & Delete Image) */}
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5">
                    <div className="font-bold uppercase tracking-wider text-zinc-800">
                      Product Image URLs (Up to 4 Angles — Upload, Replace, or
                      Delete Any Image):
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                        <input
                          type="text"
                          value={prod.imageUrl || ''}
                          onChange={(e) =>
                            onUpdateProductMeta(prod.id, {
                              imageUrl: e.target.value,
                            })
                          }
                          placeholder="1. Primary Image URL"
                          className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                        />
                        <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                          <R2ImageUploadButton
                            compact={true}
                            label={
                              prod.imageUrl?.trim()
                                ? 'Replace Photo'
                                : 'Upload Photo'
                            }
                            ariaLabel={`Upload Primary Photo for ${prod.name}`}
                            onUploaded={(url) =>
                              onUpdateProductMeta(prod.id, { imageUrl: url })
                            }
                          />
                          {Boolean(prod.imageUrl?.trim()) && (
                            <button
                              type="button"
                              onClick={() =>
                                setImagePendingDelete({
                                  label: `${prod.name} (Primary Image #1)`,
                                  imageUrl: prod.imageUrl,
                                  onConfirm: () =>
                                    onUpdateProductMeta(prod.id, {
                                      imageUrl: '',
                                    }),
                                })
                              }
                              aria-label={`Delete Primary Photo for ${prod.name}`}
                              title="Delete this image"
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {[0, 1, 2].map((gIdx) => {
                        const currentGalleryUrl =
                          prod.galleryUrls?.[gIdx] || '';
                        return (
                          <div
                            key={gIdx}
                            className="flex flex-col sm:flex-row sm:items-start gap-1.5"
                          >
                            <input
                              type="text"
                              value={currentGalleryUrl}
                              onChange={(e) => {
                                const current = [
                                  prod.galleryUrls?.[0] || '',
                                  prod.galleryUrls?.[1] || '',
                                  prod.galleryUrls?.[2] || '',
                                ];
                                current[gIdx] = e.target.value;
                                onUpdateProductMeta(prod.id, {
                                  galleryUrls: current.filter((u) =>
                                    Boolean(u.trim())
                                  ),
                                });
                              }}
                              placeholder={`${gIdx + 2}. Image URL #${
                                gIdx + 2
                              } (Optional)`}
                              className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                            />
                            <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                              <R2ImageUploadButton
                                compact={true}
                                label={
                                  currentGalleryUrl.trim()
                                    ? 'Replace Photo'
                                    : 'Upload Photo'
                                }
                                ariaLabel={`Upload Photo #${gIdx + 2} for ${
                                  prod.name
                                }`}
                                onUploaded={(url) => {
                                  const current = [
                                    prod.galleryUrls?.[0] || '',
                                    prod.galleryUrls?.[1] || '',
                                    prod.galleryUrls?.[2] || '',
                                  ];
                                  current[gIdx] = url;
                                  onUpdateProductMeta(prod.id, {
                                    galleryUrls: current.filter((u) =>
                                      Boolean(u.trim())
                                    ),
                                  });
                                }}
                              />
                              {Boolean(currentGalleryUrl.trim()) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImagePendingDelete({
                                      label: `${prod.name} (Image #${gIdx + 2})`,
                                      imageUrl: currentGalleryUrl,
                                      onConfirm: () => {
                                        const current = [
                                          prod.galleryUrls?.[0] || '',
                                          prod.galleryUrls?.[1] || '',
                                          prod.galleryUrls?.[2] || '',
                                        ];
                                        current[gIdx] = '';
                                        onUpdateProductMeta(prod.id, {
                                          galleryUrls: current.filter((u) =>
                                            Boolean(u.trim())
                                          ),
                                        });
                                      },
                                    })
                                  }
                                  aria-label={`Delete Photo #${gIdx + 2} for ${
                                    prod.name
                                  }`}
                                  title="Delete this image"
                                  className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-200">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProductId(null);
                        setProductPendingDelete(prod);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Item</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setItemFeedback(
                          `✓ Saved product "${prod.name}" (${prod.department.toUpperCase()} / ${prod.category}${
                            prod.isNewArrival ? ' · In New Arrivals' : ''
                          }).`
                        );
                        setEditingProductId(null);
                      }}
                      className="px-5 sm:px-6 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Product</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =========================================================================
          POP-UP MODAL 4: ADD NEW PRODUCT MODAL (Opened via "+ Add Product")
         ========================================================================= */}
      {isAddProductModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-product-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white text-zinc-950 border border-zinc-300 rounded-2xl max-w-3xl w-full p-3.5 sm:p-7 space-y-5 shadow-2xl my-auto max-h-[92vh] overflow-y-auto overflow-x-hidden">
            <div className="flex items-start justify-between gap-2 border-b border-zinc-200 pb-3 sticky top-0 bg-white z-10">
              <div className="min-w-0">
                <h2
                  id="add-product-modal-title"
                  className="font-display text-base sm:text-lg font-extrabold uppercase tracking-[0.08em] text-zinc-950"
                >
                  Add New Product Item
                </h2>
                <p className="text-xs text-zinc-500">
                  Configure product details, discounts, 4:5 photos, colors, and
                  per-size stock.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProductModalOpen(false)}
                aria-label="Close Add Product Modal"
                className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-900 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="E.g. HOURGLASS SUEDE BIKER JACKET"
                    className="w-full px-3 py-2 text-xs border border-zinc-300 focus:border-zinc-950 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-900 mb-1">
                    Price (USD) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-zinc-300 focus:border-zinc-950 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-900 mb-1">
                      Item Discount Type ($ or %)
                    </label>
                    <select
                      value={itemDiscountType}
                      onChange={(e) =>
                        setItemDiscountType(e.target.value as DiscountType)
                      }
                      aria-label="Item discount type"
                      className="w-full px-3 py-2 text-xs border border-zinc-300 bg-white"
                    >
                      <option value="none">No Discount</option>
                      <option value="percentage">
                        Percentage Discount (%)
                      </option>
                      <option value="fixed">Dollar Amount Discount ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-900 mb-1">
                      Discount Amount (
                      {itemDiscountType === 'percentage' ? '%' : '$'})
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={itemDiscountType === 'none'}
                      value={itemDiscountValue}
                      onChange={(e) => setItemDiscountValue(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono-tabular border border-zinc-300 bg-white disabled:bg-zinc-100"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={itemIsNewArrival}
                      onChange={(e) => setItemIsNewArrival(e.target.checked)}
                      className="w-4 h-4 accent-zinc-950 cursor-pointer"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-950">
                      Show in New Arrivals (/new-arrivals)
                    </span>
                  </label>
                  <p className="text-[11px] text-zinc-500 mt-0.5 pl-6">
                    Keep checked to showcase this item in New Arrivals in addition to its selected Category ({itemCategory}).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-900 mb-1">
                    Department *
                  </label>
                  <select
                    value={itemDept}
                    onChange={(e) => {
                      const nextDept = e.target.value as Department;
                      setItemDept(nextDept);
                      if (nextDept === 'kids') {
                        setItemIsFullSet(false);
                        setLinkTwoSetPieces(false);
                      }
                      const firstCat = getCategoriesByDepartment(
                        categories,
                        nextDept
                      )[0];
                      if (firstCat) setItemCategory(firstCat.name);
                      if (nextDept === 'kids') {
                        handleSizeTypeChange(
                          firstCat?.name.toLowerCase().includes('1 to 5')
                            ? 'months'
                            : 'years'
                        );
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 bg-white uppercase"
                  >
                    <option value="women">Women</option>
                    <option value="kids">Kids</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-900 mb-1">
                    Category *
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItemCategory(val);
                      const isFS = val.trim().toLowerCase() === 'full set';
                      setItemIsFullSet(isFS);
                      if (isFS && allStandaloneProducts.length > 0) {
                        const defaultP1 =
                          products.find((p) => p.id === setPiece1ProductId) ||
                          allStandaloneProducts[0];
                        const defaultP2 =
                          products.find((p) => p.id === setPiece2ProductId) ||
                          allStandaloneProducts[1] ||
                          allStandaloneProducts[0];
                        if (defaultP1 && !setPiece1ProductId) {
                          handleSelectSetPieceProduct(1, defaultP1.id);
                        }
                        if (defaultP2 && !setPiece2ProductId) {
                          handleSelectSetPieceProduct(2, defaultP2.id);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 bg-white"
                  >
                    {deptCategories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-900 mb-1">
                    Aesthetic Style
                  </label>
                  <select
                    value={itemStyle}
                    onChange={(e) => setItemStyle(e.target.value as StyleType)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 bg-white"
                  >
                    <option value="Classic">Classic</option>
                    <option value="Sport Chic">Sport Chic</option>
                    <option value="Fine Leather">Fine Leather</option>
                    <option value="Suede">Suede</option>
                    <option value="Fur">Fur</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>
              </div>

              {/* UP TO 4 PRODUCT IMAGE URLS */}
              <div className="p-3 sm:p-3.5 bg-zinc-50 border border-zinc-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-900">
                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Product Image URLs (Add 1 up to 4 Image URLs)</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    4:5 Ratio · Smart Image Optimization
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-0.5">
                      1. Primary Image URL
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                      <input
                        type="text"
                        value={itemUrl}
                        onChange={(e) => setItemUrl(e.target.value)}
                        placeholder="https://... (Main Front View)"
                        aria-label="Primary Product Image URL 1"
                        className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                      />
                      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                        <R2ImageUploadButton
                          label={
                            itemUrl.trim() ? 'Replace Photo' : 'Upload Photo'
                          }
                          ariaLabel="Upload Photo for Primary Image URL 1"
                          onUploaded={(url) => setItemUrl(url)}
                        />
                        {Boolean(itemUrl.trim()) && (
                          <button
                            type="button"
                            onClick={() =>
                              setImagePendingDelete({
                                label: 'New Item Primary Image #1',
                                imageUrl: itemUrl,
                                onConfirm: () => setItemUrl(''),
                              })
                            }
                            aria-label="Delete Primary Image URL 1"
                            title="Delete this image"
                            className="px-2.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-0.5">
                      2. Image URL #2 (Optional)
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                      <input
                        type="text"
                        value={itemUrl2}
                        onChange={(e) => setItemUrl2(e.target.value)}
                        placeholder="https://... (Second Angle / Detail)"
                        aria-label="Product Image URL 2"
                        className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                      />
                      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                        <R2ImageUploadButton
                          label={
                            itemUrl2.trim() ? 'Replace Photo' : 'Upload Photo'
                          }
                          ariaLabel="Upload Photo for Image URL 2"
                          onUploaded={(url) => setItemUrl2(url)}
                        />
                        {Boolean(itemUrl2.trim()) && (
                          <button
                            type="button"
                            onClick={() =>
                              setImagePendingDelete({
                                label: 'New Item Image #2',
                                imageUrl: itemUrl2,
                                onConfirm: () => setItemUrl2(''),
                              })
                            }
                            aria-label="Delete Image URL 2"
                            title="Delete this image"
                            className="px-2.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-0.5">
                      3. Image URL #3 (Optional)
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                      <input
                        type="text"
                        value={itemUrl3}
                        onChange={(e) => setItemUrl3(e.target.value)}
                        placeholder="https://... (Third Angle / Back)"
                        aria-label="Product Image URL 3"
                        className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                      />
                      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                        <R2ImageUploadButton
                          label={
                            itemUrl3.trim() ? 'Replace Photo' : 'Upload Photo'
                          }
                          ariaLabel="Upload Photo for Image URL 3"
                          onUploaded={(url) => setItemUrl3(url)}
                        />
                        {Boolean(itemUrl3.trim()) && (
                          <button
                            type="button"
                            onClick={() =>
                              setImagePendingDelete({
                                label: 'New Item Image #3',
                                imageUrl: itemUrl3,
                                onConfirm: () => setItemUrl3(''),
                              })
                            }
                            aria-label="Delete Image URL 3"
                            title="Delete this image"
                            className="px-2.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-0.5">
                      4. Image URL #4 (Optional)
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                      <input
                        type="text"
                        value={itemUrl4}
                        onChange={(e) => setItemUrl4(e.target.value)}
                        placeholder="https://... (Fourth Angle / Lookbook)"
                        aria-label="Product Image URL 4"
                        className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                      />
                      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                        <R2ImageUploadButton
                          label={
                            itemUrl4.trim() ? 'Replace Photo' : 'Upload Photo'
                          }
                          ariaLabel="Upload Photo for Image URL 4"
                          onUploaded={(url) => setItemUrl4(url)}
                        />
                        {Boolean(itemUrl4.trim()) && (
                          <button
                            type="button"
                            onClick={() =>
                              setImagePendingDelete({
                                label: 'New Item Image #4',
                                imageUrl: itemUrl4,
                                onConfirm: () => setItemUrl4(''),
                              })
                            }
                            aria-label="Delete Image URL 4"
                            title="Delete this image"
                            className="px-2.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2-PIECE WOMEN FULL SET ITEM & COLOR SELECTOR */}
              {isFullSetCategorySelected && (
                <div
                  data-testid="full-set-builder-section"
                  className="p-4 bg-zinc-50 border-2 border-zinc-950 space-y-4"
                >
                  <div className="border-b border-zinc-200 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-zinc-950">
                      <Layers className="w-4 h-4" />
                      <span>
                        2-Piece Full Set Configuration (Select Shirt/Top &amp;
                        Trousers/Bottom from Women Categories)
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Select a Women category first, then choose the specific
                      product in that category. Size types, sizes, colors,
                      materials, and live inventory are automatically inherited
                      from the two selected store products below. When a customer
                      purchases this Full Set, stock is deducted from each linked
                      product in its original category.
                    </p>
                  </div>

                  {/* PIECE 1 SELECTOR (e.g. Shirt / Top / Jacket) */}
                  {(() => {
                    const p1Pool =
                      womenStandaloneProducts.length > 0
                        ? womenStandaloneProducts
                        : allStandaloneProducts;
                    const effectiveP1Cat =
                      setPiece1Category ||
                      products.find((p) => p.id === setPiece1ProductId)
                        ?.category ||
                      womenCategories[0]?.name ||
                      p1Pool[0]?.category ||
                      '';
                    const p1ProductsForCat = p1Pool.filter(
                      (p) =>
                        p.category.trim().toLowerCase() ===
                        effectiveP1Cat.trim().toLowerCase()
                    );
                    const p1Id =
                      setPiece1ProductId &&
                      p1ProductsForCat.some((p) => p.id === setPiece1ProductId)
                        ? setPiece1ProductId
                        : p1ProductsForCat[0]?.id || p1Pool[0]?.id || '';
                    const prod1 = products.find((p) => p.id === p1Id);
                    const p1HasColors =
                      Boolean(prod1?.hasColors) &&
                      Array.isArray(prod1?.colorVariants) &&
                      prod1!.colorVariants!.length > 0;
                    const activeP1Colors = p1HasColors
                      ? setPiece1Colors.length > 0
                        ? setPiece1Colors
                        : [prod1!.colorVariants![0].colorName]
                      : [];

                    return (
                      <div className="p-3.5 bg-white border border-zinc-300 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-950">
                            1. Select First Item (e.g. Shirt / Top / Jacket)
                          </span>
                          {prod1 && (
                            <span className="text-[10px] font-mono-tabular uppercase text-zinc-500">
                              Category: {prod1.category} · Sizes:{' '}
                              {prod1.sizes.join(', ')}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                              Choose Category (Women Only) *
                            </label>
                            <select
                              aria-label="Select Full Set Piece 1 Category"
                              value={effectiveP1Cat}
                              onChange={(e) => {
                                const newCat = e.target.value;
                                setSetPiece1Category(newCat);
                                const matchingProds = p1Pool.filter(
                                  (p) =>
                                    p.category.trim().toLowerCase() ===
                                    newCat.trim().toLowerCase()
                                );
                                if (matchingProds.length > 0) {
                                  handleSelectSetPieceProduct(
                                    1,
                                    matchingProds[0].id
                                  );
                                }
                              }}
                              className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-300"
                            >
                              {womenCategories.map((wc) => (
                                <option key={wc.id} value={wc.name}>
                                  {wc.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                              Choose Product in Category *
                            </label>
                            <select
                              aria-label="Select Full Set Piece 1 Product"
                              value={p1Id}
                              onChange={(e) =>
                                handleSelectSetPieceProduct(1, e.target.value)
                              }
                              className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-300"
                            >
                              {p1ProductsForCat.length > 0 ? (
                                p1ProductsForCat.map((sp) => (
                                  <option key={sp.id} value={sp.id}>
                                    {sp.name} (${sp.price})
                                  </option>
                                ))
                              ) : (
                                <option value="">
                                  No products in this category
                                </option>
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                              Piece 1 Label on Website (e.g. Shirt / Top)
                            </label>
                            <input
                              type="text"
                              value={setPiece1Label}
                              onChange={(e) =>
                                setSetPiece1Label(e.target.value)
                              }
                              placeholder="e.g. Shirt / Top / Jacket"
                              className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-300"
                            />
                          </div>
                        </div>

                        {p1HasColors && prod1?.colorVariants && (
                          <div className="p-3 bg-zinc-50 border border-zinc-200 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">
                                Select Colors of &ldquo;{prod1.name}&rdquo; to
                                Appear in Full Set (Defaults to 1st color if
                                none selected):
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSetPiece1Colors(
                                    prod1.colorVariants!.map((v) => v.colorName)
                                  )
                                }
                                className="px-2.5 py-1 bg-zinc-900 text-white text-[10px] font-bold uppercase cursor-pointer"
                              >
                                Select All Colors
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {prod1.colorVariants.map((cv) => {
                                const isSelected = activeP1Colors.some(
                                  (c) =>
                                    c.trim().toLowerCase() ===
                                    cv.colorName.trim().toLowerCase()
                                );
                                return (
                                  <button
                                    key={cv.colorName}
                                    type="button"
                                    onClick={() => {
                                      const exists = activeP1Colors.some(
                                        (c) =>
                                          c.trim().toLowerCase() ===
                                          cv.colorName.trim().toLowerCase()
                                      );
                                      const next = exists
                                        ? activeP1Colors.filter(
                                            (c) =>
                                              c.trim().toLowerCase() !==
                                              cv.colorName.trim().toLowerCase()
                                          )
                                        : [...activeP1Colors, cv.colorName];
                                      setSetPiece1Colors(
                                        next.length > 0
                                          ? next
                                          : [prod1.colorVariants![0].colorName]
                                      );
                                    }}
                                    className={`px-2.5 py-1 text-[10px] font-bold uppercase border flex items-center gap-1.5 cursor-pointer ${
                                      isSelected
                                        ? 'bg-zinc-950 text-white border-zinc-950'
                                        : 'bg-white text-zinc-700 border-zinc-300'
                                    }`}
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-zinc-400 shrink-0"
                                      style={{
                                        backgroundColor:
                                          cv.colorHex ||
                                          getColorSwatchHex(cv.colorName),
                                      }}
                                    />
                                    <span>{cv.colorName}</span>
                                    {isSelected && (
                                      <Check className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* PIECE 2 SELECTOR (e.g. Trousers / Pants / Skirt) */}
                  {(() => {
                    const p2Pool =
                      womenStandaloneProducts.length > 0
                        ? womenStandaloneProducts
                        : allStandaloneProducts;
                    const effectiveP2Cat =
                      setPiece2Category ||
                      products.find((p) => p.id === setPiece2ProductId)
                        ?.category ||
                      womenCategories[1]?.name ||
                      womenCategories[0]?.name ||
                      p2Pool[0]?.category ||
                      '';
                    const p2ProductsForCat = p2Pool.filter(
                      (p) =>
                        p.category.trim().toLowerCase() ===
                        effectiveP2Cat.trim().toLowerCase()
                    );
                    const p2Id =
                      setPiece2ProductId &&
                      p2ProductsForCat.some((p) => p.id === setPiece2ProductId)
                        ? setPiece2ProductId
                        : p2ProductsForCat[0]?.id ||
                          p2Pool[1]?.id ||
                          p2Pool[0]?.id ||
                          '';
                    const prod2 = products.find((p) => p.id === p2Id);
                    const p2HasColors =
                      Boolean(prod2?.hasColors) &&
                      Array.isArray(prod2?.colorVariants) &&
                      prod2!.colorVariants!.length > 0;
                    const activeP2Colors = p2HasColors
                      ? setPiece2Colors.length > 0
                        ? setPiece2Colors
                        : [prod2!.colorVariants![0].colorName]
                      : [];

                    return (
                      <div className="p-3.5 bg-white border border-zinc-300 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-950">
                            2. Select Second Item (e.g. Trousers / Pants /
                            Skirt)
                          </span>
                          {prod2 && (
                            <span className="text-[10px] font-mono-tabular uppercase text-zinc-500">
                              Category: {prod2.category} · Sizes:{' '}
                              {prod2.sizes.join(', ')}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                              Choose Category (Women Only) *
                            </label>
                            <select
                              aria-label="Select Full Set Piece 2 Category"
                              value={effectiveP2Cat}
                              onChange={(e) => {
                                const newCat = e.target.value;
                                setSetPiece2Category(newCat);
                                const matchingProds = p2Pool.filter(
                                  (p) =>
                                    p.category.trim().toLowerCase() ===
                                    newCat.trim().toLowerCase()
                                );
                                if (matchingProds.length > 0) {
                                  handleSelectSetPieceProduct(
                                    2,
                                    matchingProds[0].id
                                  );
                                }
                              }}
                              className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-300"
                            >
                              {womenCategories.map((wc) => (
                                <option key={wc.id} value={wc.name}>
                                  {wc.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                              Choose Product in Category *
                            </label>
                            <select
                              aria-label="Select Full Set Piece 2 Product"
                              value={p2Id}
                              onChange={(e) =>
                                handleSelectSetPieceProduct(2, e.target.value)
                              }
                              className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-300"
                            >
                              {p2ProductsForCat.length > 0 ? (
                                p2ProductsForCat.map((sp) => (
                                  <option key={sp.id} value={sp.id}>
                                    {sp.name} (${sp.price})
                                  </option>
                                ))
                              ) : (
                                <option value="">
                                  No products in this category
                                </option>
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 mb-1">
                              Piece 2 Label on Website (e.g. Trousers / Bottom)
                            </label>
                            <input
                              type="text"
                              value={setPiece2Label}
                              onChange={(e) =>
                                setSetPiece2Label(e.target.value)
                              }
                              placeholder="e.g. Trousers / Pants / Skirt"
                              className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-300"
                            />
                          </div>
                        </div>

                        {p2HasColors && prod2?.colorVariants && (
                          <div className="p-3 bg-zinc-50 border border-zinc-200 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">
                                Select Colors of &ldquo;{prod2.name}&rdquo; to
                                Appear in Full Set (Defaults to 1st color if
                                none selected):
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSetPiece2Colors(
                                    prod2.colorVariants!.map((v) => v.colorName)
                                  )
                                }
                                className="px-2.5 py-1 bg-zinc-900 text-white text-[10px] font-bold uppercase cursor-pointer"
                              >
                                Select All Colors
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {prod2.colorVariants.map((cv) => {
                                const isSelected = activeP2Colors.some(
                                  (c) =>
                                    c.trim().toLowerCase() ===
                                    cv.colorName.trim().toLowerCase()
                                );
                                return (
                                  <button
                                    key={cv.colorName}
                                    type="button"
                                    onClick={() => {
                                      const exists = activeP2Colors.some(
                                        (c) =>
                                          c.trim().toLowerCase() ===
                                          cv.colorName.trim().toLowerCase()
                                      );
                                      const next = exists
                                        ? activeP2Colors.filter(
                                            (c) =>
                                              c.trim().toLowerCase() !==
                                              cv.colorName.trim().toLowerCase()
                                          )
                                        : [...activeP2Colors, cv.colorName];
                                      setSetPiece2Colors(
                                        next.length > 0
                                          ? next
                                          : [prod2.colorVariants![0].colorName]
                                      );
                                    }}
                                    className={`px-2.5 py-1 text-[10px] font-bold uppercase border flex items-center gap-1.5 cursor-pointer ${
                                      isSelected
                                        ? 'bg-zinc-950 text-white border-zinc-950'
                                        : 'bg-white text-zinc-700 border-zinc-300'
                                    }`}
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-zinc-400 shrink-0"
                                      style={{
                                        backgroundColor:
                                          cv.colorHex ||
                                          getColorSwatchHex(cv.colorName),
                                      }}
                                    />
                                    <span>{cv.colorName}</span>
                                    {isSelected && (
                                      <Check className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* MULTI-COLOR TOGGLE & CONFIG (Hidden when Full Set is selected) */}
              {!isFullSetCategorySelected && (
                <div className="p-4 bg-zinc-50 border border-zinc-300 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={itemHasColors}
                        onChange={(e) => setItemHasColors(e.target.checked)}
                        className="w-4 h-4 accent-zinc-950 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-zinc-950">
                        <Palette className="w-4 h-4" />
                        <span>
                          Product Has Multiple Colors (Configure Sizes &amp;
                          Quantities Under Each Color)
                        </span>
                      </span>
                    </label>
                  </div>

                  {itemHasColors && (
                    <div className="space-y-4">
                      {/* Preset & Custom Color Swatch Selector */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {allColors.map((colName) => {
                          const existingDraft = draftColors.find(
                            (c) =>
                              c.colorName.toLowerCase() ===
                              colName.toLowerCase()
                          );
                          const checked = Boolean(existingDraft);
                          const hex =
                            existingDraft?.colorHex ||
                            customColorHexMap[colName.toLowerCase()] ||
                            getColorSwatchHex(colName);
                          return (
                            <button
                              key={colName}
                              type="button"
                              onClick={() => {
                                setItemHasColors(true);
                                toggleDraftColor(colName, hex);
                              }}
                              className={`px-2.5 py-2 text-xs font-medium border text-left flex items-center justify-between transition-colors cursor-pointer ${
                                checked
                                  ? 'bg-zinc-950 text-white border-zinc-950 font-bold'
                                  : 'bg-white text-zinc-800 border-zinc-300'
                              }`}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <span
                                  className="w-3.5 h-3.5 border border-zinc-400 shrink-0"
                                  style={{ backgroundColor: hex }}
                                />
                                <span className="truncate">{colName}</span>
                              </span>
                              {checked && <Check className="w-3 h-3" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* ADD NEW COLOR NAME, HEX CODE, OR PICK FROM COLOR PALETTE */}
                      <div className="p-3.5 bg-white border border-zinc-300 space-y-2.5">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-900">
                          Add New Color (Name, Hex Code, or Color Palette):
                        </span>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            value={newColorInput}
                            onChange={(e) => setNewColorInput(e.target.value)}
                            placeholder="Color Name (e.g. Emerald, Camel, Bordeaux)..."
                            aria-label="New custom color name"
                            className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                          />
                          <div className="flex items-center gap-1.5 justify-between sm:justify-start">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={
                                  /^#([0-9A-Fa-f]{6})$/.test(newColorHexInput)
                                    ? newColorHexInput
                                    : '#3D4F2F'
                                }
                                onChange={(e) =>
                                  setNewColorHexInput(e.target.value)
                                }
                                aria-label="Pick color from palette wheel"
                                title="Click to open Color Palette Picker"
                                className="w-8 h-8 p-0.5 bg-white border border-zinc-300 cursor-pointer shrink-0"
                              />
                              <input
                                type="text"
                                value={newColorHexInput}
                                onChange={(e) =>
                                  setNewColorHexInput(e.target.value)
                                }
                                placeholder="#HEX (e.g. #3D4F2F)"
                                aria-label="New custom color hex code"
                                className="w-28 px-2.5 py-1.5 text-xs font-mono-tabular bg-white border border-zinc-300"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddAndCheckCustomColor()}
                              className="px-3.5 py-1.5 bg-zinc-950 text-white text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-zinc-800 whitespace-nowrap shrink-0"
                            >
                              + Add Color
                            </button>
                          </div>
                        </div>

                        {/* Quick Clickable Color Palette Swatches */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold uppercase text-zinc-500 mr-1">
                            Color Palette:
                          </span>
                          {LUXURY_PALETTE_SWATCHES.map((sw) => (
                            <button
                              key={sw.hex}
                              type="button"
                              title={`${sw.name} (${sw.hex})`}
                              onClick={() => {
                                if (!newColorInput.trim()) {
                                  setNewColorInput(sw.name);
                                }
                                setNewColorHexInput(sw.hex);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 cursor-pointer"
                            >
                              <span
                                className="w-3 h-3 border border-zinc-400 shrink-0"
                                style={{ backgroundColor: sw.hex }}
                              />
                              <span className="text-zinc-800">{sw.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* CONFIGURE EACH SELECTED COLOR (4 Photos + 3 Size Types + Custom Size + Quantities) */}
                      {draftColors.map((dc, idx) => {
                        const hex =
                          dc.colorHex ||
                          customColorHexMap[dc.colorName.toLowerCase()] ||
                          getColorSwatchHex(dc.colorName);
                        const presetList = getPresetsForSizeType(dc.sizeType);
                        const gUrls = dc.galleryUrls || ['', '', ''];

                        return (
                          <div
                            key={dc.colorName}
                            className="p-4 bg-white border-2 border-zinc-950 space-y-4"
                          >
                            {/* Color Header & Swatch Hex Picker */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-200">
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={
                                    /^#([0-9A-Fa-f]{6})$/.test(hex)
                                      ? hex
                                      : '#09090B'
                                  }
                                  onChange={(e) => {
                                    const nextHex = e.target.value;
                                    setCustomColorHexMap((prev) => ({
                                      ...prev,
                                      [dc.colorName.toLowerCase()]: nextHex,
                                    }));
                                    updateDraftColorField(
                                      dc.colorName,
                                      (prev) => ({
                                        ...prev,
                                        colorHex: nextHex,
                                      })
                                    );
                                  }}
                                  title="Adjust color swatch hex"
                                  className="w-6 h-6 p-0.5 bg-white border border-zinc-400 cursor-pointer shrink-0"
                                />
                                <span className="text-xs font-extrabold uppercase text-zinc-950">
                                  {idx + 1}. {dc.colorName}
                                </span>
                                <span className="text-[10px] font-mono-tabular text-zinc-500">
                                  ({hex})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleDraftColor(dc.colorName)}
                                className="text-[10px] font-bold uppercase text-red-600 hover:underline cursor-pointer"
                              >
                                Remove Color
                              </button>
                            </div>

                            {/* 4 PHOTO UPLOAD SLOTS FOR THIS COLOR */}
                            <div className="p-3 bg-zinc-50 border border-zinc-200 space-y-2.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-900">
                                Upload Up to 4 Photos for {dc.colorName} (Photo
                                #1 appears on website card when customer clicks
                                this color; all 4 appear in item pop-up):
                              </div>

                              {/* Slot 1: Primary Color Image */}
                              <div>
                                <span className="block text-[10px] font-bold uppercase text-zinc-700 mb-0.5">
                                  1. Main Color Photo (Shown on Website Card &amp; First in Pop-up) *
                                </span>
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                                  <input
                                    type="text"
                                    value={dc.imageUrl}
                                    onChange={(e) =>
                                      updateDraftColorField(
                                        dc.colorName,
                                        (prev) => ({
                                          ...prev,
                                          imageUrl: e.target.value,
                                        })
                                      )
                                    }
                                    placeholder={`1st Image URL for ${dc.colorName} (Main Card Photo)`}
                                    className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                                  />
                                  <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                                    <R2ImageUploadButton
                                      compact={true}
                                      label={
                                        dc.imageUrl?.trim()
                                          ? 'Replace Photo'
                                          : 'Upload Photo'
                                      }
                                      ariaLabel={`Upload Photo 1 for color ${dc.colorName}`}
                                      onUploaded={(url) =>
                                        updateDraftColorField(
                                          dc.colorName,
                                          (prev) => ({
                                            ...prev,
                                            imageUrl: url,
                                          })
                                        )
                                      }
                                    />
                                    {Boolean(dc.imageUrl?.trim()) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setImagePendingDelete({
                                            label: `New Item (${dc.colorName} · Photo #1)`,
                                            imageUrl: dc.imageUrl,
                                            onConfirm: () =>
                                              updateDraftColorField(
                                                dc.colorName,
                                                (prev) => ({
                                                  ...prev,
                                                  imageUrl: '',
                                                })
                                              ),
                                          })
                                        }
                                        aria-label={`Delete Photo 1 for color ${dc.colorName}`}
                                        title="Delete this image"
                                        className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Delete</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Slots 2, 3, 4: Additional Pop-up Photos for this Color */}
                              {[0, 1, 2].map((gIdx) => (
                                <div key={gIdx}>
                                  <span className="block text-[10px] font-bold uppercase text-zinc-600 mb-0.5">
                                    {gIdx + 2}. Color Photo #{gIdx + 2} (Shown in Item Pop-up Gallery)
                                  </span>
                                  <div className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                                    <input
                                      type="text"
                                      value={gUrls[gIdx] || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        updateDraftColorField(
                                          dc.colorName,
                                          (prev) => {
                                            const nextG = [
                                              ...(prev.galleryUrls || [
                                                '',
                                                '',
                                                '',
                                              ]),
                                            ];
                                            while (nextG.length < 3) {
                                              nextG.push('');
                                            }
                                            nextG[gIdx] = val;
                                            return {
                                              ...prev,
                                              galleryUrls: nextG,
                                            };
                                          }
                                        );
                                      }}
                                      placeholder={`Photo #${gIdx + 2} URL for ${dc.colorName} (Optional)`}
                                      className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                                    />
                                    <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                                      <R2ImageUploadButton
                                        compact={true}
                                        label={
                                          gUrls[gIdx]?.trim()
                                            ? 'Replace Photo'
                                            : 'Upload Photo'
                                        }
                                        ariaLabel={`Upload Photo ${gIdx + 2} for color ${dc.colorName}`}
                                        onUploaded={(url) =>
                                          updateDraftColorField(
                                            dc.colorName,
                                            (prev) => {
                                              const nextG = [
                                                ...(prev.galleryUrls || [
                                                  '',
                                                  '',
                                                  '',
                                                ]),
                                              ];
                                              while (nextG.length < 3) {
                                                nextG.push('');
                                              }
                                              nextG[gIdx] = url;
                                              return {
                                                ...prev,
                                                galleryUrls: nextG,
                                              };
                                            }
                                          )
                                        }
                                      />
                                      {Boolean(gUrls[gIdx]?.trim()) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setImagePendingDelete({
                                              label: `New Item (${dc.colorName} · Photo #${gIdx + 2})`,
                                              imageUrl: gUrls[gIdx],
                                              onConfirm: () =>
                                                updateDraftColorField(
                                                  dc.colorName,
                                                  (prev) => {
                                                    const nextG = [
                                                      ...(prev.galleryUrls || [
                                                        '',
                                                        '',
                                                        '',
                                                      ]),
                                                    ];
                                                    while (nextG.length < 3) {
                                                      nextG.push('');
                                                    }
                                                    nextG[gIdx] = '';
                                                    return {
                                                      ...prev,
                                                      galleryUrls: nextG,
                                                    };
                                                  }
                                                ),
                                            })
                                          }
                                          aria-label={`Delete Photo ${gIdx + 2} for color ${dc.colorName}`}
                                          title="Delete this image"
                                          className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>Delete</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* 4 SIZE TYPE OPTIONS FOR THIS COLOR (Letter / Number / Months / Years) */}
                            <div className="space-y-2.5">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-900">
                                Size Type &amp; Sizes for {dc.colorName} (Choose
                                Letter, Number, Months, or Years):
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftColorField(
                                      dc.colorName,
                                      (prev) => ({
                                        ...prev,
                                        sizeType: 'letter',
                                        sizes: [...LETTER_SIZES],
                                        rawQuantities: {},
                                      })
                                    )
                                  }
                                  className={`py-2 px-2 text-[11px] font-bold uppercase border cursor-pointer ${
                                    dc.sizeType === 'letter'
                                      ? 'bg-zinc-950 text-white border-zinc-950'
                                      : 'bg-white text-zinc-700 border-zinc-300'
                                  }`}
                                >
                                  1. Letter (XS–XL)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftColorField(
                                      dc.colorName,
                                      (prev) => ({
                                        ...prev,
                                        sizeType: 'numeric',
                                        sizes: [...NUMERIC_SIZES],
                                        rawQuantities: {},
                                      })
                                    )
                                  }
                                  className={`py-2 px-2 text-[11px] font-bold uppercase border cursor-pointer ${
                                    dc.sizeType === 'numeric'
                                      ? 'bg-zinc-950 text-white border-zinc-950'
                                      : 'bg-white text-zinc-700 border-zinc-300'
                                  }`}
                                >
                                  2. Number (36, 38...)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftColorField(
                                      dc.colorName,
                                      (prev) => ({
                                        ...prev,
                                        sizeType: 'months',
                                        sizes: getPresetsForSizeType('months'),
                                        rawQuantities: {},
                                      })
                                    )
                                  }
                                  className={`py-2 px-2 text-[11px] font-bold uppercase border cursor-pointer ${
                                    dc.sizeType === 'months'
                                      ? 'bg-zinc-950 text-white border-zinc-950'
                                      : 'bg-white text-zinc-700 border-zinc-300'
                                  }`}
                                >
                                  3. Months (Baby)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftColorField(
                                      dc.colorName,
                                      (prev) => ({
                                        ...prev,
                                        sizeType: 'years',
                                        sizes: getPresetsForSizeType('years'),
                                        rawQuantities: {},
                                      })
                                    )
                                  }
                                  className={`py-2 px-2 text-[11px] font-bold uppercase border cursor-pointer ${
                                    dc.sizeType === 'years'
                                      ? 'bg-zinc-950 text-white border-zinc-950'
                                      : 'bg-white text-zinc-700 border-zinc-300'
                                  }`}
                                >
                                  4. Years (Kids)
                                </button>
                              </div>

                              {/* Preset Size Toggles */}
                              <div className="flex flex-wrap gap-1.5">
                                {presetList.map((presetSz) => {
                                  const active = dc.sizes.includes(presetSz);
                                  return (
                                    <button
                                      key={presetSz}
                                      type="button"
                                      onClick={() =>
                                        updateDraftColorField(
                                          dc.colorName,
                                          (prev) => {
                                            const nextSizes = active
                                              ? prev.sizes.filter(
                                                  (s) => s !== presetSz
                                                )
                                              : [...prev.sizes, presetSz];
                                            return {
                                              ...prev,
                                              sizes: nextSizes,
                                            };
                                          }
                                        )
                                      }
                                      className={`px-2.5 py-1 text-[11px] font-mono-tabular font-semibold border flex items-center gap-1 cursor-pointer ${
                                        active
                                          ? 'bg-zinc-950 text-white border-zinc-950'
                                          : 'bg-white text-zinc-700 border-zinc-300'
                                      }`}
                                    >
                                      {active && <Check className="w-3 h-3" />}
                                      <span>{presetSz}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Custom Size Input (e.g. 0-3 Months, 10-11 Years, 36, XXL) */}
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={dc.customSizeInput || ''}
                                  onChange={(e) =>
                                    updateDraftColorField(
                                      dc.colorName,
                                      (prev) => ({
                                        ...prev,
                                        customSizeInput: e.target.value,
                                      })
                                    )
                                  }
                                  placeholder={
                                    dc.sizeType === 'months'
                                      ? 'Add new Months size (e.g. 0-3 Months, 24-36 Months)'
                                      : dc.sizeType === 'years'
                                      ? 'Add new Years size (e.g. 10-11 Years, 12-13 Years)'
                                      : dc.sizeType === 'numeric'
                                      ? 'Add custom numeric size (e.g. 36, 46)'
                                      : 'Add custom size (e.g. XXL, One Size)'
                                  }
                                  className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const raw = (
                                      dc.customSizeInput || ''
                                    ).trim();
                                    if (!raw) return;
                                    const normalized = normalizeSizeEntry(
                                      raw,
                                      dc.sizeType
                                    );
                                    if (!normalized) return;
                                    registerCustomSizePreset(
                                      dc.sizeType,
                                      normalized
                                    );
                                    updateDraftColorField(
                                      dc.colorName,
                                      (prev) => {
                                        const nextSizes = prev.sizes.includes(
                                          normalized
                                        )
                                          ? prev.sizes
                                          : [...prev.sizes, normalized];
                                        return {
                                          ...prev,
                                          sizes: nextSizes,
                                          rawQuantities: {
                                            ...(prev.rawQuantities || {}),
                                            [normalized]:
                                              prev.rawQuantities?.[normalized] ??
                                              '5',
                                          },
                                          customSizeInput: '',
                                        };
                                      }
                                    );
                                  }}
                                  className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold uppercase cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  + Add Size
                                </button>
                              </div>

                              {/* Per-Size Quantity Inputs for this Color */}
                              {dc.sizes.length > 0 && (
                                <div className="pt-2 border-t border-zinc-200 space-y-1.5">
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700">
                                    Stock Quantity per Size for {dc.colorName}:
                                  </span>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {dc.sizes.map((sz) => (
                                      <div
                                        key={sz}
                                        className="flex items-center justify-between gap-1.5 p-1.5 bg-zinc-50 border border-zinc-300"
                                      >
                                        <span className="text-xs font-mono-tabular font-bold text-zinc-900 truncate">
                                          {sz}
                                        </span>
                                        <input
                                          type="number"
                                          min="0"
                                          value={dc.rawQuantities?.[sz] ?? '5'}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            updateDraftColorField(
                                              dc.colorName,
                                              (prev) => ({
                                                ...prev,
                                                rawQuantities: {
                                                  ...(prev.rawQuantities || {}),
                                                  [sz]: val,
                                                },
                                              })
                                            );
                                          }}
                                          className="w-16 px-1.5 py-1 text-xs font-mono-tabular text-right bg-white border border-zinc-300"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SINGLE PRODUCT SIZES & QUANTITIES (Hidden when Full Set is selected) */}
              {!itemHasColors && !isFullSetCategorySelected && (
                <div className="p-4 bg-zinc-50 border border-zinc-200 space-y-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-950">
                    Sizes &amp; Per-Size Quantity Configuration (Defaults to 5
                    per size) *
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSizeTypeChange('letter')}
                      className={`py-2 px-2 text-[11px] font-bold uppercase border cursor-pointer ${
                        itemSizeType === 'letter'
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-700 border-zinc-300'
                      }`}
                    >
                      1. Letter (XS–XL)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSizeTypeChange('numeric')}
                      className={`py-2 px-2 text-[11px] font-bold uppercase border cursor-pointer ${
                        itemSizeType === 'numeric'
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-700 border-zinc-300'
                      }`}
                    >
                      2. Number (36, 38...)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSizeTypeChange('months')}
                      className={`py-2 px-2 text-[11px] font-bold uppercase border cursor-pointer ${
                        itemSizeType === 'months'
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-700 border-zinc-300'
                      }`}
                    >
                      3. Months (Baby)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSizeTypeChange('years')}
                      className={`py-2 px-2 text-[11px] font-bold uppercase border cursor-pointer ${
                        itemSizeType === 'years'
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-700 border-zinc-300'
                      }`}
                    >
                      4. Years (Kids)
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {getPresetsForSizeType(itemSizeType).map((presetSize) => {
                      const active = selectedSizes.includes(presetSize);
                      return (
                        <button
                          key={presetSize}
                          type="button"
                          onClick={() => toggleSize(presetSize)}
                          className={`px-2.5 py-1 text-xs font-mono-tabular font-semibold border flex items-center gap-1 cursor-pointer ${
                            active
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-white text-zinc-700 border-zinc-300'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                          <span>{presetSize}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Size Input for Single-Color Product (Months, Years, Numeric, Letter) */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      placeholder={
                        itemSizeType === 'months'
                          ? 'Add new Months size (e.g. 0-3 Months, 24-36 Months)'
                          : itemSizeType === 'years'
                          ? 'Add new Years size (e.g. 10-11 Years, 12-13 Years)'
                          : itemSizeType === 'numeric'
                          ? 'Add custom numeric size (e.g. 36, 46)'
                          : 'Add custom size (e.g. XXL, One Size)'
                      }
                      aria-label="Add custom size for product"
                      className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-zinc-300"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSize}
                      className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold uppercase cursor-pointer whitespace-nowrap shrink-0"
                    >
                      + Add Size
                    </button>
                  </div>

                  {selectedSizes.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                      {selectedSizes.map((sz) => (
                        <div
                          key={sz}
                          className="flex items-center justify-between gap-2 bg-white border border-zinc-300 px-2.5 py-1.5"
                        >
                          <span className="text-xs font-mono-tabular font-bold text-zinc-950">
                            {sz}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={perSizeRawQuantities[sz] ?? ''}
                            onChange={(e) =>
                              setPerSizeRawQuantities((prev) => ({
                                ...prev,
                                [sz]: e.target.value,
                              }))
                            }
                            placeholder="Default: 5"
                            aria-label={`Quantity for size ${sz}`}
                            className="w-20 px-2 py-1 text-xs font-mono-tabular border border-zinc-200 text-right"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MATERIALS CHECKMARK SELECTOR (OPTIONAL VIA CHECKBOX — Hidden when Full Set is selected) */}
              {!isFullSetCategorySelected && (
                <div className="p-4 bg-zinc-50 border border-zinc-300 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={itemHasMaterials}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setItemHasMaterials(checked);
                          if (checked && selectedMaterials.length === 0) {
                            setSelectedMaterials([
                              allMaterials[0] || 'Cow Leather',
                            ]);
                          }
                        }}
                        className="w-4 h-4 accent-zinc-950 cursor-pointer"
                      />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-950">
                        Add Material to Product (Show Material Type on Website)
                      </span>
                    </label>
                    {itemHasMaterials && (
                      <span className="text-[11px] text-zinc-500">
                        {selectedMaterials.length} Checkmarked
                      </span>
                    )}
                  </div>

                  {itemHasMaterials && (
                    <div className="space-y-3 pt-2 border-t border-zinc-200">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {allMaterials.map((mat) => {
                          const checked = selectedMaterials.includes(mat);
                          return (
                            <button
                              key={mat}
                              type="button"
                              onClick={() => toggleMaterial(mat)}
                              aria-pressed={checked}
                              className={`px-2.5 py-2 text-xs font-medium border text-left flex items-center justify-between transition-colors cursor-pointer ${
                                checked
                                  ? 'bg-zinc-950 text-white border-zinc-950 font-bold'
                                  : 'bg-white text-zinc-800 border-zinc-300'
                              }`}
                            >
                              <span className="truncate">{mat}</span>
                              {checked && <Check className="w-3 h-3" />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newMaterialInput}
                          onChange={(e) => setNewMaterialInput(e.target.value)}
                          placeholder="Add custom material (e.g. Calfskin)..."
                          className="w-full sm:flex-1 min-w-0 px-3 py-1.5 text-xs bg-white border border-zinc-300"
                        />
                        <button
                          type="button"
                          onClick={handleAddAndCheckCustomMaterial}
                          className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0"
                        >
                          + Add &amp; Check
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Editorial Notes */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-900">
                      Product Notes / Description
                    </label>
                    {copyDraftedNotice && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        ✓ Description Drafted
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiCopy}
                    disabled={aiGeneratingCopy}
                    className="px-2.5 py-1 rounded-md bg-zinc-950 text-white hover:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>
                      {aiGeneratingCopy
                        ? 'Drafting Description...'
                        : 'Auto-Draft Editorial Notes'}
                    </span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={itemDescription}
                  onChange={(e) => {
                    setItemDescription(e.target.value);
                    if (copyDraftedNotice) setCopyDraftedNotice(false);
                  }}
                  placeholder="Optional silhouette and construction notes (or click Auto-Draft Editorial Notes above to generate automatically)..."
                  className="w-full px-3 py-2 text-xs border border-zinc-300"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="px-4 py-3 rounded-xl bg-zinc-100 text-zinc-800 text-xs font-bold uppercase tracking-wider cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-zinc-950 text-white text-xs font-bold tracking-[0.12em] uppercase hover:bg-zinc-800 transition-colors cursor-pointer text-center"
                >
                  Publish Item to SAMO Storefront
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
