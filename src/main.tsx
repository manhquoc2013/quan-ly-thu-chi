/**
 * Entry point — renders the App root in StrictMode.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import { App } from './App';
import './index.css';

const swUrl = `${import.meta.env.BASE_URL}sw.js`;

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).then(
      (registration) => {
        void registration.update();
        // Auto-update: when new SW found, activate immediately then reload once
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      },
      (err) => console.error('SW registration failed:', err),
    );
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
