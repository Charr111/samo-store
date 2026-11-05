export type Department = 'women' | 'kids';

export type SizeType = 'letter' | 'numeric' | 'cm';

export type StyleType =
  | 'Classic'
  | 'Sport Chic'
  | 'Fine Leather'
  | 'Suede'
  | 'Fur'
  | 'Accessories';

export type OrderStatus = 'pending' | 'accepted' | 'rejected';

export type DiscountType = 'none' | 'percentage' | 'fixed';

export type RoutePath =
  | '/home'
  | '/women'
  | '/kids'
  | '/new-arrivals'
  | '/gifts'
  | '/showroom'
  | '/admin';

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  department: Department;
  description: string;
  createdAt?: string;
}

export interface ProductColorVariant {
  colorName: string;
  colorHex?: string;
  imageUrl: string;
  galleryUrls?: string[];
  sizeType: SizeType;
  sizes: string[];
  sizeQuantities: Record<string, number>;
}

export interface FullSetSubItem {
  productId: string;
  productName: string;
  pieceLabel?: string;
  sizeType: SizeType;
  sizes: string[];
  sizeQuantities: Record<string, number>;
}

export interface SelectedSetPieceSize {
  productId: string;
  productName: string;
  pieceLabel?: string;
  selectedSize: string;
}

export interface ProductItem {
  id: string;
  name: string;
  department: Department;
  category: string;
  style: StyleType;
  price: number;
  quantity: number;
  sizeQuantities: Record<string, number>;
  hasColors?: boolean;
  colorVariants?: ProductColorVariant[];
  isFullSet?: boolean;
  setItems?: FullSetSubItem[];
  isNewArrival: boolean;
  discountType?: DiscountType;
  discountValue?: number;
  imageUrl: string;
  galleryUrls: string[];
  sizeType: SizeType;
  sizes: string[];
  materials: string[];
  description: string;
  inStock: boolean;
  featured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PromoCodeItem {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  active: boolean;
  createdAt?: string;
}

export interface MaterialOption {
  id: string;
  name: string;
  isPrebuilt?: boolean;
}

export interface CartItem {
  product: ProductItem;
  selectedColor?: string;
  selectedSize: string;
  selectedColorImage?: string;
  selectedSetSizes?: SelectedSetPieceSize[];
  quantity: number;
}

export type DeliveryMethod = 'Standard Delivery' | 'SAMO Showroom Pickup';

export type PaymentMethod = 'COD' | 'Whish/OMT Payment';

export interface OrderedLineItem {
  productId: string;
  productName: string;
  selectedColor?: string;
  selectedSize?: string;
  selectedSetSizes?: SelectedSetPieceSize[];
  quantity: number;
}

export interface OrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingLocation: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod?: PaymentMethod;
  deliveryFee: number;
  subtotal: number;
  discountAmount?: number;
  promoCode?: string;
  totalPrice: number;
  itemsSummary: string;
  itemsCount: number;
  primaryProductName: string;
  primaryProductSize: string;
  primaryProductImage: string;
  orderedItems?: OrderedLineItem[];
  status: OrderStatus;
  createdAt: string;
}

export type PreorderStatus = 'pending' | 'notified';

export interface PreorderItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  department: Department;
  category: string;
  selectedSize: string;
  selectedColor?: string;
  customerContact: string;
  status: PreorderStatus;
  createdAt: string;
}

export interface AdminRecord {
  id: string;
  email: string;
  addedBy: string;
  createdAt: string;
}

export interface CategoryBannerConfig {
  categoryKey: string;
  department: Department | 'collection';
  categoryName: string;
  imageUrl: string;
  kicker?: string;
  title?: string;
  enabled: boolean;
  insertAfterCount: number;
  updatedAt?: string;
}

export interface SiteBannersConfig {
  homeHeroMediaType: 'video' | 'image';
  homeHeroVideoUrl: string;
  homeHeroImageUrl: string;
  homeHeroKicker: string;
  homeHeroTitle: string;
  homeMiddleBannerUrl: string;
  homeMiddleKicker: string;
  homeMiddleTitle: string;
  homeMiddleSubtitle: string;
  homeBottomNewArrivalsUrl: string;
  homeBottomGiftsUrl: string;
  homeBottomShowroomUrl: string;
  showroomHeroBannerUrl: string;
  categoryBanners: Record<string, CategoryBannerConfig>;
}

