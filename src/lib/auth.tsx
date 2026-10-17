import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Perfil } from './tipos';

/** Supabase Auth exige correo: se usa uno interno ficticio que el usuario nunca ve. */
export const toEmail = (usuario: string) => `${usuario.trim().toLowerCase()}@sanisidro.test`;

interface AuthCtx {
  cargando: boolean;
  session: Session | null;
  perfil: Perfil | null;
  esEditor: boolean;
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  aviso: string | null;
}

const Ctx = createContext<AuthCtx | null>(null);

async function cargarPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, usuario, nombre, rol, activo')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data && data.activo ? (data as Perfil) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilListo, setPerfilListo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSesionLista(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s);
      setSesionLista(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    let vivo = true;
    if (!userId) {
      setPerfil(null);
      setPerfilListo(true);
      return;
    }
    setPerfilListo(false);
    cargarPerfil(userId)
      .then(async (p) => {
        if (!vivo) return;
        if (!p) {
          setAviso('Usuario no autorizado');
          await supabase.auth.signOut();
        }
        setPerfil(p);
      })
      .catch(() => {
        // Sin red: se mantiene el perfil anterior; se reintenta en el próximo cambio de sesión.
      })
      .finally(() => vivo && setPerfilListo(true));
    return () => {
      vivo = false;
    };
  }, [userId]);

  const login = useCallback(async (usuario: string, password: string) => {
    setAviso(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: toEmail(usuario), password });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) throw new Error('Usuario o contraseña incorrectos');
      throw error;
    }
    const p = await cargarPerfil(data.user.id);
    if (!p) {
      await supabase.auth.signOut();
      throw new Error('Usuario no autorizado');
    }
    setPerfil(p);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setPerfil(null);
  }, []);

  const value: AuthCtx = {
    cargando: !sesionLista || !perfilListo,
    session,
    perfil,
    esEditor: perfil?.rol === 'editor',
    login,
    logout,
    aviso,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
