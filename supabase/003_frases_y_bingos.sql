-- =====================================================================
-- 003 · Frases editables de la pantalla + bingos jugados no se repiten
-- Correr UNA vez en Supabase → SQL Editor → Run (después de 002).
-- =====================================================================

-- Frases fijas de la franja inferior de la pantalla (las de avance, bingos y
-- productos se arman solas con los datos en vivo).
alter table public.config_publica add column if not exists frases text[];

update public.config_publica set frases = array[
  '🎟️ Pregunte por las tablas de bingo en los Bancos 1, 2 y 3',
  '🪙 Cambie sus fichas en los Bancos 1, 2 y 3',
  '🙏 Cada ficha ayuda a terminar nuestra parroquia',
  '🛍️ Visite el Almacén: ¡hay de todo!',
  '⛪ Juntos estamos construyendo la casa de Dios',
  '📱 Escanee el código y siga el termómetro desde su celular',
  '💛 Comparta el termómetro con su familia por WhatsApp'
] where id = 1 and frases is null;

create or replace function public.guardar_frases(p_frases text[])
returns void
language plpgsql security definer set search_path = public as $$
declare v text[];
begin
  if not es_felipe() then
    raise exception 'Solo Felipe puede cambiar las frases';
  end if;
  select coalesce(array_agg(trim(f)), '{}') into v
    from unnest(coalesce(p_frases, '{}')) as f
   where length(trim(f)) > 0;
  if array_length(v, 1) is null then
    raise exception 'Debe quedar al menos una frase';
  end if;
  if exists (select 1 from unnest(v) f where length(f) > 90) then
    raise exception 'Cada frase puede tener máximo 90 caracteres para que quepa en la pantalla';
  end if;
  update config_publica set frases = v where id = 1;
end $$;

revoke execute on function public.guardar_frases(text[]) from public, anon;
grant  execute on function public.guardar_frases(text[]) to authenticated;

-- Un bingo terminado no se puede volver a jugar (el reinicio de Felipe sí los deja en cero)
create or replace function public.cambiar_estado_bingo(p_bingo_id smallint, p_estado text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actual text;
begin
  if not es_admin() then
    raise exception 'No autorizado';
  end if;
  if p_estado not in ('programado', 'en_juego', 'finalizado') then
    raise exception 'Estado inválido';
  end if;
  select estado into v_actual from bingos where id = p_bingo_id;
  if not found then
    raise exception 'Bingo no existe';
  end if;
  if v_actual = 'finalizado' and p_estado <> 'finalizado' then
    raise exception 'Este bingo ya se jugó y no se puede volver a jugar';
  end if;
  if p_estado = 'en_juego' then
    update bingos set estado = 'finalizado', actualizado_en = now()
     where estado = 'en_juego' and id <> p_bingo_id;
  end if;
  update bingos set estado = p_estado, actualizado_en = now() where id = p_bingo_id;
end $$;

-- Verificar: debe mostrar las frases
select array_length(frases, 1) as cantidad_frases from public.config_publica where id = 1;
