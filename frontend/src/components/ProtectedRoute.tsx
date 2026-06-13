import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';

interface Props {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

const ProtectedRoute: React.FC<Props> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
