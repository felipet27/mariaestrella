import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { perfil, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/admin', label: 'Inicio', end: true },
    { to: '/admin/registrar', label: '+ Registrar' },
    { to: '/admin/historial', label: 'Historial' },
    { to: '/admin/productos', label: 'Productos' },
    { to: '/admin/bingos', label: 'Bingos' },
    { to: '/admin/reportes', label: 'Reportes' },
    ...(perfil?.usuario === 'felipe' ? [{ to: '/admin/pruebas', label: '🧪 Pruebas' }] : []),
  ];

  return (
    <div className="min-h-full bg-crema">
      <header className="sticky top-0 z-40 bg-real text-crema shadow-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
          <img src="/logo.jpg" alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-dorado" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-serif text-xl font-bold text-dorado-claro">San Isidro · Admin</div>
            <div className="truncate text-xs text-crema/80">
              {perfil?.nombre} · {perfil?.rol === 'editor' ? 'Editor' : 'Registrador'}
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/admin/login', { replace: true });
            }}
            className="h-10 rounded-xl border border-crema/30 px-3 text-sm font-semibold"
          >
            Salir
          </button>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap ${
                  isActive ? 'bg-dorado text-marino' : 'bg-marino/30 text-crema'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">{children}</main>
    </div>
  );
}

/** Tarjeta blanca estándar del panel. */
export function Tarjeta({ titulo, children, className = '' }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-dorado/30 bg-white p-4 shadow-sm ${className}`}>
      {titulo && <h2 className="mb-3 text-lg font-bold text-marino">{titulo}</h2>}
      {children}
    </section>
  );
}

/** Botón grande de opción (tipo, banco, medio). */
export function Opcion({
  activo,
  onClick,
  children,
  className = '',
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`min-h-14 rounded-2xl border-2 px-3 text-base font-bold transition-colors ${
        activo ? 'border-dorado bg-dorado text-marino shadow' : 'border-marino/15 bg-white text-marino active:bg-marino/5'
      } ${className}`}
    >
      {children}
    </button>
  );
}
