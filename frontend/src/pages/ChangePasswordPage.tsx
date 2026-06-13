import React, { useState } from 'react';
import Layout from '../components/Layout';
import { apiPost } from '../lib/api';

const ChangePasswordPage: React.FC = () => {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.new_password !== form.confirm_password) {
      setError('New passwords do not match.');
      return;
    }
    if (form.new_password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost<{ detail: string }>('/change-password/', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setSuccess(res.detail);
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: unknown) {
      setError((err as { detail?: string })?.detail || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '0.5rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.875rem', color: '#111827', outline: 'none', width: '100%',
  };

  return (
    <Layout>
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Change Password</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Enter your current password and choose a new one.
        </p>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>
                Current Password
              </label>
              <input
                type="password"
                style={inputStyle}
                value={form.current_password}
                onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>
                New Password
              </label>
              <input
                type="password"
                style={inputStyle}
                value={form.new_password}
                onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                required
                autoComplete="new-password"
                placeholder="Min. 6 characters"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                style={inputStyle}
                value={form.confirm_password}
                onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '0.6rem 0.85rem', color: '#dc2626', fontSize: '0.82rem' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '0.6rem 0.85rem', color: '#16a34a', fontSize: '0.82rem' }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{ background: saving ? '#fdba8c' : '#f16524', color: '#fff', border: 'none', borderRadius: 7, padding: '0.55rem', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem', minHeight: 40, marginTop: '0.25rem' }}
            >
              {saving ? 'Saving…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ChangePasswordPage;
