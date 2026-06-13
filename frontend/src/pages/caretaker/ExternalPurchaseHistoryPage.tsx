import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { apiGet, apiFetch } from '../../lib/api';
import type { ExternalPurchase } from '../../types';

const ExternalPurchaseHistoryPage: React.FC = () => {
  const [purchases, setPurchases] = useState<ExternalPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchPurchases = () =>
    apiGet<ExternalPurchase[]>('/external-purchases/')
      .then(setPurchases)
      .catch(() => setError('Failed to load purchase history.'));

  useEffect(() => {
    fetchPurchases().finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this purchase record? This cannot be undone.')) return;
    setDeletingId(id);
    setError('');
    try {
      await apiFetch(`/external-purchases/${id}/`, { method: 'DELETE' });
      setPurchases(prev => prev.filter(p => p.id !== id));
    } catch {
      setError('Failed to delete purchase. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading…</p></Layout>;

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Purchase History</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>
          External purchases you have logged on behalf of guests
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {purchases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontWeight: 500 }}>No purchases logged yet.</p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Purchases you log via "Log Purchase" will appear here.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Date', 'Item', 'Vendor', 'Qty', 'Cost', 'Billing', ''].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '0.6rem 1rem',
                      textAlign: h === 'Cost' || h === '' || h === 'Qty' ? 'right' : 'left',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map((p, i) => (
                <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                  <td style={{ padding: '0.7rem 1rem', color: '#6b7280', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {p.created_at
                      ? new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', fontWeight: 500, color: '#111827' }}>{p.item_name}</td>
                  <td style={{ padding: '0.7rem 0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>{p.vendor_name}</td>
                  <td style={{ padding: '0.7rem 0.5rem', color: '#374151', textAlign: 'right' }}>×{p.quantity}</td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                    ₹{Number(p.cost).toFixed(2)}
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem' }}>
                    {p.is_paid_by_caretaker ? (
                      <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                        Out-of-pocket
                      </span>
                    ) : (
                      <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                        On guest bill
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      style={{
                        background: 'none',
                        border: '1px solid #fca5a5',
                        color: '#dc2626',
                        borderRadius: 6,
                        padding: '0.25rem 0.6rem',
                        cursor: deletingId === p.id ? 'not-allowed' : 'pointer',
                        fontSize: '0.78rem',
                        minHeight: 30,
                        opacity: deletingId === p.id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === p.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
};

export default ExternalPurchaseHistoryPage;
