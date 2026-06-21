import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet, apiFetch } from '../../lib/api';
import type { ExternalPurchase, Order, User } from '../../types';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending:   { background: '#fef3c7', color: '#92400e' },
  accepted:  { background: '#d1fae5', color: '#065f46' },
  rejected:  { background: '#fee2e2', color: '#991b1b' },
  prepared:  { background: '#dbeafe', color: '#1e40af' },
  delivered: { background: '#ede9fe', color: '#4c1d95' },
  resolved:  { background: '#f0fdf4', color: '#166534' },
};

const GuestOrdersPage: React.FC = () => {
  const { guestId } = useParams<{ guestId: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [guest, setGuest] = useState<User | null>(null);
  const [extPurchases, setExtPurchases] = useState<ExternalPurchase[]>([]);
  const [reimbursing, setReimbursing] = useState<string | null>(null);
  const proofRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    return Promise.all([
      apiGet<Order[]>(`/orders/?guest_id=${guestId}`),
      apiGet<User[]>(`/users/?role=guest`),
      apiGet<ExternalPurchase[]>(`/external-purchases/?guest_id=${guestId}`),
    ]).then(([guestOrders, users, purchases]) => {
      setOrders(guestOrders);
      setGuest(users.find(u => u.id === guestId) || null);
      setExtPurchases(purchases);
    });
  };

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [guestId]);

  const handleReimburse = async (ep: ExternalPurchase) => {
    const file = proofRefs.current[ep.id]?.files?.[0];
    if (!file) { alert('Please select a proof file first.'); return; }
    setReimbursing(ep.id);
    const fd = new FormData();
    fd.append('is_reimbursed', 'true');
    fd.append('reimbursement_proof', file);
    await apiFetch(`/external-purchases/${ep.id}/`, { method: 'PATCH', body: fd });
    await fetchAll();
    setReimbursing(null);
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading…</p></Layout>;

  const totalSpend = orders.reduce((sum, order) =>
    sum + (order.items_detail || []).reduce((s, item) =>
      s + (item.is_complimentary ? 0 : (item.customer_price ?? 0) * item.quantity), 0), 0);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Orders — {guest?.username ?? guestId}</h1>
          {guest?.email && <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>{guest.email}</p>}
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>
            {orders.length} order{orders.length !== 1 ? 's' : ''} · Total: <strong style={{ color: '#111827' }}>₹{totalSpend.toFixed(2)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            onClick={() => navigate(`/manager/bill/generate?guest=${guestId}`)}
            style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 40 }}
          >
            Generate Bill
          </button>
          <button
            onClick={() => navigate('/manager/dashboard')}
            style={{ background: 'none', border: 'none', color: '#1a3c2c', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ← Back
          </button>
        </div>
      </div>

      {orders.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>No orders for this guest.</p>
      )}

      {/* ── Caretaker Expenses (out-of-pocket) ── */}
      {extPurchases.filter(ep => ep.is_paid_by_caretaker).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '1.25rem' }}>
          <div style={{ padding: '0.6rem 1rem', background: '#f0ece3', borderBottom: '1px solid #e5e7eb', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Caretaker Out-of-Pocket Expenses
          </div>
          <table style={{ width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                {['Item', 'Vendor', 'Cost', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 1rem', fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: h === 'Cost' || h === 'Action' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {extPurchases.filter(ep => ep.is_paid_by_caretaker).map(ep => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #f0ece3' }}>
                  <td style={{ padding: '0.6rem 1rem', color: '#374151', fontWeight: 500, fontSize: '0.875rem' }}>{ep.item_name}</td>
                  <td style={{ padding: '0.6rem 0.5rem', color: '#6b7280', fontSize: '0.82rem' }}>{ep.vendor_name}</td>
                  <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>₹{Number(ep.cost).toFixed(2)}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    {ep.is_reimbursed ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#d1fae5', color: '#065f46', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>
                        ✓ Reimbursed
                      </span>
                    ) : (
                      <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>
                        Pending
                      </span>
                    )}
                    {ep.reimbursement_proof_url && (
                      <a href={ep.reimbursement_proof_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: '0.73rem', color: '#1a3c2c' }}>proof</a>
                    )}
                  </td>
                  <td style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>
                    {!ep.is_reimbursed && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          ref={el => { proofRefs.current[ep.id] = el; }}
                          style={{ fontSize: '0.75rem', color: '#374151' }}
                        />
                        <button
                          onClick={() => handleReimburse(ep)}
                          disabled={reimbursing === ep.id}
                          style={{ background: reimbursing === ep.id ? '#e5e7eb' : '#16a34a', color: reimbursing === ep.id ? '#9ca3af' : '#fff', border: 'none', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: reimbursing === ep.id ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.78rem', minHeight: 32, whiteSpace: 'nowrap' }}
                        >
                          {reimbursing === ep.id ? 'Saving…' : 'Mark Reimbursed'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {orders.map(order => {
          const sc = STATUS_STYLE[order.status] || { background: '#f3f4f6', color: '#6b7280' };
          const orderTotal = (order.items_detail || []).reduce((sum, item) =>
            sum + (item.is_complimentary ? 0 : (item.customer_price ?? 0) * item.quantity), 0);
          return (
            <div key={order.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#f0ece3', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{new Date(order.created_at).toLocaleString()}</span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>₹{orderTotal.toFixed(2)}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, ...sc }}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
              </div>
              <table style={{ width: '100%' }}>
                <tbody>
                  {(order.items_detail || order.items).map((item, idx) => {
                    const d = item as { name?: string; customer_price?: number; quantity: number; is_complimentary?: boolean; spicy_level?: string };
                    return (
                      <tr key={idx} style={{ borderBottom: idx < (order.items_detail || order.items).length - 1 ? '1px solid #f0ece3' : undefined }}>
                        <td style={{ padding: '0.5rem 1rem', color: '#374151', fontWeight: 500 }}>{d.name || (item as { menu_item_id: string }).menu_item_id}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>×{d.quantity}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>{d.spicy_level}</td>
                        <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontSize: '0.9rem', color: d.is_complimentary ? '#16a34a' : '#111827', fontWeight: 500 }}>
                          {d.is_complimentary ? '₹0' : `₹${((d.customer_price || 0) * d.quantity).toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {order.allergy_notes && (
                <div style={{ padding: '0.5rem 1rem', background: '#fefce8', fontSize: '0.82rem', color: '#6b7280', borderTop: '1px solid #f3f4f6' }}>
                  Note: {order.allergy_notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
};

export default GuestOrdersPage;
