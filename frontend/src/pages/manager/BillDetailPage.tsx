import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Download, Upload, CheckCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet, apiFetch } from '../../lib/api';
import type { Bill } from '../../types';

const BillDetailPage: React.FC = () => {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const screenshotRef = useRef<HTMLInputElement>(null);
  const catererScreenshotRef = useRef<HTMLInputElement>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadingCatererProof, setUploadingCatererProof] = useState(false);

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
    fetchBill();
    setApproving(false);
  };

  const handleUploadCatererProof = async () => {
    if (!catererScreenshotRef.current?.files?.[0]) {
      alert('Please select a screenshot first.');
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

  const handleWhatsApp = () => {
    if (!bill?.guest_detail?.phone_number) {
      alert('Guest has no phone number registered.');
      return;
    }
    const phone = bill.guest_detail.phone_number.replace(/\D/g, '');
    const pdfUrl = bill.pdf_url || `${window.location.origin}/api/bills/${billId}/pdf/`;
    const message = encodeURIComponent(`Hi, please find your BookMyMeal bill here: ${pdfUrl}`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  if (loading) return <Layout><p>Loading bill…</p></Layout>;
  if (!bill) return <Layout><p>Bill not found.</p></Layout>;

  const orders = bill.orders_detail || [];
  const externalPurchases = bill.external_purchases_detail || [];

  const ordersTotal = orders.reduce((sum, order) =>
    sum + (order.items_detail || []).reduce((s, item) =>
      s + (item.is_complimentary ? 0 : item.customer_price * item.quantity), 0), 0);

  const externalTotal = externalPurchases
    .filter(ep => !ep.is_paid_by_caretaker)
    .reduce((s, ep) => s + ep.cost, 0);

  const subtotal = ordersTotal + externalTotal;
  const discountValue = bill.discount_amount > 0
    ? bill.discount_amount
    : bill.discount_percentage > 0
      ? subtotal * (bill.discount_percentage / 100)
      : 0;
  const grandTotal = subtotal - discountValue;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Bill Detail</h1>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>Guest: {bill.guest_detail?.username}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* WhatsApp share (PRD §4.4.3) */}
          <button
            onClick={handleWhatsApp}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', minHeight: 44, fontSize: '0.85rem' }}
          >
            <MessageCircle size={16} /> Send via WhatsApp
          </button>
          {/* PDF download stub */}
          <a
            href={`/api/bills/${billId}/pdf/`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fff', border: '1px solid #ccc', color: '#333', borderRadius: 8, padding: '0.5rem 1rem', textDecoration: 'none', fontSize: '0.85rem', minHeight: 44 }}
          >
            <Download size={16} /> Download PDF
          </a>
          <button onClick={() => navigate('/manager/dashboard')} style={{ color: '#f16524', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        </div>
      </div>

      {/* Bill status badge */}
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{ background: bill.status === 'paid' ? '#e8f5e9' : '#fff3e0', color: bill.status === 'paid' ? '#2e7d32' : '#e65100', padding: '0.3rem 0.8rem', borderRadius: 12, fontWeight: 600, fontSize: '0.85rem' }}>
          {bill.status === 'paid' ? '✓ Paid' : 'Draft'}
        </span>
        <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#999' }}>{new Date(bill.created_at).toLocaleString()}</span>
      </div>

      {/* Orders */}
      {orders.map(order => (
        <div key={order.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ padding: '0.6rem 1rem', background: '#f9f9f9', borderBottom: '1px solid #e0e0e0', fontSize: '0.8rem', color: '#666' }}>
            Order • {new Date(order.created_at).toLocaleString()}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {(order.items_detail || order.items).map((item, idx) => {
                const d = item as { name?: string; customer_price?: number; quantity: number; is_complimentary?: boolean; spicy_level?: string };
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      {d.name || (item as { menu_item_id: string }).menu_item_id}
                      {d.is_complimentary && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#2e7d32', background: '#e8f5e9', padding: '0.1rem 0.4rem', borderRadius: 4 }}>Complimentary</span>}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>×{d.quantity}</td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                      {d.is_complimentary ? <span style={{ color: '#2e7d32' }}>₹0</span> : `₹${((d.customer_price || 0) * d.quantity).toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* External purchases */}
      {externalPurchases.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ padding: '0.6rem 1rem', background: '#f9f9f9', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', fontWeight: 600 }}>Caretaker Purchases</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {externalPurchases.map(ep => (
                <tr key={ep.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '0.5rem 1rem' }}>
                    {ep.item_name}
                    <span style={{ marginLeft: 6, fontSize: '0.75rem', background: '#e3f2fd', color: '#1565c0', padding: '0.1rem 0.4rem', borderRadius: 4 }}>Caretaker Purchase</span>
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>×{ep.quantity}</td>
                  <td style={{ padding: '0.5rem', color: '#666', fontSize: '0.8rem' }}>{ep.vendor_name}</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                    {ep.is_paid_by_caretaker ? <span style={{ color: '#999' }}>Paid by caretaker</span> : `₹${ep.cost.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem', maxWidth: 400, marginLeft: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span>Orders subtotal</span><span>₹{ordersTotal.toFixed(2)}</span>
        </div>
        {externalTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span>Caretaker purchases</span><span>₹{externalTotal.toFixed(2)}</span>
          </div>
        )}
        {discountValue > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: '#2e7d32' }}>
            <span>Discount</span><span>-₹{discountValue.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', borderTop: '1px solid #e0e0e0', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
          <span>Total</span><span>₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Approve payment */}
      {bill.status !== 'paid' && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1.25rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} /> Approve Guest Payment
          </h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Payment screenshot *</label>
              <input ref={screenshotRef} type="file" accept="image/*" style={{ fontSize: '0.85rem' }} />
            </div>
            <button
              onClick={handleApprovePayment}
              disabled={approving}
              style={{ background: approving ? '#ccc' : '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', cursor: approving ? 'not-allowed' : 'pointer', minHeight: 44, fontWeight: 600 }}
            >
              {approving ? 'Approving…' : 'Approve Payment'}
            </button>
          </div>
        </div>
      )}

      {/* Caterer payment proof */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Upload size={18} /> Upload Caterer Payment Proof
        </h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={catererScreenshotRef} type="file" accept="image/*" style={{ fontSize: '0.85rem' }} />
          <button
            onClick={handleUploadCatererProof}
            disabled={uploadingCatererProof}
            style={{ background: uploadingCatererProof ? '#ccc' : '#f16524', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', cursor: uploadingCatererProof ? 'not-allowed' : 'pointer', minHeight: 44 }}
          >
            {uploadingCatererProof ? 'Uploading…' : 'Upload Proof'}
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default BillDetailPage;
