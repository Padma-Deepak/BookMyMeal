import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet, apiPost } from '../../lib/api';
import type { Order, Bill } from '../../types';

const GenerateBillPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const guestId = searchParams.get('guest') || '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!guestId) { setLoading(false); return; }
    apiGet<Order[]>(`/orders/?guest_id=${guestId}`)
      .then(o => {
        setOrders(o.filter(ord => ['accepted', 'prepared', 'delivered'].includes(ord.status)));
        setSelectedOrderIds(new Set(o.filter(ord => ['accepted', 'prepared', 'delivered'].includes(ord.status)).map(o => o.id)));
      })
      .finally(() => setLoading(false));
  }, [guestId]);

  const toggleOrder = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const orderTotal = (order: Order) =>
    (order.items_detail || []).reduce((s, item) => s + (item.is_complimentary ? 0 : item.customer_price * item.quantity), 0);

  const subtotal = orders
    .filter(o => selectedOrderIds.has(o.id))
    .reduce((s, o) => s + orderTotal(o), 0);

  const handleGenerate = async () => {
    if (selectedOrderIds.size === 0) { setError('Select at least one order.'); return; }
    setError('');
    setGenerating(true);
    try {
      const bill = await apiPost<Bill>('/bills/', {
        guest_id: guestId,
        order_ids: Array.from(selectedOrderIds),
        discount_amount: discountAmount ? parseFloat(discountAmount) : 0,
        discount_percentage: discountPct ? parseFloat(discountPct) : 0,
      });
      navigate(`/manager/bill/${bill.id}`);
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown> };
      setError(JSON.stringify(e.data) || 'Failed to generate bill.');
    } finally {
      setGenerating(false);
    }
  };

  if (!guestId) return <Layout><p>No guest selected. <button onClick={() => navigate('/manager/dashboard')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer' }}>← Dashboard</button></p></Layout>;
  if (loading) return <Layout><p>Loading orders…</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Generate Bill</h1>
        <button onClick={() => navigate('/manager/dashboard')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
      </div>

      {orders.length === 0 && (
        <p style={{ color: '#666' }}>No accepted/delivered orders for this guest.</p>
      )}

      {orders.length > 0 && (
        <>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>Select orders to include in the bill:</p>
          {orders.map(order => {
            const total = orderTotal(order);
            const selected = selectedOrderIds.has(order.id);
            return (
              <label key={order.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: '#fff', border: `1px solid ${selected ? '#f16524' : '#e0e0e0'}`, borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleOrder(order.id)}
                  style={{ marginTop: 3, width: 18, height: 18, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>{new Date(order.created_at).toLocaleString()}</span>
                    <strong>₹{total.toFixed(2)}</strong>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#333', marginTop: '0.25rem' }}>
                    {(order.items_detail || order.items).map((item, idx) => {
                      const d = item as { name?: string; quantity: number };
                      return <span key={idx}>{idx > 0 && ', '}{d.name || (item as { menu_item_id: string }).menu_item_id} ×{d.quantity}</span>;
                    })}
                  </div>
                </div>
              </label>
            );
          })}

          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginTop: '1.5rem', maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 1rem' }}>Discount (optional)</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Amount (₹)</span>
                <input type="number" min="0" step="0.01" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
              </label>
              <label style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Percentage (%)</span>
                <input type="number" min="0" max="100" step="0.1" value={discountPct} onChange={e => setDiscountPct(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
              </label>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal ({selectedOrderIds.size} orders)</span>
              <strong>₹{subtotal.toFixed(2)}</strong>
            </div>
          </div>

          {error && <p style={{ color: '#c62828', marginTop: '0.75rem' }}>{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={generating || selectedOrderIds.size === 0}
            style={{ marginTop: '1.5rem', background: generating || selectedOrderIds.size === 0 ? '#ccc' : '#f16524', color: '#fff', border: 'none', borderRadius: 8, padding: '0.75rem 2rem', cursor: generating || selectedOrderIds.size === 0 ? 'not-allowed' : 'pointer', minHeight: 44, fontSize: '1rem', fontWeight: 600 }}
          >
            {generating ? 'Generating…' : 'Generate Bill'}
          </button>
        </>
      )}
    </Layout>
  );
};

export default GenerateBillPage;
