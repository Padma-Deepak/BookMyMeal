import React from 'react';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  title: string;
}

const Dashboard: React.FC<DashboardProps> = ({ title }) => {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{title}</h1>
      <p>Welcome, <strong>{user?.username}</strong>!</p>
      <p>Your role: <strong>{user?.role}</strong></p>
      <button 
        onClick={logout}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Logout
      </button>
    </div>
  );
};

export default Dashboard;
