import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './Layout';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="play/:gameId" element={<Play />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
