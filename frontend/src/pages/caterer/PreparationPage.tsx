import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { apiGet, apiPatch } from '../../lib/api';
import type { Order } from '../../types';

const PreparationPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, Set<number>>>({});
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchOrders = () => {
    Promise.all([
      apiGet<Order[]>('/orders/?status=accepted'),
      apiGet<Order[]>('/orders/?status=partially_accepted'),
    ]).then(([accepted, partial]) => setOrders([...accepted, ...partial]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  const toggleItem = (orderId: string, idx: number) => {
    setCheckedItems(prev => {
      const set = new Set(prev[orderId] || []);
      if (set.has(idx)) set.delete(idx); else set.add(idx);
      return { ...prev, [orderId]: set };
    });
  };

  const allItemsChecked = (order: Order) => {
    const count = (order.items_detail || order.items).length;
    return (checkedItems[order.id]?.size || 0) >= count;
  };

  const handleComplete = async (id: string) => {
    setCompleting(id);
    await apiPatch(`/orders/${id}/`, { status: 'delivered' });
    setCompleting(null);
    fetchOrders();
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading…</p></Layout>;

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>In Preparation</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Check off items as you prepare them</p>
      </div>

      {orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontWeight: 500 }}>No orders in preparation.</p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Accepted orders will appear here.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {orders.map(order => {
          const items = order.items_detail || order.items;
          const checked = checkedItems[order.id] || new Set<number>();
          const allDone = allItemsChecked(order);
          const checkedCount = checked.size;
          return (
            <div key={order.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>#{order.id.slice(0, 8)}</span>
                  <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#6b7280' }}>{new Date(order.created_at).toLocaleString()}</span>
                </div>
                <span style={{ fontSize: '0.78rem', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
                  {checkedCount}/{items.length} done
                </span>
              </div>

              {/* Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.875rem' }}>
                {items.map((item, idx) => {
                  const d = item as { name?: string; quantity: number; spicy_level?: string };
                  const isDone = checked.has(idx);
                  return (
                    <label
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        cursor: 'pointer',
                        padding: '0.45rem 0.65rem',
                        borderRadius: 7,
                        background: isDone ? '#f0fdf4' : '#f0ece3',
                        border: `1px solid ${isDone ? '#bbf7d0' : '#f3f4f6'}`,
                        transition: 'background 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleItem(order.id, idx)}
                        style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#16a34a' }}
                      />
                      <span style={{
                        textDecoration: isDone ? 'line-through' : 'none',
                        color: isDone ? '#9ca3af' : '#374151',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}>
                        {d.name || (item as { menu_item_id: string }).menu_item_id}
                        <span style={{ color: '#6b7280', fontWeight: 400 }}> ×{d.quantity}</span>
                        {d.spicy_level && d.spicy_level !== 'None' && (
                          <span style={{ marginLeft: 6, fontSize: '0.78rem', color: '#9ca3af' }}>({d.spicy_level})</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>

              {order.allergy_notes && (
                <p style={{ fontSize: '0.82rem', color: '#6b7280', background: '#fefce8', border: '1px solid #fef08a', padding: '0.4rem 0.65rem', borderRadius: 5, marginBottom: '0.75rem' }}>
                  Note: {order.allergy_notes}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => handleComplete(order.id)}
                  disabled={!allDone || completing === order.id}
                  style={{
                    background: allDone ? '#16a34a' : '#e5e7eb',
                    color: allDone ? '#fff' : '#9ca3af',
                    border: 'none',
                    borderRadius: 7,
                    padding: '0.5rem 1.375rem',
                    cursor: allDone ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    minHeight: 40,
                  }}
                >
                  {completing === order.id ? 'Completing…' : 'Complete Order'}
                </button>
                {!allDone && (
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    Check all {items.length} items first
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
};

export default PreparationPage;
