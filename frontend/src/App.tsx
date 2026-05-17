import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

// Guest
import MenuPage from './pages/guest/MenuPage';
import OrderSummaryPage from './pages/guest/OrderSummaryPage';
import BillPage from './pages/guest/BillPage';

// Caterer
import CatererOrdersPage from './pages/caterer/OrdersPage';
import PreparationPage from './pages/caterer/PreparationPage';
import MenuManagementPage from './pages/caterer/MenuManagementPage';

// Caretaker
import RejectedOrdersPage from './pages/caretaker/RejectedOrdersPage';
import ModifyOrderPage from './pages/caretaker/ModifyOrderPage';
import ExternalPurchasePage from './pages/caretaker/ExternalPurchasePage';

// Manager
import ManagerDashboardPage from './pages/manager/DashboardPage';
import GuestOrdersPage from './pages/manager/GuestOrdersPage';
import GenerateBillPage from './pages/manager/GenerateBillPage';
import BillDetailPage from './pages/manager/BillDetailPage';

// Superuser
import VendorsPage from './pages/superuser/VendorsPage';

const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'guest':      return <Navigate to="/guest/menu" replace />;
    case 'caterer':    return <Navigate to="/caterer/orders" replace />;
    case 'caretaker':  return <Navigate to="/caretaker/orders" replace />;
    case 'manager':    return <Navigate to="/manager/dashboard" replace />;
    case 'superuser':  return <Navigate to="/manager/dashboard" replace />;
    default:           return <Navigate to="/unauthorized" replace />;
  }
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/" element={<RoleRedirect />} />

            {/* ── Guest ── */}
            <Route path="/guest/menu" element={
              <ProtectedRoute allowedRoles={['guest', 'superuser']}>
                <MenuPage />
              </ProtectedRoute>
            } />
            <Route path="/guest/order/summary" element={
              <ProtectedRoute allowedRoles={['guest', 'superuser']}>
                <OrderSummaryPage />
              </ProtectedRoute>
            } />
            <Route path="/guest/bill" element={
              <ProtectedRoute allowedRoles={['guest', 'superuser']}>
                <BillPage />
              </ProtectedRoute>
            } />

            {/* ── Caterer ── */}
            <Route path="/caterer/orders" element={
              <ProtectedRoute allowedRoles={['caterer', 'superuser']}>
                <CatererOrdersPage />
              </ProtectedRoute>
            } />
            <Route path="/caterer/preparation" element={
              <ProtectedRoute allowedRoles={['caterer', 'superuser']}>
                <PreparationPage />
              </ProtectedRoute>
            } />
            <Route path="/caterer/menu" element={
              <ProtectedRoute allowedRoles={['caterer', 'superuser']}>
                <MenuManagementPage />
              </ProtectedRoute>
            } />

            {/* ── Caretaker ── */}
            <Route path="/caretaker/orders" element={
              <ProtectedRoute allowedRoles={['caretaker', 'superuser']}>
                <RejectedOrdersPage />
              </ProtectedRoute>
            } />
            <Route path="/caretaker/orders/:id/modify" element={
              <ProtectedRoute allowedRoles={['caretaker', 'superuser']}>
                <ModifyOrderPage />
              </ProtectedRoute>
            } />
            <Route path="/caretaker/external-purchase" element={
              <ProtectedRoute allowedRoles={['caretaker', 'superuser']}>
                <ExternalPurchasePage />
              </ProtectedRoute>
            } />

            {/* ── Manager ── */}
            <Route path="/manager/dashboard" element={
              <ProtectedRoute allowedRoles={['manager', 'superuser']}>
                <ManagerDashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/manager/guest/:guestId/orders" element={
              <ProtectedRoute allowedRoles={['manager', 'superuser']}>
                <GuestOrdersPage />
              </ProtectedRoute>
            } />
            <Route path="/manager/bill/generate" element={
              <ProtectedRoute allowedRoles={['manager', 'superuser']}>
                <GenerateBillPage />
              </ProtectedRoute>
            } />
            <Route path="/manager/bill/:billId" element={
              <ProtectedRoute allowedRoles={['manager', 'superuser']}>
                <BillDetailPage />
              </ProtectedRoute>
            } />

            {/* ── Superuser ── */}
            <Route path="/superuser/vendors" element={
              <ProtectedRoute allowedRoles={['superuser']}>
                <VendorsPage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
