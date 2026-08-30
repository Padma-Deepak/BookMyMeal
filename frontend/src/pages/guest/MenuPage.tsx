import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Clock, Sun, UtensilsCrossed, Moon, Cookie, CupSoda } from 'lucide-react';
import Layout from '../../components/Layout';
import { useCart } from '../../context/CartContext';
import { apiGet } from '../../lib/api';
import type { MenuItem } from '../../types';
import { SPICY_LEVELS, CATEGORY_LABELS } from '../../types';
import { isWithinNoticePeriod, formatNotice } from '../../lib/notice';

const BRAND = '#1a3c2c';
const BRAND_DARK = '#122e21';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const CATEGORY_ORDER = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverage'];

const CATEGORY_META: Record<string, { icon: React.ElementType; gradient: string }> = {
  breakfast: { icon: Sun, gradient: 'linear-gradient(135deg, #f2a35e 0%, #d9713c 100%)' },
  lunch: { icon: UtensilsCrossed, gradient: 'linear-gradient(135deg, #3f8f66 0%, #1a3c2c 100%)' },
  dinner: { icon: Moon, gradient: 'linear-gradient(135deg, #4b6357 0%, #16261e 100%)' },
  snacks: { icon: Cookie, gradient: 'linear-gradient(135deg, #e9c46a 0%, #d1893f 100%)' },
  beverage: { icon: CupSoda, gradient: 'linear-gradient(135deg, #7ba3c9 0%, #3d6d99 100%)' },
};
const DEFAULT_META = { icon: UtensilsCrossed, gradient: 'linear-gradient(135deg, #9ca88f 0%, #5c6b57 100%)' };

const MenuPage: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [spicyLevels, setSpicyLevels] = useState<Record<string, string>>({});
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const { addItem, updateItem, removeItem, items: cartItems } = useCart();
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

  // Total quantity across all cart items (2 idlis + 1 dosa = 3)
  const totalCartQty = cartItems.reduce((sum, i) => sum + i.quantity, 0);

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
    // Reset local quantity to 1 after adding
    setQuantities(q => ({ ...q, [item.id]: 1 }));
  };

  const handleDecrement = (itemId: string) => {
    const cartItem = cartItems.find(i => i.menu_item_id === itemId);
    if (cartItem) {
      const newQty = cartItem.quantity - 1;
      if (newQty <= 0) {
        removeItem(itemId);
        setQuantities(q => ({ ...q, [itemId]: 1 }));
      } else {
        updateItem(itemId, { quantity: newQty });
      }
    } else {
      setQuantities(q => ({ ...q, [itemId]: Math.max(1, (q[itemId] || 1) - 1) }));
    }
  };

  const handleIncrement = (itemId: string) => {
    const cartItem = cartItems.find(i => i.menu_item_id === itemId);
    if (cartItem) {
      updateItem(itemId, { quantity: cartItem.quantity + 1 });
    } else {
      setQuantities(q => ({ ...q, [itemId]: (q[itemId] || 1) + 1 }));
    }
  };

  if (loading) {
    return (
      <Layout>
        <p style={{ color: '#9ca3af', padding: '3rem 0', textAlign: 'center' }}>Loading menu…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{`
        .bmm-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.75rem;
        }
        @media (max-width: 900px) {
          .bmm-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .bmm-grid { grid-template-columns: 1fr; }
        }
        .bmm-card {
          transition: transform 0.28s ease, box-shadow 0.28s ease;
        }
        .bmm-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 48px -20px rgba(26,60,44,0.25), 0 6px 16px -8px rgba(0,0,0,0.08);
        }
        .bmm-card-media {
          transition: transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .bmm-card:hover .bmm-card-media {
          transform: scale(1.045);
        }
        .bmm-add-btn {
          transition: background 0.2s ease, transform 0.15s ease;
        }
        .bmm-add-btn:hover:not(:disabled) {
          background: ${BRAND_DARK};
        }
        .bmm-add-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .bmm-qty-btn {
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .bmm-qty-btn:hover {
          background: #f0ece3;
        }
        .bmm-qty-btn:active {
          transform: scale(0.94);
        }
        .bmm-order-btn {
          transition: background 0.2s ease, transform 0.15s ease;
        }
        .bmm-order-btn:hover {
          background: ${BRAND_DARK};
        }
      `}</style>

      {/* Page header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '1.5rem',
        flexWrap: 'wrap',
        marginBottom: '3rem',
        paddingTop: '0.5rem',
      }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 600, color: BRAND, letterSpacing: '-0.02em' }}>
            Today's Menu
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1rem', marginTop: '0.5rem', maxWidth: 440 }}>
            Fresh meals, thoughtfully prepared for you. Browse by category and order ahead.
          </p>
        </div>
        <button
          className="bmm-order-btn"
          onClick={() => navigate('/guest/order/summary')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: BRAND,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '0.7rem 1.375rem',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            minHeight: 44,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <ShoppingCart size={16} />
          View Order
          {totalCartQty > 0 && (
            <span style={{
              background: '#fff',
              color: BRAND,
              borderRadius: '50%',
              width: 20,
              height: 20,
              fontSize: '0.72rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {totalCartQty}
            </span>
          )}
        </button>
      </div>

      {orderedCategories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#9ca3af' }}>
          <p style={{ fontWeight: 500 }}>No items available right now.</p>
        </div>
      )}

      {orderedCategories.map((category, catIdx) => {
        const meta = CATEGORY_META[category] ?? DEFAULT_META;

        return (
          <section key={category} style={{ marginBottom: catIdx === orderedCategories.length - 1 ? 0 : '3.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.875rem',
              marginBottom: '1.75rem',
              paddingBottom: '0.875rem',
              borderBottom: '1px solid #e5e0d3',
            }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#111827' }}>
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>
                {grouped[category].length} {grouped[category].length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="bmm-grid">
              {grouped[category].map(item => {
                const blocked = isWithinNoticePeriod(item.notice_period_minutes);
                const cartItem = cartItems.find(i => i.menu_item_id === item.id);
                const isInCart = !!cartItem;
                const displayQty = isInCart ? cartItem.quantity : (quantities[item.id] || 1);
                const imgSrc = `/food-images/${slugify(item.name)}.jpeg`;
                const hasPhoto = !brokenImages[item.id];
                const Icon = meta.icon;

                return (
                  <div
                    key={item.id}
                    className="bmm-card"
                    style={{
                      background: '#fff',
                      borderRadius: 20,
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)',
                      opacity: blocked ? 0.55 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                    }}
                  >
                    {/* Image / media area */}
                    <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', background: meta.gradient }}>
                      {hasPhoto ? (
                        <img
                          src={imgSrc}
                          alt={item.name}
                          className="bmm-card-media"
                          onError={() => setBrokenImages(b => ({ ...b, [item.id]: true }))}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div className="bmm-card-media" style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={56} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />
                        </div>
                      )}

                      {item.is_complimentary && (
                        <span style={{
                          position: 'absolute', top: 12, left: 12,
                          background: 'rgba(255,255,255,0.92)', color: '#065f46',
                          fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                          backdropFilter: 'blur(2px)',
                        }}>
                          Complimentary
                        </span>
                      )}

                      {item.notice_period_minutes > 0 && (
                        <span style={{
                          position: 'absolute', top: 12, right: 12,
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          background: blocked ? 'rgba(220,38,38,0.92)' : 'rgba(255,255,255,0.92)',
                          color: blocked ? '#fff' : '#374151',
                          fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                        }}>
                          <Clock size={11} />
                          {blocked ? 'Unavailable now' : formatNotice(item.notice_period_minutes)}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ padding: '1.25rem 1.375rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#111827' }}>
                        {item.name}
                      </h3>

                      {item.description && (
                        <p style={{
                          color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.5,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {item.description}
                        </p>
                      )}

                      <div style={{ flex: 1 }} />

                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.15rem', color: item.is_complimentary ? '#16a34a' : BRAND }}>
                          {item.is_complimentary ? '₹0' : `₹${item.customer_price}`}
                        </span>
                      </div>

                      {blocked ? (
                        <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          Advance notice required — cannot order at this time.
                        </p>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.5rem' }}>
                            {/* Qty stepper */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '0.2rem',
                              background: '#f9f8f4', borderRadius: 999, padding: '0.2rem',
                              border: '1px solid #ede9de', height: 38,
                            }}>
                              <button
                                className="bmm-qty-btn"
                                onClick={() => handleDecrement(item.id)}
                                style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'transparent', color: '#374151', fontWeight: 600, fontSize: '1rem' }}
                              >
                                −
                              </button>
                              <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>
                                {displayQty}
                              </span>
                              <button
                                className="bmm-qty-btn"
                                onClick={() => handleIncrement(item.id)}
                                style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'transparent', color: '#374151', fontWeight: 600, fontSize: '1rem' }}
                              >
                                +
                              </button>
                            </div>

                            {/* Spicy level dropdown — hidden once item is in cart */}
                            {!isInCart && (
                              <select
                                value={spicyLevels[item.id] || 'None'}
                                onChange={e => setSpicyLevels(s => ({ ...s, [item.id]: e.target.value }))}
                                style={{
                                  flex: 1, minWidth: 0, height: 38,
                                  padding: '0 0.6rem', borderRadius: 999,
                                  border: '1px solid #ede9de', background: '#f9f8f4',
                                  fontSize: '0.8rem', color: '#374151',
                                }}
                              >
                                {SPICY_LEVELS.map(l => <option key={l}>{l}</option>)}
                              </select>
                            )}
                          </div>

                          {isInCart ? (
                            <button
                              disabled
                              className="bmm-add-btn"
                              style={{
                                background: '#16a34a', color: '#fff', border: 'none',
                                borderRadius: 999, padding: '0.65rem', cursor: 'default',
                                fontWeight: 600, fontSize: '0.85rem', minHeight: 42, marginTop: '0.4rem',
                              }}
                            >
                              ✓ Added to order
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(item)}
                              className="bmm-add-btn"
                              style={{
                                background: BRAND, color: '#fff', border: 'none',
                                borderRadius: 999, padding: '0.65rem', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.85rem', minHeight: 42, marginTop: '0.4rem',
                              }}
                            >
                              Add to Order
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </Layout>
  );
};

export default MenuPage;
