export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'beverage';
  customer_price: number;
  caterer_price?: number;
  is_available: boolean;
  notice_period_minutes: number;
  is_complimentary: boolean;
  caterer: string;
}

export interface OrderItem {
  menu_item_id: string;
  quantity: number;
  spicy_level: string;
}

export interface OrderItemDetail extends OrderItem {
  name: string;
  customer_price: number;
  category: string;
  is_complimentary: boolean;
}

export interface Order {
  id: string;
  guest: string;
  caterer: string;
  items: OrderItem[];
  items_detail?: OrderItemDetail[];
  allergy_notes: string;
  status: 'pending' | 'accepted' | 'rejected' | 'prepared' | 'delivered';
  rejection_reason?: string;
  rejection_notes?: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  vendor_type: 'regular' | 'ad-hoc';
  order_count: number;
  created_at: string;
}

export interface ExternalPurchase {
  id: string;
  order: string;
  guest: string;
  caretaker: string;
  vendor: string;
  vendor_name?: string;
  item_name: string;
  quantity: number;
  cost: number;
  is_paid_by_caretaker: boolean;
  created_at: string;
}

export interface Bill {
  id: string;
  guest: string;
  guest_detail?: { id: string; username: string; phone_number: string | null };
  orders: string[];
  orders_detail?: Order[];
  external_purchases: string[];
  external_purchases_detail?: ExternalPurchase[];
  discount_amount: number;
  discount_percentage: number;
  status: 'draft' | 'paid';
  payment_screenshot?: string;
  pdf_url?: string;
  created_at: string;
}

export interface CatererBill {
  id: string;
  caterer: string;
  bill: string;
  payment_screenshot?: string;
  status: 'pending' | 'paid';
  created_at: string;
}

export interface Notification {
  id: string;
  recipient: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface CartItem {
  menu_item_id: string;
  name: string;
  customer_price: number;
  category: string;
  quantity: number;
  spicy_level: string;
  is_complimentary: boolean;
}

export const SPICY_LEVELS = ['None', 'Mild', 'Medium', 'Hot', 'Extra Hot'] as const;

export const REJECTION_REASONS = [
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'ingredients_unavailable', label: 'Ingredients unavailable' },
  { value: 'preparation_not_possible', label: 'Preparation not possible today' },
  { value: 'insufficient_notice', label: 'Insufficient notice period' },
  { value: 'other', label: 'Other' },
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
  beverage: 'Beverage',
};
