-- =====================================================================
-- 004 · Corrige el reinicio de datos
-- Supabase bloquea los UPDATE sin WHERE (error: "UPDATE requires a WHERE clause").
-- El reinicio tenía uno al limpiar los productos agotados/ocultos.
-- Correr UNA vez en Supabase → SQL Editor → Run.
-- =====================================================================

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

  update productos set agotado = false, activo = true where agotado or not activo;

  truncate auditoria restart identity;
  insert into auditoria (tabla, registro_id, accion, usuario)
  values ('sistema', null, case when p_restaurar_menu then 'REINICIO (con menú original)' else 'REINICIO' end, auth.uid());

  perform recalcular_progreso();
end $$;

-- Verificar: debe decir 'agotado or not activo'
select position('where agotado or not activo' in pg_get_functiondef('public.reiniciar_datos(text, boolean)'::regprocedure)) > 0 as corregido;
