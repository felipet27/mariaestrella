-- =====================================================================
-- 007 · Gastos
-- * Tabla de gastos: premios, insumos, transporte u otros, indicando de qué
--   plata salió (un punto/banco, donaciones, remates o varios).
-- * Solo los EDITORES registran y anulan gastos.
-- * Los premios de bingo entregados se vuelven un gasto (categoría Premios).
-- * El termómetro y el neto ahora son: ingresos − gastos ("lo que se tiene").
-- Correr UNA vez en Supabase → SQL Editor → Run (después de 006).
-- =====================================================================

create table if not exists public.gastos (
  id                bigserial primary key,
  client_id         uuid not null unique,                       -- idempotencia (reintentos sin duplicar)
  categoria         text not null check (categoria in ('premios', 'insumos', 'transporte', 'otros')),
  origen            text not null check (origen in ('banco', 'donacion', 'remate', 'general')),
  banco_id          smallint references public.bancos(id),
  medio_pago        text not null default 'efectivo' check (medio_pago in ('efectivo', 'transferencia')),
  monto             bigint not null check (monto > 0 and monto <= 50000000),
  descripcion       text not null,
  bingo_id          smallint references public.bingos(id) on delete set null,
  registrado_por    uuid not null references public.perfiles(id),
  registrado_en     timestamptz not null default now(),
  anulado           boolean not null default false,
  anulado_por       uuid references public.perfiles(id),
  anulado_en        timestamptz,
  motivo_anulacion  text,
  constraint gasto_banco_requerido check ((origen = 'banco') = (banco_id is not null))
);

create index if not exists gastos_fecha_idx on public.gastos (registrado_en desc);
create index if not exists gastos_banco_idx on public.gastos (banco_id);

alter table public.gastos enable row level security;
drop policy if exists "admins gastos" on public.gastos;
create policy "admins gastos" on public.gastos for select to authenticated using (public.es_admin());
revoke all on public.gastos from anon, authenticated;
grant select on public.gastos to authenticated;
revoke all on sequence public.gastos_id_seq from anon, authenticated;

drop trigger if exists aud_gastos on public.gastos;
create trigger aud_gastos after insert or update or delete on public.gastos for each row execute function public.fn_auditoria();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'gastos') then
    alter publication supabase_realtime add table public.gastos;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Termómetro sobre lo que se tiene: ingresos − gastos (nunca menos de 0)
-- ---------------------------------------------------------------------
create or replace function public.recalcular_progreso() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total bigint;
  v_meta  bigint;
  v_pct   smallint;
  v_ok    boolean;
begin
  select coalesce((select sum(monto) from ingresos where not anulada), 0)
       - coalesce((select sum(monto) from gastos where not anulado), 0)
    into v_total;
  v_total := greatest(v_total, 0);
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
revoke execute on function public.recalcular_progreso() from public, anon, authenticated;

drop trigger if exists trg_gastos_progreso on public.gastos;
create trigger trg_gastos_progreso
  after insert or update or delete on public.gastos
  for each statement execute function public.tg_recalcular_progreso();

-- ---------------------------------------------------------------------
-- Registrar y anular gastos (solo editores)
-- ---------------------------------------------------------------------
create or replace function public.registrar_gasto(
  p_client_id   uuid,
  p_categoria   text,
  p_origen      text,
  p_banco_id    smallint,
  p_monto       bigint,
  p_descripcion text,
  p_medio_pago  text default 'efectivo'
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not es_editor() then
    raise exception 'Solo los editores pueden registrar gastos';
  end if;

  select id into v_id from gastos where client_id = p_client_id;
  if found then
    return v_id;  -- reintento: no duplicar
  end if;

  if p_categoria not in ('premios', 'insumos', 'transporte', 'otros') then
    raise exception 'Categoría inválida';
  end if;
  if p_origen not in ('banco', 'donacion', 'remate', 'general') then
    raise exception 'Origen inválido';
  end if;
  if p_origen = 'banco' and not exists (select 1 from bancos where id = p_banco_id) then
    raise exception 'Elija de qué punto salió la plata';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto > 50000000 then
    raise exception 'Monto inválido';
  end if;
  if length(trim(coalesce(p_descripcion, ''))) < 3 then
    raise exception 'Escriba en qué se gastó (mínimo 3 letras)';
  end if;
  if coalesce(p_medio_pago, 'efectivo') not in ('efectivo', 'transferencia') then
    raise exception 'Medio de pago inválido';
  end if;

  insert into gastos (client_id, categoria, origen, banco_id, medio_pago, monto, descripcion, registrado_por)
  values (
    p_client_id, p_categoria, p_origen,
    case when p_origen = 'banco' then p_banco_id end,
    coalesce(p_medio_pago, 'efectivo'), p_monto, trim(p_descripcion), auth.uid()
  )
  on conflict (client_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from gastos where client_id = p_client_id;
  end if;
  return v_id;
end $$;

create or replace function public.anular_gasto(p_id bigint, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_editor() then
    raise exception 'Solo los editores pueden anular gastos';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'El motivo debe tener al menos 5 caracteres';
  end if;
  update gastos
     set anulado = true, anulado_por = auth.uid(), anulado_en = now(), motivo_anulacion = trim(p_motivo)
   where id = p_id and not anulado;
  if not found then
    raise exception 'El gasto no existe o ya estaba anulado';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Premio entregado = gasto de categoría Premios (se anula solo al desmarcar)
-- ---------------------------------------------------------------------
drop function if exists public.marcar_premio_entregado(smallint, boolean);

create or replace function public.marcar_premio_entregado(
  p_bingo_id  smallint,
  p_entregado boolean,
  p_origen    text default 'general',
  p_banco_id  smallint default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_bingo bingos%rowtype;
  v_origen text := coalesce(p_origen, 'general');
begin
  if not es_editor() then
    raise exception 'Solo los editores pueden marcar premios entregados';
  end if;
  select * into v_bingo from bingos where id = p_bingo_id;
  if not found then
    raise exception 'Bingo no existe';
  end if;

  if p_entregado then
    if v_origen not in ('banco', 'donacion', 'remate', 'general') then
      raise exception 'Origen inválido';
    end if;
    if v_origen = 'banco' and not exists (select 1 from bancos where id = p_banco_id) then
      raise exception 'Elija de qué punto salió la plata del premio';
    end if;
    -- Un solo gasto activo por premio
    if coalesce(v_bingo.premio, 0) > 0
       and not exists (select 1 from gastos where bingo_id = p_bingo_id and not anulado) then
      insert into gastos (client_id, categoria, origen, banco_id, medio_pago, monto, descripcion, bingo_id, registrado_por)
      values (gen_random_uuid(), 'premios', v_origen, case when v_origen = 'banco' then p_banco_id end,
              'efectivo', v_bingo.premio, 'Premio del ' || v_bingo.nombre, p_bingo_id, auth.uid());
    end if;
  else
    update gastos
       set anulado = true, anulado_por = auth.uid(), anulado_en = now(),
           motivo_anulacion = 'Se desmarcó el premio entregado'
     where bingo_id = p_bingo_id and not anulado;
  end if;

  update bingos
     set premio_entregado     = p_entregado,
         premio_entregado_por = case when p_entregado then auth.uid() end,
         premio_entregado_en  = case when p_entregado then now() end,
         estado               = case when p_entregado then 'finalizado' else estado end,
         actualizado_en       = now()
   where id = p_bingo_id;
end $$;

-- Premios ya marcados antes de este cambio: se pasan a gastos ("varios")
insert into public.gastos (client_id, categoria, origen, banco_id, medio_pago, monto, descripcion, bingo_id, registrado_por, registrado_en)
select gen_random_uuid(), 'premios', 'general', null, 'efectivo', b.premio, 'Premio del ' || b.nombre, b.id,
       coalesce(b.premio_entregado_por, (select id from public.perfiles where usuario = 'felipe')),
       coalesce(b.premio_entregado_en, now())
  from public.bingos b
 where b.premio_entregado and coalesce(b.premio, 0) > 0
   and not exists (select 1 from public.gastos g where g.bingo_id = b.id and not g.anulado);

-- ---------------------------------------------------------------------
-- Balance: neto = ingresos − gastos
-- ---------------------------------------------------------------------
drop view if exists public.v_balance;
create view public.v_balance with (security_invoker = true) as
with t as (
  select (select coalesce(sum(monto), 0) from public.ingresos where not anulada)                          as bruto,
         (select coalesce(sum(monto), 0) from public.gastos where not anulado)                            as gastos,
         (select coalesce(sum(monto), 0) from public.gastos where not anulado and categoria = 'premios')  as premios_entregados,
         (select coalesce(sum(premio), 0) from public.bingos)                                              as premios_totales,
         (select coalesce(sum(premio), 0) from public.bingos where not premio_entregado)                   as premios_pendientes,
         (select meta from public.config_privada where id = 1)                                             as meta
)
select bruto,
       premios_entregados,
       premios_totales,
       bruto - gastos                                   as neto,
       bruto - gastos - premios_pendientes              as neto_proyectado,
       meta,
       greatest(meta - (bruto - gastos), 0)             as faltante,
       greatest((bruto - gastos) - meta, 0)             as excedente,
       gastos
  from t;
revoke all on public.v_balance from anon;
grant select on public.v_balance to authenticated;

-- Permisos de las funciones nuevas
revoke execute on function public.registrar_gasto(uuid, text, text, smallint, bigint, text, text) from public, anon;
revoke execute on function public.anular_gasto(bigint, text) from public, anon;
revoke execute on function public.marcar_premio_entregado(smallint, boolean, text, smallint) from public, anon;
grant  execute on function public.registrar_gasto(uuid, text, text, smallint, bigint, text, text) to authenticated;
grant  execute on function public.anular_gasto(bigint, text) to authenticated;
grant  execute on function public.marcar_premio_entregado(smallint, boolean, text, smallint) to authenticated;

-- ---------------------------------------------------------------------
-- Reinicio: también borra los gastos de prueba (conserva los de Banco general)
-- ---------------------------------------------------------------------
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
    delete from gastos where id > 0 and not (origen = 'banco' and banco_id = v_general);
  else
    truncate ingresos restart identity;
    truncate gastos restart identity;
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
       and not (tabla = 'ingresos' and registro_id in (select id::text from ingresos))
       and not (tabla = 'gastos' and registro_id in (select id::text from gastos));
  else
    truncate auditoria restart identity;
  end if;
  insert into auditoria (tabla, registro_id, accion, usuario)
  values ('sistema', null, case when p_restaurar_menu then 'REINICIO (con menú original)' else 'REINICIO' end, auth.uid());

  perform recalcular_progreso();
end $$;

revoke execute on function public.reiniciar_datos(text, boolean, boolean) from public, anon;
grant  execute on function public.reiniciar_datos(text, boolean, boolean) to authenticated;

select public.recalcular_progreso();

-- Verificar: debe mostrar el balance con la columna gastos
select bruto, gastos, neto from public.v_balance;
