/**
 * App — Root component with React Router 7.
 *
 * Uses lazy-loaded route components with Suspense fallback.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Layout } from '@ui/Layout';
import { Toaster } from '@/components/ui/sonner';

const DashboardScreen = lazy(
  () => import('@screens/dashboard/DashboardScreen').then((m) => ({ default: m.DashboardScreen }))
);
const ExpenseScreen = lazy(
  () => import('@screens/expense/ExpenseScreen').then((m) => ({ default: m.ExpenseScreen }))
);
const RevenueScreen = lazy(
  () => import('@screens/revenue/RevenueScreen').then((m) => ({ default: m.RevenueScreen }))
);
const ReportScreen = lazy(
  () => import('@screens/report/ReportScreen').then((m) => ({ default: m.ReportScreen }))
);
const AIChatScreen = lazy(
  () => import('@screens/ai/AIChatScreen').then((m) => ({ default: m.AIChatScreen }))
);
const SettingsScreen = lazy(
  () => import('@screens/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen }))
);
const CustomerScreen = lazy(
  () => import('@screens/customer/CustomerScreen').then((m) => ({ default: m.CustomerScreen }))
);
const ProductScreen = lazy(
  () => import('@screens/product/ProductScreen').then((m) => ({ default: m.ProductScreen }))
);
const PlatformScreen = lazy(
  () => import('@screens/platform/PlatformScreen').then((m) => ({ default: m.PlatformScreen }))
);

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen" role="status" aria-label="Loading">
      <div className="animate-spin size-8 border-2 border-accent-fg border-t-transparent rounded-full" />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardScreen />} />
            <Route path="expense" element={<ExpenseScreen />} />
            <Route path="revenue" element={<RevenueScreen />} />
            <Route path="customers" element={<CustomerScreen />} />
            <Route path="products" element={<ProductScreen />} />
            <Route path="platforms" element={<PlatformScreen />} />
            <Route path="report" element={<ReportScreen />} />
            <Route path="ai" element={<AIChatScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster richColors position="top-right" closeButton />
    </BrowserRouter>
  );
}
