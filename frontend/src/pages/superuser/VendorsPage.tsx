import React, { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
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

  if (loading) return <Layout><p>Loading vendors…</p></Layout>;

  const adhocVendors = vendors.filter(v => v.vendor_type === 'ad-hoc');
  const regularVendors = vendors.filter(v => v.vendor_type === 'regular');

  return (
    <Layout>
      <h1 style={{ marginBottom: '0.5rem' }}>Vendor Management</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Edit vendor names to merge duplicates, or remove erroneous entries.
      </p>

      {vendors.length === 0 && <p style={{ color: '#666' }}>No vendors registered yet.</p>}

      {adhocVendors.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#e65100' }}>Ad-hoc Vendors (auto-registered)</h2>
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9f9f9', fontSize: '0.85rem', color: '#666' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Vendor Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Order Count</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>First Seen</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adhocVendors.map(vendor => (
                  <tr key={vendor.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {editingId === vendor.id ? (
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(vendor.id); if (e.key === 'Escape') setEditingId(null); }}
                          style={{ padding: '0.3rem 0.5rem', border: '1px solid #f16524', borderRadius: 4, fontSize: '0.95rem', width: '100%' }}
                        />
                      ) : (
                        <span>{vendor.name}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ background: '#fff3e0', color: '#e65100', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600 }}>
                        {vendor.order_count}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
                      {new Date(vendor.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {editingId === vendor.id ? (
                          <>
                            <button onClick={() => handleSaveEdit(vendor.id)} style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 0.7rem', cursor: 'pointer', minHeight: 44, fontSize: '0.8rem' }}>Save</button>
                            <button onClick={() => setEditingId(null)} style={{ background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer', minHeight: 44, fontSize: '0.8rem' }}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(vendor)} title="Edit name" style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', minHeight: 44 }}>
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(vendor.id)} title="Delete vendor" style={{ background: 'none', border: '1px solid #fce4ec', borderRadius: 4, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#c62828', display: 'flex', alignItems: 'center', minHeight: 44 }}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {regularVendors.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Regular Caterers</h2>
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9f9f9', fontSize: '0.85rem', color: '#666' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Orders</th>
                </tr>
              </thead>
              <tbody>
                {regularVendors.map(v => (
                  <tr key={v.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>{v.name}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{v.order_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Layout>
  );
};

export default VendorsPage;
