import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// In local dev, inject the Power Apps client mock before anything else reads it.
if (import.meta.env.DEV) {
  await import('./mocks/powerAppsClient');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
