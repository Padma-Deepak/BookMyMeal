import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet } from '../../lib/api';
import type { Order, User } from '../../types';

const GuestOrdersPage: React.FC = () => {
  const { guestId } = useParams<{ guestId: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [guest, setGuest] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<Order[]>(`/orders/?guest_id=${guestId}`),
      apiGet<User[]>(`/users/?role=guest`),
    ]).then(([guestOrders, users]) => {
      setOrders(guestOrders);
      setGuest(users.find(u => u.id === guestId) || null);
    }).finally(() => setLoading(false));
  }, [guestId]);

  if (loading) return <Layout><p>Loading…</p></Layout>;

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    pending: { bg: '#fff3e0', color: '#e65100' },
    accepted: { bg: '#e8f5e9', color: '#2e7d32' },
    rejected: { bg: '#fce4ec', color: '#c62828' },
    prepared: { bg: '#e3f2fd', color: '#1565c0' },
    delivered: { bg: '#f3e5f5', color: '#6a1b9a' },
  };

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Orders — {guest?.username ?? guestId}</h1>
          {guest?.email && <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#666' }}>{guest.email}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => navigate(`/manager/bill/generate?guest=${guestId}`)}
            style={{ background: '#f16524', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem', cursor: 'pointer', minHeight: 44 }}
          >
            Generate Bill
          </button>
          <button onClick={() => navigate('/manager/dashboard')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        </div>
      </div>

      {orders.length === 0 && <p style={{ color: '#666' }}>No orders for this guest.</p>}

      {orders.map(order => {
        const sc = STATUS_COLORS[order.status] || { bg: '#f5f5f5', color: '#666' };
        const orderTotal = (order.items_detail || []).reduce((sum, item) =>
          sum + (item.is_complimentary ? 0 : item.customer_price * item.quantity), 0);
        return (
          <div key={order.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: '#f9f9f9', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>{new Date(order.created_at).toLocaleString()}</span>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <strong>₹{orderTotal.toFixed(2)}</strong>
                <span style={{ background: sc.bg, color: sc.color, fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 12, fontWeight: 600 }}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {(order.items_detail || order.items).map((item, idx) => {
                  const d = item as { name?: string; customer_price?: number; quantity: number; is_complimentary?: boolean; spicy_level?: string };
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '0.5rem 1rem' }}>{d.name || (item as { menu_item_id: string }).menu_item_id}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>×{d.quantity}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: '#666', fontSize: '0.8rem' }}>{d.spicy_level}</td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.9rem' }}>
                        {d.is_complimentary ? <span style={{ color: '#2e7d32' }}>₹0</span> : `₹${((d.customer_price || 0) * d.quantity).toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {order.allergy_notes && (
              <div style={{ padding: '0.5rem 1rem', background: '#fffde7', fontSize: '0.85rem', color: '#666' }}>
                Note: {order.allergy_notes}
              </div>
            )}
          </div>
        );
      })}
    </Layout>
  );
};

export default GuestOrdersPage;
