import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, HeartHandshake, ChefHat, Wallet, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Persona {
  role: string;
  username: string;
  password: string;
  redirectTo: string;
  description: string;
  icon: React.ElementType;
}

const PERSONAS: Persona[] = [
  {
    role: 'Guest',
    username: 'guest1',
    password: 'guest123',
    redirectTo: '/guest/menu',
    description: 'Browse the menu, place orders, and track your bill.',
    icon: Utensils,
  },
  {
    role: 'Caretaker',
    username: 'caretaker1',
    password: 'caretaker123',
    redirectTo: '/caretaker/orders',
    description: 'Order on behalf of guests, fix rejected orders, and log outside purchases.',
    icon: HeartHandshake,
  },
  {
    role: 'Caterer',
    username: 'caterer1',
    password: 'caterer123',
    redirectTo: '/caterer/orders',
    description: 'Manage the menu, approve or reject orders, and mark food as prepared.',
    icon: ChefHat,
  },
  {
    role: 'Manager',
    username: 'manager1',
    password: 'manager123',
    redirectTo: '/manager/dashboard',
    description: 'Generate and settle bills, approve payments, and oversee every order.',
    icon: Wallet,
  },
  {
    role: 'Superuser',
    username: 'padma',
    password: 'admin123',
    redirectTo: '/manager/dashboard',
    description: 'Full manager access, plus the vendor registry and account management.',
    icon: ShieldCheck,
  },
];

const LandingPage: React.FC = () => {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleView = async (persona: Persona) => {
    setError('');
    setLoadingRole(persona.role);
    try {
      await login(persona.username, persona.password);
      navigate(persona.redirectTo);
    } catch {
      setError('Could not start the demo. Please try again in a moment.');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0ece3' }}>
      {/* ── Nav ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 1.5rem',
        maxWidth: 1080,
        margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            background: '#1a3c2c',
            borderRadius: 10,
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
            </svg>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.015em' }}>
            BookMyMeal
          </span>
        </div>

        <button
          onClick={() => navigate('/login')}
          style={{
            padding: '0.5rem 1.1rem',
            background: 'transparent',
            color: '#1a3c2c',
            border: '1.5px solid #1a3c2c',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 38,
          }}
        >
          Log in
        </button>
      </div>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem 1rem', maxWidth: 620, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.25rem)', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
          Institutional meal ordering, end to end
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1rem', lineHeight: 1.6 }}>
          Guests order, caterers prepare, caretakers step in when needed, and managers handle billing —
          all in one system. Pick a persona below to explore it live, with real demo data.
        </p>
      </div>

      {/* ── Persona grid ── */}
      <div style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '1rem',
      }}>
        {PERSONAS.map(persona => {
          const Icon = persona.icon;
          const isLoading = loadingRole === persona.role;
          return (
            <div
              key={persona.role}
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 42,
                background: '#eaf1ec',
                borderRadius: 10,
              }}>
                <Icon size={22} color="#1a3c2c" />
              </div>

              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '0.3rem' }}>
                  {persona.role}
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5 }}>
                  {persona.description}
                </p>
              </div>

              <button
                onClick={() => handleView(persona)}
                disabled={loadingRole !== null}
                style={{
                  marginTop: 'auto',
                  padding: '0.6rem 0.75rem',
                  background: isLoading ? '#7aab8e' : '#1a3c2c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: loadingRole !== null ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  minHeight: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                {isLoading ? 'Signing in…' : `View as ${persona.role}`}
                {!isLoading && <ArrowRight size={15} />}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 1.5rem 1.5rem' }}>
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '0.65rem 0.9rem',
            fontSize: '0.85rem',
            color: '#dc2626',
            textAlign: 'center',
          }}>
            {error}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '1rem 1.5rem 2.5rem', color: '#9ca3af', fontSize: '0.8rem' }}>
        These are seeded demo accounts — changes made while exploring are visible to other visitors too.
      </div>
    </div>
  );
};

export default LandingPage;
