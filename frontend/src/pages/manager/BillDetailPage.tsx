import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Download, Upload, CheckCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet, apiFetch } from '../../lib/api';
import type { Bill, ExternalPurchase } from '../../types';

const BillDetailPage: React.FC = () => {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [uploadingCatererProof, setUploadingCatererProof] = useState(false);
  const [reimbursing, setReimbursing] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);
  const catererScreenshotRef = useRef<HTMLInputElement>(null);
  const proofRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchBill = () => {
    apiGet<Bill>(`/bills/${billId}/`)
      .then(setBill)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBill(); }, [billId]);

  const handleApprovePayment = async () => {
    if (!screenshotRef.current?.files?.[0]) {
      alert('Please select a payment screenshot first.');
      return;
    }
    setApproving(true);
    const fd = new FormData();
    fd.append('status', 'paid');
    fd.append('payment_screenshot', screenshotRef.current.files[0]);
    await apiFetch(`/bills/${billId}/`, { method: 'PATCH', body: fd });
    await fetchBill();
    setApproving(false);
  };

  const handleUploadCatererProof = async () => {
    if (!catererScreenshotRef.current?.files?.[0]) {
      alert('Please select a file first.');
      return;
    }
    setUploadingCatererProof(true);
    const fd = new FormData();
    fd.append('bill_id', billId!);
    fd.append('screenshot', catererScreenshotRef.current.files[0]);
    await apiFetch('/bill-payments/', { method: 'POST', body: fd });
    setUploadingCatererProof(false);
    alert('Caterer payment proof uploaded.');
  };

  const handleReimburse = async (ep: ExternalPurchase) => {
    const file = proofRefs.current[ep.id]?.files?.[0];
    if (!file) { alert('Please select a proof file first.'); return; }
    setReimbursing(ep.id);
    const fd = new FormData();
    fd.append('is_reimbursed', 'true');
    fd.append('reimbursement_proof', file);
    await apiFetch(`/external-purchases/${ep.id}/`, { method: 'PATCH', body: fd });
    await fetchBill();
    setReimbursing(null);
  };

  const handleWhatsApp = () => {
    if (!bill?.guest_detail?.phone_number) {
      alert('This guest has no phone number registered.');
      return;
    }
    const phone = bill.guest_detail.phone_number.replace(/\D/g, '');
    const pdfUrl = bill.pdf_url || `${window.location.origin}/api/bills/${billId}/pdf/`;
    const message = encodeURIComponent(`Hi, please find your BookMyMeal bill here: ${pdfUrl}`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading bill…</p></Layout>;
  if (!bill) return <Layout><p style={{ color: '#6b7280' }}>Bill not found.</p></Layout>;

  const orders = bill.orders_detail || [];
  const allExtPurchases = (bill.external_purchases_detail || []) as ExternalPurchase[];
  const externalPurchases = allExtPurchases.filter(ep => !ep.is_paid_by_caretaker);
  const caretakerExpenses = allExtPurchases.filter(ep => ep.is_paid_by_caretaker);

  const ordersTotal = orders.reduce((sum, order) =>
    sum + (order.items_detail || []).reduce((s, item) =>
      s + (item.is_complimentary ? 0 : (item.customer_price ?? 0) * item.quantity), 0), 0);
  const externalTotal = externalPurchases.reduce((s, ep) => s + Number(ep.cost), 0);
  const caretakerExpensesTotal = caretakerExpenses.reduce((s, ep) => s + Number(ep.cost), 0);
  const subtotal = ordersTotal + externalTotal + caretakerExpensesTotal;
  const discountValue = Number(bill.discount_amount) > 0
    ? Number(bill.discount_amount)
    : Number(bill.discount_percentage) > 0
      ? subtotal * (Number(bill.discount_percentage) / 100)
      : 0;
  const grandTotal = subtotal - discountValue;

  const sectionCard: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Bill Detail</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>
            Guest: <strong style={{ color: '#374151' }}>{bill.guest_detail?.username ?? '—'}</strong>
            <span style={{ marginLeft: 8, color: '#9ca3af' }}>{new Date(bill.created_at).toLocaleDateString()}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            padding: '3px 10px',
            borderRadius: 12,
            fontSize: '0.8rem',
            fontWeight: 600,
            background: bill.status === 'paid' ? '#d1fae5' : '#fef3c7',
            color: bill.status === 'paid' ? '#065f46' : '#92400e',
          }}>
            {bill.status === 'paid' ? '✓ Paid' : 'Draft'}
          </span>
          <button
            onClick={handleWhatsApp}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#25D366', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 0.875rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', minHeight: 36 }}
          >
            <MessageCircle size={14} /> WhatsApp
          </button>
          <a
            href={`/api/bills/${billId}/pdf/`}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#fff', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 7, padding: '0.45rem 0.875rem', fontSize: '0.82rem', minHeight: 36, textDecoration: 'none' }}
          >
            <Download size={14} /> PDF
          </a>
          <button
            onClick={() => navigate('/manager/dashboard')}
            style={{ background: 'none', border: 'none', color: '#1a3c2c', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Orders */}
      {orders.map(order => (
        <div key={order.id} style={sectionCard}>
          <div style={{ padding: '0.6rem 1rem', background: '#f0ece3', borderBottom: '1px solid #e5e7eb', fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Order · {new Date(order.created_at).toLocaleString()}</span>
            {order.status === 'resolved' && (
              <span style={{ background: '#f0fdf4', color: '#166534', fontSize: '0.72rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>Caretaker Resolved</span>
            )}
          </div>
          <table style={{ width: '100%' }}>
            <tbody>
              {(order.items_detail || order.items).map((item, idx) => {
                const d = item as { name?: string; customer_price?: number; quantity: number; is_complimentary?: boolean; spicy_level?: string };
                return (
                  <tr key={idx} style={{ borderBottom: idx < (order.items_detail || order.items).length - 1 ? '1px solid #f0ece3' : undefined }}>
                    <td style={{ padding: '0.5rem 1rem', color: '#374151', fontWeight: 500 }}>
                      {d.name || (item as { menu_item_id: string }).menu_item_id}
                      {d.is_complimentary && (
                        <span style={{ marginLeft: 6, background: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>Complimentary</span>
                      )}
                      {order.status === 'resolved' && (
                        <span style={{ marginLeft: 6, background: '#f0fdf4', color: '#166534', fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>Modified</span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>×{d.quantity}</td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 500, color: d.is_complimentary ? '#16a34a' : '#111827' }}>
                      {d.is_complimentary ? '₹0' : `₹${((d.customer_price || 0) * d.quantity).toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* External purchases on bill (guest pays) */}
      {externalPurchases.length > 0 && (
        <div style={sectionCard}>
          <div style={{ padding: '0.6rem 1rem', background: '#f0ece3', borderBottom: '1px solid #e5e7eb', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
            Caretaker Purchases
          </div>
          <table style={{ width: '100%' }}>
            <tbody>
              {externalPurchases.map(ep => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #f0ece3' }}>
                  <td style={{ padding: '0.5rem 1rem', color: '#374151', fontWeight: 500 }}>
                    {ep.item_name}
                    <span style={{ marginLeft: 6, background: '#eff6ff', color: '#1e40af', fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>
                      Caretaker Purchase
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>×{ep.quantity}</td>
                  <td style={{ padding: '0.5rem', color: '#9ca3af', fontSize: '0.8rem' }}>{ep.vendor_name}</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 500, color: '#111827' }}>
                    ₹{Number(ep.cost).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Caretaker out-of-pocket expenses (not on guest bill) */}
      {caretakerExpenses.length > 0 && (
        <div style={sectionCard}>
          <div style={{ padding: '0.6rem 1rem', background: '#f0ece3', borderBottom: '1px solid #e5e7eb', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
            Caretaker Out-of-Pocket Expenses
            <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 400, color: '#6b7280' }}>reimbursable to caretaker</span>
          </div>
          <table style={{ width: '100%' }}>
            <tbody>
              {caretakerExpenses.map(ep => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #f0ece3' }}>
                  <td style={{ padding: '0.5rem 1rem', color: '#374151', fontWeight: 500, fontSize: '0.875rem' }}>
                    {ep.item_name}
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 1 }}>{ep.vendor_name}</div>
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.82rem' }}>×{ep.quantity}</td>
                  <td style={{ padding: '0.5rem', fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>₹{Number(ep.cost).toFixed(2)}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {ep.is_reimbursed ? (
                      <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '0.73rem', fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>✓ Reimbursed</span>
                    ) : (
                      <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.73rem', fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>Pending</span>
                    )}
                    {ep.reimbursement_proof_url && (
                      <a href={ep.reimbursement_proof_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: '0.72rem', color: '#1a3c2c' }}>proof</a>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 1rem' }}>
                    {!ep.is_reimbursed && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          ref={el => { proofRefs.current[ep.id] = el; }}
                          style={{ fontSize: '0.73rem', color: '#374151' }}
                        />
                        <button
                          onClick={() => handleReimburse(ep)}
                          disabled={reimbursing === ep.id}
                          style={{ background: reimbursing === ep.id ? '#e5e7eb' : '#16a34a', color: reimbursing === ep.id ? '#9ca3af' : '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.65rem', cursor: reimbursing === ep.id ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.75rem', minHeight: 30, whiteSpace: 'nowrap' }}
                        >
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

      {/* Totals */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', maxWidth: 360, marginLeft: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.35rem' }}>
          <span>Orders subtotal</span><span>₹{ordersTotal.toFixed(2)}</span>
        </div>
        {externalTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.35rem' }}>
            <span>Caretaker purchases</span><span>₹{externalTotal.toFixed(2)}</span>
          </div>
        )}
        {caretakerExpensesTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.35rem' }}>
            <span>Caretaker out-of-pocket</span><span>₹{caretakerExpensesTotal.toFixed(2)}</span>
          </div>
        )}
        {discountValue > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#16a34a', marginBottom: '0.35rem' }}>
            <span>Discount</span><span>−₹{discountValue.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.6rem', marginTop: '0.4rem' }}>
          <span>Total</span><span style={{ color: '#1a3c2c' }}>₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Approve payment */}
      {bill.status !== 'paid' && (
        <div style={{ ...sectionCard, padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#111827' }}>
            <CheckCircle size={16} color="#16a34a" /> Approve Guest Payment
          </h3>
          <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#374151', marginBottom: '0.3rem' }}>Payment screenshot *</label>
              <input ref={screenshotRef} type="file" accept="image/*" style={{ fontSize: '0.82rem', color: '#374151' }} />
            </div>
            <button
              onClick={handleApprovePayment}
              disabled={approving}
              style={{ background: approving ? '#e5e7eb' : '#16a34a', color: approving ? '#9ca3af' : '#fff', border: 'none', borderRadius: 7, padding: '0.55rem 1.25rem', cursor: approving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 40 }}
            >
              {approving ? 'Approving…' : 'Approve Payment'}
            </button>
          </div>
        </div>
      )}

      {/* Caterer payment proof */}
      <div style={{ ...sectionCard, padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#111827' }}>
          <Upload size={16} color="#6b7280" /> Upload Caterer Payment Proof
        </h3>
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <input ref={catererScreenshotRef} type="file" accept="image/*" style={{ fontSize: '0.82rem', color: '#374151' }} />
          <button
            onClick={handleUploadCatererProof}
            disabled={uploadingCatererProof}
            style={{ background: uploadingCatererProof ? '#e5e7eb' : '#1a3c2c', color: uploadingCatererProof ? '#9ca3af' : '#fff', border: 'none', borderRadius: 7, padding: '0.55rem 1.25rem', cursor: uploadingCatererProof ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 40 }}
          >
            {uploadingCatererProof ? 'Uploading…' : 'Upload Proof'}
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default BillDetailPage;
