import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Clock } from 'lucide-react';
import Layout from '../../components/Layout';
import { useCart } from '../../context/CartContext';
import { apiGet } from '../../lib/api';
import type { MenuItem } from '../../types';
import { SPICY_LEVELS, CATEGORY_LABELS } from '../../types';

function isWithinNoticePeriod(noticePeriodMinutes: number): boolean {
  if (noticePeriodMinutes === 0) return false;
  const now = new Date();
  const minutesUntilMidnight = (23 - now.getHours()) * 60 + (59 - now.getMinutes());
  return noticePeriodMinutes > minutesUntilMidnight;
}

function formatNotice(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const CATEGORY_ORDER = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverage'];

const MenuPage: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [spicyLevels, setSpicyLevels] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const { addItem, items: cartItems } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    apiGet<MenuItem[]>('/menu-items/')
      .then(setMenuItems)
      .finally(() => setLoading(false));
  }, []);

  const grouped = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const orderedCategories = CATEGORY_ORDER.filter(c => grouped[c]);

  const handleAddToCart = (item: MenuItem) => {
    const qty = quantities[item.id] || 1;
    const spicy = spicyLevels[item.id] || 'None';
    addItem({
      menu_item_id: item.id,
      name: item.name,
      customer_price: item.customer_price,
      category: item.category,
      quantity: qty,
      spicy_level: spicy,
      is_complimentary: item.is_complimentary,
    });
    setAdded(a => ({ ...a, [item.id]: true }));
    setTimeout(() => setAdded(a => ({ ...a, [item.id]: false })), 1500);
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading menu…</p></Layout>;

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Menu</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Browse and order from today's menu</p>
        </div>
        <button
          onClick={() => navigate('/guest/order/summary')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: '#f16524',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.55rem 1rem',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 40,
            position: 'relative',
          }}
        >
          <ShoppingCart size={16} />
          View Order
          {cartItems.length > 0 && (
            <span style={{
              background: '#fff',
              color: '#f16524',
              borderRadius: '50%',
              width: 20,
              height: 20,
              fontSize: '0.72rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {cartItems.length}
            </span>
          )}
        </button>
      </div>

      {orderedCategories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontWeight: 500 }}>No items available right now.</p>
        </div>
      )}

      {orderedCategories.map(category => (
        <section key={category} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {grouped[category].map(item => {
              const blocked = isWithinNoticePeriod(item.notice_period_minutes);
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '1rem 1.125rem',
                    opacity: blocked ? 0.6 : 1,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Item header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#111827' }}>{item.name}</span>
                        {item.is_complimentary && (
                          <span style={{ background: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>
                            Complimentary
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: 3 }}>{item.description}</p>
                      )}
                      {item.notice_period_minutes > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', fontSize: '0.78rem', color: blocked ? '#dc2626' : '#d97706' }}>
                          <Clock size={12} />
                          Order {formatNotice(item.notice_period_minutes)} in advance
                          {blocked && <strong> · Cannot order now</strong>}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: item.is_complimentary ? '#16a34a' : '#111827' }}>
                        {item.is_complimentary ? '₹0' : `₹${item.customer_price}`}
                      </span>
                    </div>
                  </div>

                  {/* Controls */}
                  {!blocked && (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.875rem', flexWrap: 'wrap' }}>
                      {/* Qty stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#f9fafb', borderRadius: 7, padding: '0.2rem', border: '1px solid #e5e7eb' }}>
                        <button
                          onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(1, (q[item.id] || 1) - 1) }))}
                          style={{ width: 30, height: 30, borderRadius: 5, border: 'none', cursor: 'pointer', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
                        >
                          −
                        </button>
                        <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 600, color: '#111827' }}>
                          {quantities[item.id] || 1}
                        </span>
                        <button
                          onClick={() => setQuantities(q => ({ ...q, [item.id]: (q[item.id] || 1) + 1 }))}
                          style={{ width: 30, height: 30, borderRadius: 5, border: 'none', cursor: 'pointer', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
                        >
                          +
                        </button>
                      </div>

                      {/* Spicy dropdown */}
                      <select
                        value={spicyLevels[item.id] || 'None'}
                        onChange={e => setSpicyLevels(s => ({ ...s, [item.id]: e.target.value }))}
                        style={{ padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: '0.82rem', color: '#374151' }}
                      >
                        {SPICY_LEVELS.map(l => <option key={l}>{l}</option>)}
                      </select>

                      {/* Add button */}
                      <button
                        onClick={() => handleAddToCart(item)}
                        style={{
                          background: added[item.id] ? '#16a34a' : '#f16524',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 7,
                          padding: '0.4rem 0.875rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          minHeight: 36,
                          transition: 'background 0.2s',
                        }}
                      >
                        {added[item.id] ? '✓ Added' : 'Add to Order'}
                      </button>
                    </div>
                  )}

                  {blocked && (
                    <p style={{ marginTop: '0.5rem', color: '#dc2626', fontSize: '0.82rem' }}>
                      Advance notice required — cannot order at this time.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </Layout>
  );
};

export default MenuPage;
