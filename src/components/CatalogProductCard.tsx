import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductItem } from '../types/samo';
import {
  getColorSwatchHex,
  getEffectiveProductPrice,
  sumSizeQuantities,
} from '../utils/catalogLogic';
import { ProductImage } from './ProductImage';

interface CatalogProductCardProps {
  product: ProductItem;
  onSelectProduct: (product: ProductItem) => void;
}

/**
 * Prada-inspired 4:5 Product Card with:
 * - Touch/swipe horizontal image scroller inside the 4:5 card (plus desktop hover chevrons)
 * - Live pagination dots (• ◦) at the bottom-center of the 4:5 studio tile
 * - Left-aligned Product Title, Price (with discount support), and Color Swatch Circles below
 */
export const CatalogProductCard: React.FC<CatalogProductCardProps> = ({
  product,
  onSelectProduct,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [userClickedColorSwatch, setUserClickedColorSwatch] = useState(false);

  const hasColorVariants =
    Boolean(product.hasColors) &&
    Array.isArray(product.colorVariants) &&
    product.colorVariants.length > 0;

  const activeVariant = hasColorVariants
    ? product.colorVariants![
        Math.min(selectedColorIndex, product.colorVariants!.length - 1)
      ]
    : null;

  // Build ordered list of scrollable 4:5 images for this card.
  // When a customer on website view clicks a color swatch (or when color has its own gallery),
  // only the first image uploaded to that color appears on the card (all color images appear in the item pop-up).
  const slideUrls = useMemo(() => {
    const primaryUrl = (activeVariant?.imageUrl || product.imageUrl || '').trim();
    if (
      hasColorVariants &&
      activeVariant &&
      (userClickedColorSwatch ||
        (Array.isArray(activeVariant.galleryUrls) &&
          activeVariant.galleryUrls.length > 0))
    ) {
      return [primaryUrl || 'studio://samo-item'];
    }

    const rawList = [
      primaryUrl,
      ...(Array.isArray(product.galleryUrls) ? product.galleryUrls : []),
    ]
      .map((u) => (u || '').trim())
      .filter(Boolean);

    const deduped: string[] = [];
    for (const u of rawList) {
      if (!deduped.includes(u)) deduped.push(u);
    }

    // If only 1 angle exists on a studio:// URI, add a second profile angle so the card image scroller is always interactive
    if (deduped.length === 1 && deduped[0].startsWith('studio://')) {
      deduped.push(`${deduped[0]}-profile`);
    }
    return deduped.length > 0 ? deduped.slice(0, 4) : ['studio://samo-item'];
  }, [
    activeVariant,
    hasColorVariants,
    userClickedColorSwatch,
    product.imageUrl,
    product.galleryUrls,
  ]);

  const totalQty = sumSizeQuantities(product.sizes, product.sizeQuantities);
  const isOutOfStock = totalQty <= 0 || !product.inStock;
  const pricing = getEffectiveProductPrice(product);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el || el.clientWidth <= 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.max(0, Math.min(slideUrls.length - 1, idx));
    if (clamped !== activeSlideIndex) {
      setActiveSlideIndex(clamped);
    }
  };

  const scrollToSlide = (e: React.MouseEvent, targetIndex: number) => {
    e.stopPropagation();
    const el = scrollContainerRef.current;
    if (!el) return;
    const clamped =
      (targetIndex + slideUrls.length) % Math.max(1, slideUrls.length);
    el.scrollTo({
      left: clamped * el.clientWidth,
      behavior: 'smooth',
    });
    setActiveSlideIndex(clamped);
  };

  const handleSelectColorSwatch = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setSelectedColorIndex(idx);
    setUserClickedColorSwatch(true);
    setActiveSlideIndex(0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  // Format title with clean sentence/title case feel while keeping SAMO names readable
  const formattedName = useMemo(() => {
    const raw = (product.name || '').trim();
    if (!raw) return 'SAMO Piece';
    return raw
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }, [product.name]);

  return (
    <article
      onClick={() => onSelectProduct(product)}
      className="group cursor-pointer bg-white flex flex-col justify-between"
    >
      {/* 4:5 Studio Image Container with Horizontal Touch/Trackpad Swipe & Pagination Dots */}
      <div className="relative aspect-[4/5] w-full bg-white overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex h-full w-full overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth gap-[2px] bg-white"
        >
          {slideUrls.map((url, idx) => (
            <div
              key={`${product.id}-slide-${idx}-${url}`}
              className="h-full w-full shrink-0 snap-center bg-[#EFEFEF]"
            >
              <ProductImage
                src={url}
                alt={`${product.name} — View ${idx + 1}`}
                category={product.category}
                styleType={product.style}
                compact={true}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>

        {/* Top-Left Status Badges (Discount / Out of Stock) */}
        {(isOutOfStock || pricing.hasDiscount) && (
          <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1">
            {isOutOfStock && (
              <span className="px-2 py-0.5 bg-zinc-950/90 text-white text-[9px] font-bold uppercase tracking-[0.12em]">
                Out of Stock
              </span>
            )}
            {pricing.hasDiscount && (
              <span className="px-2 py-0.5 bg-red-700 text-white text-[9px] font-bold uppercase tracking-[0.12em]">
                {pricing.discountBadge}
              </span>
            )}
          </div>
        )}

        {/* Desktop Subtle Previous / Next Image Arrows on Hover */}
        {slideUrls.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => scrollToSlide(e, activeSlideIndex - 1)}
              aria-label={`Previous image for ${product.name}`}
              className="hidden lg:group-hover:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 items-center justify-center bg-white/80 hover:bg-white text-zinc-950 transition-opacity cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
            </button>
            <button
              type="button"
              onClick={(e) => scrollToSlide(e, activeSlideIndex + 1)}
              aria-label={`Next image for ${product.name}`}
              className="hidden lg:group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 items-center justify-center bg-white/80 hover:bg-white text-zinc-950 transition-opacity cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 stroke-[1.75]" />
            </button>
          </>
        )}

        {/* Bottom-Center Pagination Dots (• ◦) matching Video 2 */}
        {slideUrls.length > 1 && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            {slideUrls.map((_, dotIdx) => {
              const isActive = dotIdx === activeSlideIndex;
              return (
                <button
                  key={`${product.id}-dot-${dotIdx}`}
                  type="button"
                  onClick={(e) => scrollToSlide(e, dotIdx)}
                  aria-label={`View angle ${dotIdx + 1} of ${product.name}`}
                  className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-950 scale-110'
                      : 'bg-transparent border border-zinc-950/60 hover:border-zinc-950'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Clean Editorial Footer below 4:5 Image (Title, Price, Color Swatch Circles) */}
      <div className="px-3 sm:px-3.5 pt-2.5 pb-4 bg-white">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[12px] sm:text-[13px] font-semibold text-zinc-950 leading-snug truncate">
            {formattedName}
          </h3>
          <div className="flex items-center gap-1 font-mono-tabular shrink-0">
            <span className="text-[11px] sm:text-[12px] font-semibold text-zinc-900">
              ${pricing.effectivePrice.toLocaleString()}
            </span>
            {pricing.hasDiscount && (
              <span className="text-[10px] text-zinc-400 line-through">
                ${pricing.originalPrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Color Swatch Circles Row (Only shown when product has colors enabled) */}
        {hasColorVariants && (
          <div className="mt-2 flex items-center gap-1.5 min-h-[14px]">
            {product.colorVariants!.map((variant, cIdx) => {
              const hex =
                variant.colorHex || getColorSwatchHex(variant.colorName);
              const isSelected = cIdx === selectedColorIndex;
              return (
                <button
                  key={`${product.id}-color-${variant.colorName}`}
                  type="button"
                  onClick={(e) => handleSelectColorSwatch(e, cIdx)}
                  aria-label={`Select ${variant.colorName} color for ${product.name}`}
                  title={variant.colorName}
                  className={`w-3 h-3 rounded-full border transition-transform cursor-pointer ${
                    isSelected
                      ? 'border-zinc-950 ring-1 ring-zinc-950 ring-offset-1 scale-105'
                      : 'border-zinc-400 hover:border-zinc-950'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
};
