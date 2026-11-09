import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Check,
  ShoppingBag,
  Zap,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  BellRing,
} from 'lucide-react';
import {
  ProductColorVariant,
  ProductItem,
  SelectedSetPieceSize,
  SizeType,
} from '../types/samo';
import {
  getColorSwatchHex,
  getEffectiveProductPrice,
  getSizeQuantity,
  sumSizeQuantities,
} from '../utils/catalogLogic';
import { ProductImage } from './ProductImage';

interface ProductModalProps {
  product: ProductItem | null;
  onClose: () => void;
  onAddToCart: (
    product: ProductItem,
    selectedSize: string,
    selectedColor?: string,
    selectedColorImage?: string,
    selectedSetSizes?: SelectedSetPieceSize[]
  ) => void;
  onBuyNow: (
    product: ProductItem,
    selectedSize: string,
    selectedColor?: string,
    selectedColorImage?: string,
    selectedSetSizes?: SelectedSetPieceSize[]
  ) => void;
  onSubmitPreorder?: (payload: {
    product: ProductItem;
    selectedSize: string;
    selectedColor?: string;
    customerContact: string;
  }) => Promise<void>;
  showLowStockCount?: boolean;
}


export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onBuyNow,
  onSubmitPreorder,
  showLowStockCount = false,
}) => {
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedSetPieceSizes, setSelectedSetPieceSizes] = useState<
    Record<number, string>
  >({});
  const [selectedSetPieceColors, setSelectedSetPieceColors] = useState<
    Record<number, string>
  >({});
  const [openSetDrawers, setOpenSetDrawers] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
  });
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [addedFeedback, setAddedFeedback] = useState<boolean>(false);
  const galleryScrollRef = useRef<HTMLDivElement | null>(null);
  const modalOverlayRef = useRef<HTMLDivElement | null>(null);
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);
  const preorderSectionRef = useRef<HTMLDivElement | null>(null);
  const preorderInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToPreorderBox = (focusInput = false) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const preorderEl = preorderSectionRef.current;
        if (!preorderEl) return;

        const detailsEl = detailsScrollRef.current;
        const overlayEl = modalOverlayRef.current;
        const isDesktopDetailsScrollable =
          Boolean(detailsEl) &&
          window.matchMedia('(min-width: 768px)').matches &&
          detailsEl!.scrollHeight > detailsEl!.clientHeight + 4;

        const activeContainer = isDesktopDetailsScrollable ? detailsEl : overlayEl;

        if (activeContainer) {
          const containerRect = activeContainer.getBoundingClientRect();
          const elRect = preorderEl.getBoundingClientRect();
          const currentScrollTop = activeContainer.scrollTop;
          const offsetInsideContainer =
            elRect.top - containerRect.top + currentScrollTop;
          const centeredTop = Math.max(
            0,
            offsetInsideContainer -
              Math.max(24, (activeContainer.clientHeight - elRect.height) / 2)
          );
          activeContainer.scrollTo({
            top: centeredTop,
            behavior: 'smooth',
          });
        } else {
          preorderEl.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }

        if (focusInput && preorderInputRef.current) {
          window.setTimeout(() => {
            preorderInputRef.current?.focus({ preventScroll: true });
          }, 220);
        }
      }, 95);
    });
  };

  // Preorder form state when an out-of-stock size is selected
  const [preorderContact, setPreorderContact] = useState<string>('');
  const [preorderSubmitting, setPreorderSubmitting] = useState<boolean>(false);
  const [preorderSubmitted, setPreorderSubmitted] = useState<boolean>(false);
  const [preorderError, setPreorderError] = useState<string>('');

  useEffect(() => {
    if (product) {
      const isFullSet =
        Boolean(product.isFullSet) &&
        Array.isArray(product.setItems) &&
        product.setItems.length > 0;

      if (isFullSet && product.setItems) {
        const initialSetSizes: Record<number, string> = {};
        const initialSetColors: Record<number, string> = {};
        const initialDrawers: Record<number, boolean> = {};
        product.setItems.forEach((sub, idx) => {
          const hasSubColors =
            Array.isArray(sub.colorVariants) && sub.colorVariants.length > 0;
          if (hasSubColors && sub.colorVariants) {
            const firstColVar = sub.colorVariants[0];
            initialSetColors[idx] = firstColVar.colorName;
            const firstAvail =
              firstColVar.sizes.find(
                (sz) => (firstColVar.sizeQuantities?.[sz] ?? 5) > 0
              ) ||
              firstColVar.sizes[0] ||
              'M';
            initialSetSizes[idx] = firstAvail;
          } else {
            const firstAvail =
              sub.sizes.find((sz) => (sub.sizeQuantities?.[sz] ?? 5) > 0) ||
              sub.sizes[0] ||
              'M';
            initialSetSizes[idx] = firstAvail;
          }
          initialDrawers[idx] = true;
        });
        setSelectedSetPieceColors(initialSetColors);
        setSelectedSetPieceSizes(initialSetSizes);
        setOpenSetDrawers(initialDrawers);
      } else {
        setSelectedSetPieceColors({});
        setSelectedSetPieceSizes({});
      }

      const hasColorVariants =
        Boolean(product.hasColors) &&
        Array.isArray(product.colorVariants) &&
        product.colorVariants.length > 0;

      if (hasColorVariants && product.colorVariants) {
        const firstVariant = product.colorVariants[0];
        setSelectedColor(firstVariant.colorName);
        const firstAvailableSize =
          firstVariant.sizes.find(
            (sz) => (firstVariant.sizeQuantities?.[sz] ?? 5) > 0
          ) ||
          firstVariant.sizes[0] ||
          'M';
        setSelectedSize(firstAvailableSize);
      } else {
        setSelectedColor('');
        const firstAvailableSize =
          product.sizes.find((sz) => getSizeQuantity(product, sz) > 0) ||
          product.sizes[0] ||
          'M';
        setSelectedSize(firstAvailableSize);
      }
      setActiveImageIndex(0);
      if (galleryScrollRef.current) {
        galleryScrollRef.current.scrollTo({ left: 0, behavior: 'auto' });
      }
      if (modalOverlayRef.current) {
        modalOverlayRef.current.scrollTop = 0;
      }
      if (detailsScrollRef.current) {
        detailsScrollRef.current.scrollTop = 0;
      }
      setAddedFeedback(false);
      setPreorderContact('');
      setPreorderSubmitted(false);
      setPreorderError('');
    }
  }, [product]);

  if (!product) return null;

  const isFullSetProduct =
    Boolean(product.isFullSet) &&
    Array.isArray(product.setItems) &&
    product.setItems.length > 0;

  const hasColorVariants =
    !isFullSetProduct &&
    Boolean(product.hasColors) &&
    Array.isArray(product.colorVariants) &&
    product.colorVariants.length > 0;

  const activeVariant: ProductColorVariant | undefined = hasColorVariants
    ? product.colorVariants!.find(
        (v) => v.colorName.toLowerCase() === selectedColor.toLowerCase()
      ) || product.colorVariants![0]
    : undefined;

  const handleSelectColor = (variant: ProductColorVariant) => {
    setSelectedColor(variant.colorName);
    setActiveImageIndex(0);
    if (galleryScrollRef.current) {
      galleryScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
    setAddedFeedback(false);
    setPreorderSubmitted(false);
    setPreorderError('');
    if (selectedSize && variant.sizes.includes(selectedSize)) {
      return;
    }
    const nextSize =
      variant.sizes.find((sz) => (variant.sizeQuantities?.[sz] ?? 5) > 0) ||
      variant.sizes[0] ||
      'M';
    setSelectedSize(nextSize);
  };

  const activeSizes = activeVariant ? activeVariant.sizes : product.sizes;
  const activeSizeType = activeVariant ? activeVariant.sizeType : product.sizeType;

  const getActiveSizeQty = (sz: string): number => {
    if (!product.inStock) return 0;
    if (activeVariant) {
      const q = activeVariant.sizeQuantities?.[sz];
      return typeof q === 'number' && !Number.isNaN(q)
        ? Math.max(0, Math.floor(q))
        : 5;
    }
    return getSizeQuantity(product, sz);
  };

  // Determine stock state for Full Set vs Standard Product
  let isSelectedConfigurationOut = false;
  let effectiveSelectedSizeLabel = selectedSize || activeSizes[0] || 'One Size';
  let resolvedSetSizesPayload: SelectedSetPieceSize[] | undefined = undefined;

  if (isFullSetProduct && product.setItems) {
    const pieceSelections: SelectedSetPieceSize[] = product.setItems.map(
      (sub, idx) => {
        const subHasColors =
          Array.isArray(sub.colorVariants) && sub.colorVariants.length > 0;
        const activeSubColVar = subHasColors
          ? sub.colorVariants!.find(
              (v) =>
                v.colorName.toLowerCase() ===
                (selectedSetPieceColors[idx] || '').toLowerCase()
            ) || sub.colorVariants![0]
          : undefined;
        const activeSubSizes = activeSubColVar ? activeSubColVar.sizes : sub.sizes;
        const chosen =
          selectedSetPieceSizes[idx] &&
          activeSubSizes.includes(selectedSetPieceSizes[idx])
            ? selectedSetPieceSizes[idx]
            : activeSubSizes[0] || 'M';
        return {
          productId: sub.productId,
          productName: sub.productName,
          pieceLabel:
            sub.pieceLabel || (idx === 0 ? 'Piece 1' : `Piece ${idx + 1}`),
          selectedSize: chosen,
          selectedColor: activeSubColVar?.colorName,
        };
      }
    );
    resolvedSetSizesPayload = pieceSelections;
    effectiveSelectedSizeLabel = pieceSelections
      .map((ps) =>
        ps.selectedColor
          ? `${ps.selectedColor} (${ps.selectedSize})`
          : ps.selectedSize
      )
      .join(' / ');

    // Check if product is toggled out-of-stock or any selected piece size has 0 quantity
    isSelectedConfigurationOut =
      !product.inStock ||
      product.setItems.some((sub, idx) => {
        const subHasColors =
          Array.isArray(sub.colorVariants) && sub.colorVariants.length > 0;
        const activeSubColVar = subHasColors
          ? sub.colorVariants!.find(
              (v) =>
                v.colorName.toLowerCase() ===
                (selectedSetPieceColors[idx] || '').toLowerCase()
            ) || sub.colorVariants![0]
          : undefined;
        const activeSubSizes = activeSubColVar ? activeSubColVar.sizes : sub.sizes;
        const activeSubQtyMap = activeSubColVar
          ? activeSubColVar.sizeQuantities
          : sub.sizeQuantities;
        const chosen =
          selectedSetPieceSizes[idx] &&
          activeSubSizes.includes(selectedSetPieceSizes[idx])
            ? selectedSetPieceSizes[idx]
            : activeSubSizes[0] || '';
        const q = activeSubQtyMap?.[chosen];
        const numericQ =
          typeof q === 'number' && !Number.isNaN(q)
            ? Math.max(0, Math.floor(q))
            : 5;
        return numericQ <= 0;
      });
  } else {
    const selectedSizeQty = selectedSize ? getActiveSizeQty(selectedSize) : 0;
    const totalQty = activeVariant
      ? sumSizeQuantities(activeVariant.sizes, activeVariant.sizeQuantities)
      : sumSizeQuantities(product.sizes, product.sizeQuantities);
    isSelectedConfigurationOut =
      selectedSizeQty <= 0 || totalQty <= 0 || !product.inStock;
  }

  const pricing = getEffectiveProductPrice(product);

  // Combine up to 4 image URLs for the selected color (or product gallery fallback)
  const primaryImageForSelection =
    (activeVariant?.imageUrl && activeVariant.imageUrl.trim()) || product.imageUrl;

  const variantGalleryUrls = Array.isArray(activeVariant?.galleryUrls)
    ? activeVariant!.galleryUrls.map((u) => (u || '').trim()).filter(Boolean)
    : [];
  const fallbackProductGalleryUrls = Array.isArray(product.galleryUrls)
    ? product.galleryUrls.map((u) => (u || '').trim()).filter(Boolean)
    : [];
  const sourceGallery =
    variantGalleryUrls.length > 0 ? variantGalleryUrls : fallbackProductGalleryUrls;

  const allImages = Array.from(
    new Set([
      primaryImageForSelection,
      ...sourceGallery.filter((u) => u && u !== primaryImageForSelection),
    ])
  ).slice(0, 4);

  const scrollToGallerySlide = (targetIndex: number) => {
    if (allImages.length <= 1) return;
    const clamped = Math.max(0, Math.min(allImages.length - 1, targetIndex));
    setActiveImageIndex(clamped);
    const container = galleryScrollRef.current;
    if (!container) return;
    const slideEl = container.children[clamped] as HTMLElement | undefined;
    if (slideEl) {
      container.scrollTo({
        left: slideEl.offsetLeft,
        behavior: 'smooth',
      });
    }
  };

  const handleGalleryScroll = () => {
    const container = galleryScrollRef.current;
    if (!container || allImages.length <= 1) return;
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (maxScroll <= 4) {
      if (activeImageIndex !== 0) setActiveImageIndex(0);
      return;
    }
    if (container.scrollLeft >= maxScroll - 12) {
      const lastIdx = allImages.length - 1;
      if (activeImageIndex !== lastIdx) setActiveImageIndex(lastIdx);
      return;
    }
    const firstSlide = container.children[0] as HTMLElement | undefined;
    const slideWidth = firstSlide
      ? firstSlide.offsetWidth
      : container.clientWidth * 0.93;
    const computedIdx = Math.min(
      allImages.length - 1,
      Math.max(0, Math.round(container.scrollLeft / Math.max(1, slideWidth)))
    );
    if (computedIdx !== activeImageIndex) {
      setActiveImageIndex(computedIdx);
    }
  };

  const sizeTypeLabel =
    activeSizeType === 'months'
      ? 'Baby & Kids Sizing (Months)'
      : activeSizeType === 'years'
      ? 'Kids & Junior Sizing (Years)'
      : activeSizeType === 'cm'
      ? 'Centimeter Sizing (cm)'
      : activeSizeType === 'numeric'
      ? 'European Numeric Sizing'
      : 'International Letter Sizing';

  const handleAdd = () => {
    if (isSelectedConfigurationOut) return;
    onAddToCart(
      product,
      effectiveSelectedSizeLabel,
      activeVariant?.colorName,
      primaryImageForSelection,
      resolvedSetSizesPayload
    );
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1600);
  };

  const handleImmediateBuy = () => {
    if (isSelectedConfigurationOut) return;
    onBuyNow(
      product,
      effectiveSelectedSizeLabel,
      activeVariant?.colorName,
      primaryImageForSelection,
      resolvedSetSizesPayload
    );
  };

  const handlePreorderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreorderError('');
    const contact = preorderContact.trim();
    if (!contact || contact.length < 4) {
      setPreorderError('Please enter your email address or phone number.');
      return;
    }
    setPreorderSubmitting(true);
    try {
      if (onSubmitPreorder) {
        await onSubmitPreorder({
          product,
          selectedSize: effectiveSelectedSizeLabel,
          selectedColor: activeVariant?.colorName,
          customerContact: contact,
        });
      }
      setPreorderSubmitted(true);
      setPreorderContact('');
    } catch {
      setPreorderError('Could not save preorder right now. Please try again.');
    } finally {
      setPreorderSubmitting(false);
    }
  };

  return (
    <div
      ref={modalOverlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sole-product-modal-title"
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/70 p-3 pb-[calc(2rem+env(safe-area-inset-bottom,20px))] md:p-6 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
    >
      <div className="relative w-full max-w-4xl bg-white border border-zinc-950 grid grid-cols-1 md:grid-cols-12 overflow-hidden my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product popup"
          className="absolute top-3.5 right-3.5 z-20 w-9 h-9 bg-white border border-zinc-950 flex items-center justify-center text-zinc-950 hover:bg-zinc-950 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Column: Product Gallery Images (Up to 4 Images) (7 cols) */}
        <div className="md:col-span-7 bg-[#EFEFEF] border-b md:border-b-0 md:border-r border-zinc-950 flex flex-col justify-between">
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            {/* Swipeable Horizontal Track (93% primary image width so ~7% of image #2 peeks on the right) */}
            <div
              ref={galleryScrollRef}
              onScroll={handleGalleryScroll}
              className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar touch-pan-x bg-white"
            >
              {allImages.map((imgUrl, idx) => (
                <div
                  key={`${imgUrl}-${idx}`}
                  className={`relative h-full shrink-0 snap-start bg-[#EFEFEF] ${
                    allImages.length > 1
                      ? 'w-[93%] border-r-2 border-white last:border-r-0'
                      : 'w-full'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`${product.name}${
                      activeVariant ? ` - ${activeVariant.colorName}` : ''
                    } - View ${idx + 1}`}
                    category={product.category}
                    styleType={product.style}
                    className="h-full w-full"
                  />
                </div>
              ))}
            </div>

            {/* Top-Left Badges */}
            <div className="pointer-events-none absolute top-3.5 left-3.5 z-10 flex flex-wrap gap-1.5">
              {isSelectedConfigurationOut && (
                <button
                  type="button"
                  onClick={() => scrollToPreorderBox(true)}
                  className="pointer-events-auto cursor-pointer px-2.5 py-1 bg-red-700 text-white text-[10px] font-bold uppercase tracking-[0.14em]"
                >
                  Out of Stock
                </button>
              )}
              {pricing.hasDiscount && (
                <span className="px-2.5 py-1 bg-red-700 text-white text-[10px] font-bold uppercase tracking-[0.14em]">
                  {pricing.discountBadge}
                </span>
              )}
            </div>

            {/* Desktop Navigation Arrows (Left / Right) */}
            {allImages.length > 1 && (
              <>
                {activeImageIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => scrollToGallerySlide(activeImageIndex - 1)}
                    aria-label="Previous product image"
                    className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white/95 hover:bg-zinc-950 text-zinc-950 hover:text-white border border-zinc-950 items-center justify-center shadow-sm transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {activeImageIndex < allImages.length - 1 && (
                  <button
                    type="button"
                    onClick={() => scrollToGallerySlide(activeImageIndex + 1)}
                    aria-label="Next product image"
                    className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white/95 hover:bg-zinc-950 text-zinc-950 hover:text-white border border-zinc-950 items-center justify-center shadow-sm transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Thumbnail Selector Strip (Up to 4 Images) */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-2 p-3 bg-white border-t border-zinc-200 overflow-x-auto">
              {allImages.map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => scrollToGallerySlide(idx)}
                  aria-label={`View angle ${idx + 1}`}
                  className={`w-16 h-20 border transition-all shrink-0 cursor-pointer ${
                    activeImageIndex === idx
                      ? 'border-zinc-950 ring-1 ring-zinc-950'
                      : 'border-zinc-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    category={product.category}
                    styleType={product.style}
                    compact={true}
                    className="h-full w-full"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Sole Item Purchase Module (5 cols) */}
        <div
          ref={detailsScrollRef}
          className="md:col-span-5 p-6 pb-[calc(2rem+env(safe-area-inset-bottom,20px))] md:p-8 flex flex-col justify-between bg-white md:max-h-[88vh] md:overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
        >
          <div className="space-y-5">
            {/* Unboxed Clean Metadata Header */}
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-2">
                <span>{product.department}</span>
                <span aria-hidden="true">·</span>
                <span>{product.category}</span>
                <span aria-hidden="true">·</span>
                <span>{product.style}</span>
              </div>
              <h2
                id="sole-product-modal-title"
                className="font-display text-xl md:text-2xl font-extrabold tracking-[0.06em] uppercase text-zinc-950 leading-snug"
              >
                {product.name}
              </h2>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5 font-mono-tabular">
                  <span className="text-lg font-bold text-zinc-950">
                    ${pricing.effectivePrice.toLocaleString()}
                  </span>
                  {pricing.hasDiscount && (
                    <>
                      <span className="text-sm text-zinc-400 line-through">
                        ${pricing.originalPrice.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200">
                        {pricing.discountBadge}
                      </span>
                    </>
                  )}
                </div>
                {isSelectedConfigurationOut && (
                  <button
                    type="button"
                    onClick={() => scrollToPreorderBox(true)}
                    className="px-2 py-0.5 bg-red-50 border border-red-200 text-[10px] font-mono-tabular font-bold uppercase tracking-wider text-red-700 cursor-pointer"
                  >
                    Out of Stock
                  </button>
                )}
              </div>
            </div>

            {/* Minimal Color Selector (Preselected on First Color, Switches Image & Sizes) */}
            {hasColorVariants && product.colorVariants && (
              <div className="pt-4 border-t border-zinc-200">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-950">
                    Color
                  </span>
                  <span className="text-[11px] font-mono-tabular uppercase tracking-wider text-zinc-600">
                    {activeVariant?.colorName}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {product.colorVariants.map((variant) => {
                    const isSelected =
                      activeVariant?.colorName.toLowerCase() ===
                      variant.colorName.toLowerCase();
                    const hex =
                      variant.colorHex || getColorSwatchHex(variant.colorName);
                    const variantTotalStock = sumSizeQuantities(
                      variant.sizes,
                      variant.sizeQuantities
                    );
                    const isColorOut = variantTotalStock <= 0;
                    return (
                      <button
                        key={variant.colorName}
                        type="button"
                        onClick={() => handleSelectColor(variant)}
                        aria-pressed={isSelected}
                        aria-label={`Select color ${variant.colorName}`}
                        className={`group flex items-center gap-2 px-3 py-1.5 border text-xs uppercase tracking-[0.1em] transition-all cursor-pointer ${
                          isSelected
                            ? 'border-zinc-950 bg-zinc-950 text-white font-bold'
                            : 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950'
                        } ${isColorOut ? 'opacity-60' : ''}`}
                      >
                        <span
                          className="w-3 h-3 border border-zinc-400 shrink-0"
                          style={{ backgroundColor: hex }}
                        />
                        <span>{variant.colorName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Materials Section (Only shown when product has materials added and is not a Full Set) */}
            {!isFullSetProduct &&
              Array.isArray(product.materials) &&
              product.materials.length > 0 && (
                <div className="pt-4 border-t border-zinc-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-950">
                      Materials Composition
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {product.materials.length}{' '}
                      {product.materials.length === 1 ? 'Material' : 'Materials'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-zinc-800 tracking-wide">
                    {product.materials.join(' · ')}
                  </p>
                </div>
              )}

            {/* FULL SET: Minimalistic Drawer-Down Box Selector for Each Piece in the Set */}
            {isFullSetProduct && product.setItems ? (
              <div className="pt-4 border-t border-zinc-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-950">
                    Select Your Size
                  </span>
                </div>

                {product.setItems.map((subItem, idx) => {
                  const subHasColors =
                    Array.isArray(subItem.colorVariants) &&
                    subItem.colorVariants.length > 0;
                  const activeSubColVar = subHasColors
                    ? subItem.colorVariants!.find(
                        (v) =>
                          v.colorName.toLowerCase() ===
                          (selectedSetPieceColors[idx] || '').toLowerCase()
                      ) || subItem.colorVariants![0]
                    : undefined;
                  const activeSubSizes = activeSubColVar
                    ? activeSubColVar.sizes
                    : subItem.sizes;
                  const activeSubQtyMap = activeSubColVar
                    ? activeSubColVar.sizeQuantities
                    : subItem.sizeQuantities;

                  const chosenSize =
                    selectedSetPieceSizes[idx] &&
                    activeSubSizes.includes(selectedSetPieceSizes[idx])
                      ? selectedSetPieceSizes[idx]
                      : activeSubSizes[0] || '';
                  const chosenQty = activeSubQtyMap?.[chosenSize] ?? 5;
                  const isPieceChosenOut = chosenQty <= 0;
                  const isOpen = openSetDrawers[idx] ?? true;

                  return (
                    <div
                      key={`${subItem.productId}-${idx}`}
                      className="border border-zinc-300 bg-zinc-50/40"
                    >
                      {/* Minimalistic Drawer Header */}
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSetDrawers((prev) => ({
                            ...prev,
                            [idx]: !isOpen,
                          }))
                        }
                        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left bg-white hover:bg-zinc-50 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                            {subItem.pieceLabel ||
                              (idx === 0
                                ? 'Top / Shirt'
                                : idx === 1
                                ? 'Trousers / Bottom'
                                : 'Third Piece')}
                          </div>
                          <div className="text-xs font-bold uppercase tracking-wider text-zinc-950 truncate mt-0.5">
                            {subItem.productName}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {activeSubColVar && (
                            <span className="px-2 py-0.5 border border-zinc-300 bg-zinc-100 text-zinc-800 text-[10px] font-mono-tabular font-bold uppercase">
                              {activeSubColVar.colorName}
                            </span>
                          )}
                          <span className="px-2 py-0.5 border border-zinc-950 bg-zinc-950 text-white text-[11px] font-mono-tabular font-bold uppercase">
                            {chosenSize}
                          </span>
                          {isPieceChosenOut && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                scrollToPreorderBox(true);
                              }}
                              className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Out of Stock
                            </span>
                          )}
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-zinc-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-600" />
                          )}
                        </div>
                      </button>

                      {/* Drawer-Down Color & Size Grid for this Piece */}
                      {isOpen && (
                        <div className="p-3 border-t border-zinc-200 bg-zinc-50/70 space-y-2.5">
                          {/* Color Selector for this Set Piece (when the linked product has colors) */}
                          {subHasColors && subItem.colorVariants && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                                  Color
                                </span>
                                <span className="text-[10px] font-mono-tabular uppercase text-zinc-800 font-semibold">
                                  {activeSubColVar?.colorName}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {subItem.colorVariants.map((colVar) => {
                                  const isColSelected =
                                    activeSubColVar?.colorName.toLowerCase() ===
                                    colVar.colorName.toLowerCase();
                                  const hex =
                                    colVar.colorHex ||
                                    getColorSwatchHex(colVar.colorName);
                                  return (
                                    <button
                                      key={colVar.colorName}
                                      type="button"
                                      onClick={() => {
                                        setSelectedSetPieceColors((prev) => ({
                                          ...prev,
                                          [idx]: colVar.colorName,
                                        }));
                                        if (!colVar.sizes.includes(chosenSize)) {
                                          const nextSz =
                                            colVar.sizes.find(
                                              (s) =>
                                                (colVar.sizeQuantities?.[s] ??
                                                  5) > 0
                                            ) ||
                                            colVar.sizes[0] ||
                                            '';
                                          setSelectedSetPieceSizes((prev) => ({
                                            ...prev,
                                            [idx]: nextSz,
                                          }));
                                        }
                                        setPreorderSubmitted(false);
                                        setPreorderError('');
                                      }}
                                      aria-pressed={isColSelected}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 border text-[10px] uppercase tracking-wider cursor-pointer transition-colors ${
                                        isColSelected
                                          ? 'bg-zinc-950 text-white border-zinc-950 font-bold'
                                          : 'bg-white text-zinc-800 border-zinc-300 hover:border-zinc-950'
                                      }`}
                                    >
                                      <span
                                        className="w-2.5 h-2.5 border border-zinc-400 shrink-0"
                                        style={{ backgroundColor: hex }}
                                      />
                                      <span>{colVar.colorName}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {activeSubSizes.map((sz) => {
                              const szQty = activeSubQtyMap?.[sz] ?? 5;
                              const isZeroQty = szQty <= 0;
                              const isLowQty =
                                showLowStockCount && (szQty === 1 || szQty === 2);
                              const isSelected = chosenSize === sz;
                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSetPieceSizes((prev) => ({
                                      ...prev,
                                      [idx]: sz,
                                    }));
                                    setPreorderSubmitted(false);
                                    setPreorderError('');
                                    if (isZeroQty || !product.inStock) {
                                      scrollToPreorderBox(false);
                                    }
                                  }}
                                  aria-pressed={isSelected}
                                  aria-label={
                                    isZeroQty
                                      ? `${subItem.productName} size ${sz} (Out of stock — click to preorder)`
                                      : `${subItem.productName} size ${sz}`
                                  }
                                  className={`relative py-2 px-2 text-xs font-mono-tabular font-bold uppercase border transition-colors whitespace-nowrap shrink-0 overflow-hidden cursor-pointer flex flex-col items-center justify-center ${
                                    isSelected && isZeroQty
                                      ? 'bg-red-950 text-white border-red-800 ring-1 ring-red-700'
                                      : isSelected
                                      ? 'bg-zinc-950 text-white border-zinc-950'
                                      : isZeroQty
                                      ? 'bg-zinc-100/80 text-zinc-400 border-zinc-200 hover:border-zinc-500'
                                      : 'bg-white text-zinc-900 border-zinc-300 hover:border-zinc-950'
                                  }`}
                                >
                                  <span className={isZeroQty && !isSelected ? 'opacity-60' : ''}>
                                    {sz}
                                  </span>
                                  {isLowQty && (
                                    <span
                                      className={`text-[9px] font-semibold leading-none mt-0.5 ${
                                        isSelected ? 'text-amber-300' : 'text-amber-700'
                                      }`}
                                    >
                                      {szQty} left
                                    </span>
                                  )}
                                  {isZeroQty && (
                                    <span
                                      aria-hidden="true"
                                      className={`pointer-events-none absolute inset-0 flex items-center justify-center font-light text-lg select-none ${
                                        isSelected ? 'text-red-300/80' : 'text-zinc-400'
                                      }`}
                                    >
                                      /
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {isPieceChosenOut && (
                            <div
                              onClick={() => scrollToPreorderBox(true)}
                              className="text-[11px] font-semibold text-red-700 flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>
                                Size {chosenSize} is currently out of stock — select to Preorder below.
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* STANDARD PRODUCT: Sizes Selection Section (All Sizes Clickable Including Out-of-Stock Sizes) */
              <div className="pt-4 border-t border-zinc-200">
                <div className="flex items-center justify-between mb-2.5 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-950">
                      Select Size {activeVariant ? `(${activeVariant.colorName})` : ''}
                    </span>
                    {isSelectedConfigurationOut && (
                      <button
                        type="button"
                        onClick={() => scrollToPreorderBox(true)}
                        className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Out of Stock
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider">
                    {sizeTypeLabel}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {activeSizes.map((size) => {
                    const sizeQty = getActiveSizeQty(size);
                    const isZeroQty = sizeQty <= 0;
                    const isLowQty =
                      showLowStockCount && (sizeQty === 1 || sizeQty === 2);
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setSelectedSize(size);
                          setPreorderSubmitted(false);
                          setPreorderError('');
                          if (isZeroQty || !product.inStock) {
                            scrollToPreorderBox(false);
                          }
                        }}
                        aria-pressed={isSelected}
                        aria-label={
                          isZeroQty
                            ? `Size ${size} (Out of stock — click to preorder)`
                            : `Size ${size}`
                        }
                        className={`relative py-2.5 px-2 text-xs font-mono-tabular font-bold uppercase border transition-colors whitespace-nowrap shrink-0 overflow-hidden cursor-pointer flex flex-col items-center justify-center ${
                          isSelected && isZeroQty
                            ? 'bg-red-950 text-white border-red-800 ring-1 ring-red-700'
                            : isSelected
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : isZeroQty
                            ? 'bg-zinc-100/80 text-zinc-400 border-zinc-200 hover:border-zinc-500'
                            : 'bg-white text-zinc-900 border-zinc-300 hover:border-zinc-950'
                        }`}
                      >
                        <span className={isZeroQty && !isSelected ? 'opacity-60' : ''}>
                          {size}
                        </span>
                        {isLowQty && (
                          <span
                            className={`text-[9px] font-semibold leading-none mt-0.5 ${
                              isSelected ? 'text-amber-300' : 'text-amber-700'
                            }`}
                          >
                            {sizeQty} left
                          </span>
                        )}
                        {isZeroQty && (
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-0 flex items-center justify-center font-light text-xl select-none ${
                              isSelected ? 'text-red-300/80' : 'text-zinc-400'
                            }`}
                          >
                            /
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {isSelectedConfigurationOut && (
                  <p
                    onClick={() => scrollToPreorderBox(true)}
                    className="mt-2 text-[11px] font-semibold text-red-700 cursor-pointer"
                  >
                    Size {selectedSize} is out of stock. Enter your email or phone below to preorder.
                  </p>
                )}
              </div>
            )}

            {/* Editorial Construction Notes */}
            <div className="pt-4 border-t border-zinc-200">
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-950 mb-1.5">
                Atelier Notes
              </span>
              <p className="text-xs leading-relaxed text-zinc-600">
                {product.description}
              </p>
            </div>
          </div>

          {/* Primary Actions: ADD TO CART + BUY NOW, OR PREORDER WHEN OUT-OF-STOCK SIZE IS SELECTED */}
          <div className="pt-6 mt-6 border-t border-zinc-200 space-y-2.5">
            {isSelectedConfigurationOut ? (
              <div
                ref={preorderSectionRef}
                className="preorder scroll-mt-6 p-4 bg-zinc-50 border border-zinc-950 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-zinc-950">
                    <BellRing className="w-3.5 h-3.5 text-red-700" />
                    <span>Preorder — Size {effectiveSelectedSizeLabel}</span>
                  </div>
                </div>

                {preorderSubmitted ? (
                  <div className="p-3 bg-emerald-950 text-white text-xs space-y-1">
                    <div className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Preorder Request Saved</span>
                    </div>
                    <p className="text-[11px] text-zinc-200 leading-relaxed">
                      We have registered your preorder for{' '}
                      <strong>{product.name}</strong> (
                      {activeVariant ? `${activeVariant.colorName} · ` : ''}Size:{' '}
                      {effectiveSelectedSizeLabel}) and will notify you immediately when it returns.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handlePreorderSubmit} className="space-y-2.5">
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      Enter your email address or phone number so our atelier can inform you as soon as Size{' '}
                      <strong>{effectiveSelectedSizeLabel}</strong> is back in stock:
                    </p>
                    {preorderError && (
                      <div className="text-[11px] font-semibold text-red-700">
                        {preorderError}
                      </div>
                    )}
                    <input
                      ref={preorderInputRef}
                      type="text"
                      required
                      value={preorderContact}
                      onFocus={() => scrollToPreorderBox(false)}
                      onChange={(e) => setPreorderContact(e.target.value)}
                      placeholder="Email or phone number (e.g. client@email.com or +961 70...)"
                      aria-label="Email or phone number for preorder notification"
                      className="w-full px-3 py-2.5 text-xs bg-white border border-zinc-300 focus:border-zinc-950 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={preorderSubmitting}
                      className="w-full py-3.5 px-5 bg-zinc-950 text-white text-xs font-bold tracking-[0.16em] uppercase hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <BellRing className="w-4 h-4" />
                      <span>
                        {preorderSubmitting
                          ? 'Saving Preorder...'
                          : `Preorder / Notify Me (Size ${effectiveSelectedSizeLabel})`}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="w-full py-3.5 px-5 bg-white text-zinc-950 border border-zinc-950 text-xs font-bold tracking-[0.16em] uppercase hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {addedFeedback ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-700" />
                      <span>
                        Added {activeVariant ? `${activeVariant.colorName} · ` : ''}
                        Size {effectiveSelectedSizeLabel} to Bag
                      </span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        Add to Cart — ${pricing.effectivePrice.toLocaleString()}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleImmediateBuy}
                  className="w-full py-3.5 px-5 bg-zinc-950 text-white border border-zinc-950 text-xs font-bold tracking-[0.16em] uppercase hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>
                    Buy Now (
                    {activeVariant
                      ? `${activeVariant.colorName} · ${effectiveSelectedSizeLabel}`
                      : effectiveSelectedSizeLabel}
                    )
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
