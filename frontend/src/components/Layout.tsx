import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';
import type { Notification } from '../types';

const BRAND = '#f16524';

interface NavItem {
  to: string;
  label: string;
}

function navForRole(role: string): NavItem[] {
  switch (role) {
    case 'guest':
      return [
        { to: '/guest/menu', label: 'Menu' },
        { to: '/guest/bill', label: 'My Bill' },
      ];
    case 'caterer':
      return [
        { to: '/caterer/orders', label: 'Orders' },
        { to: '/caterer/preparation', label: 'Preparation' },
        { to: '/caterer/menu', label: 'My Menu' },
        { to: '/caterer/payouts', label: 'Payouts' },
      ];
    case 'caretaker':
      return [
        { to: '/caretaker/orders', label: 'Orders' },
        { to: '/caretaker/external-purchase', label: 'Log Purchase' },
        { to: '/caretaker/purchases', label: 'Purchase History' },
      ];
    case 'manager':
    case 'superuser':
      return [
        { to: '/manager/dashboard', label: 'Dashboard' },
        { to: '/manager/billing-history', label: 'Billing History' },
      ];
    default:
      return [];
  }
}

const ROLE_LABEL: Record<string, string> = {
  guest: 'Guest',
  caterer: 'Caterer',
  caretaker: 'Caretaker',
  manager: 'Manager',
  superuser: 'Admin',
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    apiGet<Notification[]>('/notifications/')
      .then(ns => setUnreadCount(ns.filter(n => !n.is_read).length))
      .catch(() => {});
  }, [user]);

  const navItems = user ? navForRole(user.role) : [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <nav style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          maxWidth: 1024,
          margin: '0 auto',
          padding: '0 1.25rem',
          display: 'flex',
          alignItems: 'center',
          height: 56,
          gap: '0.5rem',
        }}>
          {/* Brand */}
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              marginRight: '1.25rem',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div style={{ width: 28, height: 28, background: BRAND, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: BRAND, letterSpacing: '-0.01em' }}>
              BookMyMeal
            </span>
          </button>

          {/* Nav links */}
          <div style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto' }}>
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: isActive ? BRAND : '#4b5563',
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: 'none',
                  padding: '0.3rem 0.65rem',
                  borderRadius: 6,
                  fontSize: '0.875rem',
                  background: isActive ? '#fff7f4' : 'transparent',
                  whiteSpace: 'nowrap',
                  borderBottom: isActive ? `2px solid ${BRAND}` : '2px solid transparent',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {/* Notification bell */}
              <button
                onClick={() => {}}
                title="Notifications"
                style={{
                  position: 'relative',
                  background: 'none',
                  border: 'none',
                  padding: '0.3rem',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 6,
                  color: '#6b7280',
                  cursor: 'pointer',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 1,
                    right: 1,
                    background: BRAND,
                    color: '#fff',
                    borderRadius: '50%',
                    width: 15,
                    height: 15,
                    fontSize: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* User badge */}
              <span style={{
                fontSize: '0.78rem',
                color: '#374151',
                background: '#f3f4f6',
                padding: '0.2rem 0.55rem',
                borderRadius: 20,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}>
                {user.username}
                <span style={{ color: BRAND, marginLeft: 3 }}>
                  · {ROLE_LABEL[user.role] || user.role}
                </span>
              </span>

              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: '0.25rem 0.55rem',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  color: '#6b7280',
                  whiteSpace: 'nowrap',
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      <main style={{ maxWidth: 1024, margin: '0 auto', padding: '1.5rem 1.25rem' }}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
