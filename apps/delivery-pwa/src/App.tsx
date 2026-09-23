import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedDeliveryRoute } from '@/auth/guards';
import { DeliveryShell } from '@/layout/DeliveryShell';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { RoutesPage } from '@/pages/RoutesPage';
import { RouteDetailPage } from '@/pages/RouteDetailPage';
import { StopDetailPage } from '@/pages/StopDetailPage';
import { CodPage } from '@/pages/CodPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedDeliveryRoute>
            <DeliveryShell />
          </ProtectedDeliveryRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="routes/:routeId" element={<RouteDetailPage />} />
        <Route
          path="routes/:routeId/stops/:stopId"
          element={<StopDetailPage />}
        />
        <Route path="cod" element={<CodPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
