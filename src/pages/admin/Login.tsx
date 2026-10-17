import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { mensajeError } from '../../lib/supabase';
import { Cargando } from '../../components/ProtectedRoute';

export default function Login() {
  const { login, perfil, cargando, aviso } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const destino = (loc.state as { desde?: string } | null)?.desde ?? '/admin';

  if (cargando) return <Cargando />;
  if (perfil) return <Navigate to={destino} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password) return;
    setEnviando(true);
    setError(null);
    try {
      await login(usuario, password);
      navigate(destino, { replace: true });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-10">
      <img src="/logo.jpg" alt="" className="mx-auto h-24 w-24 rounded-full object-cover ring-4 ring-dorado/60" />
      <h1 className="mt-3 text-center font-serif text-4xl font-bold text-marino">San Isidro</h1>
      <p className="text-center text-sm font-semibold text-real">Ingreso de administradores</p>

      <form onSubmit={enviar} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-bold text-marino">Usuario</span>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Ej.: felipe"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            className="mt-1 h-14 w-full rounded-2xl border-2 border-dorado/60 bg-white px-4 text-lg outline-none focus:border-dorado"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-marino">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 h-14 w-full rounded-2xl border-2 border-dorado/60 bg-white px-4 text-lg outline-none focus:border-dorado"
          />
        </label>

        {(error || aviso) && (
          <p className="rounded-xl bg-rojo/10 px-3 py-2 text-center font-semibold text-rojo">{error || aviso}</p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="h-14 w-full rounded-2xl bg-dorado text-lg font-extrabold text-marino shadow disabled:opacity-60"
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-marino/60">
        Escriba solo su nombre de usuario, por ejemplo <b>felipe</b>.
        <br />
        ¿Olvidó la contraseña? Pídasela a Felipe.
      </p>
    </main>
  );
}
