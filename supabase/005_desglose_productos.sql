-- =====================================================================
-- 005 · Desglose por producto en los recaudos de banco
-- Cada registro de banco puede decir de qué fue: un producto del menú,
-- tablas de bingo o "general" (sin detalle). Lo ya registrado queda "general".
-- Correr UNA vez en Supabase → SQL Editor → Run.
-- =====================================================================

alter table public.ingresos
  add column if not exists producto_id integer references public.productos(id) on delete set null;
alter table public.ingresos
  add column if not exists concepto text not null default 'general';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ingresos_concepto_check') then
    alter table public.ingresos
      add constraint ingresos_concepto_check check (concepto in ('general', 'producto', 'tablas_bingo'));
  end if;
end $$;

create index if not exists ingresos_producto_idx on public.ingresos (producto_id);

-- Nueva versión de registrar_ingreso con producto y concepto (opcionales:
-- un celular con la versión anterior de la app sigue funcionando).
drop function if exists public.registrar_ingreso(uuid, text, smallint, text, bigint, text, text);

create or replace function public.registrar_ingreso(
  p_client_id    uuid,
  p_tipo         text,
  p_banco_id     smallint,
  p_medio_pago   text,
  p_monto        bigint,
  p_descripcion  text default null,
  p_nota         text default null,
  p_producto_id  integer default null,
  p_concepto     text default 'general'
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_concepto text := coalesce(p_concepto, 'general');
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

  -- El desglose solo aplica a recaudos de banco
  if p_tipo <> 'recaudo_banco' then
    v_concepto := 'general';
  end if;
  if v_concepto not in ('general', 'producto', 'tablas_bingo') then
    raise exception 'Concepto inválido';
  end if;
  if v_concepto = 'producto' and not exists (select 1 from productos where id = p_producto_id) then
    raise exception 'Producto inválido';
  end if;

  insert into ingresos (client_id, tipo, banco_id, medio_pago, monto, descripcion, nota, registrado_por, producto_id, concepto)
  values (
    p_client_id,
    p_tipo,
    case when p_tipo = 'recaudo_banco' then p_banco_id end,
    p_medio_pago,
    p_monto,
    nullif(trim(p_descripcion), ''),
    nullif(trim(p_nota), ''),
    auth.uid(),
    case when v_concepto = 'producto' then p_producto_id end,
    v_concepto
  )
  on conflict (client_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from ingresos where client_id = p_client_id;
  end if;

  return v_id;
end $$;

revoke execute on function public.registrar_ingreso(uuid, text, smallint, text, bigint, text, text, integer, text) from public, anon;
grant  execute on function public.registrar_ingreso(uuid, text, smallint, text, bigint, text, text, integer, text) to authenticated;

-- Verificar: deben salir las dos columnas nuevas
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'ingresos' and column_name in ('producto_id', 'concepto')
 order by column_name;
