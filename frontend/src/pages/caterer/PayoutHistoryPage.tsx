import React, { useEffect, useState } from 'react';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet } from '../../lib/api';

interface PayoutItem {
  item_name: string;
  quantity: number;
  caterer_price: number;
  line_total: number;
}

interface PayoutRecord {
  id: string;
  stay_start?: string;
  stay_end?: string;
  bill_date: string;
  items: PayoutItem[];
  total_caterer_amount: number;
  is_paid: boolean;
  payment_proof_url?: string;
}

const PayoutHistoryPage: React.FC = () => {
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiGet<PayoutRecord[]>('/caterer-bills/')
      .then(setPayouts)
      .catch(() => setError('Payout history is not yet available. Please check back later.'))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalPending = payouts.filter(p => !p.is_paid).reduce((s, p) => s + p.total_caterer_amount, 0);
  const totalPaid = payouts.filter(p => p.is_paid).reduce((s, p) => s + p.total_caterer_amount, 0);

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading payout history…</p></Layout>;

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Payout History</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Your earnings per guest stay (caterer prices only)</p>
      </div>

      {error ? (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '1rem 1.25rem', color: '#92400e', fontSize: '0.875rem' }}>
          {error}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {payouts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', maxWidth: 480 }}>
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500, marginBottom: '0.4rem' }}>Pending Payment</p>
                <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#d97706' }}>₹{totalPending.toFixed(2)}</p>
              </div>
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500, marginBottom: '0.4rem' }}>Total Received</p>
                <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#16a34a' }}>₹{totalPaid.toFixed(2)}</p>
              </div>
            </div>
          )}

          {payouts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontWeight: 500 }}>No payout records yet.</p>
              <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Payouts appear here after the manager generates a guest bill.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {payouts.map(payout => {
                const isOpen = expanded.has(payout.id);
                return (
                  <div key={payout.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    {/* Header row */}
                    <button
                      onClick={() => toggleExpand(payout.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem 1.25rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        {isOpen ? <ChevronDown size={16} color="#6b7280" /> : <ChevronRight size={16} color="#6b7280" />}
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>
                            {payout.stay_start && payout.stay_end
                              ? `${formatDate(payout.stay_start)} – ${formatDate(payout.stay_end)}`
                              : formatDate(payout.bill_date)}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 1 }}>
                            {payout.items.length} item{payout.items.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
                          ₹{payout.total_caterer_amount.toFixed(2)}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: payout.is_paid ? '#d1fae5' : '#fef3c7',
                          color: payout.is_paid ? '#065f46' : '#92400e',
                        }}>
                          {payout.is_paid ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div style={{ borderTop: '1px solid #f3f4f6', padding: '1rem 1.25rem' }}>
                        <table style={{ width: '100%', marginBottom: '0.75rem' }}>
                          <thead>
                            <tr style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                              <th style={{ padding: '0.4rem 0', textAlign: 'left', fontWeight: 500 }}>Item</th>
                              <th style={{ padding: '0.4rem 0', textAlign: 'center', fontWeight: 500 }}>Qty</th>
                              <th style={{ padding: '0.4rem 0', textAlign: 'right', fontWeight: 500 }}>Rate</th>
                              <th style={{ padding: '0.4rem 0', textAlign: 'right', fontWeight: 500 }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payout.items.map((item, idx) => (
                              <tr key={idx} style={{ borderTop: '1px solid #f0ece3' }}>
                                <td style={{ padding: '0.45rem 0', color: '#374151' }}>{item.item_name}</td>
                                <td style={{ padding: '0.45rem 0', textAlign: 'center', color: '#6b7280' }}>×{item.quantity}</td>
                                <td style={{ padding: '0.45rem 0', textAlign: 'right', color: '#6b7280' }}>₹{item.caterer_price.toFixed(2)}</td>
                                <td style={{ padding: '0.45rem 0', textAlign: 'right', fontWeight: 500, color: '#111827' }}>₹{item.line_total.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                              <td colSpan={3} style={{ padding: '0.55rem 0', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }}>Total</td>
                              <td style={{ padding: '0.55rem 0', textAlign: 'right', fontWeight: 700 }}>₹{payout.total_caterer_amount.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>

                        {payout.payment_proof_url && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 500 }}>Payment received</span>
                            <a
                              href={payout.payment_proof_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.78rem', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 5, padding: '0.2rem 0.5rem' }}
                            >
                              <Download size={11} /> Proof
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Layout>
  );
};

export default PayoutHistoryPage;
