import { useLayoutEffect, useRef, useState } from 'react';
import type { Producto } from '../lib/tipos';
import { formatCOP } from '../lib/format';

interface Grupo {
  titulo: string;
  items: Producto[];
}

function Columna({ grupos }: { grupos: Grupo[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {grupos.map((g) => (
        <div key={g.titulo} className="mb-[0.5em]">
          <h3 className="mb-[0.15em] font-serif text-[1.3em] font-bold uppercase leading-tight tracking-wide text-real">
            {g.titulo}
          </h3>
          <ul>
            {g.items.map((p) => (
              <li key={p.id} className="flex items-end leading-[1.38] text-marino">
                <span className={`flex min-w-0 items-end ${p.agotado ? 'opacity-45' : ''}`}>
                  {p.emoji && <span className="mr-[0.3em] w-[1.3em] shrink-0 text-center">{p.emoji}</span>}
                  <span className={`truncate font-semibold uppercase ${p.agotado ? 'line-through decoration-rojo decoration-[0.12em]' : ''}`}>
                    {p.nombre}
                  </span>
                </span>
                {p.agotado ? (
                  <>
                    <span className="puntos" />
                    <span className="mb-[0.12em] shrink-0 rounded-[0.25em] bg-rojo px-[0.4em] py-[0.05em] text-[0.72em] font-extrabold tracking-wider text-white">
                      AGOTADO
                    </span>
                  </>
                ) : (
                  <>
                    <span className="puntos" />
                    <span className="tabular shrink-0 font-extrabold">{formatCOP(p.precio)}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Menú en dos columnas (Comidas | Bebidas y Postres). La fuente se reduce
 * sola hasta que todo quepa en el contenedor, sin scroll.
 */
export default function MenuProductos({ productos, maxFont = 34, minFont = 12 }: { productos: Producto[]; maxFont?: number; minFont?: number }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [font, setFont] = useState(maxFont);

  const comidas = productos.filter((p) => p.categoria === 'comida');
  const derecha: Grupo[] = [
    { titulo: 'Bebidas', items: productos.filter((p) => p.categoria === 'bebida') },
    { titulo: 'Postres', items: productos.filter((p) => p.categoria === 'postre') },
    { titulo: 'Otros', items: productos.filter((p) => p.categoria === 'otro') },
  ].filter((g) => g.items.length > 0);
  const izquierda: Grupo[] = comidas.length ? [{ titulo: 'Comidas', items: comidas }] : [];

  const firma = productos.map((p) => `${p.id}:${p.nombre}:${p.precio}:${p.agotado}`).join('|');

  useLayoutEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const ajustar = () => {
      // Búsqueda binaria del tamaño más grande que cabe
      let lo = minFont;
      let hi = maxFont;
      let mejor = minFont;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        el.style.fontSize = `${mid}px`;
        const cabe = el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
        if (cabe) {
          mejor = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      el.style.fontSize = `${mejor}px`;
      setFont(mejor);
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    document.fonts?.ready.then(ajustar);
    return () => ro.disconnect();
  }, [firma, maxFont, minFont]);

  return (
    <div ref={contenedor} className="flex h-full w-full gap-[1.4em] overflow-hidden" style={{ fontSize: font }}>
      <Columna grupos={izquierda} />
      <div className="w-[0.12em] shrink-0 bg-dorado/40" />
      <Columna grupos={derecha} />
    </div>
  );
}
