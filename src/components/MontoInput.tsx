import { formatCOP, formatMiles } from '../lib/format';

interface Props {
  valor: number | null;
  onChange: (v: number | null) => void;
  atajos?: number[];
  max?: number;
  autoFocus?: boolean;
  placeholder?: string;
}

/** Campo de monto con formateo en vivo ($ 300.000) y atajos que suman. */
export default function MontoInput({
  valor,
  onChange,
  atajos = [50_000, 100_000, 500_000, 1_000_000],
  max = 50_000_000,
  autoFocus,
  placeholder = '0',
}: Props) {
  const texto = valor ? formatMiles(valor) : '';

  const alEscribir = (s: string) => {
    const digitos = s.replace(/\D/g, '').replace(/^0+/, '');
    if (!digitos) return onChange(null);
    const n = Math.min(Number(digitos.slice(0, 9)), max);
    onChange(n);
  };

  return (
    <div>
      <div className="flex items-center rounded-2xl border-2 border-dorado bg-white px-4 focus-within:ring-4 focus-within:ring-dorado/30">
        <span className="mr-2 text-3xl font-bold text-marino/60">$</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          value={texto}
          placeholder={placeholder}
          onChange={(e) => alEscribir(e.target.value)}
          className="tabular h-16 w-full min-w-0 bg-transparent text-4xl font-extrabold text-marino outline-none placeholder:text-marino/25"
        />
        {valor ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 h-12 shrink-0 rounded-xl px-3 text-sm font-bold text-rojo active:bg-rojo/10"
            aria-label="Borrar monto"
          >
            Borrar
          </button>
        ) : null}
      </div>
      {atajos.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {atajos.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange(Math.min((valor ?? 0) + a, max))}
              className="tabular h-12 rounded-xl border border-real/30 bg-white text-sm font-bold text-real active:bg-real/10"
            >
              +{a >= 1_000_000 ? `${a / 1_000_000}M` : formatMiles(a)}
            </button>
          ))}
        </div>
      )}
      {valor ? <p className="mt-1 text-sm text-marino/60">{formatCOP(valor)}</p> : null}
    </div>
  );
}
