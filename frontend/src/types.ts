// ─── Constants ────────────────────────────────────────────────────────────────

export const SPICY_LEVELS = ['None', 'Mild', 'Medium', 'Hot', 'Extra Hot'] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
  beverage: 'Beverage',
};

export const REJECTION_REASONS: { value: string; label: string }[] = [
  { value: 'out_of_stock',           label: 'Out of Stock' },
  { value: 'ingredients_unavailable',label: 'Ingredients Unavailable' },
  { value: 'preparation_not_possible',label: 'Preparation Not Possible Today' },
  { value: 'insufficient_notice',    label: 'Insufficient Notice Period' },
  { value: 'other',                  label: 'Other' },
];

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: 'guest' | 'caterer' | 'caretaker' | 'manager' | 'superuser';
  phone_number: string | null;
}

export interface MenuItem {
  id: string;
  caterer: string;
  name: string;
  description: string;
  category: string;
  caterer_price: number;
  customer_price: number;
  is_available: boolean;
  is_complimentary: boolean;
  notice_period_minutes: number;
  created_at: string;
}

export interface OrderItem {
  menu_item_id: string;
  quantity: number;
  spicy_level: string;
  // Populated in items_detail (read-only enriched response from backend)
  name?: string;
  customer_price?: number;
  caterer_price?: number;
  category?: string;
  is_complimentary?: boolean;
  notice_period_minutes?: number;
}

export interface Order {
  id: string;
  guest: string;
  guest_detail?: User;
  status: 'pending' | 'accepted' | 'partially_accepted' | 'rejected' | 'prepared' | 'delivered' | 'resolved';
  items: OrderItem[];
  items_detail?: OrderItem[];
  is_editable?: boolean;
  allergy_notes: string;
  rejection_reason?: string;
  rejection_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalPurchase {
  id: string;
  guest?: string;
  guest_username?: string;
  order?: string | null;
  caretaker?: string | null;
  caretaker_username?: string | null;
  bill?: string | null;
  vendor_name: string;
  item_name: string;
  quantity: number;
  cost: number;
  is_paid_by_caretaker: boolean;
  is_reimbursed: boolean;
  reimbursement_proof_url?: string | null;
  reimbursement_proof?: string | null;
  created_at?: string;
}

export interface PayoutItem {
  item_name: string;
  quantity: number;
  caterer_price: number;
  line_total: number;
  caterer_id?: string;
  caterer_name?: string;
}

export interface PayoutRecord {
  id: string;
  stay_start?: string;
  stay_end?: string;
  bill_date: string;
  items: PayoutItem[];
  total_caterer_amount: number;
  is_paid: boolean;
  payment_proof_url?: string;
}

export interface Bill {
  id: string;
  guest_detail?: User;
  orders_detail?: Order[];
  external_purchases_detail?: ExternalPurchase[];
  status: 'draft' | 'paid';
  discount_amount: number;
  discount_percentage: number;
  payment_screenshot?: string;
  pdf_url?: string;
  grand_total: number;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  vendor_type: 'regular' | 'ad-hoc';
  order_count: number;
  created_at: string;
}

export interface Notification {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
