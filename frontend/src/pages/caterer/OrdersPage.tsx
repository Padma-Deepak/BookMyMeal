import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { apiGet, apiPatch } from '../../lib/api';
import type { Order } from '../../types';
import { REJECTION_REASONS } from '../../types';

interface ItemDecision {
  accepted: boolean;
  rejection_reason: string;
  rejection_notes: string;
}

const isToday = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [itemDecisions, setItemDecisions] = useState<Record<number, ItemDecision>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmingPreparedId, setConfirmingPreparedId] = useState<string | null>(null);

  const fetchOrders = () =>
    Promise.all([
      apiGet<Order[]>('/orders/?status=pending'),
      apiGet<Order[]>('/orders/?status=accepted'),
      apiGet<Order[]>('/orders/?status=rejected'),
      apiGet<Order[]>('/orders/?status=prepared'),
      apiGet<Order[]>('/orders/?status=partially_accepted'),
    ]).then(([pending, accepted, rejected, prepared, partial]) => setOrders([...pending, ...accepted, ...rejected, ...prepared, ...partial]));

  useEffect(() => {
    fetchOrders().finally(() => setLoading(false));
  }, []);

  const startDecision = (order: Order) => {
    const items = order.items_detail ?? order.items ?? [];
    const initial: Record<number, ItemDecision> = {};
    items.forEach((_, idx) => {
      initial[idx] = { accepted: true, rejection_reason: 'out_of_stock', rejection_notes: '' };
    });
    setItemDecisions(initial);
    setDecidingId(order.id);
    setError('');
  };

  const toggleItem = (idx: number, accepted: boolean) => {
    setItemDecisions(prev => ({ ...prev, [idx]: { ...prev[idx], accepted } }));
  };

  const setItemField = (idx: number, field: 'rejection_reason' | 'rejection_notes', value: string) => {
    setItemDecisions(prev => ({ ...prev, [idx]: { ...prev[idx], [field]: value } }));
  };

  const handleSubmitDecision = async (order: Order) => {
    const items = order.items_detail ?? order.items ?? [];
    const acceptedIdxs = items.map((_, i) => i).filter(i => itemDecisions[i]?.accepted !== false);
    const rejectedIdxs = items.map((_, i) => i).filter(i => itemDecisions[i]?.accepted === false);

    for (const i of rejectedIdxs) {
      if (itemDecisions[i].rejection_reason === 'other' && !itemDecisions[i].rejection_notes.trim()) {
        setError('Please describe the reason for all items rejected with "Other".');
        return;
      }
    }

    setProcessingId(order.id);
    setError('');
    try {
      if (acceptedIdxs.length === 0) {
        const primaryReason = itemDecisions[rejectedIdxs[0]]?.rejection_reason || 'other';
        const notes = rejectedIdxs.map(i => {
          const item = items[i] as { name?: string };
          const d = itemDecisions[i];
          return d.rejection_notes
            ? `${item.name || `Item ${i + 1}`} (${d.rejection_notes})`
            : item.name || `Item ${i + 1}`;
        }).join('; ');
        await apiPatch(`/orders/${order.id}/`, {
          status: 'rejected',
          rejection_reason: primaryReason,
          rejection_notes: notes,
        });
      } else if (rejectedIdxs.length === 0) {
        await apiPatch(`/orders/${order.id}/`, { status: 'accepted' });
      } else {
        const writeItems = acceptedIdxs.map(i => {
          const item = items[i] as { menu_item_id?: string; quantity: number; spicy_level?: string };
          return { menu_item_id: item.menu_item_id || '', quantity: item.quantity, spicy_level: item.spicy_level || 'None' };
        });
        const rejectedSummary = rejectedIdxs.map(i => {
          const item = items[i] as { name?: string };
          const d = itemDecisions[i];
          return d.rejection_notes
            ? `${item.name || `Item ${i + 1}`} (${d.rejection_notes})`
            : item.name || `Item ${i + 1}`;
        }).join(', ');
        await apiPatch(`/orders/${order.id}/`, {
          status: 'partially_accepted',
          items: writeItems,
          rejection_notes: `Items not available: ${rejectedSummary}`,
        });
      }
      setDecidingId(null);
      fetchOrders();
    } catch {
      setError('Failed to submit decision. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmPrepared = async (id: string) => {
    setProcessingId(id);
    await apiPatch(`/orders/${id}/`, { status: 'prepared' });
    setProcessingId(null);
    setConfirmingPreparedId(null);
    fetchOrders();
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading orders…</p></Layout>;

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const acceptedOrders = orders.filter(o => o.status === 'accepted');
  const rejectedOrders = orders.filter(o => (o.status === 'rejected' || o.status === 'partially_accepted') && isToday(o.updated_at));
  const preparedOrders = orders.filter(o => o.status === 'prepared' && isToday(o.updated_at));
  const rejectionLabel = (value?: string) => REJECTION_REASONS.find(r => r.value === value)?.label || value || 'Unknown';

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Incoming Orders</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Accept or reject items individually</p>
      </div>

      {pendingOrders.length === 0 && acceptedOrders.length === 0 && rejectedOrders.length === 0 && preparedOrders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontWeight: 500 }}>No orders at the moment.</p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>New orders will appear here.</p>
        </div>
      )}

      {pendingOrders.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>
            Awaiting Decision ({pendingOrders.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingOrders.map(order => {
              const items = order.items_detail ?? order.items ?? [];
              const isDeciding = decidingId === order.id;
              return (
                <div key={order.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem 1.125rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>#{order.id.slice(0, 8)}</span>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(order.created_at).toLocaleString()}</span>
                  </div>

                  {!isDeciding ? (
                    <>
                      <table style={{ width: '100%', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                        <tbody>
                          {items.map((item, idx) => {
                            const d = item as { name?: string; quantity: number; spicy_level?: string };
                            return (
                              <tr key={idx} style={{ borderTop: idx > 0 ? '1px solid #f0ece3' : undefined }}>
                                <td style={{ padding: '0.3rem 0', color: '#374151', fontWeight: 500 }}>
                                  {d.name || (item as { menu_item_id: string }).menu_item_id}
                                </td>
                                <td style={{ padding: '0.3rem', textAlign: 'center', color: '#6b7280' }}>×{d.quantity}</td>
                                <td style={{ padding: '0.3rem', color: '#9ca3af', fontSize: '0.8rem' }}>{d.spicy_level}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {order.allergy_notes && (
                        <p style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: '#6b7280', background: '#fefce8', border: '1px solid #fef08a', padding: '0.4rem 0.65rem', borderRadius: 5 }}>
                          Note: {order.allergy_notes}
                        </p>
                      )}
                      <button
                        onClick={() => startDecision(order)}
                        style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 1.125rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 38 }}
                      >
                        Make Decision
                      </button>
                    </>
                  ) : (
                    <div style={{ background: '#f0ece3', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem' }}>
                        Accept or reject each item — rejected items will be removed from the order:
                      </p>

                      {items.map((item, idx) => {
                        const d = item as { name?: string; quantity: number; spicy_level?: string };
                        const dec = itemDecisions[idx] || { accepted: true, rejection_reason: 'out_of_stock', rejection_notes: '' };
                        return (
                          <div
                            key={idx}
                            style={{
                              background: '#fff',
                              border: `1px solid ${dec.accepted ? '#a7f3d0' : '#fca5a5'}`,
                              borderRadius: 8,
                              padding: '0.75rem',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div>
                                <span style={{ fontWeight: 500, color: '#111827' }}>
                                  {d.name || (item as { menu_item_id: string }).menu_item_id}
                                </span>
                                <span style={{ color: '#6b7280', fontSize: '0.82rem', marginLeft: 8 }}>×{d.quantity}</span>
                                {d.spicy_level && d.spicy_level !== 'None' && (
                                  <span style={{ color: '#9ca3af', fontSize: '0.78rem', marginLeft: 6 }}>{d.spicy_level}</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  onClick={() => toggleItem(idx, true)}
                                  style={{
                                    background: dec.accepted ? '#d1fae5' : '#f0ece3',
                                    border: `1px solid ${dec.accepted ? '#6ee7b7' : '#d1d5db'}`,
                                    color: dec.accepted ? '#065f46' : '#6b7280',
                                    borderRadius: 6,
                                    padding: '0.25rem 0.7rem',
                                    cursor: 'pointer',
                                    fontWeight: dec.accepted ? 700 : 400,
                                    fontSize: '0.82rem',
                                    minHeight: 32,
                                  }}
                                >
                                  ✓ Accept
                                </button>
                                <button
                                  onClick={() => toggleItem(idx, false)}
                                  style={{
                                    background: !dec.accepted ? '#fee2e2' : '#f0ece3',
                                    border: `1px solid ${!dec.accepted ? '#fca5a5' : '#d1d5db'}`,
                                    color: !dec.accepted ? '#991b1b' : '#6b7280',
                                    borderRadius: 6,
                                    padding: '0.25rem 0.7rem',
                                    cursor: 'pointer',
                                    fontWeight: !dec.accepted ? 700 : 400,
                                    fontSize: '0.82rem',
                                    minHeight: 32,
                                  }}
                                >
                                  ✗ Reject
                                </button>
                              </div>
                            </div>

                            {!dec.accepted && (
                              <div style={{ marginTop: '0.5rem' }}>
                                <select
                                  value={dec.rejection_reason}
                                  onChange={e => setItemField(idx, 'rejection_reason', e.target.value)}
                                  style={{ width: '100%', padding: '0.35rem 0.55rem', border: '1px solid #fca5a5', borderRadius: 6, fontSize: '0.82rem', color: '#374151', background: '#fff', marginBottom: dec.rejection_reason === 'other' ? '0.35rem' : 0 }}
                                >
                                  {REJECTION_REASONS.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                  ))}
                                </select>
                                {dec.rejection_reason === 'other' && (
                                  <input
                                    type="text"
                                    value={dec.rejection_notes}
                                    onChange={e => setItemField(idx, 'rejection_notes', e.target.value)}
                                    placeholder="Describe the reason…"
                                    style={{ width: '100%', padding: '0.35rem 0.55rem', border: '1px solid #fca5a5', borderRadius: 6, fontSize: '0.82rem', color: '#111827', boxSizing: 'border-box' }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {error && (
                        <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: '0.5rem 0 0.25rem' }}>{error}</p>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }}>
                        <button
                          onClick={() => handleSubmitDecision(order)}
                          disabled={processingId === order.id}
                          style={{
                            background: processingId === order.id ? '#e5e7eb' : '#1a3c2c',
                            color: processingId === order.id ? '#9ca3af' : '#fff',
                            border: 'none',
                            borderRadius: 7,
                            padding: '0.45rem 1rem',
                            cursor: processingId === order.id ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            minHeight: 38,
                          }}
                        >
                          {processingId === order.id ? 'Submitting…' : 'Submit Decision'}
                        </button>
                        <button
                          onClick={() => setDecidingId(null)}
                          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 7, padding: '0.45rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', minHeight: 38, color: '#374151' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {acceptedOrders.length > 0 && (
        <section>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>
            Accepted — In Preparation ({acceptedOrders.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {acceptedOrders.map(order => (
              <div key={order.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem 1.125rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>#{order.id.slice(0, 8)}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(order.created_at).toLocaleString()}</span>
                </div>
                <table style={{ width: '100%', fontSize: '0.875rem' }}>
                  <tbody>
                    {(order.items_detail ?? order.items ?? []).map((item, idx) => {
                      const d = item as { name?: string; quantity: number; spicy_level?: string };
                      return (
                        <tr key={idx} style={{ borderTop: idx > 0 ? '1px solid #f0ece3' : undefined }}>
                          <td style={{ padding: '0.3rem 0', color: '#374151', fontWeight: 500 }}>
                            {d.name || (item as { menu_item_id: string }).menu_item_id}
                          </td>
                          <td style={{ padding: '0.3rem', textAlign: 'center', color: '#6b7280' }}>×{d.quantity}</td>
                          <td style={{ padding: '0.3rem', color: '#9ca3af', fontSize: '0.8rem' }}>{d.spicy_level}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {order.allergy_notes && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#6b7280', background: '#fefce8', border: '1px solid #fef08a', padding: '0.4rem 0.65rem', borderRadius: 5 }}>
                    Note: {order.allergy_notes}
                  </p>
                )}
                {confirmingPreparedId === order.id ? (
                  <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: '#374151', fontWeight: 500 }}>Confirm this order is fully prepared?</span>
                    <button
                      onClick={() => handleConfirmPrepared(order.id)}
                      disabled={processingId === order.id}
                      style={{ background: processingId === order.id ? '#93c5fd' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 1.125rem', cursor: processingId === order.id ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 38 }}
                    >
                      {processingId === order.id ? 'Confirming…' : 'Yes, Confirm Prepared'}
                    </button>
                    <button
                      onClick={() => setConfirmingPreparedId(null)}
                      disabled={processingId === order.id}
                      style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 7, padding: '0.45rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', minHeight: 38, color: '#374151' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingPreparedId(order.id)}
                    style={{ marginTop: '0.875rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 1.125rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 38 }}
                  >
                    Mark as Prepared
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {rejectedOrders.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>
            Rejected Today ({rejectedOrders.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rejectedOrders.map(order => {
              const isPartial = order.status === 'partially_accepted';
              return (
              <div key={order.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem 1.125rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>#{order.id.slice(0, 8)}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(order.created_at).toLocaleString()}</span>
                  <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>
                    {isPartial ? 'Partially Rejected' : 'Rejected'}
                  </span>
                </div>
                {isPartial && (order.items_detail ?? order.items ?? []).length > 0 && (
                  <>
                    <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.3rem' }}>Still being prepared:</p>
                    <table style={{ width: '100%', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      <tbody>
                        {(order.items_detail ?? order.items ?? []).map((item, idx) => {
                          const d = item as { name?: string; quantity: number; spicy_level?: string };
                          return (
                            <tr key={idx} style={{ borderTop: idx > 0 ? '1px solid #f0ece3' : undefined }}>
                              <td style={{ padding: '0.3rem 0', color: '#374151', fontWeight: 500 }}>
                                {d.name || (item as { menu_item_id: string }).menu_item_id}
                              </td>
                              <td style={{ padding: '0.3rem', textAlign: 'center', color: '#6b7280' }}>×{d.quantity}</td>
                              <td style={{ padding: '0.3rem', color: '#9ca3af', fontSize: '0.8rem' }}>{d.spicy_level}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
                {!isPartial && (
                  <table style={{ width: '100%', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    <tbody>
                      {(order.items_detail ?? order.items ?? []).map((item, idx) => {
                        const d = item as { name?: string; quantity: number; spicy_level?: string };
                        return (
                          <tr key={idx} style={{ borderTop: idx > 0 ? '1px solid #f0ece3' : undefined }}>
                            <td style={{ padding: '0.3rem 0', color: '#374151', fontWeight: 500 }}>
                              {d.name || (item as { menu_item_id: string }).menu_item_id}
                            </td>
                            <td style={{ padding: '0.3rem', textAlign: 'center', color: '#6b7280' }}>×{d.quantity}</td>
                            <td style={{ padding: '0.3rem', color: '#9ca3af', fontSize: '0.8rem' }}>{d.spicy_level}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                <p style={{ fontSize: '0.82rem', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.4rem 0.65rem', borderRadius: 5 }}>
                  {isPartial
                    ? order.rejection_notes
                    : <>Reason: {rejectionLabel(order.rejection_reason)}{order.rejection_notes ? ` — ${order.rejection_notes}` : ''}</>}
                </p>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {preparedOrders.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>
            Prepared Today — Awaiting Delivery ({preparedOrders.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {preparedOrders.map(order => (
              <div key={order.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem 1.125rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>#{order.id.slice(0, 8)}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(order.created_at).toLocaleString()}</span>
                  <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>Prepared</span>
                </div>
                <table style={{ width: '100%', fontSize: '0.875rem' }}>
                  <tbody>
                    {(order.items_detail ?? order.items ?? []).map((item, idx) => {
                      const d = item as { name?: string; quantity: number; spicy_level?: string };
                      return (
                        <tr key={idx} style={{ borderTop: idx > 0 ? '1px solid #f0ece3' : undefined }}>
                          <td style={{ padding: '0.3rem 0', color: '#374151', fontWeight: 500 }}>
                            {d.name || (item as { menu_item_id: string }).menu_item_id}
                          </td>
                          <td style={{ padding: '0.3rem', textAlign: 'center', color: '#6b7280' }}>×{d.quantity}</td>
                          <td style={{ padding: '0.3rem', color: '#9ca3af', fontSize: '0.8rem' }}>{d.spicy_level}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
};

export default OrdersPage;
