import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import PublicBooking from '@/components/PublicBooking';
import '@/index.css';

const isPublicAgenda = window.location.pathname.toLowerCase().includes('/agenda');

ReactDOM.createRoot(document.getElementById('root')).render(
  isPublicAgenda ? <PublicBooking /> : <App />
);