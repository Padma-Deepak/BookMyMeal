import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, CheckCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet, apiFetch } from '../../lib/api';
import type { Bill, ExternalPurchase, PayoutRecord } from '../../types';

const BILL_STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: { background: '#fef3c7', color: '#92400e' },
  paid:  { background: '#d1fae5', color: '#065f46' },
};

const PAID_BADGE: React.CSSProperties = { background: '#d1fae5', color: '#065f46' };
const DUE_BADGE: React.CSSProperties = { background: '#fee2e2', color: '#991b1b' };

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: '0.78rem',
  fontWeight: 500,
};

type Tab = 'guests' | 'caterers' | 'caretakers';

const BillingHistoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('guests');
  const navigate = useNavigate();

  // Guest bills
  const [bills, setBills] = useState<Bill[]>([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Caterer bills
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [payoutsError, setPayoutsError] = useState('');

  // Caretaker reimbursements
  const [purchases, setPurchases] = useState<ExternalPurchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [purchasesError, setPurchasesError] = useState('');
  const [reimbursing, setReimbursing] = useState<string | null>(null);
  const proofRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    apiGet<Bill[]>('/bills/')
      .then(setBills)
      .catch(() => setBillsError('Failed to load billing history.'))
      .finally(() => setBillsLoading(false));

    apiGet<PayoutRecord[]>('/caterer-bills/')
      .then(setPayouts)
      .catch(() => setPayoutsError('Failed to load caterer billing history.'))
      .finally(() => setPayoutsLoading(false));

    fetchPurchases();
  }, []);

  const fetchPurchases = () => {
    apiGet<ExternalPurchase[]>('/external-purchases/')
      .then(setPurchases)
      .catch(() => setPurchasesError('Failed to load caretaker billing history.'))
      .finally(() => setPurchasesLoading(false));
  };

  const handleReimburse = async (ep: ExternalPurchase) => {
    const file = proofRefs.current[ep.id]?.files?.[0];
    if (!file) { alert('Please select a proof file first.'); return; }
    setReimbursing(ep.id);
    const fd = new FormData();
    fd.append('is_reimbursed', 'true');
    fd.append('reimbursement_proof', file);
    await apiFetch(`/external-purchases/${ep.id}/`, { method: 'PATCH', body: fd });
    await fetchPurchases();
    setReimbursing(null);
  };

  const filteredBills = bills.filter(b => {
    const guestName = b.guest_detail?.username?.toLowerCase() || '';
    const matchSearch = !search || guestName.includes(search.toLowerCase());
    const matchStatus = !filterStatus || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const reimbursablePurchases = purchases.filter(p => p.is_paid_by_caretaker);

  const loading = billsLoading || payoutsLoading || purchasesLoading;
  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading billing history…</p></Layout>;

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Billing History</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Guest bills, caterer payouts, and caretaker reimbursements</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
        {([
          { key: 'guests', label: 'Guest Bills' },
          { key: 'caterers', label: 'Caterer Billing' },
          { key: 'caretakers', label: 'Caretaker Billing' },
        ] as { key: Tab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #1a3c2c' : '2px solid transparent',
              padding: '0.6rem 1.25rem',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#1a3c2c' : '#6b7280',
              fontSize: '0.9rem',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Guest Bills ── */}
      {activeTab === 'guests' && (
        <>
          {billsError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#dc2626' }}>
              {billsError}
            </div>
          )}

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

          {filteredBills.length === 0 ? (
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
                  {filteredBills.map((bill, i) => (
                    <tr key={bill.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 500, color: '#111827' }}>
                        {bill.guest_detail?.username || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
                        {new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                        ₹{bill.grand_total.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ ...badgeStyle, ...(BILL_STATUS_STYLE[bill.status] || {}) }}>
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
        </>
      )}

      {/* ── Caterer Billing ── */}
      {activeTab === 'caterers' && (
        <>
          {payoutsError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#dc2626' }}>
              {payoutsError}
            </div>
          )}

          {payouts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontWeight: 500 }}>No caterer bills yet.</p>
              <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Caterer amounts are generated alongside guest bills.</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f0ece3', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bill Date</th>
                    <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Caterers</th>
                    <th style={{ padding: '0.7rem 0.75rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</th>
                    <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p, i) => {
                    const caterers = Array.from(new Set(p.items.map(it => it.caterer_name).filter(Boolean)));
                    return (
                      <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                        <td style={{ padding: '0.85rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                          {new Date(p.bill_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: '#374151', fontSize: '0.875rem' }}>
                          {caterers.length > 0 ? caterers.join(', ') : '—'}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                          ₹{p.total_caterer_amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                          <span style={{ ...badgeStyle, ...(p.is_paid ? PAID_BADGE : DUE_BADGE) }}>
                            {p.is_paid ? 'Paid' : 'Due'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => navigate(`/manager/bill/${p.id}`)}
                              style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, minHeight: 32 }}
                            >
                              View / Pay
                            </button>
                            {p.payment_proof_url && (
                              <a
                                href={p.payment_proof_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '0.78rem', color: '#1a3c2c', alignSelf: 'center' }}
                              >
                                proof
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Caretaker Billing ── */}
      {activeTab === 'caretakers' && (
        <>
          {purchasesError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#dc2626' }}>
              {purchasesError}
            </div>
          )}

          {reimbursablePurchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontWeight: 500 }}>No out-of-pocket caretaker purchases logged yet.</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f0ece3', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                    <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Caretaker</th>
                    <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Guest</th>
                    <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Item</th>
                    <th style={{ padding: '0.7rem 0.75rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cost</th>
                    <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reimbursablePurchases.map((ep, i) => (
                    <tr key={ep.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                      <td style={{ padding: '0.85rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                        {ep.created_at ? new Date(ep.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', color: '#111827', fontWeight: 500 }}>
                        {ep.caretaker_username || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', color: '#374151' }}>
                        {ep.guest_username || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', color: '#374151' }}>
                        {ep.item_name} <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>×{ep.quantity}</span>
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                        ₹{Number(ep.cost).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ ...badgeStyle, ...(ep.is_reimbursed ? PAID_BADGE : DUE_BADGE) }}>
                          {ep.is_reimbursed ? 'Reimbursed' : 'Due'}
                        </span>
                        {ep.reimbursement_proof_url && (
                          <a href={ep.reimbursement_proof_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: '0.72rem', color: '#1a3c2c' }}>proof</a>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {!ep.is_reimbursed && (
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              ref={el => { proofRefs.current[ep.id] = el; }}
                              style={{ fontSize: '0.72rem', width: 110 }}
                            />
                            <button
                              onClick={() => handleReimburse(ep)}
                              disabled={reimbursing === ep.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, background: reimbursing === ep.id ? '#e5e7eb' : '#16a34a', color: reimbursing === ep.id ? '#9ca3af' : '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.65rem', cursor: reimbursing === ep.id ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.75rem', minHeight: 30, whiteSpace: 'nowrap' }}
                            >
                              <CheckCircle size={12} />
                              {reimbursing === ep.id ? 'Saving…' : 'Mark Reimbursed'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Layout>
  );
};

export default BillingHistoryPage;
