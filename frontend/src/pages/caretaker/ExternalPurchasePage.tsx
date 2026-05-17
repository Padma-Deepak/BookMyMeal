import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiPost } from '../../lib/api';

const ExternalPurchasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    order: searchParams.get('order') || '',
    guest: searchParams.get('guest') || '',
    vendor_name: '',
    item_name: '',
    quantity: '1',
    cost: '',
    is_paid_by_caretaker: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.vendor_name.trim()) { setError('Vendor name is required.'); return; }
    if (!form.item_name.trim()) { setError('Item name is required.'); return; }
    if (!form.cost || parseFloat(form.cost) <= 0) { setError('Valid cost is required.'); return; }
    if (!form.guest) { setError('Guest ID is required.'); return; }
    setSaving(true);
    try {
      await apiPost('/external-purchases/', {
        order: form.order || null,
        guest: form.guest,
        vendor_name: form.vendor_name.trim(),
        item_name: form.item_name.trim(),
        quantity: parseInt(form.quantity, 10),
        cost: parseFloat(form.cost),
        is_paid_by_caretaker: form.is_paid_by_caretaker,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown> };
      setError(JSON.stringify(e.data) || 'Failed to log purchase.');
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <h2 style={{ color: '#2e7d32' }}>Purchase Logged</h2>
          <p style={{ color: '#666' }}>
            {form.is_paid_by_caretaker
              ? 'Recorded for accounting. Not added to guest bill.'
              : 'Added to guest bill automatically.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button onClick={() => { setSuccess(false); setForm(f => ({ ...f, vendor_name: '', item_name: '', quantity: '1', cost: '' })); }} style={{ padding: '0.6rem 1.2rem', background: '#f16524', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', minHeight: 44 }}>
              Log Another
            </button>
            <button onClick={() => navigate('/caretaker/orders')} style={{ padding: '0.6rem 1.2rem', background: '#fff', color: '#333', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', minHeight: 44 }}>
              Back to Orders
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Log External Purchase</h1>
        <button onClick={() => navigate('/caretaker/orders')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1.5rem', maxWidth: 560 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Vendor Name *</label>
            <input
              value={form.vendor_name}
              onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
              placeholder="e.g. Sharma Sweets"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
            />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#999' }}>New vendors are automatically registered.</p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Item Name *</label>
            <input
              value={form.item_name}
              onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Quantity</label>
              <input
                type="number" min="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Total Cost (₹) *</label>
              <input
                type="number" min="0" step="0.01"
                value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 600 }}>Payment Status</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="paid_status"
                  checked={!form.is_paid_by_caretaker}
                  onChange={() => setForm(f => ({ ...f, is_paid_by_caretaker: false }))}
                />
                Unpaid — add to guest bill
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="paid_status"
                  checked={form.is_paid_by_caretaker}
                  onChange={() => setForm(f => ({ ...f, is_paid_by_caretaker: true }))}
                />
                Paid by me — log only
              </label>
            </div>
          </div>
          {!form.is_paid_by_caretaker && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#e65100', background: '#fff3e0', padding: '0.5rem 0.75rem', borderRadius: 4 }}>
              This purchase will be automatically added to the guest's bill.
            </p>
          )}
          {error && <p style={{ margin: 0, color: '#c62828', fontSize: '0.85rem' }}>{error}</p>}
          <button
            type="submit"
            disabled={saving}
            style={{ background: saving ? '#ccc' : '#f16524', color: '#fff', border: 'none', borderRadius: 8, padding: '0.75rem', cursor: saving ? 'not-allowed' : 'pointer', minHeight: 44, fontSize: '1rem', fontWeight: 600 }}
          >
            {saving ? 'Saving…' : 'Log Purchase'}
          </button>
        </div>
      </form>
    </Layout>
  );
};

export default ExternalPurchasePage;
