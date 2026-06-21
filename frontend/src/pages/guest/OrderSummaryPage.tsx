import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { useCart } from '../../context/CartContext';
import { apiPost } from '../../lib/api';
import type { Order } from '../../types';

const OrderSummaryPage: React.FC = () => {
  const { items, allergyNotes, setAllergyNotes, updateItem, removeItem, clearCart, total } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  if (items.length === 0 && !submitted) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Your cart is empty.</p>
          <button
            onClick={() => navigate('/guest/menu')}
            style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: 600, minHeight: 44 }}
          >
            Browse Menu
          </button>
        </div>
      </Layout>
    );
  }

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        items: items.map(i => ({
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
          spicy_level: i.spicy_level,
        })),
        allergy_notes: allergyNotes,
      };
      await apiPost<Order>('/orders/', payload);
      clearCart();
      setSubmitted(true);
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown> };
      const msg = e.data ? Object.values(e.data).flat().join(' ') : 'Failed to submit order. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, background: '#f0fdf4', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <CheckCircle size={32} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>Order Submitted!</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Your order has been sent to the caterer.</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem' }}>
            <button
              onClick={() => navigate('/guest/menu')}
              style={{ padding: '0.6rem 1.25rem', background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, minHeight: 44 }}
            >
              Order More
            </button>
            <button
              onClick={() => navigate('/guest/bill')}
              style={{ padding: '0.6rem 1.25rem', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', minHeight: 44 }}
            >
              View Bill
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Order Summary</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Review your order before submitting</p>
        </div>
        <button
          onClick={() => navigate('/guest/menu')}
          style={{ background: 'none', border: 'none', color: '#1a3c2c', cursor: 'pointer', fontSize: '0.875rem', padding: '0.25rem' }}
        >
          ← Menu
        </button>
      </div>

      {/* Items table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <table style={{ width: '100%' }}>
          <thead>
            <tr style={{ background: '#f0ece3', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Item</th>
              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qty</th>
              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Spicy</th>
              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price</th>
              <th style={{ padding: '0.65rem 1rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.menu_item_id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{item.name}</span>
                  {item.is_complimentary && (
                    <span style={{ marginLeft: 6, background: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>
                      Complimentary
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      onClick={() => item.quantity > 1 ? updateItem(item.menu_item_id, { quantity: item.quantity - 1 }) : removeItem(item.menu_item_id)}
                      style={{ width: 26, height: 26, border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', background: '#f0ece3', color: '#374151', fontWeight: 600 }}
                    >−</button>
                    <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 600, color: '#111827' }}>{item.quantity}</span>
                    <button
                      onClick={() => updateItem(item.menu_item_id, { quantity: item.quantity + 1 })}
                      style={{ width: 26, height: 26, border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', background: '#f0ece3', color: '#374151', fontWeight: 600 }}
                    >+</button>
                  </div>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
                  {item.spicy_level}
                </td>
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: item.is_complimentary ? '#16a34a' : '#374151' }}>
                  {item.is_complimentary ? '₹0' : `₹${item.customer_price}`}
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: item.is_complimentary ? '#16a34a' : '#111827' }}>
                  {item.is_complimentary ? '₹0' : `₹${(item.customer_price * item.quantity).toFixed(2)}`}
                </td>
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                  <button
                    onClick={() => removeItem(item.menu_item_id)}
                    style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.1rem', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e5e7eb' }}>
              <td colSpan={4} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem' }}>Total</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
                ₹{total.toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Allergy notes */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '1.125rem 1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#111827' }}>
          Allergies & Special Preferences
        </label>
        <textarea
          value={allergyNotes}
          onChange={e => setAllergyNotes(e.target.value)}
          placeholder="e.g. No nuts, gluten-free if possible, less oil"
          rows={3}
          style={{
            width: '100%',
            padding: '0.6rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: '0.9rem',
            boxSizing: 'border-box',
            resize: 'vertical',
            color: '#111827',
            background: '#fff',
          }}
        />
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.65rem 0.875rem', fontSize: '0.875rem', color: '#dc2626', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '0.7rem 2rem',
            background: submitting ? '#7aab8e' : '#1a3c2c',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '0.95rem',
            minHeight: 46,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Order'}
        </button>
        <button
          onClick={() => navigate('/guest/bill')}
          style={{ padding: '0.7rem 1.25rem', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', minHeight: 46 }}
        >
          View Bill
        </button>
      </div>
    </Layout>
  );
};

export default OrderSummaryPage;
