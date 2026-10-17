import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tipo = 'ok' | 'error' | 'info';
interface ToastItem {
  id: number;
  texto: string;
  tipo: Tipo;
}

const Ctx = createContext<(texto: string, tipo?: Tipo) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const mostrar = useCallback((texto: string, tipo: Tipo = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, texto, tipo }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tipo === 'error' ? 6000 : 4000);
  }, []);

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animar-entrar pointer-events-auto w-full max-w-md rounded-2xl px-4 py-3 text-center text-base font-bold shadow-lg ${
              t.tipo === 'ok' ? 'bg-verde text-white' : t.tipo === 'error' ? 'bg-rojo text-white' : 'bg-marino text-crema'
            }`}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
