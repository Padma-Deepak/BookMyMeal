import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet } from '../../lib/api';
import type { Order } from '../../types';
import { REJECTION_REASONS } from '../../types';

const reasonLabel = (value: string) =>
  REJECTION_REASONS.find(r => r.value === value)?.label ?? value;

const RejectedOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiGet<Order[]>('/orders/?status=rejected')
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout><p>Loading…</p></Layout>;

  return (
    <Layout>
      <h1 style={{ marginBottom: '1.5rem' }}>Rejected Orders</h1>
      {orders.length === 0 && <p style={{ color: '#666' }}>No rejected orders.</p>}
      {orders.map(order => (
        <div key={order.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#999' }}>Order #{order.id.slice(0, 8)}…</span>
              <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#666' }}>{new Date(order.created_at).toLocaleString()}</span>
            </div>
            <span style={{ background: '#fce4ec', color: '#c62828', fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 12, fontWeight: 600 }}>Rejected</span>
          </div>

          {/* Caterer rejection reason — visible to caretaker (PRD §4.3.1) */}
          {order.rejection_reason && (
            <div style={{ background: '#fce4ec', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              <strong>Caterer reason:</strong> {reasonLabel(order.rejection_reason)}
              {order.rejection_notes && <span> — {order.rejection_notes}</span>}
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            <tbody>
              {(order.items_detail || order.items).map((item, idx) => {
                const d = item as { name?: string; quantity: number; spicy_level?: string };
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '0.3rem 0' }}>{d.name || (item as { menu_item_id: string }).menu_item_id}</td>
                    <td style={{ padding: '0.3rem', color: '#666' }}>×{d.quantity}</td>
                    <td style={{ padding: '0.3rem', color: '#666', fontSize: '0.8rem' }}>{d.spicy_level}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {order.allergy_notes && (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', background: '#fffde7', padding: '0.4rem 0.6rem', borderRadius: 4, color: '#666' }}>
              Guest note: {order.allergy_notes}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(`/caretaker/orders/${order.id}/modify`)}
              style={{ background: '#f16524', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', cursor: 'pointer', minHeight: 44, fontWeight: 600 }}
            >
              Modify Order
            </button>
            <button
              onClick={() => navigate(`/caretaker/external-purchase?order=${order.id}&guest=${order.guest}`)}
              style={{ background: '#fff', border: '1px solid #f16524', color: '#f16524', borderRadius: 6, padding: '0.5rem 1.2rem', cursor: 'pointer', minHeight: 44 }}
            >
              Log External Purchase
            </button>
          </div>
        </div>
      ))}
    </Layout>
  );
};

export default RejectedOrdersPage;
