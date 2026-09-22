import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Upload } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet, apiFetch } from '../../lib/api';
import type { CatererBillBreakdown } from '../../types';

const CatererBillDetailPage: React.FC = () => {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const [breakdown, setBreakdown] = useState<CatererBillBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const screenshotRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchBreakdown = () => {
    apiGet<CatererBillBreakdown>(`/caterer-bills/${billId}/`)
      .then(setBreakdown)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBreakdown(); }, [billId]);

  const handleUploadProof = async (catererId: string) => {
    const file = screenshotRefs.current[catererId]?.files?.[0];
    if (!file) {
      alert('Please select a payment screenshot first.');
      return;
    }
    setUploadingFor(catererId);
    const fd = new FormData();
    fd.append('bill', billId!);
    fd.append('caterer', catererId);
    fd.append('screenshot', file);
    const res = await apiFetch('/bill-payments/', { method: 'POST', body: fd });
    setUploadingFor(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to upload payment proof: ${Object.values(err).flat().join(' ') || res.status}`);
      return;
    }
    const ref = screenshotRefs.current[catererId];
    if (ref) ref.value = '';
    await fetchBreakdown();
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading bill…</p></Layout>;
  if (!breakdown) return <Layout><p style={{ color: '#6b7280' }}>Bill not found.</p></Layout>;

  const sectionCard: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Caterer Bills</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>
            Amounts owed to each caterer for this guest stay
            <span style={{ marginLeft: 8, color: '#9ca3af' }}>{new Date(breakdown.bill_date).toLocaleDateString()}</span>
          </p>
        </div>
        <button
          onClick={() => navigate('/manager/dashboard')}
          style={{ background: 'none', border: 'none', color: '#1a3c2c', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Back
        </button>
      </div>

      {breakdown.caterers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontWeight: 500 }}>No caterer items on this bill.</p>
        </div>
      )}

      {breakdown.caterers.map(payout => (
        <div key={payout.caterer_id} style={sectionCard}>
          {/* Caterer header */}
          <div style={{ padding: '0.85rem 1.25rem', background: '#f0ece3', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.95rem' }}>{payout.caterer_name}</span>
              <span style={{
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: '0.78rem',
                fontWeight: 600,
                background: payout.is_paid ? '#d1fae5' : '#fef3c7',
                color: payout.is_paid ? '#065f46' : '#92400e',
              }}>
                {payout.is_paid ? '✓ Paid' : 'Not yet paid'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>₹{payout.total_caterer_amount.toFixed(2)}</span>
              {payout.caterer_id && (
                <a
                  href={`/api/caterer-bills/${billId}/pdf/`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#fff', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 7, padding: '0.35rem 0.7rem', fontSize: '0.78rem', textDecoration: 'none' }}
                >
                  <Download size={13} /> PDF
                </a>
              )}
            </div>
          </div>

          {/* Items */}
          <table style={{ width: '100%' }}>
            <tbody>
              {payout.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: idx < payout.items.length - 1 ? '1px solid #f0ece3' : undefined }}>
                  <td style={{ padding: '0.5rem 1.25rem', color: '#374151', fontWeight: 500 }}>{item.item_name}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>×{item.quantity}</td>
                  <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontWeight: 500, color: '#111827' }}>₹{item.line_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pay this caterer */}
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #f3f4f6' }}>
            {payout.payment_proof_url && (
              <div style={{ marginBottom: '0.6rem' }}>
                <a
                  href={payout.payment_proof_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.78rem', color: '#6b7280', textDecoration: 'underline' }}
                >
                  View payment proof
                </a>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <input
                ref={el => { if (payout.caterer_id) screenshotRefs.current[payout.caterer_id] = el; }}
                type="file"
                accept="image/*"
                style={{ fontSize: '0.82rem', color: '#374151' }}
              />
              <button
                onClick={() => payout.caterer_id && handleUploadProof(payout.caterer_id)}
                disabled={uploadingFor === payout.caterer_id}
                style={{
                  background: uploadingFor === payout.caterer_id ? '#e5e7eb' : '#1a3c2c',
                  color: uploadingFor === payout.caterer_id ? '#9ca3af' : '#fff',
                  border: 'none', borderRadius: 7, padding: '0.5rem 1.1rem',
                  cursor: uploadingFor === payout.caterer_id ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: '0.82rem', minHeight: 38,
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}
              >
                <Upload size={14} />
                {uploadingFor === payout.caterer_id ? 'Uploading…' : payout.is_paid ? 'Upload New Proof' : `Mark ${payout.caterer_name} as Paid`}
              </button>
            </div>
          </div>
        </div>
      ))}
    </Layout>
  );
};

export default CatererBillDetailPage;
