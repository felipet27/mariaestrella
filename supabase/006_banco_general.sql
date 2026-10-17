-- =====================================================================
-- 006 · Banco general (dinero recibido ANTES del evento)
-- * Crea el punto "Banco general" para donaciones, pagos u otros previos.
-- * El reinicio de Felipe ahora CONSERVA por defecto lo de Banco general
--   (y su rastro en la auditoría); borra solo lo demás.
-- Correr UNA vez en Supabase → SQL Editor → Run (después de 005).
-- =====================================================================

insert into public.bancos (id, nombre, activo)
select coalesce((select max(id) + 1 from public.bancos), 1), 'Banco general', true
 where not exists (select 1 from public.bancos where lower(nombre) = 'banco general');

drop function if exists public.reiniciar_datos(text, boolean);

create or replace function public.reiniciar_datos(p_confirmacion text, p_restaurar_menu boolean default false, p_conservar_general boolean default true)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_general smallint := (select id from bancos where lower(nombre) = 'banco general' limit 1);
begin
  if not es_felipe() then
    raise exception 'Solo Felipe puede reiniciar los datos';
  end if;
  if p_confirmacion is distinct from 'REINICIAR' then
    raise exception 'Escriba REINICIAR para confirmar';
  end if;

  -- Lo de Banco general (antes del evento) se conserva si así se pide; lo demás se borra
  if p_conservar_general and v_general is not null then
    delete from ingresos where id > 0 and banco_id is distinct from v_general;
  else
    truncate ingresos restart identity;
  end if;

  update config_privada set meta = 50000000 where id = 1;

  delete from bingos where id > 4;
  update bingos as b
     set nombre = s.nombre, hora = s.hora, premio = s.premio, premio_texto = null, valor_carton = null,
         estado = 'programado', premio_entregado = false, premio_entregado_por = null,
         premio_entregado_en = null, actualizado_en = now()
    from (values
      (1::smallint, 'Bingo 1',    null::timestamptz,                     100000::bigint),
      (2::smallint, 'Bingo 2',    null::timestamptz,                     200000::bigint),
      (3::smallint, 'Bingo 3',    null::timestamptz,                     300000::bigint),
      (4::smallint, 'Gran Bingo', '2026-10-18 19:00:00-05'::timestamptz, 1000000::bigint)
    ) as s(id, nombre, hora, premio)
   where b.id = s.id;

  if p_restaurar_menu then
    create temp table _menu (nombre text, precio integer, categoria text, emoji text, orden smallint) on commit drop;
    insert into _menu values
      ('Desayuno sencillo',      12000, 'comida', '🍳',  1),
      ('Desayuno especial',      15000, 'comida', '🍳',  2),
      ('Perico',                  2500, 'comida', '🍳',  3),
      ('Típico antioqueño',      18000, 'comida', '🍛',  4),
      ('Almuerzo especial',      20000, 'comida', '🍛',  5),
      ('Sudado de posta',        20000, 'comida', '🍲',  6),
      ('Mondongo',               18000, 'comida', '🍲',  7),
      ('Lechona',                18000, 'comida', '🐷',  8),
      ('Tamales',                15000, 'comida', '🫔',  9),
      ('Asado con carne',        15000, 'comida', '🥩', 10),
      ('Morcilla libra',         12000, 'comida', '🌭', 11),
      ('Chorizo con arepa',      12000, 'comida', '🌭', 12),
      ('Chicharrón con arepa',   12000, 'comida', '🥓', 13),
      ('Picada plato personal',  12000, 'comida', '🍖', 14),
      ('Salchipapas',             8000, 'comida', '🍟', 15),
      ('Tinto',                   1500, 'bebida', '☕', 20),
      ('Café con leche',          3000, 'bebida', '☕', 21),
      ('Gaseosa pequeña',         1500, 'bebida', '🥤', 22),
      ('Soda michelada',          2500, 'bebida', '🥤', 23),
      ('Cerveza',                 4500, 'bebida', '🍺', 24),
      ('Cerveza michelada',       6000, 'bebida', '🍺', 25),
      ('Crispetas',               1000, 'postre', '🍿', 30);
    delete from productos where lower(nombre) not in (select lower(nombre) from _menu);
    update productos p
       set nombre = m.nombre, precio = m.precio, categoria = m.categoria, emoji = m.emoji, orden = m.orden
      from _menu m
     where lower(p.nombre) = lower(m.nombre);
    insert into productos (nombre, precio, categoria, emoji, orden)
    select m.nombre, m.precio, m.categoria, m.emoji, m.orden from _menu m
     where not exists (select 1 from productos p where lower(p.nombre) = lower(m.nombre));
  end if;

  update productos set agotado = false, activo = true where agotado or not activo;

  -- La auditoría se limpia, salvo el rastro de los registros conservados de Banco general
  if p_conservar_general and v_general is not null then
    delete from auditoria where id > 0
       and not (tabla = 'ingresos' and registro_id in (select id::text from ingresos));
  else
    truncate auditoria restart identity;
  end if;
  insert into auditoria (tabla, registro_id, accion, usuario)
  values ('sistema', null, case when p_restaurar_menu then 'REINICIO (con menú original)' else 'REINICIO' end, auth.uid());

  perform recalcular_progreso();
end $$;

revoke execute on function public.reiniciar_datos(text, boolean, boolean) from public, anon;
grant  execute on function public.reiniciar_datos(text, boolean, boolean) to authenticated;

-- Verificar: debe salir "Banco general"
select id, nombre, activo from public.bancos order by id;