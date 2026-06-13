import React, { createContext, useContext, useState } from 'react';

export interface CartItem {
  menu_item_id: string;
  name: string;
  customer_price: number;
  category: string;
  quantity: number;
  spicy_level: string;
  is_complimentary: boolean;
}

interface CartContextType {
  items: CartItem[];
  allergyNotes: string;
  total: number;
  addItem: (item: CartItem) => void;
  updateItem: (menu_item_id: string, updates: Partial<CartItem>) => void;
  removeItem: (menu_item_id: string) => void;
  clearCart: () => void;
  setAllergyNotes: (notes: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [allergyNotes, setAllergyNotes] = useState('');

  const addItem = (newItem: CartItem) => {
    setItems(prev => {
      const existing = prev.find(
        i => i.menu_item_id === newItem.menu_item_id && i.spicy_level === newItem.spicy_level
      );
      if (existing) {
        return prev.map(i =>
          i.menu_item_id === newItem.menu_item_id && i.spicy_level === newItem.spicy_level
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i
        );
      }
      return [...prev, newItem];
    });
  };

  const updateItem = (menu_item_id: string, updates: Partial<CartItem>) => {
    setItems(prev =>
      prev.map(i => i.menu_item_id === menu_item_id ? { ...i, ...updates } : i)
    );
  };

  const removeItem = (menu_item_id: string) => {
    setItems(prev => prev.filter(i => i.menu_item_id !== menu_item_id));
  };

  const clearCart = () => {
    setItems([]);
    setAllergyNotes('');
  };

  const total = items.reduce(
    (sum, item) => sum + (item.is_complimentary ? 0 : item.customer_price * item.quantity),
    0
  );

  return (
    <CartContext.Provider value={{ items, allergyNotes, total, addItem, updateItem, removeItem, clearCart, setAllergyNotes }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
