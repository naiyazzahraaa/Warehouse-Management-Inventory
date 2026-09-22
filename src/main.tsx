import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Automatically unregister any lingering Service Workers and flush stale browser CacheStorage
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch((err) => console.warn('SW unregister error:', err));
      }
    }).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then((cacheNames) => {
      for (const name of cacheNames) {
        caches.delete(name).catch((err) => console.warn('Cache delete error:', err));
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
