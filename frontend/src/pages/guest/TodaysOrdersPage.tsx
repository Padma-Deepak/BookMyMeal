import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet, apiPatch, apiDelete } from '../../lib/api';
import { formatNotice } from '../../lib/notice';
import type { Order, OrderItem } from '../../types';
import { CATEGORY_LABELS } from '../../types';

const CATEGORY_ORDER = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverage'];

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  pending:   { background: '#fef3c7', color: '#92400e' },
  accepted:  { background: '#d1fae5', color: '#065f46' },
  rejected:  { background: '#fee2e2', color: '#991b1b' },
  prepared:  { background: '#dbeafe', color: '#1e40af' },
  delivered: { background: '#ede9fe', color: '#4c1d95' },
  partially_accepted: { background: '#fef3c7', color: '#92400e' },
  resolved:  { background: '#f3f4f6', color: '#374151' },
};

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function orderCategory(order: Order): string {
  const items = order.items_detail || [];
  const categories = new Set(items.map(i => i.category).filter(Boolean));
  if (categories.size === 1) return [...categories][0] as string;
  return 'mixed';
}

function orderTotal(order: Order): number {
  return (order.items_detail || []).reduce(
    (sum, item) => sum + (item.is_complimentary ? 0 : (item.customer_price ?? 0) * item.quantity), 0);
}

// Minutes remaining today before the strictest (max notice_period_minutes) item in
// this order hits its cutoff — mirrors the backend's Order.is_editable calculation.
function editWindowMinutes(order: Order): number {
  const now = new Date();
  const minutesUntilMidnight = (23 - now.getHours()) * 60 + (59 - now.getMinutes());
  const items = order.items_detail || [];
  const maxNotice = items.reduce((m, i) => Math.max(m, i.notice_period_minutes ?? 0), 0);
  return minutesUntilMidnight - maxNotice;
}

function lockReason(order: Order): string {
  if (order.status !== 'pending') {
    return `Locked — already ${order.status.replace('_', ' ')} by the caterer.`;
  }
  return 'Locked — the notice-period cutoff for this order has passed.';
}

function parseErrorStatus(err: unknown): number | null {
  const e = err as { message?: string };
  const match = e.message?.match(/failed: (\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { data?: Record<string, unknown> };
  return e.data ? Object.values(e.data).flat().join(' ') : fallback;
}

interface EditState {
  items: OrderItem[];
  allergyNotes: string;
}

const TodaysOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGet<Order[]>('/orders/')
      .then(all => setOrders(all.filter(o => isToday(o.created_at))))
      .finally(() => setLoading(false));
  }, []);

  const getEdit = (order: Order): EditState =>
    edits[order.id] ?? { items: order.items_detail || [], allergyNotes: order.allergy_notes };

  const setEdit = (orderId: string, next: EditState) =>
    setEdits(e => ({ ...e, [orderId]: next }));

  const handleQtyChange = (order: Order, menuItemId: string, delta: number) => {
    const current = getEdit(order);
    const nextItems = current.items
      .map(i => i.menu_item_id === menuItemId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0);
    if (nextItems.length === 0) return; // last item can't be zeroed out — use Cancel Order instead
    setEdit(order.id, { ...current, items: nextItems });
  };

  const handleRemoveItem = (order: Order, menuItemId: string) => {
    const current = getEdit(order);
    if (current.items.length <= 1) return; // last item — use Cancel Order instead
    setEdit(order.id, { ...current, items: current.items.filter(i => i.menu_item_id !== menuItemId) });
  };

  const handleNotesChange = (order: Order, notes: string) => {
    setEdit(order.id, { ...getEdit(order), allergyNotes: notes });
  };

  const isDirty = (order: Order): boolean => order.id in edits;

  const handleSave = async (order: Order) => {
    const edit = getEdit(order);
    setSaving(s => ({ ...s, [order.id]: true }));
    setOrderErrors(e => ({ ...e, [order.id]: '' }));
    try {
      const updated = await apiPatch<Order>(`/orders/${order.id}/`, {
        items: edit.items.map(i => ({
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
          spicy_level: i.spicy_level,
        })),
        allergy_notes: edit.allergyNotes,
      });
      setOrders(list => list.map(o => o.id === order.id ? updated : o));
      setEdits(e => { const next = { ...e }; delete next[order.id]; return next; });
    } catch (err) {
      if (parseErrorStatus(err) === 403) {
        setOrders(list => list.map(o => o.id === order.id ? { ...o, is_editable: false } : o));
      }
      setOrderErrors(e => ({ ...e, [order.id]: errorMessage(err, 'Failed to save changes.') }));
    } finally {
      setSaving(s => ({ ...s, [order.id]: false }));
    }
  };

  const handleCancel = async (order: Order) => {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setSaving(s => ({ ...s, [order.id]: true }));
    setOrderErrors(e => ({ ...e, [order.id]: '' }));
    try {
      await apiDelete(`/orders/${order.id}/`);
      setOrders(list => list.filter(o => o.id !== order.id));
    } catch (err) {
      if (parseErrorStatus(err) === 403) {
        setOrders(list => list.map(o => o.id === order.id ? { ...o, is_editable: false } : o));
      }
      setOrderErrors(e => ({ ...e, [order.id]: errorMessage(err, 'Failed to cancel order.') }));
      setSaving(s => ({ ...s, [order.id]: false }));
    }
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading today's orders…</p></Layout>;

  const grouped = orders.reduce<Record<string, Order[]>>((acc, order) => {
    const cat = orderCategory(order);
    (acc[cat] ||= []).push(order);
    return acc;
  }, {});
  const groupOrder = [...CATEGORY_ORDER.filter(c => grouped[c]), ...(grouped['mixed'] ? ['mixed'] : [])];

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Today's Orders</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>
            Edit or cancel a preorder before its cutoff
          </p>
        </div>
        <button
          onClick={() => navigate('/guest/menu')}
          style={{ background: 'none', border: 'none', color: '#1a3c2c', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Menu
        </button>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontWeight: 500 }}>No orders placed today yet.</p>
          <button
            onClick={() => navigate('/guest/menu')}
            style={{ marginTop: '0.75rem', background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
          >
            Browse Menu
          </button>
        </div>
      ) : (
        groupOrder.map(category => (
          <section key={category} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
              {category === 'mixed' ? 'Mixed' : (CATEGORY_LABELS[category] ?? category)}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {grouped[category].map(order => {
                const sc = STATUS_STYLE[order.status] || { background: '#f3f4f6', color: '#6b7280' };
                const editable = !!order.is_editable;
                const edit = getEdit(order);
                const dirty = isDirty(order);
                const isSaving = !!saving[order.id];
                const remaining = editWindowMinutes(order);

                return (
                  <div key={order.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ padding: '0.65rem 1rem', background: '#f0ece3', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>₹{orderTotal(order).toFixed(2)}</span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '2px 8px', borderRadius: 12,
                          fontSize: '0.75rem', fontWeight: 600, ...sc
                        }}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem' }}>
                      {edit.items.map(item => (
                        <div key={item.menu_item_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ color: '#374151', fontWeight: 500 }}>{item.name}</span>
                            {item.is_complimentary && (
                              <span style={{ marginLeft: 6, background: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>Complimentary</span>
                            )}
                            {item.spicy_level && item.spicy_level !== 'None' && (
                              <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#9ca3af' }}>({item.spicy_level})</span>
                            )}
                          </div>
                          {editable ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <button
                                onClick={() => handleQtyChange(order, item.menu_item_id, -1)}
                                style={{ width: 24, height: 24, border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', background: '#f0ece3', color: '#374151', fontWeight: 600 }}
                              >−</button>
                              <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600, color: '#111827', fontSize: '0.85rem' }}>{item.quantity}</span>
                              <button
                                onClick={() => handleQtyChange(order, item.menu_item_id, 1)}
                                style={{ width: 24, height: 24, border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', background: '#f0ece3', color: '#374151', fontWeight: 600 }}
                              >+</button>
                              <button
                                onClick={() => handleRemoveItem(order, item.menu_item_id)}
                                title="Remove item"
                                style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', marginLeft: 4 }}
                              >✕</button>
                            </div>
                          ) : (
                            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>×{item.quantity}</span>
                          )}
                        </div>
                      ))}

                      {editable ? (
                        <textarea
                          value={edit.allergyNotes}
                          onChange={e => handleNotesChange(order, e.target.value)}
                          placeholder="Allergies & special preferences"
                          rows={2}
                          style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical', color: '#111827', background: '#fff' }}
                        />
                      ) : order.allergy_notes && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#6b7280' }}>
                          Note: {order.allergy_notes}
                        </div>
                      )}

                      {orderErrors[order.id] && (
                        <div style={{ marginTop: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#dc2626' }}>
                          {orderErrors[order.id]}
                        </div>
                      )}

                      {editable ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.78rem', color: remaining <= 30 ? '#d97706' : '#9ca3af' }}>
                            Editable for another {formatNotice(Math.max(remaining, 0))}
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleCancel(order)}
                              disabled={isSaving}
                              style={{ background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, padding: '0.4rem 0.75rem', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                            >
                              Cancel Order
                            </button>
                            <button
                              onClick={() => handleSave(order)}
                              disabled={!dirty || isSaving}
                              style={{
                                background: (!dirty || isSaving) ? '#7aab8e' : '#1a3c2c',
                                color: '#fff', border: 'none', borderRadius: 7, padding: '0.4rem 0.875rem',
                                cursor: (!dirty || isSaving) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8rem',
                              }}
                            >
                              {isSaving ? 'Saving…' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ marginTop: '0.75rem', color: '#9ca3af', fontSize: '0.78rem' }}>
                          {lockReason(order)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </Layout>
  );
};

export default TodaysOrdersPage;
