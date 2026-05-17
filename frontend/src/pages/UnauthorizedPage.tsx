import React from 'react';
import { Link } from 'react-router-dom';

const UnauthorizedPage: React.FC = () => {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ color: '#f44336' }}>403 - Unauthorized</h1>
      <p>You do not have permission to view this page.</p>
      <Link to="/" style={{ color: '#f16524', textDecoration: 'none', fontWeight: 'bold' }}>
        Return to Dashboard
      </Link>
    </div>
  );
};

export default UnauthorizedPage;
