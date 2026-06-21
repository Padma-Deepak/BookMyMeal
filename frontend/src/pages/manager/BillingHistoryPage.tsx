import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet } from '../../lib/api';
import type { Bill } from '../../types';

const BILL_STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: { background: '#fef3c7', color: '#92400e' },
  paid:  { background: '#d1fae5', color: '#065f46' },
};

const BillingHistoryPage: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    apiGet<Bill[]>('/bills/')
      .then(setBills)
      .catch(() => setError('Failed to load billing history.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = bills.filter(b => {
    const guestName = b.guest_detail?.username?.toLowerCase() || '';
    const matchSearch = !search || guestName.includes(search.toLowerCase());
    const matchStatus = !filterStatus || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const calcTotal = (bill: Bill) => {
    const ordersTotal = (bill.orders_detail || []).reduce((sum, order) =>
      sum + (order.items_detail || []).reduce((s, item) =>
        s + (item.is_complimentary ? 0 : (item.customer_price ?? 0) * item.quantity), 0), 0);
    const externalTotal = (bill.external_purchases_detail || [])
      .filter(ep => !ep.is_paid_by_caretaker)
      .reduce((s, ep) => s + ep.cost, 0);
    const subtotal = ordersTotal + externalTotal;
    const discount = bill.discount_amount > 0
      ? bill.discount_amount
      : bill.discount_percentage > 0
        ? subtotal * (bill.discount_percentage / 100)
        : 0;
    return subtotal - discount;
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading billing history…</p></Layout>;

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Billing History</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>All generated guest bills</p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by guest…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '0.5rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 6, minWidth: 200, boxSizing: 'border-box', color: '#111827' }}
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '0.5rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827' }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontWeight: 500 }}>{bills.length === 0 ? 'No bills generated yet.' : 'No bills match your filters.'}</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: '#f0ece3', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Guest</th>
                <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                <th style={{ padding: '0.7rem 0.75rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</th>
                <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                <th style={{ padding: '0.7rem 1rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bill, i) => (
                <tr key={bill.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 500, color: '#111827' }}>
                    {bill.guest_detail?.username || '—'}
                  </td>
                  <td style={{ padding: '0.85rem 0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
                    {new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                    ₹{calcTotal(bill).toFixed(2)}
                  </td>
                  <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      ...(BILL_STATUS_STYLE[bill.status] || {}),
                    }}>
                      {bill.status === 'paid' ? 'Paid' : 'Draft'}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => navigate(`/manager/bill/${bill.id}`)}
                        style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, minHeight: 32 }}
                      >
                        View
                      </button>
                      <a
                        href={`/api/bills/${bill.id}/pdf/`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fff', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 6, padding: '0.3rem 0.7rem', fontSize: '0.8rem', minHeight: 32, textDecoration: 'none' }}
                      >
                        <Download size={13} /> PDF
                      </a>
                    </div>
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

export default BillingHistoryPage;
