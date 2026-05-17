import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Bill, Order } from '../../types';
import { CATEGORY_LABELS } from '../../types';

const BillPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch guest's orders to find associated bills
    Promise.all([
      apiGet<Order[]>('/orders/'),
    ]).then(([guestOrders]) => {
      setOrders(guestOrders);
      // Try fetching bills by checking order IDs - for simplicity, try bill IDs from 1 upward
      // Better: the backend should expose GET /api/bills/?guest_id=me - for now we show orders
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Fetch bill by ID when guest has a bill_id from notifications or URL
  useEffect(() => {
    // Try fetching bills the guest may have
    const fetchBill = async () => {
      // The guest can't list bills directly; they'd navigate here via a link
      // Check URL params or show orders summary
    };
    fetchBill();
  }, []);

  const spendByCategory = orders.reduce<Record<string, number>>((acc, order) => {
    (order.items_detail || []).forEach(item => {
      const cat = item.category || 'other';
      acc[cat] = (acc[cat] || 0) + (item.is_complimentary ? 0 : item.customer_price * item.quantity);
    });
    return acc;
  }, {});

  if (loading) return <Layout><p>Loading…</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>My Bill</h1>
        <button onClick={() => navigate('/guest/menu')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer' }}>← Back to Menu</button>
      </div>

      {/* Spending breakdown by category */}
      {Object.keys(spendByCategory).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Spending Breakdown</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {Object.entries(spendByCategory).map(([cat, amount]) => (
              <div key={cat} style={{ background: '#fff8f5', border: '1px solid #f0c0a0', borderRadius: 6, padding: '0.5rem 0.9rem', minWidth: 110 }}>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{CATEGORY_LABELS[cat] ?? cat}</div>
                <div style={{ fontWeight: 700, color: '#f16524' }}>₹{amount.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders list */}
      {orders.length === 0 ? (
        <p style={{ color: '#666' }}>No orders yet. <button onClick={() => navigate('/guest/menu')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Browse the menu</button></p>
      ) : (
        orders.map(order => (
          <div key={order.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: '#f9f9f9', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>
                Order • {new Date(order.created_at).toLocaleString()}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {(order.items_detail || order.items || []).map((item, idx) => {
                  const detail = item as { name?: string; customer_price?: number; quantity: number; is_complimentary?: boolean; spicy_level?: string };
                  return (
                    <tr key={idx} style={{ borderTop: idx > 0 ? '1px solid #f0f0f0' : undefined }}>
                      <td style={{ padding: '0.6rem 1rem' }}>
                        {detail.name || (item as { menu_item_id: string }).menu_item_id}
                        {detail.is_complimentary && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#2e7d32', background: '#e8f5e9', padding: '0.1rem 0.4rem', borderRadius: 4 }}>Complimentary</span>}
                        {detail.spicy_level && detail.spicy_level !== 'None' && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#666' }}>({detail.spicy_level})</span>}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>×{detail.quantity}</td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>
                        {detail.is_complimentary
                          ? <span style={{ color: '#2e7d32' }}>₹0</span>
                          : `₹${((detail.customer_price || 0) * detail.quantity).toFixed(2)}`}
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
        ))
      )}

      {selectedBill && (
        <BillDetail bill={selectedBill} onClose={() => setSelectedBill(null)} />
      )}

      <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '1rem' }}>
        {user?.username} • Bill is read-only. Contact the manager for billing queries.
      </p>
    </Layout>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, { bg: string; color: string }> = {
    pending: { bg: '#fff3e0', color: '#e65100' },
    accepted: { bg: '#e8f5e9', color: '#2e7d32' },
    rejected: { bg: '#fce4ec', color: '#c62828' },
    prepared: { bg: '#e3f2fd', color: '#1565c0' },
    delivered: { bg: '#f3e5f5', color: '#6a1b9a' },
  };
  const s = colors[status] || { bg: '#f5f5f5', color: '#666' };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 12, fontWeight: 600 }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const BillDetail: React.FC<{ bill: Bill; onClose: () => void }> = ({ bill, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
    <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Bill Detail</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
      </div>
      <p><strong>Status:</strong> {bill.status}</p>
      {bill.discount_amount > 0 && <p><strong>Discount:</strong> ₹{bill.discount_amount}</p>}
      {bill.discount_percentage > 0 && <p><strong>Discount:</strong> {bill.discount_percentage}%</p>}
    </div>
  </div>
);

export default BillPage;
