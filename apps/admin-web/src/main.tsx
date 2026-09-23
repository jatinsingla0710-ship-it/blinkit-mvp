import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { AdminAuthProviders } from '@/auth/AdminAuthProviders';
import { AdminDataProviders } from '@/data/AdminDataProviders';
import '@groaurum/ui/tokens.css';
import '@groaurum/ui/styles/base.css';
import './styles/global.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Installability must not block the operational app if registration fails.
    });
  });
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AdminAuthProviders>
        <AdminDataProviders>
          <AppRoutes />
        </AdminDataProviders>
      </AdminAuthProviders>
    </BrowserRouter>
  </StrictMode>,
);
