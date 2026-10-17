import { useEffect, type ReactNode } from 'react';

interface Props {
  abierto: boolean;
  titulo?: ReactNode;
  children?: ReactNode;
  confirmar?: string;
  cancelar?: string;
  peligro?: boolean;
  ocupado?: boolean;
  deshabilitado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ConfirmModal({
  abierto,
  titulo,
  children,
  confirmar = 'Confirmar',
  cancelar = 'Cancelar',
  peligro,
  ocupado,
  deshabilitado,
  onConfirmar,
  onCancelar,
}: Props) {
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !ocupado && onCancelar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [abierto, ocupado, onCancelar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-marino/60 p-3 backdrop-blur-sm sm:items-center">
      <div className="animar-entrar w-full max-w-md rounded-3xl bg-crema p-5 shadow-2xl" role="dialog" aria-modal="true">
        {titulo && <div className="mb-3 text-lg font-bold text-marino">{titulo}</div>}
        <div className="text-marino">{children}</div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={ocupado}
            className="h-14 rounded-2xl border-2 border-marino/20 bg-white text-lg font-bold text-marino disabled:opacity-50"
          >
            {cancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={ocupado || deshabilitado}
            className={`h-14 rounded-2xl text-lg font-extrabold shadow disabled:opacity-50 ${
              peligro ? 'bg-rojo text-white' : 'bg-dorado text-marino'
            }`}
          >
            {ocupado ? 'Guardando…' : confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
