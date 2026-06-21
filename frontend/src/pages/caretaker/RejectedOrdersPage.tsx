import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet } from '../../lib/api';
import type { Order } from '../../types';
import { REJECTION_REASONS } from '../../types';

const TIMEOUT_MINUTES = 30;

const reasonLabel = (value: string) =>
  REJECTION_REASONS.find(r => r.value === value)?.label ?? value;

const isTimedOut = (order: Order) => {
  if (order.status !== 'pending') return false;
  const created = new Date(order.created_at).getTime();
  const ageMinutes = (Date.now() - created) / 60000;
  return ageMinutes > TIMEOUT_MINUTES;
};

const RejectedOrdersPage: React.FC = () => {
  const [rejected, setRejected] = useState<Order[]>([]);
  const [partiallyRejected, setPartiallyRejected] = useState<Order[]>([]);
  const [timedOut, setTimedOut] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiGet<Order[]>('/orders/?status=rejected'),
      apiGet<Order[]>('/orders/?status=pending'),
      apiGet<Order[]>('/orders/?status=partially_accepted'),
    ]).then(([rejectedOrders, pendingOrders, partialOrders]) => {
      setRejected(rejectedOrders);
      setTimedOut(pendingOrders.filter(isTimedOut));
      setPartiallyRejected(partialOrders);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading orders…</p></Layout>;

  const totalCount = rejected.length + timedOut.length + partiallyRejected.length;

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Orders Requiring Attention</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>
          Rejected orders and orders pending for over {TIMEOUT_MINUTES} minutes
        </p>
      </div>

      {totalCount === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <div style={{ width: 48, height: 48, background: '#f0fdf4', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.875rem' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p style={{ fontWeight: 500 }}>All clear!</p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>No orders need attention right now.</p>
        </div>
      )}

      {/* Timed-out orders */}
      {timedOut.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <Clock size={16} color="#d97706" />
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d97706' }}>
              Timed Out — No Response ({timedOut.length})
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {timedOut.map(order => (
              <OrderCard key={order.id} order={order} variant="timeout">
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate(`/caretaker/orders/${order.id}/resolve`)}
                    style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 38 }}
                  >
                    Resolve Order
                  </button>
                </div>
              </OrderCard>
            ))}
          </div>
        </section>
      )}

      {/* Partially rejected orders */}
      {partiallyRejected.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <AlertCircle size={16} color="#d97706" />
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d97706' }}>
              Items Partially Rejected — Source Missing Items ({partiallyRejected.length})
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {partiallyRejected.map(order => (
              <OrderCard key={order.id} order={order} variant="partial">
                {order.rejection_notes && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '0.5rem 0.75rem', marginTop: '0.75rem', fontSize: '0.85rem', color: '#78350f' }}>
                    <strong>Missing:</strong> {order.rejection_notes}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate(`/caretaker/orders/${order.id}/resolve`)}
                    style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 38 }}
                  >
                    Source Missing Items
                  </button>
                </div>
              </OrderCard>
            ))}
          </div>
        </section>
      )}

      {/* Rejected orders */}
      {rejected.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <AlertCircle size={16} color="#dc2626" />
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#dc2626' }}>
              Rejected by Caterer ({rejected.length})
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rejected.map(order => (
              <OrderCard key={order.id} order={order} variant="rejected">
                {order.rejection_reason && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.5rem 0.75rem', marginTop: '0.75rem', fontSize: '0.85rem', color: '#7f1d1d' }}>
                    <strong>Reason:</strong> {reasonLabel(order.rejection_reason)}
                    {order.rejection_notes && <span> — {order.rejection_notes}</span>}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate(`/caretaker/orders/${order.id}/resolve`)}
                    style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 38 }}
                  >
                    Resolve Order
                  </button>
                </div>
              </OrderCard>
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
};

interface OrderCardProps {
  order: Order;
  variant: 'rejected' | 'timeout' | 'partial';
  children?: React.ReactNode;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, variant, children }) => {
  const ageMinutes = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);

  const borderColor = variant === 'rejected' ? '#fecaca' : variant === 'partial' ? '#fde68a' : '#fde68a';

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: '1rem 1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontFamily: 'monospace' }}>
            #{order.id.slice(0, 8)}
          </span>
          <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#6b7280' }}>
            {new Date(order.created_at).toLocaleString()}
          </span>
          {variant === 'timeout' && (
            <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#d97706', fontWeight: 500 }}>
              ({ageMinutes} min ago)
            </span>
          )}
        </div>
        <span style={{
          padding: '2px 8px',
          borderRadius: 12,
          fontSize: '0.75rem',
          fontWeight: 600,
          background: variant === 'rejected' ? '#fee2e2' : '#fef3c7',
          color: variant === 'rejected' ? '#991b1b' : '#92400e',
        }}>
          {variant === 'rejected' ? 'Rejected' : variant === 'partial' ? 'Partially Rejected' : 'Timed Out'}
        </span>
      </div>

      <table style={{ width: '100%', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
        <tbody>
          {(order.items_detail || order.items).map((item, idx) => {
            const d = item as { name?: string; quantity: number; spicy_level?: string };
            return (
              <tr key={idx} style={{ borderTop: idx > 0 ? '1px solid #f0ece3' : undefined }}>
                <td style={{ padding: '0.3rem 0', color: '#374151' }}>{d.name || (item as { menu_item_id: string }).menu_item_id}</td>
                <td style={{ padding: '0.3rem', textAlign: 'center', color: '#6b7280' }}>×{d.quantity}</td>
                <td style={{ padding: '0.3rem', color: '#9ca3af', fontSize: '0.8rem' }}>{d.spicy_level}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {order.allergy_notes && (
        <p style={{ fontSize: '0.82rem', color: '#6b7280', background: '#fefce8', border: '1px solid #fef08a', padding: '0.4rem 0.65rem', borderRadius: 5, marginTop: '0.5rem' }}>
          Guest note: {order.allergy_notes}
        </p>
      )}

      {children}
    </div>
  );
};

export default RejectedOrdersPage;
