import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiPost } from '../../lib/api';

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  boxSizing: 'border-box',
  color: '#111827',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '0.35rem',
};

const ExternalPurchasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [savedVendors, setSavedVendors] = useState<string[]>([]);
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

  useEffect(() => {
    setSavedVendors(getSavedVendors());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.vendor_name.trim()) { setError('Vendor name is required.'); return; }
    if (!form.item_name.trim()) { setError('Item name is required.'); return; }
    if (!form.cost || parseFloat(form.cost) <= 0) { setError('Enter a valid cost greater than 0.'); return; }
    if (!form.guest) { setError('Guest ID is missing. Navigate here from an order.'); return; }
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
      saveVendorName(form.vendor_name.trim());
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown> };
      const msg = e.data ? Object.values(e.data).flat().join(' ') : 'Failed to log purchase.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: '#f0fdf4', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <CheckCircle size={28} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>Purchase Logged</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', maxWidth: 300 }}>
            {form.is_paid_by_caretaker
              ? 'Recorded for internal accounting. Not added to guest bill.'
              : 'Added to the guest bill automatically.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem' }}>
            <button
              onClick={() => {
                setSuccess(false);
                setForm(f => ({ ...f, vendor_name: '', item_name: '', quantity: '1', cost: '' }));
              }}
              style={{ padding: '0.6rem 1.25rem', background: '#f16524', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, minHeight: 44 }}
            >
              Log Another
            </button>
            <button
              onClick={() => navigate('/caretaker/orders')}
              style={{ padding: '0.6rem 1.25rem', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', minHeight: 44 }}
            >
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
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Log External Purchase</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Record an item purchased from an outside vendor</p>
        </div>
        <button
          onClick={() => navigate('/caretaker/orders')}
          style={{ background: 'none', border: 'none', color: '#f16524', cursor: 'pointer', fontSize: '0.875rem', padding: '0.25rem' }}
        >
          ← Back
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '1.5rem', maxWidth: 560 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Vendor name with datalist autocomplete */}
          <div>
            <label style={labelStyle}>Vendor Name *</label>
            <input
              id="vendor-input"
              list="vendor-suggestions"
              value={form.vendor_name}
              onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
              placeholder="e.g. Sharma Sweets"
              autoComplete="off"
              style={inputStyle}
            />
            {savedVendors.length > 0 && (
              <datalist id="vendor-suggestions">
                {savedVendors.map(v => <option key={v} value={v} />)}
              </datalist>
            )}
            {savedVendors.length > 0 && (
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                Previously used vendors are suggested as you type.
              </p>
            )}
          </div>

          <div>
            <label style={labelStyle}>Item Name *</label>
            <input
              value={form.item_name}
              onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
              placeholder="e.g. Idli Sambar (2 plates)"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Total Cost (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                placeholder="0.00"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Payment status */}
          <div>
            <label style={{ ...labelStyle, marginBottom: '0.5rem' }}>Who paid?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', padding: '0.75rem', borderRadius: 8, border: `1px solid ${!form.is_paid_by_caretaker ? '#f16524' : '#e5e7eb'}`, background: !form.is_paid_by_caretaker ? '#fff7f4' : '#fff' }}>
                <input
                  type="radio"
                  name="paid_status"
                  checked={!form.is_paid_by_caretaker}
                  onChange={() => setForm(f => ({ ...f, is_paid_by_caretaker: false }))}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>Guest pays</div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 1 }}>Cost added to guest bill automatically</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', padding: '0.75rem', borderRadius: 8, border: `1px solid ${form.is_paid_by_caretaker ? '#f16524' : '#e5e7eb'}`, background: form.is_paid_by_caretaker ? '#fff7f4' : '#fff' }}>
                <input
                  type="radio"
                  name="paid_status"
                  checked={form.is_paid_by_caretaker}
                  onChange={() => setForm(f => ({ ...f, is_paid_by_caretaker: true }))}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>I paid (caretaker)</div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 1 }}>Logged for accounting only — not charged to guest</div>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.55rem 0.75rem', fontSize: '0.85rem', color: '#dc2626' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.65rem',
              background: saving ? '#fdba8c' : '#f16524',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              minHeight: 44,
            }}
          >
            {saving ? 'Saving…' : 'Log Purchase'}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default ExternalPurchasePage;
