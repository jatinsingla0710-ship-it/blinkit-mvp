import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { SalesAuthProviders } from '@/auth/SalesAuthProviders';
import { SalesDataProviders } from '@/data/SalesDataProviders';
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

async function start(): Promise<void> {
  if (import.meta.env.DEV) {
    const { installDevMocks } = await import('./data/install-dev-mocks');
    installDevMocks();
  }

  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element #root not found');
  }

  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <SalesAuthProviders>
          <SalesDataProviders>
            <AppRoutes />
          </SalesDataProviders>
        </SalesAuthProviders>
      </BrowserRouter>
    </StrictMode>,
  );
}

void start();
