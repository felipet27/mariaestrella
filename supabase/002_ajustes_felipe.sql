-- =====================================================================
-- 002 · Ajustes desde el celular (SOLO el usuario 'felipe')
-- Correr UNA vez en Supabase → SQL Editor → Run (después de schema.sql).
-- Todas las funciones validan es_felipe() en la base de datos.
-- =====================================================================

-- Textos públicos (pantalla y celulares)
create or replace function public.guardar_config_publica(
  p_titulo text, p_subtitulo text, p_causa text, p_mensaje_meta text, p_instrucciones text, p_horario text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_felipe() then
    raise exception 'Solo Felipe puede cambiar los textos';
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 2 or length(trim(coalesce(p_causa, ''))) < 3
     or length(trim(coalesce(p_mensaje_meta, ''))) < 3 then
    raise exception 'El título, la causa y el mensaje de la meta son obligatorios';
  end if;
  update config_publica
     set titulo = trim(p_titulo),
         subtitulo = nullif(trim(p_subtitulo), ''),
         causa = trim(p_causa),
         mensaje_meta = trim(p_mensaje_meta),
         instrucciones = nullif(trim(p_instrucciones), ''),
         horario = nullif(trim(p_horario), '')
   where id = 1;
end $$;

-- Puntos de recaudo: p_id null = crear uno nuevo
create or replace function public.guardar_banco(p_id smallint, p_nombre text, p_activo boolean)
returns smallint
language plpgsql security definer set search_path = public as $$
declare v_id smallint;
begin
  if not es_felipe() then
    raise exception 'Solo Felipe puede cambiar los puntos de recaudo';
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Nombre inválido';
  end if;
  if exists (select 1 from bancos where lower(nombre) = lower(trim(p_nombre)) and (p_id is null or id <> p_id)) then
    raise exception 'Ya existe un punto con ese nombre';
  end if;
  if p_id is null then
    insert into bancos (id, nombre, activo)
    values (coalesce((select max(id) + 1 from bancos), 1), trim(p_nombre), coalesce(p_activo, true))
    returning id into v_id;
  else
    update bancos set nombre = trim(p_nombre), activo = coalesce(p_activo, activo) where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'El punto no existe';
    end if;
  end if;
  return v_id;
end $$;

-- Usuarios: rol y activo (Felipe no puede desactivarse ni quitarse el rol a sí mismo)
create or replace function public.cambiar_perfil(p_id uuid, p_rol text, p_activo boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_felipe() then
    raise exception 'Solo Felipe puede cambiar usuarios';
  end if;
  if p_rol not in ('editor', 'registrador') then
    raise exception 'Rol inválido';
  end if;
  if p_id = auth.uid() and (p_rol <> 'editor' or not p_activo) then
    raise exception 'No puede quitarse el acceso a usted mismo';
  end if;
  update perfiles set rol = p_rol, activo = p_activo where id = p_id;
  if not found then
    raise exception 'El usuario no existe';
  end if;
end $$;

-- Bingo extra
create or replace function public.crear_bingo(p_nombre text, p_hora timestamptz, p_premio bigint, p_premio_texto text)
returns smallint
language plpgsql security definer set search_path = public as $$
declare v_id smallint;
begin
  if not es_felipe() then
    raise exception 'Solo Felipe puede agregar bingos';
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Nombre inválido';
  end if;
  insert into bingos (id, nombre, hora, premio, premio_texto)
  values (coalesce((select max(id) + 1 from bingos), 1), trim(p_nombre), p_hora, p_premio, nullif(trim(p_premio_texto), ''))
  returning id into v_id;
  return v_id;
end $$;

-- El reinicio ahora también quita los bingos extra (deja solo los 4 originales)
create or replace function public.reiniciar_datos(p_confirmacion text, p_restaurar_menu boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_felipe() then
    raise exception 'Solo Felipe puede reiniciar los datos';
  end if;
  if p_confirmacion is distinct from 'REINICIAR' then
    raise exception 'Escriba REINICIAR para confirmar';
  end if;

  truncate ingresos restart identity;

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

  update productos set agotado = false, activo = true;

  truncate auditoria restart identity;
  insert into auditoria (tabla, registro_id, accion, usuario)
  values ('sistema', null, case when p_restaurar_menu then 'REINICIO (con menú original)' else 'REINICIO' end, auth.uid());

  perform recalcular_progreso();
end $$;

-- Auditoría también para bancos y textos públicos
drop trigger if exists aud_bancos on public.bancos;
create trigger aud_bancos after insert or update or delete on public.bancos for each row execute function public.fn_auditoria();
drop trigger if exists aud_config_publica on public.config_publica;
create trigger aud_config_publica after insert or update or delete on public.config_publica for each row execute function public.fn_auditoria();

-- Permisos: solo usuarios autenticados (dentro se valida que sea Felipe)
revoke execute on function public.guardar_config_publica(text, text, text, text, text, text) from public, anon;
revoke execute on function public.guardar_banco(smallint, text, boolean)                      from public, anon;
revoke execute on function public.cambiar_perfil(uuid, text, boolean)                          from public, anon;
revoke execute on function public.crear_bingo(text, timestamptz, bigint, text)                 from public, anon;
grant  execute on function public.guardar_config_publica(text, text, text, text, text, text) to authenticated;
grant  execute on function public.guardar_banco(smallint, text, boolean)                      to authenticated;
grant  execute on function public.cambiar_perfil(uuid, text, boolean)                          to authenticated;
grant  execute on function public.crear_bingo(text, timestamptz, bigint, text)                 to authenticated;

-- Verificar: deben salir las 4 funciones nuevas
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('guardar_config_publica', 'guardar_banco', 'cambiar_perfil', 'crear_bingo')
 order by proname;
