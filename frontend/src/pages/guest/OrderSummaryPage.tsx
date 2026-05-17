import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        <h1>Order Summary</h1>
        <p style={{ color: '#666' }}>Your cart is empty. <button onClick={() => navigate('/guest/menu')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Browse the menu</button></p>
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
      setError(JSON.stringify(e.data) || 'Failed to submit order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <h2 style={{ color: '#2e7d32' }}>Order Submitted!</h2>
          <p style={{ color: '#666' }}>Your order has been sent to the caterer.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button onClick={() => navigate('/guest/menu')} style={{ padding: '0.6rem 1.2rem', background: '#f16524', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', minHeight: 44 }}>
              Order More
            </button>
            <button onClick={() => navigate('/guest/bill')} style={{ padding: '0.6rem 1.2rem', background: '#fff', color: '#333', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', minHeight: 44 }}>
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
        <h1 style={{ margin: 0 }}>Order Summary</h1>
        <button onClick={() => navigate('/guest/menu')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
          ← Back to Menu
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f9f9', fontSize: '0.85rem', color: '#666' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Item</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Qty</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Spicy</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Unit</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '0.75rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.menu_item_id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {item.name}
                  {item.is_complimentary && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#2e7d32', background: '#e8f5e9', padding: '0.1rem 0.4rem', borderRadius: 4 }}>Complimentary</span>}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                    <button onClick={() => item.quantity > 1 ? updateItem(item.menu_item_id, { quantity: item.quantity - 1 }) : removeItem(item.menu_item_id)} style={{ width: 28, height: 28, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#f5f5f5' }}>−</button>
                    <span style={{ minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => updateItem(item.menu_item_id, { quantity: item.quantity + 1 })} style={{ width: 28, height: 28, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#f5f5f5' }}>+</button>
                  </div>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>{item.spicy_level}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {item.is_complimentary ? <span style={{ color: '#2e7d32' }}>₹0</span> : `₹${item.customer_price}`}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {item.is_complimentary ? <span style={{ color: '#2e7d32' }}>₹0</span> : `₹${(item.customer_price * item.quantity).toFixed(2)}`}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <button onClick={() => removeItem(item.menu_item_id)} style={{ color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e0e0e0', fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total</td>
              <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{total.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Allergy/preferences field — one per order (PRD §4.1.1) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>
          Allergies & Special Preferences
        </label>
        <textarea
          value={allergyNotes}
          onChange={e => setAllergyNotes(e.target.value)}
          placeholder="e.g. No nuts, gluten-free if possible"
          rows={3}
          style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>

      {error && <p style={{ color: '#c62828', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ padding: '0.75rem 2rem', background: submitting ? '#ccc' : '#f16524', color: '#fff', border: 'none', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '1rem', minHeight: 44 }}
        >
          {submitting ? 'Submitting…' : 'Submit Order'}
        </button>
        <button
          onClick={() => navigate('/guest/bill')}
          style={{ padding: '0.75rem 1.2rem', background: '#fff', color: '#333', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', minHeight: 44 }}
        >
          View Bill
        </button>
      </div>
    </Layout>
  );
};

export default OrderSummaryPage;
