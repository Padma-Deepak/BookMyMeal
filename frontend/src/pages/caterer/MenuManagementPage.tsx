import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api';
import type { MenuItem } from '../../types';
import { CATEGORY_LABELS } from '../../types';

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverage'] as const;

const MenuManagementPage: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', category: 'breakfast', caterer_price: '', notice_period_minutes: '0' });
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchItems = () => {
    apiGet<MenuItem[]>('/menu-items/').then(setItems).finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const handleToggleAvailability = async (item: MenuItem) => {
    await apiPatch(`/menu-items/${item.id}/`, { is_available: !item.is_available });
    fetchItems();
  };

  const handleNoticePeriodChange = async (item: MenuItem, value: string) => {
    const minutes = parseInt(value, 10);
    if (!isNaN(minutes) && minutes >= 0) {
      await apiPatch(`/menu-items/${item.id}/`, { notice_period_minutes: minutes });
      fetchItems();
    }
  };

  const handleCatererPriceChange = async (item: MenuItem, value: string) => {
    const price = parseFloat(value);
    if (!isNaN(price) && price >= 0) {
      await apiPatch(`/menu-items/${item.id}/`, { caterer_price: price });
      fetchItems();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this item from the menu? This will immediately hide it from guests.')) return;
    await apiDelete(`/menu-items/${id}/`);
    fetchItems();
  };

  const handleAdd = async () => {
    setAddError('');
    if (!newItem.name.trim()) { setAddError('Name is required.'); return; }
    if (!newItem.caterer_price) { setAddError('Caterer price is required.'); return; }
    setSaving(true);
    try {
      await apiPost('/menu-items/', {
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        category: newItem.category,
        caterer_price: parseFloat(newItem.caterer_price),
        notice_period_minutes: parseInt(newItem.notice_period_minutes, 10) || 0,
        customer_price: 0, // Superuser/Manager sets customer price; caterer sets their own price
        is_available: true,
        is_complimentary: false,
      });
      setNewItem({ name: '', description: '', category: 'breakfast', caterer_price: '', notice_period_minutes: '0' });
      setShowAddForm(false);
      fetchItems();
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown> };
      setAddError(JSON.stringify(e.data) || 'Failed to add item.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><p>Loading…</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>My Menu</h1>
        <button
          onClick={() => setShowAddForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f16524', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem', cursor: 'pointer', minHeight: 44 }}
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      {showAddForm && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>New Menu Item</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Name *</label>
              <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Category</label>
              <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Caterer Price (₹) *</label>
              <input type="number" min="0" step="0.01" value={newItem.caterer_price} onChange={e => setNewItem(p => ({ ...p, caterer_price: e.target.value }))} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Notice Period (minutes)</label>
              <input type="number" min="0" value={newItem.notice_period_minutes} onChange={e => setNewItem(p => ({ ...p, notice_period_minutes: e.target.value }))} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Description</label>
              <input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
          </div>
          {addError && <p style={{ color: '#c62828', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{addError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button onClick={handleAdd} disabled={saving} style={{ background: saving ? '#ccc' : '#f16524', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', cursor: saving ? 'not-allowed' : 'pointer', minHeight: 44 }}>
              {saving ? 'Saving…' : 'Save Item'}
            </button>
            <button onClick={() => setShowAddForm(false)} style={{ background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 6, padding: '0.5rem 1rem', cursor: 'pointer', minHeight: 44 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && <p style={{ color: '#666' }}>No menu items yet. Add your first item.</p>}

      {Object.entries(
        items.reduce<Record<string, MenuItem[]>>((acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        }, {})
      ).map(([category, catItems]) => (
        <section key={category} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', borderBottom: '1px solid #e0e0e0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          {catItems.map(item => (
            <div key={item.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <strong>{item.name}</strong>
                {item.description && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#666' }}>{item.description}</span>}
                <span style={{ marginLeft: 8, fontSize: '0.75rem', background: item.is_available ? '#e8f5e9' : '#fce4ec', color: item.is_available ? '#2e7d32' : '#c62828', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                  {item.is_available ? 'Available' : 'Unavailable'}
                </span>
              </div>
              {/* Caterer price */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                Price ₹
                <input
                  type="number"
                  defaultValue={item.caterer_price}
                  min="0"
                  step="0.01"
                  onBlur={e => handleCatererPriceChange(item, e.target.value)}
                  style={{ width: 80, padding: '0.3rem', border: '1px solid #ccc', borderRadius: 4 }}
                />
              </label>
              {/* Notice period */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                Notice
                <input
                  type="number"
                  defaultValue={item.notice_period_minutes}
                  min="0"
                  onBlur={e => handleNoticePeriodChange(item, e.target.value)}
                  style={{ width: 60, padding: '0.3rem', border: '1px solid #ccc', borderRadius: 4 }}
                />
                min
              </label>
              {/* Toggle availability */}
              <button
                onClick={() => handleToggleAvailability(item)}
                title={item.is_available ? 'Mark unavailable' : 'Mark available'}
                style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '0.4rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', minHeight: 44, fontSize: '0.8rem' }}
              >
                {item.is_available ? <EyeOff size={14} /> : <Eye size={14} />}
                {item.is_available ? 'Disable' : 'Enable'}
              </button>
              {/* Delete */}
              <button
                onClick={() => handleDelete(item.id)}
                title="Remove item"
                style={{ background: 'none', border: '1px solid #fce4ec', borderRadius: 6, padding: '0.4rem 0.6rem', cursor: 'pointer', color: '#c62828', display: 'flex', alignItems: 'center', minHeight: 44 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
      ))}
    </Layout>
  );
};

export default MenuManagementPage;
