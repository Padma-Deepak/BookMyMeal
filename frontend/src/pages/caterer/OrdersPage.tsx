import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { apiGet, apiPatch } from '../../lib/api';
import type { Order } from '../../types';
import { REJECTION_REASONS } from '../../types';

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('out_of_stock');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [error, setError] = useState('');

  const fetchOrders = () => {
    apiGet<Order[]>('/orders/?status=pending')
      .then(setOrders)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleApprove = async (id: string) => {
    await apiPatch(`/orders/${id}/`, { status: 'accepted' });
    fetchOrders();
  };

  const handleReject = async (id: string) => {
    setError('');
    if (rejectionReason === 'other' && !rejectionNotes.trim()) {
      setError('Please provide rejection notes when selecting "Other".');
      return;
    }
    await apiPatch(`/orders/${id}/`, {
      status: 'rejected',
      rejection_reason: rejectionReason,
      rejection_notes: rejectionNotes,
    });
    setRejectingId(null);
    setRejectionReason('out_of_stock');
    setRejectionNotes('');
    fetchOrders();
  };

  const handleMarkPrepared = async (id: string) => {
    await apiPatch(`/orders/${id}/`, { status: 'prepared' });
    fetchOrders();
  };

  if (loading) return <Layout><p>Loading orders…</p></Layout>;

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const acceptedOrders = orders.filter(o => o.status === 'accepted');

  return (
    <Layout>
      <h1 style={{ marginBottom: '1.5rem' }}>Incoming Orders</h1>

      {pendingOrders.length === 0 && acceptedOrders.length === 0 && (
        <p style={{ color: '#666' }}>No orders at the moment.</p>
      )}

      {pendingOrders.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#e65100', marginBottom: '1rem' }}>Pending Approval</h2>
          {pendingOrders.map(order => (
            <OrderCard key={order.id} order={order}>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleApprove(order.id)}
                  style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', cursor: 'pointer', minHeight: 44, fontWeight: 600 }}
                >
                  Approve
                </button>
                <button
                  onClick={() => { setRejectingId(order.id); setError(''); }}
                  style={{ background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', cursor: 'pointer', minHeight: 44, fontWeight: 600 }}
                >
                  Reject
                </button>
              </div>

              {rejectingId === order.id && (
                <div style={{ marginTop: '0.75rem', background: '#fff8f5', border: '1px solid #f0c0a0', borderRadius: 8, padding: '1rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Select rejection reason:</p>
                  {/* Built-in reasons shown prominently before free-text (NFR §8.4) */}
                  {REJECTION_REASONS.map(r => (
                    <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name={`reason-${order.id}`}
                        value={r.value}
                        checked={rejectionReason === r.value}
                        onChange={() => setRejectionReason(r.value)}
                      />
                      {r.label}
                    </label>
                  ))}
                  {rejectionReason === 'other' && (
                    <textarea
                      value={rejectionNotes}
                      onChange={e => setRejectionNotes(e.target.value)}
                      placeholder="Please describe the reason…"
                      rows={2}
                      style={{ width: '100%', marginTop: '0.5rem', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
                    />
                  )}
                  {error && <p style={{ color: '#c62828', fontSize: '0.85rem', marginTop: '0.25rem' }}>{error}</p>}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      onClick={() => handleReject(order.id)}
                      style={{ background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1rem', cursor: 'pointer', minHeight: 44 }}
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => setRejectingId(null)}
                      style={{ background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 6, padding: '0.5rem 1rem', cursor: 'pointer', minHeight: 44 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </OrderCard>
          ))}
        </section>
      )}

      {acceptedOrders.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1rem', color: '#1565c0', marginBottom: '1rem' }}>Accepted — In Preparation</h2>
          {acceptedOrders.map(order => (
            <OrderCard key={order.id} order={order}>
              <button
                onClick={() => handleMarkPrepared(order.id)}
                style={{ marginTop: '0.75rem', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', cursor: 'pointer', minHeight: 44 }}
              >
                Mark as Prepared
              </button>
            </OrderCard>
          ))}
        </section>
      )}
    </Layout>
  );
};

const OrderCard: React.FC<{ order: Order; children?: React.ReactNode }> = ({ order, children }) => (
  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
      <div>
        <span style={{ fontSize: '0.8rem', color: '#999' }}>Order #{order.id.slice(0, 8)}…</span>
        <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#666' }}>{new Date(order.created_at).toLocaleString()}</span>
      </div>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
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
    {order.allergy_notes && <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#666', background: '#fffde7', padding: '0.4rem 0.6rem', borderRadius: 4 }}>Note: {order.allergy_notes}</p>}
    {children}
  </div>
);

export default OrdersPage;
