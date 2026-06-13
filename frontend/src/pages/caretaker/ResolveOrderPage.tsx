import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet, apiPatch, apiPost } from '../../lib/api';
import type { Order, MenuItem } from '../../types';
import { SPICY_LEVELS } from '../../types';

const VENDOR_STORAGE_KEY = 'bmm_vendor_names';

function getSavedVendors(): string[] {
  try {
    return JSON.parse(localStorage.getItem(VENDOR_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveVendorName(name: string) {
  const saved = getSavedVendors();
  if (!saved.includes(name)) {
    localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify([name, ...saved].slice(0, 50)));
  }
}

interface ResolvedItem {
  menu_item_id: string;
  quantity: number;
  spicy_level: string;
  name?: string;
}

interface PurchaseForm {
  key: number;
  vendor_name: string;
  item_name: string;
  quantity: number;
  cost: string;
  is_paid_by_caretaker: boolean;
}

let purchaseKeyCounter = 0;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.7rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  boxSizing: 'border-box',
  color: '#111827',
  fontSize: '0.875rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '0.3rem',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0.6rem 1rem',
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
};

const ResolveOrderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedVendors, setSavedVendors] = useState<string[]>([]);

  useEffect(() => {
    setSavedVendors(getSavedVendors());
    Promise.all([
      apiGet<Order[]>('/orders/?status=rejected'),
      apiGet<Order[]>('/orders/?status=pending'),
      apiGet<Order[]>('/orders/?status=partially_accepted'),
    ]).then(([rejected, pending, partial]) => {
      const found = [...rejected, ...pending, ...partial].find(o => o.id === id);
      if (found) {
        setOrder(found);
        // Build mutable items from items_detail (the read-enriched list)
        const detailItems = found.items_detail ?? [];
        setItems(detailItems.map(item => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          spicy_level: item.spicy_level || 'None',
          name: item.name,
        })));
      }
    }).finally(() => setLoading(false));
  }, [id]);

  // ── Section 1 helpers ─────────────────────────────────────────────
  const updateQty = (idx: number, qty: number) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, qty) } : item));

  const updateSpicy = (idx: number, spicy: string) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, spicy_level: spicy } : item));

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  // ── Section 2 helpers ─────────────────────────────────────────────
  const addPurchase = () => {
    setPurchases(prev => [...prev, {
      key: ++purchaseKeyCounter,
      vendor_name: '',
      item_name: '',
      quantity: 1,
      cost: '',
      is_paid_by_caretaker: false,
    }]);
  };

  const updatePurchase = (key: number, field: keyof PurchaseForm, value: string | number | boolean) =>
    setPurchases(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p));

  const removePurchase = (key: number) =>
    setPurchases(prev => prev.filter(p => p.key !== key));

  // ── Save ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (items.length === 0) {
      setError('At least one order item must remain.');
      return;
    }
    const filledPurchases = purchases.filter(
      p => p.vendor_name.trim() || p.item_name.trim() || p.cost
    );
    const incompletePurchases = filledPurchases.filter(
      p => !p.vendor_name.trim() || !p.item_name.trim() || !p.cost || parseFloat(p.cost) <= 0
    );
    if (incompletePurchases.length > 0) {
      setError('Some external purchases are incomplete. Fill in all fields (vendor, item, cost) or remove them.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // 1. Resolve the order — send current items + resolved status
      const writeItems = items.map(item => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        spicy_level: item.spicy_level,
      }));
      await apiPatch(`/orders/${id}/`, { items: writeItems, status: 'resolved' });

      // 2. Post each completed external purchase
      for (const purchase of filledPurchases) {
        await apiPost('/external-purchases/', {
          order: id,
          guest: order!.guest,
          vendor_name: purchase.vendor_name.trim(),
          item_name: purchase.item_name.trim(),
          quantity: purchase.quantity,
          cost: parseFloat(purchase.cost),
          is_paid_by_caretaker: purchase.is_paid_by_caretaker,
        });
        saveVendorName(purchase.vendor_name.trim());
      }

      navigate('/caretaker/orders');
    } catch {
      setError('Failed to resolve order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading…</p></Layout>;
  if (!order) return <Layout><p style={{ color: '#6b7280' }}>Order not found.</p></Layout>;

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    marginBottom: '1.25rem',
  };

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Resolve Order</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>
            Modify items, log external purchases, or both — then notify the guest.
          </p>
        </div>
        <button
          onClick={() => navigate('/caretaker/orders')}
          style={{ background: 'none', border: 'none', color: '#f16524', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Back
        </button>
      </div>

      {/* Rejection / timeout context */}
      {order.status === 'rejected' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.65rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#991b1b' }}>
          <strong>Rejected by caterer:</strong> {order.rejection_reason ?? 'N/A'}
          {order.rejection_notes && <span> — {order.rejection_notes}</span>}
        </div>
      )}
      {order.status === 'partially_accepted' && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '0.65rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#78350f' }}>
          <strong>Partially rejected by caterer.</strong> The items below were prepared; source the missing items externally.
          {order.rejection_notes && <div style={{ marginTop: '0.3rem' }}><strong>Missing:</strong> {order.rejection_notes}</div>}
        </div>
      )}
      {order.status === 'pending' && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '0.65rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#92400e' }}>
          <strong>Timed out</strong> — the caterer did not respond in time.
        </div>
      )}

      {/* ── Section 1: Modify Items ── */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>Section 1 — Modify Items (Optional)</div>
        <div style={{ padding: '1rem' }}>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.875rem' }}>
            Adjust quantities, spicy levels, or remove items. Untouched items stay as-is.
          </p>

          {items.length === 0 ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '0.6rem 0.875rem', fontSize: '0.875rem', color: '#dc2626' }}>
              All items removed — at least one must remain before saving.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}
                >
                  <span style={{ flex: 1, minWidth: 120, fontWeight: 500, color: '#111827', fontSize: '0.9rem' }}>
                    {item.name || item.menu_item_id}
                  </span>

                  {/* Quantity stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      onClick={() => updateQty(idx, item.quantity - 1)}
                      style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: '#f9fafb', fontSize: '1rem', color: '#374151' }}
                    >−</button>
                    <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>{item.quantity}</span>
                    <button
                      onClick={() => updateQty(idx, item.quantity + 1)}
                      style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: '#f9fafb', fontSize: '1rem', color: '#374151' }}
                    >+</button>
                  </div>

                  {/* Spicy level */}
                  <select
                    value={item.spicy_level}
                    onChange={e => updateSpicy(idx, e.target.value)}
                    style={{ padding: '0.3rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.82rem', color: '#374151', background: '#fff', minHeight: 32 }}
                  >
                    {SPICY_LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>

                  <button
                    onClick={() => removeItem(idx)}
                    style={{ background: 'none', border: '1px solid #fee2e2', borderRadius: 6, padding: '0.25rem 0.6rem', cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem', minHeight: 32 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: External Purchases ── */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>Section 2 — Log External Purchases (Optional)</div>
        <div style={{ padding: '1rem' }}>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.875rem' }}>
            Record items purchased from outside vendors on behalf of the guest. You can add multiple.
          </p>

          {purchases.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.875rem' }}>
              No external purchases added yet.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: purchases.length > 0 ? '1rem' : 0 }}>
            {purchases.map(purchase => (
              <div
                key={purchase.key}
                style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', position: 'relative' }}
              >
                <button
                  onClick={() => removePurchase(purchase.key)}
                  style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.1rem', lineHeight: 1 }}
                  title="Remove"
                >×</button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Vendor Name *</label>
                    <input
                      list={`vendors-${purchase.key}`}
                      value={purchase.vendor_name}
                      onChange={e => updatePurchase(purchase.key, 'vendor_name', e.target.value)}
                      placeholder="e.g. Sharma Sweets"
                      autoComplete="off"
                      style={inputStyle}
                    />
                    {savedVendors.length > 0 && (
                      <datalist id={`vendors-${purchase.key}`}>
                        {savedVendors.map(v => <option key={v} value={v} />)}
                      </datalist>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Item Name *</label>
                    <input
                      value={purchase.item_name}
                      onChange={e => updatePurchase(purchase.key, 'item_name', e.target.value)}
                      placeholder="e.g. Idli Sambar"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label style={labelStyle}>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={purchase.quantity}
                      onChange={e => updatePurchase(purchase.key, 'quantity', parseInt(e.target.value, 10) || 1)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Total Cost (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchase.cost}
                      onChange={e => updatePurchase(purchase.key, 'cost', e.target.value)}
                      placeholder="0.00"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Who paid */}
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: 7, border: `1px solid ${!purchase.is_paid_by_caretaker ? '#f16524' : '#e5e7eb'}`, background: !purchase.is_paid_by_caretaker ? '#fff7f4' : '#fff', flex: 1 }}>
                    <input
                      type="radio"
                      name={`paid-${purchase.key}`}
                      checked={!purchase.is_paid_by_caretaker}
                      onChange={() => updatePurchase(purchase.key, 'is_paid_by_caretaker', false)}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.82rem', color: '#111827' }}>Guest pays</div>
                      <div style={{ fontSize: '0.73rem', color: '#6b7280' }}>Added to bill</div>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: 7, border: `1px solid ${purchase.is_paid_by_caretaker ? '#f16524' : '#e5e7eb'}`, background: purchase.is_paid_by_caretaker ? '#fff7f4' : '#fff', flex: 1 }}>
                    <input
                      type="radio"
                      name={`paid-${purchase.key}`}
                      checked={purchase.is_paid_by_caretaker}
                      onChange={() => updatePurchase(purchase.key, 'is_paid_by_caretaker', true)}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.82rem', color: '#111827' }}>I paid (reimburse me)</div>
                      <div style={{ fontSize: '0.73rem', color: '#6b7280' }}>Internal accounting only</div>
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addPurchase}
            style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: 8, padding: '0.55rem 1rem', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem', minHeight: 38 }}
          >
            + Add External Purchase
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.65rem 0.875rem', fontSize: '0.875rem', color: '#dc2626', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || items.length === 0}
        style={{
          background: saving || items.length === 0 ? '#e5e7eb' : '#f16524',
          color: saving || items.length === 0 ? '#9ca3af' : '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '0.7rem 2rem',
          cursor: saving || items.length === 0 ? 'not-allowed' : 'pointer',
          fontWeight: 700,
          fontSize: '0.95rem',
          minHeight: 46,
        }}
      >
        {saving ? 'Resolving…' : 'Resolve & Notify Guest'}
      </button>
    </Layout>
  );
};

export default ResolveOrderPage;
