import { useCallback, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { usePendientes } from '../lib/pendientes';
import { useToast } from './Toast';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { perfil, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  // Envía en segundo plano los registros guardados sin señal, en cualquier página del panel
  const alEnviar = useCallback(
    (n: number) => toast(`✓ ${n} registro${n > 1 ? 's' : ''} pendiente${n > 1 ? 's' : ''} enviado${n > 1 ? 's' : ''}`),
    [toast],
  );
  const { pendientes } = usePendientes(true, alEnviar);

  const links = [
    { to: '/admin', label: '🏠 Inicio', end: true },
    { to: '/admin/registrar', label: '➕ Registrar' },
    { to: '/admin/historial', label: '📋 Historial' },
    { to: '/admin/productos', label: '🍽️ Productos' },
    { to: '/admin/bingos', label: '🎱 Bingos' },
    { to: '/admin/reportes', label: '📊 Reportes' },
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
        {pendientes.length > 0 && (
          <Link to="/admin/registrar" className="block bg-dorado px-4 py-2 text-center text-sm font-extrabold text-marino">
            ⏳ {pendientes.length} registro{pendientes.length > 1 ? 's' : ''} sin enviar · esperando señal
          </Link>
        )}
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

/** Botón grande de opción (tipo, banco, medio). `sub` = explicación corta debajo. */
export function Opcion({
  activo,
  onClick,
  children,
  sub,
  className = '',
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border-2 px-2 py-2 text-base font-bold leading-tight transition-colors ${
        activo ? 'border-dorado bg-dorado text-marino shadow' : 'border-marino/15 bg-white text-marino active:bg-marino/5'
      } ${className}`}
    >
      {children}
      {sub && <span className={`mt-1 text-[11px] font-medium leading-snug ${activo ? 'text-marino/80' : 'text-marino/55'}`}>{sub}</span>}
    </button>
  );
}

/** Pista sutil: explica qué hace una sección o un control. */
export function Ayuda({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex gap-2 rounded-xl bg-real/[0.07] px-3 py-2 text-sm leading-snug text-marino/80 ${className}`}>
      <span aria-hidden="true">💡</span>
      <span>{children}</span>
    </p>
  );
}

/** Bloque desplegable "¿Cómo funciona?" que recuerda si el usuario lo cerró. */
export function GuiaRapida({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  const clave = `guia:${id}`;
  const [abierta, setAbierta] = useState(() => {
    try {
      return localStorage.getItem(clave) !== 'cerrada';
    } catch {
      return true;
    }
  });
  const cambiar = () => {
    const nueva = !abierta;
    setAbierta(nueva);
    try {
      localStorage.setItem(clave, nueva ? 'abierta' : 'cerrada');
    } catch {
      /* sin almacenamiento */
    }
  };
  return (
    <section className="rounded-2xl border-2 border-real/20 bg-white/70">
      <button type="button" onClick={cambiar} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="font-bold text-real">📖 {titulo}</span>
        <span className="text-sm font-semibold text-real/70">{abierta ? 'Ocultar ▲' : 'Ver ▼'}</span>
      </button>
      {abierta && <div className="px-4 pb-4 text-sm leading-relaxed text-marino/85">{children}</div>}
    </section>
  );
}
