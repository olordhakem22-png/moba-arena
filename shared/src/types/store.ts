export interface StoreItem {
  id: string;
  type: StoreItemType;
  name: string;
  description: string;
  icon: string;
  price: StoreItemPrice;
  category: StoreCategory;
  rarity: ItemRarity;
  isLimited: boolean;
  availableFrom: Date;
  availableUntil?: Date;
  discount?: StoreDiscount;
  relatedIds: string[];
  isOwned: boolean;
}

export type StoreItemType =
  | 'champion'
  | 'skin'
  | 'chroma'
  | 'ward-skin'
  | 'emote'
  | 'icon'
  | 'bundle';

export type StoreCategory =
  | 'champions'
  | 'skins'
  | 'chromas'
  | 'wards'
  | 'emotes'
  | 'icons'
  | 'bundles';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface StoreItemPrice {
  blueEssence: number;
  rp: number;
  isFree: boolean;
}

export interface StoreDiscount {
  originalPrice: StoreItemPrice;
  discountedPrice: StoreItemPrice;
  discountPercent: number;
  endsAt: Date;
}

export interface Inventory {
  champions: string[];
  skins: string[];
  chromas: string[];
  wardSkins: string[];
  emotes: string[];
  icons: string[];
  blueEssence: number;
  rp: number;
}

export interface Transaction {
  id: string;
  userId: string;
  itemId: string;
  itemType: StoreItemType;
  price: StoreItemPrice;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  createdAt: Date;
}

export type PaymentMethod = 'rp' | 'blue-essence' | 'free';
export type TransactionStatus = 'pending' | 'completed' | 'refunded' | 'failed';

// --- Shop (in-game) ---
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  stats: Record<string, number>;
  cost: number;
  sellBack: number;
  category: ShopItemCategory;
  tier: number;
  from: string[];
  into: string[];
  maps: string[];
  requiredAlly?: string;
  requiredEnemy?: string;
  isActive: boolean;
}

export type ShopItemCategory =
  | 'starter'
  | 'basic'
  | 'epic'
  | 'legendary'
  | 'boots'
  | 'consumable'
  | 'trinket';
