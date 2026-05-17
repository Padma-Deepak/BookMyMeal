import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPatch } from '../lib/api';
import type { Notification } from '../types';

const NAV_LINKS: Record<string, { label: string; href: string }[]> = {
  guest: [
    { label: 'Menu', href: '/guest/menu' },
    { label: 'My Bill', href: '/guest/bill' },
  ],
  caterer: [
    { label: 'Orders', href: '/caterer/orders' },
    { label: 'Preparation', href: '/caterer/preparation' },
    { label: 'My Menu', href: '/caterer/menu' },
  ],
  caretaker: [
    { label: 'Rejected Orders', href: '/caretaker/orders' },
    { label: 'Log Purchase', href: '/caretaker/external-purchase' },
  ],
  manager: [
    { label: 'Dashboard', href: '/manager/dashboard' },
  ],
  superuser: [
    { label: 'Manager', href: '/manager/dashboard' },
    { label: 'Vendors', href: '/superuser/vendors' },
    { label: 'Caterer Menu', href: '/caterer/menu' },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  guest: 'Guest',
  caterer: 'Caterer',
  caretaker: 'Caretaker',
  manager: 'Manager',
  superuser: 'Superuser',
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    apiGet<Notification[]>('/notifications/').then(setNotifications).catch(() => {});
    const interval = setInterval(() => {
      apiGet<Notification[]>('/notifications/').then(setNotifications).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    await apiPatch(`/notifications/${id}/read/`, {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const links = user ? (NAV_LINKS[user.role] || []) : [];

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f9', fontFamily: 'system-ui, sans-serif' }}>
      {/* Nav bar */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', height: 56 }}>
          <Link to="/" style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f16524', textDecoration: 'none', marginRight: '2rem' }}>
            BookMyMeal
          </Link>
          <nav style={{ display: 'flex', gap: '1.5rem', flex: 1 }}>
            {links.map(l => (
              <Link key={l.href} to={l.href} style={{ color: '#333', textDecoration: 'none', fontSize: '0.9rem' }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.8rem', background: '#f0f0f0', padding: '0.2rem 0.6rem', borderRadius: 12 }}>
              {user ? ROLE_LABELS[user.role] : ''}
            </span>
            {/* Notification bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifs(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px', minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, background: '#f16524', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div style={{ position: 'absolute', right: 0, top: 48, width: 320, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 200 }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}>Notifications</div>
                  {notifications.length === 0 && (
                    <p style={{ padding: '1rem', color: '#666', margin: 0 }}>No notifications</p>
                  )}
                  {notifications.slice(0, 10).map(n => (
                    <div
                      key={n.id}
                      style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f0f0f0', background: n.is_read ? '#fff' : '#fff8f5', cursor: 'pointer' }}
                      onClick={() => handleMarkRead(n.id)}
                    >
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>{n.message}</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#999' }}>
                        {new Date(n.created_at).toLocaleString()}
                        {!n.is_read && <span style={{ marginLeft: 8, color: '#f16524' }}>● New</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#666', minHeight: 44, padding: '0 0.5rem' }}
            >
              <LogOut size={18} /> <span style={{ fontSize: '0.85rem' }}>Logout</span>
            </button>
          </div>
        </div>
      </header>
      {/* Page content */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
