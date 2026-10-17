-- =====================================================================
-- Termómetro de Recaudo — San Isidro
-- Parroquia María Estrella de la Nueva Evangelización
--
-- Pegar COMPLETO en Supabase → SQL Editor → Run (proyecto nuevo, una vez).
-- Basado en la sección 6 de termometro-iglesia.md, con estas correcciones:
--   * auditoria.registro_id es text (perfiles usa uuid y rompía el cast a bigint).
--   * registrar_ingreso usa ON CONFLICT para que dos reintentos simultáneos
--     con el mismo client_id no den error.
--   * Permisos (grant/revoke) explícitos, sin depender de los defaults.
-- Después: crear los 4 usuarios y correr supabase/perfiles.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 6.1 Tablas
-- ---------------------------------------------------------------------
create table public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  usuario    text not null unique,
  nombre     text not null,
  rol        text not null check (rol in ('editor', 'registrador')),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table public.bancos (
  id           smallint primary key,
  nombre       text not null,
  responsable  text,
  activo       boolean not null default true
);

-- Solo para el menú de la pantalla (NO suma al termómetro)
create table public.productos (
  id         serial primary key,
  nombre     text not null,
  precio     integer not null check (precio >= 0),
  categoria  text not null default 'comida' check (categoria in ('comida', 'bebida', 'postre', 'otro')),
  emoji      text,
  orden      smallint not null default 0,
  agotado    boolean not null default false,
  activo     boolean not null default true
);

create table public.config_publica (
  id             smallint primary key default 1 check (id = 1),
  titulo         text not null,
  subtitulo      text,
  causa          text not null,
  mensaje_meta   text not null,
  instrucciones  text,
  horario        text,
  logo_url       text
);

create table public.bingos (
  id            smallint primary key,
  nombre        text not null,
  hora          timestamptz,
  premio        bigint check (premio >= 0),
  premio_texto  text,
  valor_carton  integer check (valor_carton >= 0),
  estado        text not null default 'programado' check (estado in ('programado', 'en_juego', 'finalizado')),
  premio_entregado      boolean not null default false,
  premio_entregado_por  uuid references public.perfiles(id),
  premio_entregado_en   timestamptz,
  actualizado_en timestamptz not null default now()
);

create table public.config_privada (
  id    smallint primary key default 1 check (id = 1),
  meta  bigint not null check (meta > 0)
);

create table public.progreso_publico (
  id              smallint primary key default 1 check (id = 1),
  porcentaje      smallint not null default 0 check (porcentaje between 0 and 100),
  meta_alcanzada  boolean not null default false,
  actualizado_en  timestamptz not null default now()
);

create table public.ingresos (
  id                bigserial primary key,
  client_id         uuid not null unique,
  tipo              text not null check (tipo in ('recaudo_banco', 'donacion', 'remate')),
  banco_id          smallint references public.bancos(id),
  medio_pago        text not null check (medio_pago in ('efectivo', 'transferencia')),
  monto             bigint not null check (monto > 0 and monto <= 50000000),
  descripcion       text,
  nota              text,
  registrado_por    uuid not null references public.perfiles(id),
  registrado_en     timestamptz not null default now(),
  anulada           boolean not null default false,
  anulada_por       uuid references public.perfiles(id),
  anulada_en        timestamptz,
  motivo_anulacion  text,
  constraint banco_requerido check (
    (tipo = 'recaudo_banco' and banco_id is not null) or (tipo <> 'recaudo_banco')
  )
);

create table public.auditoria (
  id           bigserial primary key,
  tabla        text not null,
  registro_id  text,
  accion       text not null,
  antes        jsonb,
  despues      jsonb,
  usuario      uuid,
  fecha        timestamptz not null default now()
);

create index on public.ingresos (registrado_en desc);
create index on public.ingresos (banco_id);
create index on public.auditoria (fecha desc);

-- ---------------------------------------------------------------------
-- 6.2 Helpers, progreso y auditoría
-- ---------------------------------------------------------------------
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo);
$$;

create or replace function public.es_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'editor');
$$;

-- El % público se calcula sobre el BRUTO (todo lo que entra), confirmado por la parroquia.
create or replace function public.recalcular_progreso() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total bigint;
  v_meta  bigint;
  v_pct   smallint;
  v_ok    boolean;
begin
  select coalesce(sum(monto), 0) into v_total from ingresos where not anulada;
  select meta into v_meta from config_privada where id = 1;
  if v_meta is null or v_meta <= 0 then
    return;
  end if;

  v_pct := least(100, floor(v_total * 100.0 / v_meta))::smallint;
  v_ok  := v_total >= v_meta;

  update progreso_publico
     set porcentaje = v_pct, meta_alcanzada = v_ok, actualizado_en = now()
   where id = 1 and (porcentaje <> v_pct or meta_alcanzada <> v_ok);
end $$;

create or replace function public.tg_recalcular_progreso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_progreso();
  return null;
end $$;

create trigger trg_ingresos_progreso
  after insert or update or delete on public.ingresos
  for each statement execute function public.tg_recalcular_progreso();

create trigger trg_meta_progreso
  after insert or update on public.config_privada
  for each statement execute function public.tg_recalcular_progreso();

create or replace function public.fn_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabla, registro_id, accion, antes, despues, usuario)
  values (
    tg_table_name,
    coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

create trigger aud_ingresos       after insert or update or delete on public.ingresos       for each row execute function public.fn_auditoria();
create trigger aud_bingos         after insert or update or delete on public.bingos         for each row execute function public.fn_auditoria();
create trigger aud_productos      after insert or update or delete on public.productos      for each row execute function public.fn_auditoria();
create trigger aud_config_privada after insert or update or delete on public.config_privada for each row execute function public.fn_auditoria();
create trigger aud_perfiles       after insert or update or delete on public.perfiles       for each row execute function public.fn_auditoria();

-- ---------------------------------------------------------------------
-- 6.3 Funciones RPC (únicas vías de escritura)
-- ---------------------------------------------------------------------
create or replace function public.registrar_ingreso(
  p_client_id    uuid,
  p_tipo         text,
  p_banco_id     smallint,
  p_medio_pago   text,
  p_monto        bigint,
  p_descripcion  text default null,
  p_nota         text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not es_admin() then
    raise exception 'No autorizado';
  end if;

  select id into v_id from ingresos where client_id = p_client_id;
  if found then
    return v_id;  -- reintento: no duplicar
  end if;

  if p_tipo not in ('recaudo_banco', 'donacion', 'remate') then
    raise exception 'Tipo inválido';
  end if;
  if p_medio_pago not in ('efectivo', 'transferencia') then
    raise exception 'Medio de pago inválido';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto > 50000000 then
    raise exception 'Monto inválido';
  end if;
  if p_tipo = 'recaudo_banco' and not exists (select 1 from bancos where id = p_banco_id and activo) then
    raise exception 'Banco inválido';
  end if;

  insert into ingresos (client_id, tipo, banco_id, medio_pago, monto, descripcion, nota, registrado_por)
  values (
    p_client_id,
    p_tipo,
    case when p_tipo = 'recaudo_banco' then p_banco_id end,
    p_medio_pago,
    p_monto,
    nullif(trim(p_descripcion), ''),
    nullif(trim(p_nota), ''),
    auth.uid()
  )
  on conflict (client_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- otro reintento simultáneo lo insertó primero
    select id into v_id from ingresos where client_id = p_client_id;
  end if;

  return v_id;
end $$;

create or replace function public.anular_ingreso(p_id bigint, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_editor() then
    raise exception 'Solo los editores pueden anular registros';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'El motivo debe tener al menos 5 caracteres';
  end if;

  update ingresos
     set anulada = true, anulada_por = auth.uid(), anulada_en = now(), motivo_anulacion = trim(p_motivo)
   where id = p_id and not anulada;

  if not found then
    raise exception 'El registro no existe o ya estaba anulado';
  end if;
end $$;

create or replace function public.cambiar_estado_bingo(p_bingo_id smallint, p_estado text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'No autorizado';
  end if;
  if p_estado not in ('programado', 'en_juego', 'finalizado') then
    raise exception 'Estado inválido';
  end if;
  if p_estado = 'en_juego' then
    update bingos set estado = 'finalizado', actualizado_en = now()
     where estado = 'en_juego' and id <> p_bingo_id;
  end if;
  update bingos set estado = p_estado, actualizado_en = now() where id = p_bingo_id;
  if not found then
    raise exception 'Bingo no existe';
  end if;
end $$;

create or replace function public.guardar_bingo(
  p_bingo_id smallint, p_nombre text, p_hora timestamptz,
  p_premio bigint, p_premio_texto text, p_valor_carton integer
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'No autorizado';
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Nombre inválido';
  end if;
  update bingos
     set nombre = trim(p_nombre), hora = p_hora, premio = p_premio,
         premio_texto = nullif(trim(p_premio_texto), ''), valor_carton = p_valor_carton,
         actualizado_en = now()
   where id = p_bingo_id;
  if not found then
    raise exception 'Bingo no existe';
  end if;
end $$;

create or replace function public.marcar_premio_entregado(p_bingo_id smallint, p_entregado boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_editor() then
    raise exception 'Solo los editores pueden marcar premios entregados';
  end if;
  update bingos
     set premio_entregado     = p_entregado,
         premio_entregado_por = case when p_entregado then auth.uid() end,
         premio_entregado_en  = case when p_entregado then now() end,
         estado               = case when p_entregado then 'finalizado' else estado end,
         actualizado_en       = now()
   where id = p_bingo_id;
  if not found then
    raise exception 'Bingo no existe';
  end if;
end $$;

create or replace function public.guardar_producto(
  p_id integer, p_nombre text, p_precio integer, p_categoria text, p_emoji text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_id integer;
begin
  if not es_admin() then
    raise exception 'No autorizado';
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Nombre inválido';
  end if;
  if p_precio is null or p_precio <= 0 or p_precio > 200000 then
    raise exception 'Precio inválido';
  end if;
  if p_categoria not in ('comida', 'bebida', 'postre', 'otro') then
    raise exception 'Categoría inválida';
  end if;

  if exists (select 1 from productos
              where lower(nombre) = lower(trim(p_nombre))
                and (p_id is null or id <> p_id)) then
    raise exception 'Ya existe un producto con ese nombre';
  end if;

  if p_id is null then
    insert into productos (nombre, precio, categoria, emoji, orden)
    values (trim(p_nombre), p_precio, p_categoria, nullif(trim(p_emoji), ''),
            coalesce((select max(orden) + 1 from productos where categoria = p_categoria), 50))
    returning id into v_id;
  else
    update productos
       set nombre = trim(p_nombre), precio = p_precio, categoria = p_categoria,
           emoji = coalesce(nullif(trim(p_emoji), ''), emoji)
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Producto no existe';
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.cambiar_disponibilidad_producto(p_id integer, p_agotado boolean, p_activo boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'No autorizado';
  end if;
  update productos set agotado = p_agotado, activo = p_activo where id = p_id;
  if not found then
    raise exception 'Producto no existe';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Zona de pruebas: SOLO el usuario 'felipe' (validado aquí, no en el navegador)
-- ---------------------------------------------------------------------
create or replace function public.es_felipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and usuario = 'felipe');
$$;

-- Cambiar la meta temporalmente (para probar el 100 %, el confeti y el mensaje)
create or replace function public.cambiar_meta(p_meta bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_felipe() then
    raise exception 'Solo Felipe puede cambiar la meta';
  end if;
  if p_meta is null or p_meta < 1000 then
    raise exception 'Meta inválida';
  end if;
  update config_privada set meta = p_meta where id = 1;
end $$;

-- Reinicio completo para después de las pruebas (sección 6.8):
-- borra ingresos y auditoría, bingos a su estado inicial, nada agotado y meta en $50.000.000.
-- p_restaurar_menu = true además deja el menú exactamente como la lista original
-- (elimina productos creados en las pruebas y restaura precios).
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

  perform recalcular_progreso();  -- truncate no dispara los triggers
end $$;

-- ---------------------------------------------------------------------
-- 6.4 Vistas de reporte (respetan RLS)
-- ---------------------------------------------------------------------
create or replace view public.v_resumen_tipo with (security_invoker = true) as
select tipo, medio_pago, count(*) as registros, sum(monto) as total
  from public.ingresos
 where not anulada
 group by tipo, medio_pago;

create or replace view public.v_resumen_banco with (security_invoker = true) as
select b.id as banco_id,
       b.nombre,
       count(i.id)                                                             as recogidas,
       coalesce(sum(i.monto) filter (where i.medio_pago = 'efectivo'), 0)      as efectivo,
       coalesce(sum(i.monto) filter (where i.medio_pago = 'transferencia'), 0) as transferencia,
       coalesce(sum(i.monto), 0)                                               as total,
       max(i.registrado_en)                                                    as ultima_recogida
  from public.bancos b
  left join public.ingresos i on i.banco_id = b.id and not i.anulada
 group by b.id, b.nombre;

create or replace view public.v_balance with (security_invoker = true) as
with t as (
  select (select coalesce(sum(monto), 0) from public.ingresos where not anulada)    as bruto,
         (select coalesce(sum(premio), 0) from public.bingos where premio_entregado) as premios_entregados,
         (select coalesce(sum(premio), 0) from public.bingos)                        as premios_totales,
         (select meta from public.config_privada where id = 1)                       as meta
)
select bruto,
       premios_entregados,
       premios_totales,
       bruto - premios_entregados as neto,
       bruto - premios_totales    as neto_proyectado,
       meta,
       greatest(meta - bruto, 0)  as faltante,
       greatest(bruto - meta, 0)  as excedente
  from t;

-- ---------------------------------------------------------------------
-- 6.5 RLS y permisos
-- ---------------------------------------------------------------------
alter table public.perfiles         enable row level security;
alter table public.bancos           enable row level security;
alter table public.productos        enable row level security;
alter table public.config_publica   enable row level security;
alter table public.config_privada   enable row level security;
alter table public.progreso_publico enable row level security;
alter table public.ingresos         enable row level security;
alter table public.bingos           enable row level security;
alter table public.auditoria        enable row level security;

-- Público
create policy "publico lee progreso" on public.progreso_publico for select to anon, authenticated using (true);
create policy "publico lee config"   on public.config_publica   for select to anon, authenticated using (true);
create policy "publico lee menu"     on public.productos        for select to anon, authenticated using (activo or public.es_admin());
create policy "publico lee bingos"   on public.bingos           for select to anon, authenticated using (true);

-- Solo admins
create policy "admins perfiles"  on public.perfiles       for select to authenticated using (public.es_admin());
create policy "admins bancos"    on public.bancos         for select to authenticated using (public.es_admin());
create policy "admins meta"      on public.config_privada for select to authenticated using (public.es_admin());
create policy "admins ingresos"  on public.ingresos       for select to authenticated using (public.es_admin());
create policy "admins auditoria" on public.auditoria      for select to authenticated using (public.es_admin());

-- Permisos de tabla explícitos: nadie escribe directo, cada rol lee solo lo suyo
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.progreso_publico, public.config_publica, public.productos, public.bingos
  to anon, authenticated;
grant select on public.perfiles, public.bancos, public.config_privada, public.ingresos, public.auditoria,
                public.v_resumen_tipo, public.v_resumen_banco, public.v_balance
  to authenticated;

-- Funciones internas
revoke execute on function public.recalcular_progreso()    from public, anon, authenticated;
revoke execute on function public.tg_recalcular_progreso() from public, anon, authenticated;
revoke execute on function public.fn_auditoria()           from public, anon, authenticated;

-- es_admin / es_editor las usan las políticas RLS, así que deben poder ejecutarse (solo devuelven true/false)
grant execute on function public.es_admin()  to anon, authenticated;
grant execute on function public.es_editor() to anon, authenticated;
grant execute on function public.es_felipe() to authenticated;
revoke execute on function public.es_felipe() from public, anon;

-- Zona de pruebas (dentro se valida que sea felipe)
revoke execute on function public.cambiar_meta(bigint)            from public, anon;
revoke execute on function public.reiniciar_datos(text, boolean)  from public, anon;
grant  execute on function public.cambiar_meta(bigint)            to authenticated;
grant  execute on function public.reiniciar_datos(text, boolean)  to authenticated;

-- RPC: solo autenticados (dentro se valida el rol)
revoke execute on function public.registrar_ingreso(uuid, text, smallint, text, bigint, text, text)    from public, anon;
revoke execute on function public.marcar_premio_entregado(smallint, boolean)                            from public, anon;
revoke execute on function public.anular_ingreso(bigint, text)                                          from public, anon;
revoke execute on function public.cambiar_estado_bingo(smallint, text)                                  from public, anon;
revoke execute on function public.guardar_bingo(smallint, text, timestamptz, bigint, text, integer)     from public, anon;
revoke execute on function public.guardar_producto(integer, text, integer, text, text)                  from public, anon;
revoke execute on function public.cambiar_disponibilidad_producto(integer, boolean, boolean)            from public, anon;
grant  execute on function public.registrar_ingreso(uuid, text, smallint, text, bigint, text, text)    to authenticated;
grant  execute on function public.marcar_premio_entregado(smallint, boolean)                            to authenticated;
grant  execute on function public.anular_ingreso(bigint, text)                                          to authenticated;
grant  execute on function public.cambiar_estado_bingo(smallint, text)                                  to authenticated;
grant  execute on function public.guardar_bingo(smallint, text, timestamptz, bigint, text, integer)     to authenticated;
grant  execute on function public.guardar_producto(integer, text, integer, text, text)                  to authenticated;
grant  execute on function public.cambiar_disponibilidad_producto(integer, boolean, boolean)            to authenticated;

-- ---------------------------------------------------------------------
-- 6.6 Realtime
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.progreso_publico;
alter publication supabase_realtime add table public.ingresos;
alter publication supabase_realtime add table public.bingos;
alter publication supabase_realtime add table public.productos;
alter publication supabase_realtime add table public.config_publica;

-- ---------------------------------------------------------------------
-- 6.7 Datos iniciales
-- ---------------------------------------------------------------------
insert into public.progreso_publico default values;
insert into public.config_privada (meta) values (50000000);

insert into public.config_publica (titulo, subtitulo, causa, mensaje_meta, instrucciones, horario, logo_url) values (
  'San Isidro',
  'Parroquia María Estrella de la Nueva Evangelización',
  'Para terminar de construir y reparar la parroquia',
  'Gracias por todo su apoyo',
  'Fichas y tablas de bingo en los Bancos 1, 2 y 3',
  '8:00 a.m. – 8:00 p.m.',
  '/logo.jpg'
);

insert into public.bingos (id, nombre, hora, premio) values
  (1, 'Bingo 1',    null,                     100000),
  (2, 'Bingo 2',    null,                     200000),
  (3, 'Bingo 3',    null,                     300000),
  (4, 'Gran Bingo', '2026-10-18 19:00:00-05', 1000000);

insert into public.bancos (id, nombre) values
  (1, 'Banco 1'),
  (2, 'Banco 2'),
  (3, 'Banco 3'),
  (4, 'Almacén');

insert into public.productos (nombre, precio, categoria, emoji, orden) values
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

-- Los postres se cargan en vivo desde /admin/productos.

-- Deja la auditoría limpia tras la carga inicial
truncate public.auditoria restart identity;
select public.recalcular_progreso();
