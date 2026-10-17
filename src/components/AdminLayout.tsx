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

  const links: { to: string; icono: string; label: string; end?: boolean; principal?: boolean }[] = [
    { to: '/admin', icono: '🏠', label: 'Inicio', end: true },
    { to: '/admin/registrar', icono: '➕', label: 'Registrar', principal: true },
    { to: '/admin/historial', icono: '📋', label: 'Historial' },
    { to: '/admin/productos', icono: '🍽️', label: 'Productos' },
    { to: '/admin/bingos', icono: '🎱', label: 'Bingos' },
    { to: '/admin/reportes', icono: '📊', label: 'Reportes' },
    ...(perfil?.usuario === 'felipe' ? [{ to: '/admin/pruebas', icono: '🧪', label: 'Pruebas' }] : []),
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
        {/* PC / tablet: fila centrada debajo del encabezado */}
        <nav className="mx-auto hidden max-w-4xl flex-wrap justify-center gap-1.5 px-4 pb-3 md:flex" aria-label="Secciones">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  isActive ? 'bg-dorado text-marino shadow' : 'text-crema/85 hover:bg-white/10'
                }`
              }
            >
              <span aria-hidden="true">{l.icono}</span>
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
      <main className="mx-auto max-w-3xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 md:pb-16">{children}</main>

      {/* Celular: barra fija abajo, como una app */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-dorado/30 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(20,40,90,0.08)] backdrop-blur md:hidden"
        aria-label="Secciones"
      >
        <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-[10px] font-bold leading-none ${
                  isActive ? 'text-real' : 'text-marino/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-dorado" />}
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${
                      l.principal ? 'bg-dorado shadow' : isActive ? 'bg-real/10' : ''
                    }`}
                  >
                    {l.icono}
                  </span>
                  <span className="max-w-full truncate">{l.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
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

/** Ayuda desplegable de cada sección: siempre empieza compacta; se abre con la flecha. */
export function GuiaRapida({ titulo = '¿Cómo funciona esta sección?', children }: { titulo?: string; children: ReactNode }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <section className={`rounded-2xl border transition-colors ${abierta ? 'border-real/30 bg-white' : 'border-real/15 bg-white/60'}`}>
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-real/10 text-sm font-black text-real">?</span>
        <span className="flex-1 text-sm font-bold text-real">{titulo}</span>
        <span className={`text-real/70 transition-transform ${abierta ? 'rotate-180' : ''}`} aria-hidden="true">
          ▼
        </span>
      </button>
      {abierta && <div className="animar-entrar px-4 pb-4 text-sm leading-relaxed text-marino/85">{children}</div>}
    </section>
  );
}
