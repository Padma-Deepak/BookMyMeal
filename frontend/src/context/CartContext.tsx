import React, { createContext, useContext, useState } from 'react';
import type { CartItem } from '../types';

interface CartContextType {
  items: CartItem[];
  allergyNotes: string;
  addItem: (item: CartItem) => void;
  updateItem: (menu_item_id: string, updates: Partial<CartItem>) => void;
  removeItem: (menu_item_id: string) => void;
  setAllergyNotes: (notes: string) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [allergyNotes, setAllergyNotes] = useState('');

  const addItem = (item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.menu_item_id === item.menu_item_id);
      if (existing) {
        return prev.map(i =>
          i.menu_item_id === item.menu_item_id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  };

  const updateItem = (menu_item_id: string, updates: Partial<CartItem>) => {
    setItems(prev => prev.map(i => i.menu_item_id === menu_item_id ? { ...i, ...updates } : i));
  };

  const removeItem = (menu_item_id: string) => {
    setItems(prev => prev.filter(i => i.menu_item_id !== menu_item_id));
  };

  const clearCart = () => {
    setItems([]);
    setAllergyNotes('');
  };

  const total = items.reduce((sum, item) => sum + item.customer_price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, allergyNotes, addItem, updateItem, removeItem, setAllergyNotes, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
