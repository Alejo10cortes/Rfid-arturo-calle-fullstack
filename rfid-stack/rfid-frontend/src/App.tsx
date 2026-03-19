// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';
import { useSocket } from './hooks/useSocket';

// Pages
import Login     from './pages/auth/Login';
import Dashboard from './pages/dashboard';
import Readers   from './pages/readers';
import Inventory from './pages/inventory';
import Scans     from './pages/scans';
import Alerts    from './pages/alerts';
import Reports   from './pages/reports';
import Settings  from './pages/settings';

// WebSocket global initializer (inside auth context)
function SocketInitializer() {
  useSocket(); // subscribes and maintains WebSocket connection
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <SocketInitializer />

      <Routes>
        {/* Public */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/readers"   element={<Readers />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/scans"     element={<Scans />} />
          <Route path="/alerts"    element={<Alerts />} />
          <Route path="/reports"   element={<Reports />} />
          <Route path="/settings"  element={<Settings />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={
          <div className="min-h-screen bg-ink flex items-center justify-center">
            <div className="text-center">
              <div className="font-display text-8xl text-gold/20 mb-4">404</div>
              <div className="font-display text-2xl text-cream mb-2">Página no encontrada</div>
              <a href="/" className="btn-primary inline-flex mt-4">Volver al Dashboard</a>
            </div>
          </div>
        } />
      </Routes>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e1e24',
            color: '#f5f0e8',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            letterSpacing: '0.02em',
          },
          success: { iconTheme: { primary: '#4caf7d', secondary: '#1e1e24' }, duration: 3000 },
          error:   { iconTheme: { primary: '#c0392b', secondary: '#1e1e24' }, duration: 5000 },
        }}
      />
    </BrowserRouter>
  );
}
