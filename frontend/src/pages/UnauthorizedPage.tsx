import React from 'react';
import { useNavigate } from 'react-router-dom';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{
          width: 56,
          height: 56,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
          Access Denied
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          You don't have permission to view this page.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.6rem 1.5rem',
            background: '#f16524',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            minHeight: 44,
          }}
        >
          Go Home
        </button>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
