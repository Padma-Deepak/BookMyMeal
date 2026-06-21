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
        setItems((found.items_detail ?? []).map(item => ({
          menu_item_id: String(item.menu_item_id!),
          quantity: item.quantity,
          spicy_level: item.spicy_level || 'None',
          name: item.name,
        })));
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
      const writeItems = items.map(({ menu_item_id, quantity, spicy_level }) => ({ menu_item_id, quantity, spicy_level }));
      await apiPatch(`/orders/${id}/`, { items: writeItems });
      navigate('/caretaker/orders');
    } catch {
      setError('Failed to save modifications. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading…</p></Layout>;
  if (!order) return <Layout><p style={{ color: '#6b7280' }}>Order not found.</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Modify Order</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Adjust items and resubmit to caterer</p>
        </div>
        <button
          onClick={() => navigate('/caretaker/orders')}
          style={{ background: 'none', border: 'none', color: '#1a3c2c', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Back
        </button>
      </div>

      {/* Rejection reason banner */}
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#991b1b' }}>
        <strong>Rejection reason:</strong> {order.rejection_reason ?? 'N/A'}
        {order.rejection_notes && ` — ${order.rejection_notes}`}
      </div>

      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
        Adjust quantities, spicy levels, or remove items. The caterer will see the updated order.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: '0.875rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <span style={{ flex: 1, minWidth: 140, fontWeight: 500, color: '#111827' }}>
              {item.name || itemName(item.menu_item_id)}
            </span>

            {/* Quantity stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => updateQty(idx, item.quantity - 1)}
                style={{ width: 30, height: 30, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: '#f0ece3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#374151' }}
              >−</button>
              <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600, color: '#111827' }}>{item.quantity}</span>
              <button
                onClick={() => updateQty(idx, item.quantity + 1)}
                style={{ width: 30, height: 30, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: '#f0ece3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#374151' }}
              >+</button>
            </div>

            {/* Spicy level */}
            <select
              value={item.spicy_level}
              onChange={e => updateSpicy(idx, e.target.value)}
              style={{ padding: '0.35rem 0.55rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', color: '#374151', background: '#fff', minHeight: 34 }}
            >
              {SPICY_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>

            {/* Remove */}
            <button
              onClick={() => removeItem(idx)}
              style={{ background: 'none', border: '1px solid #fee2e2', borderRadius: 6, padding: '0.3rem 0.65rem', cursor: 'pointer', color: '#dc2626', fontSize: '0.82rem', minHeight: 34 }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.65rem 0.875rem', fontSize: '0.875rem', color: '#dc2626', marginBottom: '1rem' }}>
          All items removed — at least one must remain before saving.
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.65rem 0.875rem', fontSize: '0.875rem', color: '#dc2626', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || items.length === 0}
        style={{
          background: saving || items.length === 0 ? '#e5e7eb' : '#1a3c2c',
          color: saving || items.length === 0 ? '#9ca3af' : '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '0.7rem 2rem',
          cursor: saving || items.length === 0 ? 'not-allowed' : 'pointer',
          fontWeight: 700,
          fontSize: '0.95rem',
          minHeight: 46,
        }}
      >
        {saving ? 'Saving…' : 'Save & Notify Guest'}
      </button>
    </Layout>
  );
};

export default ModifyOrderPage;
