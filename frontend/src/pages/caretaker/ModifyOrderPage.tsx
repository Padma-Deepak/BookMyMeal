import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet, apiPatch } from '../../lib/api';
import type { Order, MenuItem, OrderItem } from '../../types';
import { SPICY_LEVELS } from '../../types';

const ModifyOrderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiGet<Order[]>(`/orders/?status=rejected`),
      apiGet<MenuItem[]>('/menu-items/'),
    ]).then(([orders, menu]) => {
      const found = orders.find(o => o.id === id);
      if (found) {
        setOrder(found);
        setItems(found.items);
      }
      setMenuItems(menu);
    }).finally(() => setLoading(false));
  }, [id]);

  const itemName = (menuItemId: string) =>
    menuItems.find(m => m.id === menuItemId)?.name ?? menuItemId;

  const updateQty = (idx: number, qty: number) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: Math.max(1, qty) };
      return next;
    });
  };

  const updateSpicy = (idx: number, spicy: string) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], spicy_level: spicy };
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (items.length === 0) { setError('At least one item must remain.'); return; }
    setSaving(true);
    setError('');
    try {
      await apiPatch(`/orders/${id}/`, { items });
      navigate('/caretaker/orders');
    } catch {
      setError('Failed to save modifications. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><p>Loading…</p></Layout>;
  if (!order) return <Layout><p>Order not found.</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Modify Order</h1>
        <button onClick={() => navigate('/caretaker/orders')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
      </div>

      <div style={{ background: '#fce4ec', borderRadius: 6, padding: '0.6rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <strong>Rejection reason:</strong> {order.rejection_reason ?? 'N/A'}
        {order.rejection_notes && ` — ${order.rejection_notes}`}
      </div>

      <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
        You can swap quantities, change spicy levels, or remove items. The guest will be notified when you save.
      </p>

      {items.map((item, idx) => (
        <div key={idx} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, fontWeight: 500 }}>{itemName(item.menu_item_id)}</span>
          {/* Qty */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button onClick={() => updateQty(idx, item.quantity - 1)} style={{ width: 30, height: 30, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#f5f5f5' }}>−</button>
            <span style={{ minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
            <button onClick={() => updateQty(idx, item.quantity + 1)} style={{ width: 30, height: 30, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#f5f5f5' }}>+</button>
          </div>
          {/* Spicy */}
          <select value={item.spicy_level} onChange={e => updateSpicy(idx, e.target.value)} style={{ padding: '0.3rem 0.5rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.85rem' }}>
            {SPICY_LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
          {/* Remove */}
          <button onClick={() => removeItem(idx)} style={{ color: '#c62828', background: 'none', border: '1px solid #fce4ec', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem', minHeight: 44 }}>Remove</button>
        </div>
      ))}

      {items.length === 0 && <p style={{ color: '#c62828', fontSize: '0.9rem' }}>All items removed — at least one must remain.</p>}

      {error && <p style={{ color: '#c62828', fontSize: '0.85rem' }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving || items.length === 0}
        style={{ marginTop: '1rem', background: saving || items.length === 0 ? '#ccc' : '#f16524', color: '#fff', border: 'none', borderRadius: 8, padding: '0.75rem 2rem', cursor: saving || items.length === 0 ? 'not-allowed' : 'pointer', minHeight: 44, fontSize: '1rem' }}
      >
        {saving ? 'Saving…' : 'Save & Notify Guest'}
      </button>
    </Layout>
  );
};

export default ModifyOrderPage;
