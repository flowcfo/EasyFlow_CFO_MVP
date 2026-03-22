import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SnapshotProvider } from './context/SnapshotContext.jsx';
import { GameProvider } from './context/GameContext.jsx';
import { PartnerProvider } from './context/PartnerContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PartnerProvider>
          <SnapshotProvider>
            <GameProvider>
              <App />
            </GameProvider>
          </SnapshotProvider>
        </PartnerProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
