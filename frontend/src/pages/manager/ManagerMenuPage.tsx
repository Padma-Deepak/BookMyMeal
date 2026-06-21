import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Gift } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api';
import type { MenuItem } from '../../types';
import { CATEGORY_LABELS } from '../../types';

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverage'] as const;

type NewItemForm = {
  name: string;
  description: string;
  category: string;
  caterer_price: string;
  customer_price: string;
  notice_period_minutes: string;
  is_complimentary: boolean;
};

const defaultForm: NewItemForm = {
  name: '',
  description: '',
  category: 'breakfast',
  caterer_price: '',
  customer_price: '',
  notice_period_minutes: '0',
  is_complimentary: false,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  boxSizing: 'border-box',
  color: '#111827',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '0.25rem',
};

const ManagerMenuPage: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<NewItemForm>(defaultForm);
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingPrices, setEditingPrices] = useState<Record<string, { caterer: string; customer: string }>>({});

  const fetchItems = () => {
    apiGet<MenuItem[]>('/menu-items/').then(setItems).finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const handleToggleAvailability = async (item: MenuItem) => {
    await apiPatch(`/menu-items/${item.id}/`, { is_available: !item.is_available });
    fetchItems();
  };

  const handleToggleComplimentary = async (item: MenuItem) => {
    await apiPatch(`/menu-items/${item.id}/`, { is_complimentary: !item.is_complimentary });
    fetchItems();
  };

  const handleSavePrices = async (item: MenuItem) => {
    const edit = editingPrices[item.id];
    if (!edit) return;
    const caterer = parseFloat(edit.caterer);
    const customer = parseFloat(edit.customer);
    if (isNaN(caterer) || caterer < 0 || isNaN(customer) || customer < 0) return;
    await apiPatch(`/menu-items/${item.id}/`, {
      caterer_price: caterer,
      customer_price: customer,
    });
    setEditingPrices(p => { const next = { ...p }; delete next[item.id]; return next; });
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this item from the menu?')) return;
    await apiDelete(`/menu-items/${id}/`);
    fetchItems();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newItem.name.trim()) { setAddError('Name is required.'); return; }
    if (!newItem.caterer_price) { setAddError('Caterer price is required.'); return; }
    if (!newItem.customer_price && !newItem.is_complimentary) { setAddError('Customer price is required (or mark as complimentary).'); return; }
    setSaving(true);
    try {
      await apiPost('/menu-items/', {
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        category: newItem.category,
        caterer_price: parseFloat(newItem.caterer_price),
        customer_price: newItem.is_complimentary ? 0 : parseFloat(newItem.customer_price || '0'),
        notice_period_minutes: parseInt(newItem.notice_period_minutes, 10) || 0,
        is_available: true,
        is_complimentary: newItem.is_complimentary,
      });
      setNewItem(defaultForm);
      setShowAddForm(false);
      fetchItems();
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown> };
      const msg = e.data ? Object.values(e.data).flat().join(' ') : 'Failed to add item.';
      setAddError(msg);
    } finally {
      setSaving(false);
    }
  };

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading menu…</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Menu Management</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Set customer prices and manage availability</p>
        </div>
        <button
          onClick={() => { setShowAddForm(v => !v); setAddError(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: '#1a3c2c',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.55rem 1rem',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 40,
          }}
        >
          <Plus size={15} /> Add Item
        </button>
      </div>

      {/* Add item form */}
      {showAddForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>New Menu Item</h2>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Caterer Price (₹) *</label>
                <input type="number" min="0" step="0.01" value={newItem.caterer_price} onChange={e => setNewItem(p => ({ ...p, caterer_price: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Customer Price (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={newItem.customer_price}
                  disabled={newItem.is_complimentary}
                  onChange={e => setNewItem(p => ({ ...p, customer_price: e.target.value }))}
                  placeholder={newItem.is_complimentary ? '₹0 (complimentary)' : ''}
                  style={{ ...inputStyle, background: newItem.is_complimentary ? '#f9fafb' : '#fff', color: newItem.is_complimentary ? '#9ca3af' : '#111827' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Notice Period (minutes)</label>
                <input type="number" min="0" value={newItem.notice_period_minutes} onChange={e => setNewItem(p => ({ ...p, notice_period_minutes: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={newItem.is_complimentary}
                    onChange={e => setNewItem(p => ({ ...p, is_complimentary: e.target.checked, customer_price: e.target.checked ? '0' : p.customer_price }))}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  Complimentary (₹0 for guest)
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Description</label>
                <input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            {addError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#dc2626', marginBottom: '0.75rem' }}>
                {addError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button type="submit" disabled={saving} style={{ background: saving ? '#7aab8e' : '#1a3c2c', color: '#fff', border: 'none', borderRadius: 7, padding: '0.5rem 1.25rem', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 38 }}>
                {saving ? 'Saving…' : 'Save Item'}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, padding: '0.5rem 0.875rem', cursor: 'pointer', color: '#374151', fontSize: '0.875rem', minHeight: 38 }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {items.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>No menu items yet. Add the first item.</p>
      )}

      {Object.entries(grouped).map(([category, catItems]) => (
        <section key={category} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {catItems.map((item, idx) => {
              const isEditing = !!editingPrices[item.id];
              const prices = editingPrices[item.id] || { caterer: String(item.caterer_price), customer: String(item.customer_price) };
              return (
                <div
                  key={item.id}
                  style={{
                    borderTop: idx > 0 ? '1px solid #f3f4f6' : undefined,
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Name & meta */}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, color: '#111827' }}>{item.name}</span>
                      {item.is_complimentary && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#ecfdf5', color: '#065f46', fontSize: '0.72rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>
                          <Gift size={10} /> Complimentary
                        </span>
                      )}
                      <span style={{ background: item.is_available ? '#f0fdf4' : '#fef2f2', color: item.is_available ? '#16a34a' : '#dc2626', fontSize: '0.72rem', fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    {item.description && <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 2 }}>{item.description}</div>}
                  </div>

                  {/* Price editors */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                      <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>Caterer ₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={prices.caterer}
                        onChange={e => setEditingPrices(p => ({ ...p, [item.id]: { ...prices, caterer: e.target.value } }))}
                        style={{ width: 70, padding: '0.3rem 0.4rem', border: '1px solid #d1d5db', borderRadius: 5 }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                      <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>Guest ₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.is_complimentary ? '0' : prices.customer}
                        disabled={item.is_complimentary}
                        onChange={e => setEditingPrices(p => ({ ...p, [item.id]: { ...prices, customer: e.target.value } }))}
                        style={{ width: 70, padding: '0.3rem 0.4rem', border: '1px solid #d1d5db', borderRadius: 5, background: item.is_complimentary ? '#f9fafb' : '#fff' }}
                      />
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => handleSavePrices(item)}
                        style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, minHeight: 30 }}
                      >
                        Save
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => handleToggleComplimentary(item)}
                      title={item.is_complimentary ? 'Remove complimentary' : 'Mark complimentary'}
                      style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: item.is_complimentary ? '#16a34a' : '#9ca3af', display: 'flex', alignItems: 'center', minHeight: 34 }}
                    >
                      <Gift size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      title={item.is_available ? 'Mark unavailable' : 'Mark available'}
                      style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, minHeight: 34, fontSize: '0.78rem' }}
                    >
                      {item.is_available ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      title="Delete item"
                      style={{ background: 'none', border: '1px solid #fee2e2', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', minHeight: 34 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </Layout>
  );
};

export default ManagerMenuPage;
