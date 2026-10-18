import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import Game from './pages/Game';
import Lobby from './pages/Lobby';
import Solo from './pages/Solo';
import { SpaceBackground } from './extras/SpaceBackground';
import './styles/tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SpaceBackground />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/g/:roomId" element={<Game />} />
          <Route path="/solo" element={<Solo />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
