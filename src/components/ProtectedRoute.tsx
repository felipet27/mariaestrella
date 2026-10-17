import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-lg font-semibold text-marino/60">{texto}</div>
  );
}

export default function ProtectedRoute({ children, requireEditor }: { children: ReactNode; requireEditor?: boolean }) {
  const { cargando, session, perfil, esEditor } = useAuth();
  const loc = useLocation();

  if (cargando) return <Cargando />;
  if (!session || !perfil) return <Navigate to="/admin/login" replace state={{ desde: loc.pathname }} />;
  if (requireEditor && !esEditor) {
    return <div className="p-6 text-center text-lg font-semibold text-rojo">Esta sección es solo para editores.</div>;
  }
  return <>{children}</>;
}
