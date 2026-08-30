import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, X, ChefHat, Copy, Check, IndianRupee } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet, apiPost } from '../../lib/api';
import type { User, Order, ExternalPurchase, PayoutRecord, Bill } from '../../types';

const BILLABLE_STATUSES = ['accepted', 'prepared', 'delivered', 'resolved'];

interface GuestSummary {
  guest: User;
  orderCount: number;
  totalSpend: number;
  billStatus: string;
  billId?: string;
}

const BILL_STATUS_STYLE: Record<string, React.CSSProperties> = {
  'No bill': { background: '#f3f4f6', color: '#6b7280' },
  draft:     { background: '#fef3c7', color: '#92400e' },
  paid:      { background: '#d1fae5', color: '#065f46' },
};

type Tab = 'guests' | 'caterers';

const emptyForm = {
  username: '',
  password: '',
  phone_number: '',
  email: '',
  first_name: '',
  last_name: '',
};

interface NewCredentials {
  role: 'guest' | 'caterer';
  username: string;
  password: string;
}

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('guests');
  const [summaries, setSummaries] = useState<GuestSummary[]>([]);
  const [caterers, setCaterers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newCredentials, setNewCredentials] = useState<NewCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [catererDue, setCatererDue] = useState({ amount: 0, count: 0 });
  const [caretakerDue, setCaretakerDue] = useState({ amount: 0, count: 0 });
  const navigate = useNavigate();

  const loadDuePayments = () => {
    return Promise.all([
      apiGet<PayoutRecord[]>('/caterer-bills/'),
      apiGet<ExternalPurchase[]>('/external-purchases/'),
    ]).then(([payouts, purchases]) => {
      const unpaidPayouts = payouts.filter(p => !p.is_paid);
      setCatererDue({
        amount: unpaidPayouts.reduce((s, p) => s + p.total_caterer_amount, 0),
        count: unpaidPayouts.length,
      });
      const unreimbursed = purchases.filter(p => p.is_paid_by_caretaker && !p.is_reimbursed);
      setCaretakerDue({
        amount: unreimbursed.reduce((s, p) => s + Number(p.cost), 0),
        count: unreimbursed.length,
      });
    });
  };

  const loadGuests = () => {
    return Promise.all([
      apiGet<User[]>('/users/?role=guest'),
      apiGet<Order[]>('/orders/'),
      apiGet<Bill[]>('/bills/'),
    ]).then(([guests, orders, bills]) => {
      const result: GuestSummary[] = guests.map(guest => {
        const guestOrders = orders.filter(o => o.guest === guest.id);
        const billableSpend = guestOrders
          .filter(o => BILLABLE_STATUSES.includes(o.status))
          .reduce((sum, order) =>
            sum + (order.items_detail || []).reduce((s, item) =>
              s + (item.is_complimentary ? 0 : (item.customer_price ?? 0) * item.quantity), 0), 0);
        // Prefer the guest's most recent bill's real (backend-computed) total/status —
        // it's the same number shown on Billing History and the Bill Detail page.
        // Fall back to billable-but-not-yet-invoiced order value when no bill exists yet.
        const guestBills = bills
          .filter(b => b.guest_detail?.id === guest.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const latestBill = guestBills[0];
        return {
          guest,
          orderCount: guestOrders.length,
          totalSpend: latestBill ? latestBill.grand_total : billableSpend,
          billStatus: latestBill ? latestBill.status : 'No bill',
          billId: latestBill?.id,
        };
      });
      setSummaries(result);
    });
  };

  const loadCaterers = () => {
    return apiGet<User[]>('/users/?role=caterer').then(setCaterers);
  };

  const loadData = () => {
    setLoading(true);
    Promise.all([loadGuests(), loadCaterers(), loadDuePayments()])
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setCreateForm(emptyForm);
    setCreateError('');
    setNewCredentials(null);
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!createForm.username.trim()) { setCreateError('Username is required.'); return; }
    if (!createForm.password) { setCreateError('Password is required.'); return; }
    setCreating(true);
    const role = activeTab === 'caterers' ? 'caterer' : 'guest';
    try {
      await apiPost('/users/', {
        username: createForm.username.trim(),
        password: createForm.password,
        phone_number: createForm.phone_number.trim() || null,
        email: createForm.email.trim() || '',
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        role,
      });
      setShowCreate(false);
      setNewCredentials({ role, username: createForm.username.trim(), password: createForm.password });
      setCopied(false);
      setCreateForm(emptyForm);
      loadData();
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown> };
      const msg = e.data ? Object.values(e.data).flat().join(' ') : `Failed to create ${role}.`;
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    if (!newCredentials) return;
    navigator.clipboard.writeText(`Username: ${newCredentials.username}\nPassword: ${newCredentials.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredGuests = summaries.filter(s =>
    !search ||
    s.guest.username.toLowerCase().includes(search.toLowerCase()) ||
    (s.guest.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredCaterers = caterers.filter(c =>
    !search ||
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.65rem',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: '#fff',
    boxSizing: 'border-box',
    color: '#111827',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '0.3rem',
  };

  if (loading) return <Layout><p style={{ color: '#6b7280' }}>Loading dashboard…</p></Layout>;

  const isCaterersTab = activeTab === 'caterers';

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dashboard</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>Manage guests and billing</p>
        </div>
        <button
          onClick={() => { openCreate(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
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
          {isCaterersTab ? <ChefHat size={15} /> : <UserPlus size={15} />}
          {isCaterersTab ? 'New Caterer' : 'New Guest'}
        </button>
      </div>

      {/* Due payments */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '0.55rem', display: 'flex' }}>
            <IndianRupee size={18} />
          </div>
          <div>
            <p style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Due to Caterers</p>
            <p style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', marginTop: 2 }}>
              ₹{catererDue.amount.toFixed(2)}
              <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#9ca3af', marginLeft: 6 }}>
                {catererDue.count} unpaid bill{catererDue.count === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        </div>
        <div style={{ flex: '1 1 220px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '0.55rem', display: 'flex' }}>
            <IndianRupee size={18} />
          </div>
          <div>
            <p style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Due to Caretakers</p>
            <p style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', marginTop: 2 }}>
              ₹{caretakerDue.amount.toFixed(2)}
              <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#9ca3af', marginLeft: 6 }}>
                {caretakerDue.count} pending reimbursement{caretakerDue.count === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Credential card */}
      {newCredentials && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 10,
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div>
            <p style={{ fontWeight: 600, color: '#15803d', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              {newCredentials.role === 'caterer' ? 'Caterer' : 'Guest'} account created — share these credentials
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Username</span>
                <p style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 600, color: '#111827', marginTop: 2 }}>{newCredentials.username}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password</span>
                <p style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 600, color: '#111827', marginTop: 2 }}>{newCredentials.password}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                background: copied ? '#d1fae5' : '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 7, padding: '0.4rem 0.75rem',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                color: copied ? '#065f46' : '#374151',
                minHeight: 34,
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setNewCredentials(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.2rem', display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
        {(['guests', 'caterers'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearch(''); setShowCreate(false); }}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #1a3c2c' : '2px solid transparent',
              padding: '0.6rem 1.25rem',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#1a3c2c' : '#6b7280',
              fontSize: '0.9rem',
              marginBottom: -1,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
              {isCaterersTab ? 'Create Caterer Account' : 'Create Guest Account'}
            </h2>
            <button
              onClick={() => setShowCreate(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.2rem', display: 'flex' }}
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input
                  value={createForm.first_name}
                  onChange={e => setCreateForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="Optional"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  value={createForm.last_name}
                  onChange={e => setCreateForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Optional"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Username *</label>
                <input
                  value={createForm.username}
                  onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                  required
                  placeholder="Used to sign in"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Password *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  required
                  placeholder="Temporary password"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input
                  value={createForm.phone_number}
                  onChange={e => setCreateForm(f => ({ ...f, phone_number: e.target.value }))}
                  placeholder={isCaterersTab ? '+91 9876543210' : '+91 9876543210 (for WhatsApp)'}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Optional"
                  style={inputStyle}
                />
              </div>
            </div>

            {createError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#dc2626', marginBottom: '0.75rem' }}>
                {createError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="submit"
                disabled={creating}
                style={{ background: creating ? '#7aab8e' : '#1a3c2c', color: '#fff', border: 'none', borderRadius: 7, padding: '0.55rem 1.25rem', cursor: creating ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 40 }}
              >
                {creating ? 'Creating…' : isCaterersTab ? 'Create Caterer' : 'Create Guest'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, padding: '0.55rem 1rem', cursor: 'pointer', color: '#374151', fontSize: '0.875rem', minHeight: 40 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder={isCaterersTab ? 'Search caterers…' : 'Search guests…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, maxWidth: 280 }}
        />
      </div>

      {/* Guests Tab */}
      {activeTab === 'guests' && (
        filteredGuests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>No guests found</p>
            <p style={{ fontSize: '0.875rem' }}>
              {summaries.length === 0
                ? 'Create the first guest account to get started.'
                : 'Try adjusting your search.'}
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#f0ece3', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Guest</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Orders</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Spend</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bill</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((s, i) => (
                  <tr key={s.guest.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{s.guest.username}</div>
                      {s.guest.email && <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 1 }}>{s.guest.email}</div>}
                      {s.guest.phone_number && <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{s.guest.phone_number}</div>}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center', color: '#374151', fontWeight: 500 }}>
                      {s.orderCount}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                      ₹{s.totalSpend.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        ...(BILL_STATUS_STYLE[s.billStatus] || BILL_STATUS_STYLE['No bill']),
                      }}>
                        {s.billStatus === 'draft' ? 'Draft' : s.billStatus === 'paid' ? 'Paid' : 'No bill'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => navigate(`/manager/guest/${s.guest.id}/orders`)}
                          style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, minHeight: 34 }}
                        >
                          Orders
                        </button>
                        <button
                          onClick={() => navigate(`/manager/bill/generate?guest=${s.guest.id}`)}
                          style={{ background: '#fff', border: '1px solid #1a3c2c', color: '#1a3c2c', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, minHeight: 34 }}
                        >
                          Generate Bill
                        </button>
                        {s.billId && (
                          <button
                            onClick={() => navigate(`/manager/bill/${s.billId}`)}
                            style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', minHeight: 34 }}
                          >
                            View Bill
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Caterers Tab */}
      {activeTab === 'caterers' && (
        filteredCaterers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>No caterers found</p>
            <p style={{ fontSize: '0.875rem' }}>
              {caterers.length === 0
                ? 'Create the first caterer account to get started.'
                : 'Try adjusting your search.'}
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#f0ece3', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Caterer</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contact</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCaterers.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : undefined }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{c.username}</div>
                      {(c.first_name || c.last_name) && (
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 1 }}>
                          {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      {c.email && <div style={{ fontSize: '0.85rem', color: '#374151' }}>{c.email}</div>}
                      {c.phone_number && <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{c.phone_number}</div>}
                      {!c.email && !c.phone_number && <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        background: '#d1fae5',
                        color: '#065f46',
                      }}>
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </Layout>
  );
};

export default DashboardPage;
