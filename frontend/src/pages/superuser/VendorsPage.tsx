import React, { useEffect, useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet, apiPatch, apiDelete } from '../../lib/api';
import type { Vendor } from '../../types';

const VendorsPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const fetchVendors = () => {
    apiGet<Vendor[]>('/vendors/').then(setVendors).finally(() => setLoading(false));
  };

  useEffect(() => { fetchVendors(); }, []);

  const handleEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setEditName(vendor.name);
  };

  const handleSaveEdit = async (id: string) => {
    await apiPatch(`/vendors/${id}/`, { name: editName.trim() });
    setEditingId(null);
    fetchVendors();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this vendor? This cannot be undone.')) return;
    await apiDelete(`/vendors/${id}/`);
    fetchVendors();
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading vendors…</p></Layout>;

  const adhocVendors = vendors.filter(v => v.vendor_type === 'ad-hoc');
  const regularVendors = vendors.filter(v => v.vendor_type === 'regular');

  const VendorTable: React.FC<{ items: Vendor[]; showActions?: boolean }> = ({ items, showActions = false }) => (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0ece3', borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vendor Name</th>
            <th style={{ padding: '0.6rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Orders</th>
            <th style={{ padding: '0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>First Seen</th>
            {showActions && (
              <th style={{ padding: '0.6rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((vendor, idx) => (
            <tr key={vendor.id} style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : undefined }}>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#111827' }}>
                {editingId === vendor.id ? (
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit(vendor.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{
                      padding: '0.35rem 0.55rem',
                      border: '1px solid #1a3c2c',
                      borderRadius: 6,
                      fontSize: '0.9rem',
                      width: '100%',
                      color: '#111827',
                      outline: 'none',
                    }}
                  />
                ) : (
                  vendor.name
                )}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <span style={{
                  background: '#e6efe9', color: '#c2410c',
                  padding: '2px 8px', borderRadius: 12,
                  fontSize: '0.78rem', fontWeight: 600,
                }}>
                  {vendor.order_count}
                </span>
              </td>
              <td style={{ padding: '0.75rem', fontSize: '0.82rem', color: '#9ca3af' }}>
                {new Date(vendor.created_at).toLocaleDateString()}
              </td>
              {showActions && (
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                    {editingId === vendor.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(vendor.id)}
                          title="Save"
                          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.8rem', minHeight: 32 }}
                        >
                          <Check size={13} /> Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          title="Cancel"
                          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', minHeight: 32 }}
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(vendor)}
                          title="Edit name"
                          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', minHeight: 32 }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(vendor.id)}
                          title="Delete vendor"
                          style={{ background: 'none', border: '1px solid #fee2e2', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', minHeight: 32 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Vendor Management</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>
          Rename vendors to merge duplicates or remove erroneous entries.
        </p>
      </div>

      {vendors.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '3rem' }}>No vendors registered yet.</p>
      )}

      {adhocVendors.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Ad-hoc Vendors
            </h2>
            <span style={{ background: '#fff3ed', color: '#c2410c', fontSize: '0.72rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>
              auto-registered
            </span>
          </div>
          <VendorTable items={adhocVendors} showActions />
        </section>
      )}

      {regularVendors.length > 0 && (
        <section>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Regular Caterers
          </h2>
          <VendorTable items={regularVendors} />
        </section>
      )}
    </Layout>
  );
};

export default VendorsPage;
