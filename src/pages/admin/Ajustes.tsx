import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import MontoInput from '../../components/MontoInput';
import { Opcion } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth';
import { useBancos, usePerfiles } from '../../lib/useAdmin';
import { useLiveQuery } from '../../lib/useLiveQuery';
import { useConfigPublica } from '../../lib/useProgreso';
import { mensajeError, q, supabase } from '../../lib/supabase';
import { formatCOP, isoDesdeHora } from '../../lib/format';
import { pesosEnLetras } from '../../lib/letras';

// Ajustes: SOLO Felipe. La base de datos también lo valida (es_felipe()) en cada función,
// así que ocultar este menú no es la única protección.

const campo =
  'mt-1 h-12 w-full rounded-xl border-2 border-dorado/50 bg-white px-3 text-base font-normal text-marino outline-none focus:border-dorado';

/** Bloque desplegable de ajustes (empieza cerrado). */
function Seccion({ icono, titulo, desc, children }: { icono: string; titulo: string; desc: string; children: ReactNode }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <section className={`rounded-2xl border bg-white shadow-sm ${abierta ? 'border-dorado' : 'border-dorado/30'}`}>
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-crema text-xl">{icono}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-marino">{titulo}</span>
          <span className="block text-xs text-marino/60">{desc}</span>
        </span>
        <span className={`text-real/70 transition-transform ${abierta ? 'rotate-180' : ''}`} aria-hidden="true">
          ▼
        </span>
      </button>
      {abierta && <div className="animar-entrar border-t border-dorado/20 p-4">{children}</div>}
    </section>
  );
}

function useRpc() {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const llamar = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setOcupado(true);
    try {
      const { error } = await supabase.rpc(fn, args);
      if (error) throw error;
      toast(ok);
      return true;
    } catch (e) {
      toast(mensajeError(e), 'error');
      return false;
    } finally {
      setOcupado(false);
    }
  };
  return { llamar, ocupado };
}

// ---------------------------------------------------------------- Textos
function Textos() {
  const { data: config, refetch } = useConfigPublica();
  const { llamar, ocupado } = useRpc();
  const [f, setF] = useState({ titulo: '', subtitulo: '', causa: '', mensaje_meta: '', instrucciones: '', horario: '' });
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (config && !cargado) {
      setF({
        titulo: config.titulo,
        subtitulo: config.subtitulo ?? '',
        causa: config.causa,
        mensaje_meta: config.mensaje_meta,
        instrucciones: config.instrucciones ?? '',
        horario: config.horario ?? '',
      });
      setCargado(true);
    }
  }, [config, cargado]);

  const filas: { k: keyof typeof f; label: string; ayuda: string }[] = [
    { k: 'titulo', label: 'Título', ayuda: 'El nombre grande del evento' },
    { k: 'subtitulo', label: 'Subtítulo', ayuda: 'Debajo del título' },
    { k: 'causa', label: 'Causa', ayuda: 'Para qué se recoge el dinero' },
    { k: 'instrucciones', label: 'Instrucciones', ayuda: 'Ej.: dónde cambiar fichas y tablas' },
    { k: 'horario', label: 'Horario del evento', ayuda: 'Se ve arriba a la derecha de la pantalla' },
    { k: 'mensaje_meta', label: 'Mensaje al llegar a la meta', ayuda: 'Aparece con el confeti al 100 %' },
  ];

  return (
    <div className="space-y-3">
      {filas.map(({ k, label, ayuda }) => (
        <label key={k} className="block text-sm font-bold text-marino">
          {label} <span className="font-normal text-marino/55">· {ayuda}</span>
          <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={campo} />
        </label>
      ))}
      <button
        type="button"
        disabled={ocupado || !cargado}
        onClick={async () => {
          if (
            await llamar(
              'guardar_config_publica',
              {
                p_titulo: f.titulo,
                p_subtitulo: f.subtitulo,
                p_causa: f.causa,
                p_mensaje_meta: f.mensaje_meta,
                p_instrucciones: f.instrucciones,
                p_horario: f.horario,
              },
              '✓ Textos guardados: ya se ven en la pantalla',
            )
          )
            refetch();
        }}
        className="h-12 w-full rounded-xl bg-dorado font-extrabold text-marino shadow disabled:opacity-50"
      >
        {ocupado ? 'Guardando…' : 'Guardar textos'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Lo que ve la gente
const FRASES_BASE = [
  '🎟️ Pregunte por las tablas de bingo en los Bancos 1, 2 y 3',
  '🪙 Cambie sus fichas en los Bancos 1, 2 y 3',
  '🙏 Cada ficha ayuda a terminar nuestra parroquia',
  '🛍️ Visite el Almacén: ¡hay de todo!',
  '⛪ Juntos estamos construyendo la casa de Dios',
  '📱 Escanee el código y siga el termómetro desde su celular',
  '💛 Comparta el termómetro con su familia por WhatsApp',
];

function LoQueVe() {
  const { data: config, refetch } = useConfigPublica();
  const { llamar, ocupado } = useRpc();
  const [frases, setFrases] = useState<string[] | null>(null);

  useEffect(() => {
    if (config && frases === null) setFrases(config.frases?.length ? [...config.frases] : [...FRASES_BASE]);
  }, [config, frases]);

  const lista = frases ?? [];
  const cambiar = (i: number, v: string) => setFrases(lista.map((f, j) => (j === i ? v : f)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const n = [...lista];
    [n[i], n[j]] = [n[j], n[i]];
    setFrases(n);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <a
          href="/pantalla"
          target="_blank"
          rel="noopener"
          className="flex h-14 flex-col items-center justify-center rounded-xl bg-real text-sm font-extrabold text-crema"
        >
          📺 Ver la pantalla
          <span className="text-[10px] font-medium text-crema/75">Lo que se proyecta</span>
        </a>
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="flex h-14 flex-col items-center justify-center rounded-xl border-2 border-real/30 text-sm font-extrabold text-real"
        >
          📱 Ver el celular
          <span className="text-[10px] font-medium text-real/70">Lo que ve el público</span>
        </a>
      </div>

      <div>
        <div className="text-sm font-bold text-marino">Frases de la franja inferior de la pantalla</div>
        <p className="mb-2 text-xs text-marino/60">
          Rotan cada 8 segundos. Entre ellas aparecen solas las frases en vivo: el avance (%), el próximo bingo, el Gran Bingo y
          un producto del menú. Máximo 90 letras por frase.
        </p>
        {config && config.frases === undefined && (
          <p className="mb-2 rounded-lg bg-rojo/10 p-2 text-xs font-semibold text-rojo">
            Para guardar frases falta correr supabase/003_frases_y_bingos.sql en Supabase.
          </p>
        )}
        <ol className="space-y-2">
          {lista.map((f, i) => (
            <li key={i} className="flex items-center gap-1">
              <div className="flex shrink-0 flex-col">
                <button type="button" onClick={() => mover(i, -1)} className="h-6 w-7 text-xs text-marino/50" aria-label="Subir">
                  ▲
                </button>
                <button type="button" onClick={() => mover(i, 1)} className="h-6 w-7 text-xs text-marino/50" aria-label="Bajar">
                  ▼
                </button>
              </div>
              <input
                value={f}
                maxLength={90}
                onChange={(e) => cambiar(i, e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-lg border-2 border-dorado/40 bg-white px-2 text-sm outline-none focus:border-dorado"
              />
              <button
                type="button"
                onClick={() => setFrases(lista.filter((_, j) => j !== i))}
                className="h-11 w-9 shrink-0 rounded-lg text-rojo"
                aria-label="Quitar frase"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFrases([...lista, ''])}
            className="h-11 rounded-xl border-2 border-dashed border-real/30 text-sm font-bold text-real"
          >
            + Agregar frase
          </button>
          <button
            type="button"
            onClick={() => setFrases([...FRASES_BASE])}
            className="h-11 rounded-xl text-xs font-bold text-marino/60"
          >
            Restaurar las originales
          </button>
        </div>
        <button
          type="button"
          disabled={ocupado || !lista.some((f) => f.trim())}
          onClick={async () => {
            if (await llamar('guardar_frases', { p_frases: lista }, '✓ Frases guardadas: ya rotan en la pantalla')) refetch();
          }}
          className="mt-3 h-12 w-full rounded-xl bg-dorado font-extrabold text-marino shadow disabled:opacity-50"
        >
          {ocupado ? 'Guardando…' : 'Guardar frases'}
        </button>
      </div>
      <p className="text-xs text-marino/60">
        Cada 20 minutos la pantalla hace un “repaso”: el termómetro baja y vuelve a subir hasta el valor real, con el mensaje
        “¡Así vamos!”. Para verlo ya, abra la pantalla con <b>/pantalla?repaso=30</b> (lo hace cada 30 segundos).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Meta
function Meta() {
  const { data: metaActual, refetch } = useLiveQuery<number | null>(
    ['config_privada'],
    async () => (await q<{ meta: number } | null>(supabase.from('config_privada').select('meta').eq('id', 1).maybeSingle()))?.meta ?? null,
    { intervalo: 60_000 },
  );
  const { llamar, ocupado } = useRpc();
  const [meta, setMeta] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Meta actual: <b className="tabular text-lg">{metaActual ? formatCOP(metaActual) : '…'}</b>
      </p>
      <MontoInput valor={meta} onChange={setMeta} atajos={[100_000, 1_000_000, 5_000_000, 10_000_000]} max={1_000_000_000} />
      {meta ? <p className="text-sm font-semibold capitalize text-real">{pesosEnLetras(meta)}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!meta || meta < 1000 || ocupado}
          onClick={() => setConfirmar(meta)}
          className="h-12 rounded-xl bg-dorado font-extrabold text-marino disabled:opacity-50"
        >
          Cambiar meta
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => setConfirmar(50_000_000)}
          className="h-12 rounded-xl border-2 border-verde/40 text-sm font-bold text-verde"
        >
          Volver a $50.000.000
        </button>
      </div>
      <p className="text-xs text-marino/60">
        Para probar el 100 % y el confeti, ponga una meta baja (ej. $100.000) y luego vuelva a $50.000.000. El porcentaje del
        termómetro se recalcula solo.
      </p>
      <ConfirmModal
        abierto={confirmar !== null}
        titulo="¿Cambiar la meta?"
        ocupado={ocupado}
        onCancelar={() => setConfirmar(null)}
        onConfirmar={async () => {
          if (await llamar('cambiar_meta', { p_meta: confirmar }, `Meta cambiada a ${formatCOP(confirmar)}`)) {
            setConfirmar(null);
            setMeta(null);
            refetch();
          }
        }}
      >
        <p className="text-center">
          De <b className="tabular">{formatCOP(metaActual)}</b> a
          <br />
          <b className="tabular text-3xl">{formatCOP(confirmar)}</b>
          <br />
          <span className="text-sm capitalize text-real">{pesosEnLetras(confirmar)}</span>
        </p>
      </ConfirmModal>
    </div>
  );
}

// ---------------------------------------------------------------- Puntos de recaudo
function Puntos() {
  const { data: bancos, refetch } = useBancos();
  const { llamar, ocupado } = useRpc();
  const [nombres, setNombres] = useState<Record<number, string>>({});
  const [nuevo, setNuevo] = useState('');

  return (
    <div className="space-y-2">
      {(bancos ?? []).map((b) => {
        const nombre = nombres[b.id] ?? b.nombre;
        return (
          <div key={b.id} className={`rounded-xl border p-2 ${b.activo ? 'border-dorado/30' : 'border-marino/10 bg-marino/5'}`}>
            <div className="flex gap-2">
              <input
                value={nombre}
                onChange={(e) => setNombres({ ...nombres, [b.id]: e.target.value })}
                className="h-11 min-w-0 flex-1 rounded-lg border-2 border-dorado/40 bg-white px-2 text-base outline-none focus:border-dorado"
              />
              {nombre !== b.nombre && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={async () => {
                    if (await llamar('guardar_banco', { p_id: b.id, p_nombre: nombre, p_activo: b.activo }, 'Nombre guardado')) refetch();
                  }}
                  className="h-11 rounded-lg bg-dorado px-3 text-sm font-extrabold text-marino"
                >
                  Guardar
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={ocupado}
              onClick={async () => {
                if (
                  await llamar(
                    'guardar_banco',
                    { p_id: b.id, p_nombre: b.nombre, p_activo: !b.activo },
                    b.activo ? `${b.nombre} desactivado` : `${b.nombre} activado`,
                  )
                )
                  refetch();
              }}
              className={`mt-2 h-9 w-full rounded-lg text-xs font-bold ${b.activo ? 'text-rojo' : 'bg-verde text-white'}`}
            >
              {b.activo ? 'Desactivar (ya no aparece al registrar)' : 'Activar de nuevo'}
            </button>
          </div>
        );
      })}
      <div className="flex gap-2 pt-2">
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Ej.: Banco 4" className={`${campo} mt-0`} />
        <button
          type="button"
          disabled={ocupado || nuevo.trim().length < 2}
          onClick={async () => {
            if (await llamar('guardar_banco', { p_id: null, p_nombre: nuevo, p_activo: true }, `${nuevo.trim()} agregado`)) {
              setNuevo('');
              refetch();
            }
          }}
          className="h-12 shrink-0 rounded-xl bg-dorado px-4 font-extrabold text-marino disabled:opacity-50"
        >
          + Agregar
        </button>
      </div>
      <p className="text-xs text-marino/60">Desactivar no borra lo que ya se registró de ese punto.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Usuarios
function Usuarios() {
  const { perfil: yo } = useAuth();
  const { data: perfiles, refetch } = usePerfiles();
  const { llamar, ocupado } = useRpc();

  const cambiar = async (id: string, rol: string, activo: boolean, ok: string) => {
    if (await llamar('cambiar_perfil', { p_id: id, p_rol: rol, p_activo: activo }, ok)) refetch();
  };

  return (
    <div className="space-y-2">
      {(perfiles ?? [])
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((p) => {
          const soyYo = p.id === yo?.id;
          return (
            <div key={p.id} className={`rounded-xl border p-3 ${p.activo ? 'border-dorado/30' : 'border-marino/10 bg-marino/5 opacity-70'}`}>
              <div className="flex items-baseline justify-between">
                <b>{p.nombre}</b>
                <span className="text-xs text-marino/55">usuario: {p.usuario}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Opcion
                  activo={p.rol === 'editor'}
                  onClick={() => !soyYo && p.rol !== 'editor' && cambiar(p.id, 'editor', p.activo, `${p.nombre} ahora es editor`)}
                  sub="Registra y corrige"
                  className="text-sm"
                >
                  Editor
                </Opcion>
                <Opcion
                  activo={p.rol === 'registrador'}
                  onClick={() => !soyYo && p.rol !== 'registrador' && cambiar(p.id, 'registrador', p.activo, `${p.nombre} ahora es registrador`)}
                  sub="Solo registra"
                  className="text-sm"
                >
                  Registrador
                </Opcion>
              </div>
              {!soyYo && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => cambiar(p.id, p.rol, !p.activo, p.activo ? `${p.nombre} ya no puede entrar` : `${p.nombre} puede entrar de nuevo`)}
                  className={`mt-2 h-9 w-full rounded-lg text-xs font-bold ${p.activo ? 'text-rojo' : 'bg-verde text-white'}`}
                >
                  {p.activo ? 'Quitarle el acceso' : 'Devolverle el acceso'}
                </button>
              )}
            </div>
          );
        })}
      <p className="text-xs text-marino/60">
        Para crear un usuario nuevo o cambiar una contraseña hay que entrar a Supabase (Authentication → Users) desde el PC.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Bingo extra
function BingoExtra() {
  const { llamar, ocupado } = useRpc();
  const [nombre, setNombre] = useState('');
  const [hora, setHora] = useState('');
  const [premio, setPremio] = useState<number | null>(null);
  const [especie, setEspecie] = useState('');

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold">
        Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Bingo 5" className={campo} />
      </label>
      <label className="block text-sm font-bold">
        Hora <span className="font-normal text-marino/55">· vacío = “Durante el día”</span>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
      </label>
      <div className="text-sm font-bold">Premio en dinero</div>
      <MontoInput valor={premio} onChange={setPremio} atajos={[50_000, 100_000, 200_000, 500_000]} />
      <label className="block text-sm font-bold">
        O premio en especie <span className="font-normal text-marino/55">· opcional</span>
        <input value={especie} onChange={(e) => setEspecie(e.target.value)} placeholder="Ej.: Mercado completo" className={campo} />
      </label>
      <button
        type="button"
        disabled={ocupado || nombre.trim().length < 2 || (!premio && !especie.trim())}
        onClick={async () => {
          if (
            await llamar(
              'crear_bingo',
              { p_nombre: nombre, p_hora: isoDesdeHora(hora), p_premio: premio, p_premio_texto: especie },
              `${nombre.trim()} agregado: ya aparece en Bingos y en la pantalla`,
            )
          ) {
            setNombre('');
            setHora('');
            setPremio(null);
            setEspecie('');
          }
        }}
        className="h-12 w-full rounded-xl bg-dorado font-extrabold text-marino shadow disabled:opacity-50"
      >
        + Agregar bingo
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Reinicio
function Reinicio() {
  const { llamar, ocupado } = useRpc();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [conMenu, setConMenu] = useState(false);

  return (
    <div>
      <ul className="mb-3 list-disc pl-5 text-sm text-marino/80">
        <li>Borra todos los ingresos (el termómetro vuelve a 0 %).</li>
        <li>Bingos a su estado inicial; quita los bingos extra.</li>
        <li>Ningún producto agotado ni oculto.</li>
        <li>Meta en $50.000.000 y actividad vacía.</li>
      </ul>
      <label className="mb-3 flex items-start gap-2 text-sm font-semibold">
        <input type="checkbox" checked={conMenu} onChange={(e) => setConMenu(e.target.checked)} className="mt-0.5 h-5 w-5" />
        <span>
          También restaurar el menú original (elimina productos creados en las pruebas y restaura precios). Los postres reales
          agréguelos después.
        </span>
      </label>
      <button type="button" onClick={() => setAbierto(true)} className="h-12 w-full rounded-xl bg-rojo font-extrabold text-white">
        Reiniciar datos…
      </button>
      <ConfirmModal
        abierto={abierto}
        titulo="⚠️ Reiniciar todos los datos"
        confirmar="Reiniciar"
        peligro
        ocupado={ocupado}
        deshabilitado={texto !== 'REINICIAR'}
        onCancelar={() => setAbierto(false)}
        onConfirmar={async () => {
          if (await llamar('reiniciar_datos', { p_confirmacion: texto, p_restaurar_menu: conMenu }, 'Datos reiniciados: termómetro en 0 %')) {
            setAbierto(false);
            setTexto('');
          }
        }}
      >
        <p>
          Esto <b>no se puede deshacer</b>.{conMenu ? ' Incluye restaurar el menú original.' : ''} Escriba <b>REINICIAR</b> para
          confirmar:
        </p>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoCapitalize="characters"
          autoFocus
          className="mt-2 h-12 w-full rounded-xl border-2 border-rojo/40 bg-white px-3 text-center text-lg font-bold tracking-widest outline-none"
        />
      </ConfirmModal>
    </div>
  );
}

export default function Ajustes() {
  const { perfil } = useAuth();
  if (perfil?.usuario !== 'felipe') return <Navigate to="/admin" replace />;

  return (
    <div className="space-y-3">
      <h1 className="font-serif text-3xl font-bold text-marino">⚙️ Ajustes</h1>
      <p className="text-sm text-marino/70">
        Solo usted (Felipe) ve esta sección. Todo cambio se aplica al instante en la pantalla y en los celulares.
      </p>

      <Seccion icono="📺" titulo="Lo que ve la gente" desc="Ver la pantalla y el celular, y editar las frases que rotan">
        <LoQueVe />
      </Seccion>
      <Seccion icono="📝" titulo="Textos de la pantalla" desc="Título, causa, instrucciones, horario y mensaje de la meta">
        <Textos />
      </Seccion>
      <Seccion icono="🎯" titulo="Meta" desc="Cambiar la meta (también sirve para probar el 100 %)">
        <Meta />
      </Seccion>
      <Seccion icono="🏦" titulo="Puntos de recaudo" desc="Renombrar, agregar o desactivar bancos">
        <Puntos />
      </Seccion>
      <Seccion icono="👥" titulo="Usuarios" desc="Quién es editor o registrador, y quién puede entrar">
        <Usuarios />
      </Seccion>
      <Seccion icono="🎱" titulo="Agregar un bingo" desc="Para un bingo extra que no estaba planeado">
        <BingoExtra />
      </Seccion>
      <Seccion icono="🔄" titulo="Reiniciar datos (después de las pruebas)" desc="Deja todo en cero antes de abrir el evento">
        <Reinicio />
      </Seccion>
    </div>
  );
}
