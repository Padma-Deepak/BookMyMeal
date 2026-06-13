import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Order } from '../../types';
import { CATEGORY_LABELS } from '../../types';

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  pending:   { background: '#fef3c7', color: '#92400e' },
  accepted:  { background: '#d1fae5', color: '#065f46' },
  rejected:  { background: '#fee2e2', color: '#991b1b' },
  prepared:  { background: '#dbeafe', color: '#1e40af' },
  delivered: { background: '#ede9fe', color: '#4c1d95' },
};

const BillPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Order[]>('/orders/')
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  const spendByCategory = orders.reduce<Record<string, number>>((acc, order) => {
    (order.items_detail || []).forEach(item => {
      const cat = item.category || 'other';
      acc[cat] = (acc[cat] || 0) + (item.is_complimentary ? 0 : (item.customer_price ?? 0) * item.quantity);
    });
    return acc;
  }, {});

  const grandTotal = Object.values(spendByCategory).reduce((s, v) => s + v, 0);

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading…</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>My Bill</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>{user?.username} · Read-only view</p>
        </div>
        <button
          onClick={() => navigate('/guest/menu')}
          style={{ background: 'none', border: 'none', color: '#f16524', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Menu
        </button>
      </div>

      {/* Spending breakdown */}
      {Object.keys(spendByCategory).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Spending Breakdown</h2>
            <span style={{ fontWeight: 700, color: '#f16524', fontSize: '1rem' }}>Total ₹{grandTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {Object.entries(spendByCategory).map(([cat, amount]) => (
              <div key={cat} style={{ background: '#fff8f5', border: '1px solid #fed7aa', borderRadius: 8, padding: '0.5rem 0.875rem', minWidth: 100 }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 2 }}>{CATEGORY_LABELS[cat] ?? cat}</div>
                <div style={{ fontWeight: 700, color: '#f16524' }}>₹{amount.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontWeight: 500 }}>No orders yet.</p>
          <button
            onClick={() => navigate('/guest/menu')}
            style={{ marginTop: '0.75rem', background: '#f16524', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
          >
            Browse Menu
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {orders.map(order => {
            const sc = STATUS_STYLE[order.status] || { background: '#f3f4f6', color: '#6b7280' };
            const orderTotal = (order.items_detail || []).reduce(
              (sum, item) => sum + (item.is_complimentary ? 0 : (item.customer_price ?? 0) * item.quantity), 0);
            return (
              <div key={order.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '0.65rem 1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>₹{orderTotal.toFixed(2)}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '2px 8px', borderRadius: 12,
                      fontSize: '0.75rem', fontWeight: 600, ...sc
                    }}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                </div>
                <table style={{ width: '100%' }}>
                  <tbody>
                    {(order.items_detail || order.items || []).map((item, idx) => {
                      const d = item as { name?: string; customer_price?: number; quantity: number; is_complimentary?: boolean; spicy_level?: string };
                      return (
                        <tr key={idx} style={{ borderBottom: idx < (order.items_detail || order.items || []).length - 1 ? '1px solid #f9fafb' : undefined }}>
                          <td style={{ padding: '0.5rem 1rem', color: '#374151', fontWeight: 500 }}>
                            {d.name || (item as { menu_item_id: string }).menu_item_id}
                            {d.is_complimentary && (
                              <span style={{ marginLeft: 6, background: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>Complimentary</span>
                            )}
                            {d.spicy_level && d.spicy_level !== 'None' && (
                              <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#9ca3af' }}>({d.spicy_level})</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>×{d.quantity}</td>
                          <td style={{ padding: '0.5rem 1rem', textAlign: 'right', color: d.is_complimentary ? '#16a34a' : '#111827', fontWeight: 500 }}>
                            {d.is_complimentary ? '₹0' : `₹${((d.customer_price || 0) * d.quantity).toFixed(2)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {order.allergy_notes && (
                  <div style={{ padding: '0.45rem 1rem', background: '#fefce8', fontSize: '0.82rem', color: '#6b7280', borderTop: '1px solid #f3f4f6' }}>
                    Note: {order.allergy_notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: '0.8rem', color: '#d1d5db', marginTop: '1.5rem', textAlign: 'center' }}>
        Bill is read-only. Contact the manager for billing queries.
      </p>
    </Layout>
  );
};

export default BillPage;
