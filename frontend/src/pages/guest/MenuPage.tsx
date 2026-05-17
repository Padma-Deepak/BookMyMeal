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

const MenuPage: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [spicyLevels, setSpicyLevels] = useState<Record<string, string>>({});
  const { addItem, items: cartItems } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    apiGet<MenuItem[]>('/menu-items/')
      .then(setMenuItems)
      .finally(() => setLoading(false));
  }, []);

  const grouped = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

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
  };

  if (loading) return <Layout><p>Loading menu…</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Menu</h1>
        <button
          onClick={() => navigate('/guest/order/summary')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f16524', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem', cursor: 'pointer', fontSize: '0.95rem', minHeight: 44 }}
        >
          <ShoppingCart size={18} /> View Order {cartItems.length > 0 && `(${cartItems.length})`}
        </button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <p style={{ color: '#666' }}>No items available right now.</p>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', borderBottom: '2px solid #f16524', paddingBottom: '0.4rem', marginBottom: '1rem' }}>
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {items.map(item => {
              const blocked = isWithinNoticePeriod(item.notice_period_minutes);
              return (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', opacity: blocked ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong>{item.name}</strong>
                        {item.is_complimentary && (
                          <span style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: 4 }}>Complimentary</span>
                        )}
                      </div>
                      {item.description && <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>{item.description}</p>}
                      {item.notice_period_minutes > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.4rem', fontSize: '0.8rem', color: blocked ? '#c62828' : '#e65100' }}>
                          <Clock size={13} />
                          Order at least {formatNotice(item.notice_period_minutes)} in advance
                          {blocked && <strong> — cannot order now</strong>}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <strong style={{ fontSize: '1rem' }}>
                        {item.is_complimentary ? <span style={{ color: '#2e7d32' }}>₹0</span> : `₹${item.customer_price}`}
                      </strong>
                    </div>
                  </div>

                  {!blocked && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Quantity stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(1, (q[item.id] || 1) - 1) }))}
                          style={{ width: 32, height: 32, borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer', background: '#f5f5f5', fontSize: '1rem' }}
                        >−</button>
                        <span style={{ minWidth: 24, textAlign: 'center' }}>{quantities[item.id] || 1}</span>
                        <button
                          onClick={() => setQuantities(q => ({ ...q, [item.id]: (q[item.id] || 1) + 1 }))}
                          style={{ width: 32, height: 32, borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer', background: '#f5f5f5', fontSize: '1rem' }}
                        >+</button>
                      </div>
                      {/* Spicy dropdown */}
                      <select
                        value={spicyLevels[item.id] || 'None'}
                        onChange={e => setSpicyLevels(s => ({ ...s, [item.id]: e.target.value }))}
                        style={{ padding: '0.3rem 0.5rem', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.85rem' }}
                      >
                        {SPICY_LEVELS.map(l => <option key={l}>{l}</option>)}
                      </select>
                      {/* Add to order */}
                      <button
                        onClick={() => handleAddToCart(item)}
                        style={{ background: '#f16524', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 0.9rem', cursor: 'pointer', minHeight: 44, fontSize: '0.9rem' }}
                      >
                        Add to Order
                      </button>
                    </div>
                  )}

                  {blocked && (
                    <p style={{ marginTop: '0.5rem', color: '#c62828', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                      This item requires advance notice and cannot be ordered right now.
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
