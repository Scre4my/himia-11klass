import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<Props> = ({ children, adminOnly }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');

  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;

  if (adminOnly) {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    if (!user || user.role !== 'admin') return <Navigate to="/calculator" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
