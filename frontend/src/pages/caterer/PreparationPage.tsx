import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { apiGet, apiPatch } from '../../lib/api';
import type { Order } from '../../types';

const PreparationPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, Set<number>>>({});
  const [loading, setLoading] = useState(true);

  const fetchOrders = () => {
    apiGet<Order[]>('/orders/?status=accepted')
      .then(setOrders)
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
    await apiPatch(`/orders/${id}/`, { status: 'delivered' });
    fetchOrders();
  };

  if (loading) return <Layout><p>Loading…</p></Layout>;

  return (
    <Layout>
      <h1 style={{ marginBottom: '1.5rem' }}>In Preparation</h1>
      {orders.length === 0 && <p style={{ color: '#666' }}>No orders in preparation.</p>}
      {orders.map(order => {
        const items = order.items_detail || order.items;
        const checked = checkedItems[order.id] || new Set();
        return (
          <div key={order.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
              Order #{order.id.slice(0, 8)}… • {new Date(order.created_at).toLocaleString()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
              {items.map((item, idx) => {
                const d = item as { name?: string; quantity: number; spicy_level?: string };
                return (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: 4, background: checked.has(idx) ? '#e8f5e9' : '#f9f9f9' }}>
                    <input
                      type="checkbox"
                      checked={checked.has(idx)}
                      onChange={() => toggleItem(order.id, idx)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <span style={{ textDecoration: checked.has(idx) ? 'line-through' : 'none', color: checked.has(idx) ? '#999' : '#333' }}>
                      {d.name || (item as { menu_item_id: string }).menu_item_id} ×{d.quantity}
                      {d.spicy_level && d.spicy_level !== 'None' && <span style={{ marginLeft: 6, fontSize: '0.8rem', color: '#666' }}>({d.spicy_level})</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {order.allergy_notes && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', background: '#fffde7', padding: '0.4rem 0.6rem', borderRadius: 4, color: '#666' }}>
                Note: {order.allergy_notes}
              </p>
            )}
            <button
              onClick={() => handleComplete(order.id)}
              disabled={!allItemsChecked(order)}
              style={{
                background: allItemsChecked(order) ? '#2e7d32' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '0.6rem 1.5rem',
                cursor: allItemsChecked(order) ? 'pointer' : 'not-allowed',
                minHeight: 44,
                fontWeight: 600,
              }}
            >
              Complete Order
            </button>
            {!allItemsChecked(order) && (
              <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#999' }}>Check all items to complete</span>
            )}
          </div>
        );
      })}
    </Layout>
  );
};

export default PreparationPage;
