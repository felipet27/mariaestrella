import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { supabaseConfigurado } from './lib/supabase';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Publico from './pages/Publico';
import Pantalla from './pages/Pantalla';
import Login from './pages/admin/Login';
import Inicio from './pages/admin/Inicio';
import Registrar from './pages/admin/Registrar';
import Historial from './pages/admin/Historial';
import Productos from './pages/admin/Productos';
import Bingos from './pages/admin/Bingos';
import Reportes from './pages/admin/Reportes';
import Ajustes from './pages/admin/Ajustes';

function SinConfigurar() {
  return (
    <div className="mx-auto max-w-lg p-8 text-marino">
      <h1 className="font-serif text-3xl font-bold">Falta configurar Supabase</h1>
      <p className="mt-3">
        Cree el archivo <code>.env.local</code> (o las variables en Vercel) con <code>VITE_SUPABASE_URL</code> y{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>. Vea el README.
      </p>
    </div>
  );
}

// El AuthProvider envuelve SOLO /admin: las páginas públicas nunca consultan perfiles ni sesión.
function ZonaAdmin() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </AuthProvider>
  );
}

function Protegida() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  if (!supabaseConfigurado) return <SinConfigurar />;
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Publico />} />
        <Route path="/pantalla" element={<Pantalla />} />
        <Route path="/admin" element={<ZonaAdmin />}>
          <Route path="login" element={<Login />} />
          <Route element={<Protegida />}>
            <Route index element={<Inicio />} />
            <Route path="registrar" element={<Registrar />} />
            <Route path="historial" element={<Historial />} />
            <Route path="productos" element={<Productos />} />
            <Route path="bingos" element={<Bingos />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="ajustes" element={<Ajustes />} />
            <Route path="pruebas" element={<Navigate to="/admin/ajustes" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
