import React, { useEffect, useState } from 'react';
import { KeyRound, Trash2, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import Layout from '../../components/Layout';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import type { User } from '../../types';

const ROLES = ['guest', 'caretaker', 'caterer', 'manager', 'superuser'] as const;
type Role = typeof ROLES[number];

const ROLE_LABEL: Record<Role, string> = {
  guest: 'Guest', caretaker: 'Caretaker', caterer: 'Caterer',
  manager: 'Manager', superuser: 'Superuser',
};

const ROLE_COLOR: Record<Role, { bg: string; text: string }> = {
  guest:     { bg: '#f0fdf4', text: '#166534' },
  caretaker: { bg: '#eff6ff', text: '#1e40af' },
  caterer:   { bg: '#fefce8', text: '#854d0e' },
  manager:   { bg: '#fdf4ff', text: '#7e22ce' },
  superuser: { bg: '#fff1f2', text: '#be123c' },
};

const emptyForm = { username: '', password: '', role: 'guest' as Role, email: '', phone_number: '', first_name: '', last_name: '' };

const AccountsPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [resetingId, setResetingId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const fetchUsers = () =>
    apiGet<User[]>('/users/').then(setUsers).finally(() => setLoading(false));

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!form.username || !form.password) { setCreateError('Username and password are required.'); return; }
    setCreating(true);
    try {
      await apiPost('/users/', {
        username: form.username,
        password: form.password,
        role: form.role,
        email: form.email || undefined,
        phone_number: form.phone_number || undefined,
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
      });
      setForm(emptyForm);
      setShowCreate(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail;
      setCreateError(msg || 'Failed to create account.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete account "${user.username}"? This cannot be undone.`)) return;
    await apiDelete(`/users/${user.id}/`);
    fetchUsers();
  };

  const handleResetPassword = async (userId: string) => {
    setResetError('');
    setResetSuccess('');
    if (!newPw) { setResetError('Enter a new password.'); return; }
    try {
      const res = await apiPost<{ detail: string }>(`/users/${userId}/set-password/`, { new_password: newPw });
      setResetSuccess(res.detail);
      setNewPw('');
      setTimeout(() => { setResetingId(null); setResetSuccess(''); }, 2000);
    } catch (err: unknown) {
      setResetError((err as { detail?: string })?.detail || 'Failed to reset password.');
    }
  };

  const byRole = ROLES.map(role => ({ role, users: users.filter(u => u.role === role) }))
    .filter(g => g.users.length > 0);

  const inputStyle: React.CSSProperties = {
    padding: '0.45rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.875rem', color: '#111827', outline: 'none', width: '100%',
  };

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Account Management</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 2 }}>
            Create accounts for any role and reset passwords.
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setCreateError(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 38 }}
        >
          <UserPlus size={15} />
          {showCreate ? 'Cancel' : 'Create Account'}
          {showCreate ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>New Account</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }}>Username *</label>
              <input style={inputStyle} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. john_doe" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }}>Password *</label>
              <input style={inputStyle} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }}>Role *</label>
              <select style={inputStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }}>Phone</label>
              <input style={inputStyle} value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }}>First Name</label>
              <input style={inputStyle} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }}>Last Name</label>
              <input style={inputStyle} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          {createError && <p style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{createError}</p>}
          <button type="submit" disabled={creating} style={{ background: creating ? '#7aab8e' : '#1a3c2c', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 1.1rem', cursor: creating ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 38 }}>
            {creating ? 'Creating…' : 'Create Account'}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading users…</p>
      ) : (
        byRole.map(({ role, users: group }) => (
          <section key={role} style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ROLE_LABEL[role]}</span>
              <span style={{ background: ROLE_COLOR[role].bg, color: ROLE_COLOR[role].text, fontSize: '0.72rem', fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>{group.length}</span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f0ece3', borderBottom: '1px solid #e5e7eb' }}>
                    {['Username', 'Name', 'Email', 'Phone', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.55rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.map((user, idx) => (
                    <React.Fragment key={user.id}>
                      <tr style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : undefined }}>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>{user.username}</td>
                        <td style={{ padding: '0.7rem 1rem', color: '#374151', fontSize: '0.875rem' }}>
                          {[user.first_name, user.last_name].filter(Boolean).join(' ') || <span style={{ color: '#9ca3af' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#374151', fontSize: '0.875rem' }}>{user.email || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                        <td style={{ padding: '0.7rem 1rem', color: '#374151', fontSize: '0.875rem' }}>{user.phone_number || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => { setResetingId(resetingId === user.id ? null : user.id); setNewPw(''); setResetError(''); setResetSuccess(''); }}
                              title="Reset password"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.28rem 0.55rem', cursor: 'pointer', fontSize: '0.78rem', color: '#374151', minHeight: 30 }}
                            >
                              <KeyRound size={12} /> Reset PW
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              title="Delete account"
                              style={{ display: 'flex', alignItems: 'center', background: 'none', border: '1px solid #fee2e2', borderRadius: 6, padding: '0.28rem 0.5rem', cursor: 'pointer', color: '#dc2626', minHeight: 30 }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {resetingId === user.id && (
                        <tr style={{ background: '#fffbf7', borderTop: '1px solid #fed7aa' }}>
                          <td colSpan={5} style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                              <input
                                type="password"
                                placeholder="New password (min. 6 chars)"
                                value={newPw}
                                onChange={e => { setNewPw(e.target.value); setResetError(''); setResetSuccess(''); }}
                                autoFocus
                                style={{ ...inputStyle, width: 240 }}
                              />
                              <button
                                onClick={() => handleResetPassword(user.id)}
                                style={{ background: '#1a3c2c', color: '#fff', border: 'none', borderRadius: 7, padding: '0.4rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', minHeight: 34 }}
                              >
                                Set Password
                              </button>
                              <button
                                onClick={() => setResetingId(null)}
                                style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 7, padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem', color: '#6b7280', minHeight: 34 }}
                              >
                                Cancel
                              </button>
                              {resetError && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{resetError}</span>}
                              {resetSuccess && <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>{resetSuccess}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {!loading && users.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '3rem' }}>No users found.</p>
      )}
    </Layout>
  );
};

export default AccountsPage;
