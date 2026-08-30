import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet, apiPost } from '../../lib/api';
import type { Order, Bill, ExternalPurchase } from '../../types';

const GenerateBillPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const guestId = searchParams.get('guest') || '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [unbilledPurchases, setUnbilledPurchases] = useState<ExternalPurchase[]>([]);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!guestId) { setLoading(false); return; }
    Promise.all([
      apiGet<Order[]>(`/orders/?guest_id=${guestId}`),
      apiGet<ExternalPurchase[]>(`/external-purchases/?guest_id=${guestId}`),
    ])
      .then(([o, purchases]) => {
        const eligible = o.filter(ord => ['accepted', 'prepared', 'delivered', 'resolved'].includes(ord.status));
        setOrders(eligible);
        setSelectedOrderIds(new Set(eligible.map(o => o.id)));
        // These will be auto-attached to the bill on generation (PRD §4.3.2) —
        // shown here so the preview total matches what the bill actually ends up as.
        setUnbilledPurchases(purchases.filter(p => !p.bill && !p.is_paid_by_caretaker));
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
    (order.items_detail || []).reduce((s, item) => s + (item.is_complimentary ? 0 : (item.customer_price ?? 0) * item.quantity), 0);

  const ordersSubtotal = orders
    .filter(o => selectedOrderIds.has(o.id))
    .reduce((s, o) => s + orderTotal(o), 0);
  const externalSubtotal = unbilledPurchases.reduce((s, p) => s + Number(p.cost), 0);
  const subtotal = ordersSubtotal + externalSubtotal;

  const discountVal = discountAmount
    ? parseFloat(discountAmount) || 0
    : discountPct
      ? subtotal * ((parseFloat(discountPct) || 0) / 100)
      : 0;
  const grandTotal = subtotal - discountVal;

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
      const msg = e.data ? Object.values(e.data).flat().join(' ') : 'Failed to generate bill.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (!guestId) {
    return (
      <Layout>
        <p style={{ color: '#6b7280' }}>No guest selected. </p>
        <button onClick={() => navigate('/manager/dashboard')} style={{ color: '#1a3c2c', background: 'none', border: 'none', cursor: 'pointer' }}>← Dashboard</button>
      </Layout>
    );
  }
  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading orders…</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Generate Bill</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Select orders to include and apply discount</p>
        </div>
        <button onClick={() => navigate('/manager/dashboard')} style={{ background: 'none', border: 'none', color: '#1a3c2c', cursor: 'pointer', fontSize: '0.875rem' }}>← Back</button>
      </div>

      {orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          <p style={{ fontWeight: 500 }}>No eligible orders</p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Only accepted, prepared, or delivered orders can be billed.</p>
        </div>
      )}

      {orders.length > 0 && (
        <>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.875rem' }}>
            Select orders to include ({selectedOrderIds.size} of {orders.length} selected):
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {orders.map(order => {
              const total = orderTotal(order);
              const selected = selectedOrderIds.has(order.id);
              return (
                <label
                  key={order.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    background: '#fff',
                    border: `1px solid ${selected ? '#1a3c2c' : '#e5e7eb'}`,
                    borderRadius: 10,
                    padding: '0.875rem 1rem',
                    cursor: 'pointer',
                    boxShadow: selected ? '0 0 0 1px #1a3c2c' : '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleOrder(order.id)}
                    style={{ marginTop: 2, width: 17, height: 17, cursor: 'pointer', accentColor: '#1a3c2c' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{new Date(order.created_at).toLocaleString()}</span>
                      <span style={{ fontWeight: 700, color: '#111827' }}>₹{total.toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                      {(order.items_detail || order.items).map((item, idx) => {
                        const d = item as { name?: string; quantity: number };
                        return <span key={idx}>{idx > 0 && ', '}{d.name || (item as { menu_item_id: string }).menu_item_id} ×{d.quantity}</span>;
                      })}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Discount + total */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.25rem', maxWidth: 400, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>Discount (optional)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Flat amount (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={discountAmount}
                  onChange={e => { setDiscountAmount(e.target.value); if (e.target.value) setDiscountPct(''); }}
                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', color: '#111827' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Percentage (%)</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={discountPct}
                  onChange={e => { setDiscountPct(e.target.value); if (e.target.value) setDiscountAmount(''); }}
                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', color: '#111827' }}
                />
              </div>
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.3rem' }}>
                <span>Orders ({selectedOrderIds.size} selected)</span>
                <span>₹{ordersSubtotal.toFixed(2)}</span>
              </div>
              {externalSubtotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.3rem' }}>
                  <span>Caretaker purchases ({unbilledPurchases.length})</span>
                  <span>₹{externalSubtotal.toFixed(2)}</span>
                </div>
              )}
              {discountVal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#16a34a', marginBottom: '0.3rem' }}>
                  <span>Discount</span>
                  <span>−₹{discountVal.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #e5e7eb' }}>
                <span>Grand Total</span>
                <span style={{ color: '#1a3c2c' }}>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.65rem 0.875rem', fontSize: '0.875rem', color: '#dc2626', marginTop: '0.75rem', maxWidth: 400 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || selectedOrderIds.size === 0}
            style={{
              marginTop: '1.25rem',
              background: generating || selectedOrderIds.size === 0 ? '#e5e7eb' : '#1a3c2c',
              color: generating || selectedOrderIds.size === 0 ? '#9ca3af' : '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '0.7rem 2rem',
              cursor: generating || selectedOrderIds.size === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '0.95rem',
              minHeight: 46,
            }}
          >
            {generating ? 'Generating…' : 'Generate Bill'}
          </button>
        </>
      )}
    </Layout>
  );
};

export default GenerateBillPage;
