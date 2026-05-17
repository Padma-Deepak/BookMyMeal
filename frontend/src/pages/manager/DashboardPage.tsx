import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiGet } from '../../lib/api';
import type { User, Order, Bill } from '../../types';

interface GuestSummary {
  guest: User;
  orderCount: number;
  totalSpend: number;
  billStatus: string;
  billId?: string;
}

const DashboardPage: React.FC = () => {
  const [summaries, setSummaries] = useState<GuestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBillStatus, setFilterBillStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiGet<User[]>('/users/?role=guest'),
      apiGet<Order[]>('/orders/'),
    ]).then(([guests, orders]) => {
      const result: GuestSummary[] = guests.map(guest => {
        const guestOrders = orders.filter(o => o.guest === guest.id);
        const totalSpend = guestOrders.reduce((sum, order) => {
          return sum + (order.items_detail || []).reduce((s, item) => {
            return s + (item.is_complimentary ? 0 : item.customer_price * item.quantity);
          }, 0);
        }, 0);
        return {
          guest,
          orderCount: guestOrders.length,
          totalSpend,
          billStatus: 'No bill',
        };
      });
      setSummaries(result);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = summaries.filter(s => {
    const matchSearch = !search || s.guest.username.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterBillStatus || s.billStatus === filterBillStatus;
    return matchSearch && matchStatus;
  });

  if (loading) return <Layout><p>Loading dashboard…</p></Layout>;

  return (
    <Layout>
      <h1 style={{ marginBottom: '1.5rem' }}>Manager Dashboard</h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by guest name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem', minWidth: 220 }}
        />
        <select
          value={filterBillStatus}
          onChange={e => setFilterBillStatus(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }}
        >
          <option value="">All bill statuses</option>
          <option value="No bill">No bill</option>
          <option value="draft">Draft</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {filtered.length === 0 && <p style={{ color: '#666' }}>No guests found.</p>}

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f9f9', fontSize: '0.85rem', color: '#666' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Guest</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Orders</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Spend</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Bill Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.guest.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ fontWeight: 500 }}>{s.guest.username}</div>
                  {s.guest.email && <div style={{ fontSize: '0.8rem', color: '#999' }}>{s.guest.email}</div>}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{s.orderCount}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{s.totalSpend.toFixed(2)}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', background: s.billStatus === 'paid' ? '#e8f5e9' : s.billStatus === 'draft' ? '#fff3e0' : '#f5f5f5', color: s.billStatus === 'paid' ? '#2e7d32' : s.billStatus === 'draft' ? '#e65100' : '#666', padding: '0.2rem 0.6rem', borderRadius: 12 }}>
                    {s.billStatus}
                  </span>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => navigate(`/manager/guest/${s.guest.id}/orders`)}
                      style={{ background: '#f16524', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', minHeight: 44 }}
                    >
                      View Orders
                    </button>
                    <button
                      onClick={() => navigate(`/manager/bill/generate?guest=${s.guest.id}`)}
                      style={{ background: '#fff', border: '1px solid #f16524', color: '#f16524', borderRadius: 6, padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', minHeight: 44 }}
                    >
                      Generate Bill
                    </button>
                    {s.billId && (
                      <button
                        onClick={() => navigate(`/manager/bill/${s.billId}`)}
                        style={{ background: '#fff', border: '1px solid #ccc', color: '#333', borderRadius: 6, padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', minHeight: 44 }}
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
    </Layout>
  );
};

export default DashboardPage;
