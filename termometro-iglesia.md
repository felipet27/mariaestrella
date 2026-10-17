# Termómetro de Recaudo — San Isidro · Parroquia María Estrella de la Nueva Evangelización

> Evento: **domingo 18 de octubre de 2026, de 8:00 a.m. a 8:00 p.m.** La iglesia tiene internet.
> Documento de especificación e implementación, pensado para construirse con Claude en VS Code siguiendo las fases de la sección 13.
> Marcadores: `[PENDIENTE]` = dato que falta · `[SUPUESTO]` = decisión por defecto, cambiar si no aplica.

---

## 1. Cómo funciona el evento (modelo de negocio)

```
Persona ──$ real (efectivo / transferencia)──▶ BANCO (1, 2 o 3) ──fichas──▶ Persona ──fichas──▶ Puestos de comida
                                                     │
                                     Admin recoge el dinero real del banco
                                                     ▼
                                     Admin registra el recaudo en la app ──▶ 🌡️ sube el termómetro

Donaciones sueltas y remates (subastas) ──▶ Admin registra directo (sin banco) ──▶ 🌡️ sube el termómetro

Persona ──$ real──▶ ALMACÉN (precios propios) ──▶ Admin recoge y registra "Almacén" ──▶ 🌡️ sube el termómetro

Tablas de bingo ──▶ se pagan en el BANCO (entran en el recaudo del banco, no se registran aparte)
Premios de bingo ──▶ salen del dinero recaudado ──▶ solo los ve el admin (bruto − premios = neto)
```

- Los **bancos** son puntos de cambio: reciben dinero real y entregan fichas (dinero ficticio).
- El **Almacén** es un punto de venta propio: tiene muchos productos y sus precios los manejan allá mismo, así que **la app no los lista**. Funciona como un banco más: el admin va, recoge el dinero real y registra el recaudo con el punto "Almacén".
- Los **puestos de comida** solo reciben fichas. **La app no registra ventas de productos.** El dinero ya se contó al entrar por el banco; contarlo otra vez lo duplicaría.
- Los **administradores** van a los bancos en cualquier momento del día, recogen el dinero real y lo registran. Ese registro sube el termómetro.
- Las **donaciones** y los **remates** se registran directamente y suman a la meta sin pasar por un banco. De los remates solo se registra cuánto entró, sin descripción.
- **Premios de bingo:** salen de la plata recaudada. El termómetro público mide el **recaudo bruto** (todo lo que entra) contra la meta. El admin ve además los premios entregados y el **neto real**. Ejemplo: entran $57.000.000 → el público ve 100 %; el admin ve bruto $57.000.000 − premios $1.600.000 = **neto $55.400.000**.
- `[SUPUESTO]` El porcentaje público se calcula sobre el bruto, como en el ejemplo de la parroquia. Si prefieren que el termómetro muestre el neto (descontando premios entregados), es un cambio de una línea en `recalcular_progreso()`.
- **No hay límite de fichas**, así que no se cuadra por fichas. El control antirrobo es la auditoría: quién recogió cuánto, de qué banco y a qué hora.
- **Bingos:** hay 4. Los tres primeros no tienen hora fija (premios de **$100.000**, **$200.000** y **$300.000**). El **Gran Bingo** es a las **7:00 p.m.** con premio de **$1.000.000**. Total en premios: **$1.600.000**. Las tablas se pagan en los bancos, así que ese dinero ya entra en el recaudo de cada banco.
- La lista de **productos y precios** solo se usa para mostrar el menú en la pantalla proyectada.

**Meta:** **$50.000.000 COP**. Vive solo en la base de datos y **nunca llega al navegador del público**.

---

## 2. Objetivo de la app

- **Público** (`/`): ve un termómetro que sube en tiempo real, **solo en porcentaje**, junto con el nombre del evento y la causa. Nunca ve montos.
- **Pantalla de proyección** (`/pantalla`): termómetro grande, causa, **bingos del día (premios y cuenta regresiva al Gran Bingo)**, menú de productos con precios e indicación de dónde cambiar fichas y tablas.
- **Panel admin**: recaudo bruto, premios entregados y **neto real**, aunque la meta ya se haya superado.
- **4 administradores**: registran desde el celular los recaudos de los bancos, las donaciones y los remates.
- **3 de los 4 (editores)**: además pueden anular registros equivocados.
- **Productos en vivo**: cualquier admin puede agregar un producto nuevo (ej. Galletas $2.000), cambiar un precio o marcar algo como **AGOTADO** desde el celular, y la pantalla se actualiza al instante.
- **Auditoría completa**: quién registró qué, cuándo, de qué banco y qué se anuló.
- **Al llegar a la meta**: el termómetro se queda en 100 %, lanza confeti y muestra "Gracias por todo su apoyo". Se puede seguir registrando y el total interno sigue sumando.

---

## 3. Principios de seguridad (no negociables)

1. **El público nunca recibe montos recaudados por la red.** No basta con ocultarlos en el HTML. El rol `anon` solo lee `progreso_publico` (porcentaje **entero** 0–100 y `meta_alcanzada`), `config_publica` (textos), `productos` (menú) y `bingos` (horarios y premios, que son públicos por naturaleza).
2. **La meta no va en variables de entorno del frontend** (`VITE_*` es público). Vive en `config_privada`, que solo leen los admins.
3. **RLS activado en todas las tablas.**
4. **Escrituras solo por funciones RPC** (`registrar_ingreso`, `anular_ingreso`, `cambiar_estado_bingo`, `guardar_bingo`, `marcar_premio_entregado`, `guardar_producto`, `cambiar_disponibilidad_producto`) que validan el rol. Ningún `insert`, `update` ni `delete` directo desde el cliente.
5. **No se borra nada.** Corregir = anular con motivo + registrar de nuevo. Queda rastro completo.
6. **Idempotencia.** Cada registro lleva un `client_id` (UUID generado en el celular). Si la señal falla y se reintenta, no se duplica.
7. **Confirmación anti-ceros.** Antes de guardar se muestra el monto en grande ("¿Registrar **$300.000** del Banco 2?"). Montos mayores a $5.000.000 exigen doble confirmación. Es el error más probable del día: $300.000 vs $3.000.000.
8. **Las contraseñas no van en este documento ni en el repositorio.** Se escriben solo en el dashboard de Supabase.
9. **`service_role` key jamás** en el frontend ni en Vercel.

---

## 4. Stack y arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind CSS + React Router |
| Backend | Supabase: Postgres + Auth + Realtime |
| Tiempo real | `postgres_changes` sobre `progreso_publico` + polling de respaldo cada 15 s |
| Hosting | Vercel (deploy desde GitHub) |
| Extras | `canvas-confetti`, `qrcode.react` |

```
[Celulares admins] ──RPC autenticado──▶ [Postgres] ──trigger──▶ progreso_publico (solo %)
                                            │                          │
                                    Realtime (RLS admins)        Realtime (anon)
                                            ▼                          ▼
                                    [Panel admin]           [Público / Pantalla]
```

---

## 5. Roles y acceso

| Rol | Cuántos | Puede |
|---|---|---|
| Público (`anon`) | Cualquiera | Ver termómetro (%), textos y menú |
| `registrador` | 1 | Registrar recaudos, donaciones y remates; manejar bingos (iniciar/finalizar) y productos (nuevos, precios, agotados); ver totales, historial, auditoría y reportes |
| `editor` | 3 | Todo lo anterior + anular registros + marcar premios de bingo como entregados |

| Usuario | Nombre | Rol |
|---|---|---|
| `angela` | Angela | `editor` |
| `johana` | Johana | `editor` |
| `felipe` | Felipe | `editor` |
| `invitado` | Invitado | `registrador` |

`[SUPUESTO]` `invitado` es el que **no** puede anular.

### Login con usuario y contraseña (sin correo)

Supabase Auth necesita un correo, así que se usa un **correo interno ficticio** que el usuario nunca ve:

- El admin escribe `usuario` + `contraseña` (ej. `felipe` / `********`).
- El frontend lo convierte a `felipe@sanisidro.test` y llama `signInWithPassword`.
- Los usuarios se crean a mano en el dashboard con "Auto Confirm User". Nunca se envía ningún correo.
- Registro público **deshabilitado**.

```ts
const toEmail = (usuario: string) => `${usuario.trim().toLowerCase()}@sanisidro.test`;
```

> Si el dashboard rechazara el dominio `.test`, usar cualquier otro dominio ficticio: no se envían correos, así que no importa que no exista.

---

## 6. Modelo de datos (Supabase / Postgres)

Ejecutar en **SQL Editor**, en orden (6.1 → 6.7).

### 6.1 Tablas

```sql
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
  agotado    boolean not null default false,   -- se muestra tachado con "AGOTADO"
  activo     boolean not null default true     -- false = no aparece en el menú
);

create table public.config_publica (
  id             smallint primary key default 1 check (id = 1),
  titulo         text not null,
  subtitulo      text,
  causa          text not null,
  mensaje_meta   text not null,
  instrucciones  text,          -- ej. "Cambie sus fichas en los Bancos 1, 2 y 3"
  horario        text,          -- ej. "8:00 a.m. – 8:00 p.m."
  logo_url       text
);

-- Bingos del día (públicos: hora y premio)
create table public.bingos (
  id            smallint primary key,
  nombre        text not null,                 -- ej. "Gran Bingo"
  hora          timestamptz,                   -- null = sin hora fija ("Durante el día")
  premio        bigint check (premio >= 0),
  premio_texto  text,                          -- ej. "Mercado completo" si el premio no es dinero
  valor_carton  integer check (valor_carton >= 0),
  estado        text not null default 'programado' check (estado in ('programado', 'en_juego', 'finalizado')),
  premio_entregado      boolean not null default false,   -- egreso: descuenta del neto (solo admin)
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

-- Todo el dinero real que entra
create table public.ingresos (
  id                bigserial primary key,
  client_id         uuid not null unique,                         -- idempotencia
  tipo              text not null check (tipo in ('recaudo_banco', 'donacion', 'remate')),
  banco_id          smallint references public.bancos(id),
  medio_pago        text not null check (medio_pago in ('efectivo', 'transferencia')),
  monto             bigint not null check (monto > 0 and monto <= 50000000),
  descripcion       text,                                         -- opcional
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
  registro_id  bigint,
  accion       text not null,
  antes        jsonb,
  despues      jsonb,
  usuario      uuid,
  fecha        timestamptz not null default now()
);

create index on public.ingresos (registrado_en desc);
create index on public.ingresos (banco_id);
create index on public.auditoria (fecha desc);
```

### 6.2 Helpers, progreso y auditoría

```sql
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo);
$$;

create or replace function public.es_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'editor');
$$;

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
  after insert or update on public.ingresos
  for each statement execute function public.tg_recalcular_progreso();

create trigger trg_meta_progreso
  after update on public.config_privada
  for each statement execute function public.tg_recalcular_progreso();

create or replace function public.fn_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabla, registro_id, accion, antes, despues, usuario)
  values (
    tg_table_name,
    coalesce((to_jsonb(new)->>'id')::bigint, (to_jsonb(old)->>'id')::bigint),
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

create trigger aud_ingresos       after insert or update or delete on public.ingresos           for each row execute function public.fn_auditoria();
create trigger aud_bingos         after insert or update or delete on public.bingos             for each row execute function public.fn_auditoria();
create trigger aud_productos      after insert or update or delete on public.productos          for each row execute function public.fn_auditoria();
create trigger aud_config_privada after insert or update or delete on public.config_privada     for each row execute function public.fn_auditoria();
create trigger aud_perfiles       after insert or update or delete on public.perfiles           for each row execute function public.fn_auditoria();
```

### 6.3 Funciones RPC (únicas vías de escritura)

```sql
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
  returning id into v_id;

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

-- Cambiar estado de un bingo: programado → en_juego → finalizado (cualquier admin)
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
  -- Solo un bingo en juego a la vez
  if p_estado = 'en_juego' then
    update bingos set estado = 'finalizado', actualizado_en = now()
     where estado = 'en_juego' and id <> p_bingo_id;
  end if;
  update bingos set estado = p_estado, actualizado_en = now() where id = p_bingo_id;
  if not found then
    raise exception 'Bingo no existe';
  end if;
end $$;

-- Editar datos de un bingo (hora, premio) desde el panel
create or replace function public.guardar_bingo(
  p_bingo_id smallint, p_nombre text, p_hora timestamptz,
  p_premio bigint, p_premio_texto text, p_valor_carton integer
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'No autorizado';
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

-- Marcar (o desmarcar, si fue un error) el premio de un bingo como entregado. Solo editores.
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

-- Crear (p_id null) o editar un producto (cualquier admin; queda auditado)
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

  if p_id is null then
    if exists (select 1 from productos where lower(nombre) = lower(trim(p_nombre))) then
      raise exception 'Ya existe un producto con ese nombre';
    end if;
    insert into productos (nombre, precio, categoria, emoji, orden)
    values (trim(p_nombre), p_precio, p_categoria, p_emoji,
            coalesce((select max(orden) + 1 from productos where categoria = p_categoria), 50))
    returning id into v_id;
  else
    update productos
       set nombre = trim(p_nombre), precio = p_precio, categoria = p_categoria,
           emoji = coalesce(p_emoji, emoji)
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Producto no existe';
    end if;
  end if;
  return v_id;
end $$;

-- Marcar agotado / disponible, u ocultar del menú (cualquier admin)
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
```

### 6.4 Vistas de reporte (respetan RLS)

```sql
create or replace view public.v_resumen_tipo with (security_invoker = true) as
select tipo, medio_pago, count(*) as registros, sum(monto) as total
  from public.ingresos
 where not anulada
 group by tipo, medio_pago;

create or replace view public.v_resumen_banco with (security_invoker = true) as
select b.id as banco_id,
       b.nombre,
       count(i.id)                                                      as recogidas,
       coalesce(sum(i.monto) filter (where i.medio_pago = 'efectivo'), 0)      as efectivo,
       coalesce(sum(i.monto) filter (where i.medio_pago = 'transferencia'), 0) as transferencia,
       coalesce(sum(i.monto), 0)                                        as total,
       max(i.registrado_en)                                             as ultima_recogida
  from public.bancos b
  left join public.ingresos i on i.banco_id = b.id and not i.anulada
 group by b.id, b.nombre;

-- Balance para el panel admin: bruto, premios y neto
create or replace view public.v_balance with (security_invoker = true) as
with t as (
  select (select coalesce(sum(monto), 0) from public.ingresos where not anulada)       as bruto,
         (select coalesce(sum(premio), 0) from public.bingos where premio_entregado)    as premios_entregados,
         (select coalesce(sum(premio), 0) from public.bingos)                           as premios_totales,
         (select meta from public.config_privada where id = 1)                          as meta
)
select bruto,
       premios_entregados,
       premios_totales,
       bruto - premios_entregados                 as neto,
       bruto - premios_totales                    as neto_proyectado,  -- si se entregan todos los premios
       meta,
       greatest(meta - bruto, 0)                  as faltante,
       greatest(bruto - meta, 0)                  as excedente
  from t;
```

> `ultima_recogida` sirve de control: si un banco lleva mucho tiempo sin que nadie recoja, acumula efectivo y es más riesgoso. El panel admin lo resalta cuando pasa de 1 hora.

### 6.5 RLS y permisos

```sql
alter table public.perfiles            enable row level security;
alter table public.bancos              enable row level security;
alter table public.productos           enable row level security;
alter table public.config_publica      enable row level security;
alter table public.config_privada      enable row level security;
alter table public.progreso_publico    enable row level security;
alter table public.ingresos            enable row level security;
alter table public.bingos              enable row level security;
alter table public.auditoria           enable row level security;

-- Público
create policy "publico lee progreso" on public.progreso_publico for select to anon, authenticated using (true);
create policy "publico lee config"   on public.config_publica   for select to anon, authenticated using (true);
create policy "publico lee menu"     on public.productos        for select to anon, authenticated using (activo or public.es_admin());
create policy "publico lee bingos"   on public.bingos           for select to anon, authenticated using (true);

-- Solo admins
create policy "admins perfiles"  on public.perfiles           for select to authenticated using (public.es_admin());
create policy "admins bancos"    on public.bancos             for select to authenticated using (public.es_admin());
create policy "admins meta"      on public.config_privada     for select to authenticated using (public.es_admin());
create policy "admins ingresos"  on public.ingresos           for select to authenticated using (public.es_admin());
create policy "admins auditoria" on public.auditoria          for select to authenticated using (public.es_admin());

-- Nadie escribe directo
revoke insert, update, delete on all tables in schema public from anon, authenticated;

-- Funciones internas
revoke execute on function public.recalcular_progreso()    from public, anon, authenticated;
revoke execute on function public.tg_recalcular_progreso() from public, anon, authenticated;
revoke execute on function public.fn_auditoria()           from public, anon, authenticated;

-- RPC: solo autenticados (dentro se valida el rol)
revoke execute on function public.registrar_ingreso(uuid, text, smallint, text, bigint, text, text)          from public, anon;
revoke execute on function public.marcar_premio_entregado(smallint, boolean)                                  from public, anon;
revoke execute on function public.anular_ingreso(bigint, text)                                                from public, anon;
revoke execute on function public.cambiar_estado_bingo(smallint, text)                                        from public, anon;
revoke execute on function public.guardar_bingo(smallint, text, timestamptz, bigint, text, integer)           from public, anon;
revoke execute on function public.guardar_producto(integer, text, integer, text, text)                        from public, anon;
revoke execute on function public.cambiar_disponibilidad_producto(integer, boolean, boolean)                  from public, anon;
grant  execute on function public.registrar_ingreso(uuid, text, smallint, text, bigint, text, text)          to authenticated;
grant  execute on function public.marcar_premio_entregado(smallint, boolean)                                  to authenticated;
grant  execute on function public.anular_ingreso(bigint, text)                                                to authenticated;
grant  execute on function public.cambiar_estado_bingo(smallint, text)                                        to authenticated;
grant  execute on function public.guardar_bingo(smallint, text, timestamptz, bigint, text, integer)           to authenticated;
grant  execute on function public.guardar_producto(integer, text, integer, text, text)                        to authenticated;
grant  execute on function public.cambiar_disponibilidad_producto(integer, boolean, boolean)                  to authenticated;
```

### 6.6 Realtime

```sql
alter publication supabase_realtime add table public.progreso_publico;
alter publication supabase_realtime add table public.ingresos;
alter publication supabase_realtime add table public.bingos;
alter publication supabase_realtime add table public.productos;
```

Realtime respeta RLS: el público solo recibe cambios de `progreso_publico`, `bingos` y `productos` (así un "agotado" o un producto nuevo aparece en la pantalla al instante). **Verificarlo en las pruebas (sección 10).**

### 6.7 Datos iniciales

```sql
insert into public.config_privada (meta) values (50000000);
insert into public.progreso_publico default values;

insert into public.config_publica (titulo, subtitulo, causa, mensaje_meta, instrucciones, horario, logo_url) values (
  'San Isidro',
  'Parroquia María Estrella de la Nueva Evangelización',
  'Para terminar de construir y reparar la parroquia',
  'Gracias por todo su apoyo',
  'Fichas y tablas de bingo en los Bancos 1, 2 y 3',
  '8:00 a.m. – 8:00 p.m.',
  '/logo.png'
);

-- Bingos: los 3 primeros sin hora fija; el Gran Bingo a las 7:00 p.m.
insert into public.bingos (id, nombre, hora, premio) values
  (1, 'Bingo 1',    null,                     100000),
  (2, 'Bingo 2',    null,                     200000),
  (3, 'Bingo 3',    null,                     300000),
  (4, 'Gran Bingo', '2026-10-18 19:00:00-05', 1000000);

insert into public.bancos (id, nombre) values
  (1, 'Banco 1'),
  (2, 'Banco 2'),
  (3, 'Banco 3'),
  (4, 'Almacén');   -- punto de venta con precios propios; se recoge igual que un banco

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
  ('Cerveza michelada',       6000, 'bebida', '🍺', 25);

insert into public.productos (nombre, precio, categoria, emoji, orden) values
  ('Crispetas', 1000, 'postre', '🍿', 30);

-- [PENDIENTE] Postres (son varios, con precios distintos): se agregan desde /admin/productos
-- el mismo día, o aquí cuando llegue la lista:
-- insert into public.productos (nombre, precio, categoria, emoji, orden) values
--   ('[Postre 1]', XXXX, 'postre', '🍰', 31);
```

**Usuarios admins:**
1. Authentication → Providers → Email: desactivar "Allow new users to sign up".
2. Authentication → Users → *Add user* (× 4), con **Auto Confirm User**:
   - `angela@sanisidro.test`
   - `johana@sanisidro.test`
   - `felipe@sanisidro.test`
   - `invitado@sanisidro.test`

   Las contraseñas se escriben **solo ahí**: no van en este documento, en el código ni en el repositorio.
3. Registrar los perfiles (los UUID salen de la lista de usuarios en el dashboard):

```sql
insert into public.perfiles (id, usuario, nombre, rol) values
  ('[UUID-angela]',   'angela',   'Angela',   'editor'),
  ('[UUID-johana]',   'johana',   'Johana',   'editor'),
  ('[UUID-felipe]',   'felipe',   'Felipe',   'editor'),
  ('[UUID-invitado]', 'invitado', 'Invitado', 'registrador');
```

### 6.8 Reinicio antes del evento (después de las pruebas)

```sql
truncate public.ingresos, public.auditoria restart identity cascade;
update public.bingos set estado = 'programado', premio_entregado = false,
                         premio_entregado_por = null, premio_entregado_en = null, actualizado_en = now();
update public.productos set agotado = false;
truncate public.auditoria restart identity;  -- limpia lo que dejaron los dos update anteriores
select public.recalcular_progreso();  -- truncate no dispara los triggers
```

---

## 7. Pantallas

### 7.1 `/` — Público (móvil)
- Logo, "San Isidro", nombre de la parroquia y la causa.
- Termómetro con el **porcentaje entero** en grande y marcas en 25 / 50 / 75 / 100 %.
- Al llegar a la meta: confeti (solo en la transición) + "Gracias por todo su apoyo".
- Sin montos de ningún tipo.

### 7.2 `/pantalla` — Proyección (1920×1080, sin login)
- **Izquierda (~40 %):** logo, título, termómetro grande y porcentaje (≥ 180 px).
- **Derecha arriba — Bingos:** fila de 4 tarjetas con el premio en grande ($100.000 · $200.000 · $300.000 · **$1.000.000**). Los que no tienen hora dicen "Durante el día". El **Gran Bingo** es la tarjeta más destacada (dorada, más grande) con "7:00 p.m." y cuenta regresiva ("Faltan 2 h 15 min"). Los finalizados se ven atenuados con "Finalizado". Si hay uno `en_juego`, aparece un banner grande animado: "¡BINGO EN JUEGO! Premio $300.000".
- Los premios **sí** se muestran al público (atraen a la gente); lo que nunca se muestra es cuánto se ha recaudado.
- **Derecha abajo — Menú:** tarjeta crema en dos columnas (Comidas | Bebidas y Postres), con líneas punteadas entre el nombre y el precio, al estilo de la lista impresa. Los productos **agotados** se muestran tachados y atenuados con una etiqueta roja "AGOTADO" (no se ocultan, así la gente no pregunta). Si el menú crece con productos nuevos, la fuente se ajusta para que siempre quepa completo.
- **Esquina superior:** horario del evento (8:00 a.m. – 8:00 p.m.).
- **Franja inferior:** causa + "Fichas y tablas de bingo en los Bancos 1, 2 y 3" + QR a `/`.
- Todo cabe en pantalla, sin scroll. Botón discreto de pantalla completa. Cursor oculto tras 3 s. **Wake Lock** activo.
- Realtime + polling de respaldo cada 15 s. Indicador discreto de conexión (punto verde o rojo en una esquina).
- Al 100 %: estrella dorada iluminada, confeti grande y mensaje a pantalla completa por ~10 s, luego vuelve al layout con el termómetro lleno.

### 7.3 `/admin/login`
Usuario + contraseña (sección 5). Si el usuario no tiene un perfil activo → se cierra la sesión con el mensaje "Usuario no autorizado".

### 7.4 `/admin` — Inicio
- Tarjetas grandes (desde `v_balance`): **Recaudo bruto** · **Premios entregados** · **Neto real** · Meta · % · Faltante (o **Excedente** si ya se pasó la meta).
- Ejemplo con la meta superada: "Bruto $57.000.000 · Premios $1.600.000 · **Neto $55.400.000** · Meta cumplida (+$7.000.000)".
- Desglose por punto (Bancos 1–3 y Almacén, en efectivo / transferencia), donaciones y remates, en tiempo real.
- **Alerta por punto:** si un banco o el almacén lleva más de 1 hora sin recogida, se resalta ("Banco 2 · última recogida hace 1 h 20 min"). Mucho efectivo acumulado en un banco es el mayor riesgo de robo.
- Estado de los bingos y premios pendientes de entregar.
- Botón grande **"+ Registrar"**, más accesos a Historial, Productos, Bingos y Reportes.

### 7.5 `/admin/registrar` — Pantalla principal del día
1. **Tipo** (botones grandes): `Recaudo de banco` · `Donación` · `Remate`. (Las tablas de bingo se pagan en el banco, así que entran en el recaudo del banco.)
2. **Punto** (solo en recaudo): `Banco 1` · `Banco 2` · `Banco 3` · `Almacén`, en botones grandes. Recuerda el último en `localStorage`.
3. **Monto:** teclado numérico (`inputmode="numeric"`), formateado en vivo con separadores ($ 300.000), más atajos `+50.000` `+100.000` `+500.000` `+1.000.000`.
4. **Medio:** `Efectivo` · `Transferencia`.
5. **Nota:** opcional en todos los tipos. De los remates solo importa el monto.
6. **Confirmación** en un modal con el monto gigante: "¿Registrar **$300.000** · Banco 2 · Efectivo?". Si es mayor a $5.000.000, se pide una segunda confirmación.
7. Al guardar: vibración + toast "Registro #45 · $300.000 · Banco 2" y el formulario se limpia. Si falla: **no se limpia** y aparece "Reintentar" con el mismo `client_id`.

### 7.6 `/admin/historial`
- Lista en tiempo real: hora (Bogotá), tipo, banco, monto, medio, descripción y quién registró.
- Filtros por tipo, banco, usuario y medio, con opción de incluir anulados.
- Anulados tachados, con quién los anuló, cuándo y el motivo.
- Solo editores: **Anular** (motivo obligatorio) y **Corregir** (anula y abre el formulario precargado).

### 7.7 `/admin/productos` — Productos en vivo (cualquier admin)
- Lista agrupada por categoría (Comidas / Bebidas / Postres / Otros) con un **interruptor grande "Agotado"** en cada producto. Un toque y en la pantalla aparece tachado; otro toque y vuelve a estar disponible.
- Botón **"+ Nuevo producto"**: nombre, precio (con el mismo `MontoInput`), categoría y emoji opcional. Ej.: "Galletas · $2.000 · Postres". Aparece en la pantalla en segundos.
- Tocar un producto permite **editar nombre y precio**, u **ocultarlo** del menú (para errores de digitación; nunca se borra).
- Confirmación antes de cambiar un precio ("¿Cambiar Tamales de $15.000 a $18.000?").
- Todo cambio queda en la auditoría (quién, cuándo, valor anterior y nuevo).

### 7.8 `/admin/bingos` — Bingos (cualquier admin)
- Las 4 tarjetas con nombre, hora (opcional) y premio, editables (`guardar_bingo`).
- Botones de estado: **"Iniciar"** (→ `en_juego`, activa el banner en la pantalla) y **"Finalizar"** (cualquier admin).
- Botón **"Premio entregado"** (solo editores), con confirmación: "¿Confirmar entrega de **$300.000** del Bingo 3?". Descuenta el premio del **neto** en el panel admin; el termómetro público no cambia. Si se marcó por error, un editor lo puede desmarcar, y todo queda en la auditoría.
- Si el Gran Bingo se atrasa, se cambia la hora y la cuenta regresiva de la pantalla se ajusta sola.

### 7.9 `/admin/reportes`
- **Balance final:** bruto, premios entregados (con quién y a qué hora), neto.
- Totales por tipo (recaudo / donación / remate) y por medio de pago.
- Por punto (bancos y almacén): total y número de recogidas.
- Por usuario: cuánto registró cada admin.
- Por hora: gráfico simple del recaudo.
- Remates: lista con hora y monto.
- Auditoría completa.
- **Exportar CSV** de ingresos y de auditoría.

---

## 8. Identidad visual (Parroquia María Estrella de la Nueva Evangelización)

### 8.1 Paleta (extraída del logo)

| Token | Color | Uso |
|---|---|---|
| `--azul-marino` | `#14285A` | Texto principal, títulos |
| `--azul-real` | `#24488C` | Fondo de la proyección, encabezados |
| `--azul-claro` | `#5A7DB8` | Anillos decorativos, bordes |
| `--dorado` | `#D4A537` | **Relleno del termómetro**, botones principales, marcos |
| `--dorado-claro` | `#F2CF6B` | Degradado y brillo del relleno |
| `--crema` | `#FBF4E2` | Fondo general y tarjeta del menú |
| `--rojo-manto` | `#C2412D` | Errores, diferencias de cuadre |
| `--verde-manto` | `#1E6E73` | Confirmaciones |

Valores aproximados tomados del logo, definidos como variables CSS y en `tailwind.config` para cambiarlos en un solo lugar.

### 8.2 Tipografía (Google Fonts)
- Títulos: **Cormorant Garamond** 600–700, cercana a la serif del logo.
- Números, precios y UI: **Inter** 600–800 con `font-variant-numeric: tabular-nums`.

### 8.3 Dirección visual
- **Termómetro-estrella:** bulbo dorado abajo y **estrella de 8 puntas** arriba (el motivo del logo). Al 100 % la estrella se ilumina con un glow dorado.
- **Relleno:** degradado `--dorado` → `--dorado-claro` con un brillo sutil animado.
- **Tubo:** fondo crema con borde dorado, como el marco del logo.
- **`/pantalla`:** fondo `--azul-real` con anillos concéntricos sutiles y estrellitas dispersas.
- **Público y admin:** fondo crema; botón principal dorado con texto azul marino.

### 8.4 Logo
- Archivo: `public/logo.png`. El actual tiene fondo blanco y es circular: mostrarlo con `border-radius: 50%` o quitarle el fondo antes de subirlo.
- `[PENDIENTE]` Versión en alta resolución, si existe.
- Usarlo también como favicon y como `og:image` para la vista previa al compartir el link por WhatsApp.

---

## 9. Frontend: estructura y reglas

```
src/
  lib/
    supabase.ts       # createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    format.ts         # COP es-CO sin decimales; horas America/Bogota
    auth.ts           # toEmail(usuario), login, logout, perfil
    useProgreso.ts    # realtime + polling 15 s + estado de conexión
  components/
    Termometro.tsx    # SVG con estrella; prop porcentaje 0–100
    Confeti.tsx
    MenuProductos.tsx # dos columnas, agotados tachados, fuente auto-ajustable
    BingosPanel.tsx   # 4 tarjetas, próximo resaltado, cuenta regresiva, banner "en juego"
    MontoInput.tsx    # formateo en vivo + atajos
    ConfirmModal.tsx
    ProtectedRoute.tsx  # requireEditor opcional
  pages/
    Publico.tsx  Pantalla.tsx
    admin/ Login.tsx Inicio.tsx Registrar.tsx Historial.tsx Productos.tsx Bingos.tsx Reportes.tsx
vercel.json         # { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

- Dinero siempre como enteros. Formato: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`.
- `Publico` y `Pantalla` **solo** consultan `progreso_publico`, `config_publica`, `productos` y `bingos`. Cualquier otra consulta en esas páginas es un bug de seguridad.
- El `client_id` se genera con `crypto.randomUUID()` **al abrir el formulario**, no al enviar.
- Errores de RPC → mensaje claro en español. Nunca limpiar el formulario ante un error.
- Admin mobile-first, con áreas táctiles ≥ 48 px.
- Variables de entorno: solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

---

## 10. Pruebas obligatorias

### Seguridad
- [ ] Sin sesión, desde la consola: `supabase.from('ingresos').select()` → `[]`.
- [ ] Sin sesión: `supabase.from('config_privada').select()` → `[]`.
- [ ] Sin sesión: `supabase.rpc('registrar_ingreso', …)` → error.
- [ ] Network de `/` y `/pantalla`: ninguna respuesta contiene montos recaudados ni la meta.
- [ ] El `registrador` intenta `anular_ingreso` → error.
- [ ] `insert` directo en `ingresos` con sesión de admin → error de permisos.

### Funcional
- [ ] Registrar un recaudo desde el celular → la pantalla sube en < 2 s.
- [ ] Doble toque en "Confirmar" → un solo registro.
- [ ] Modo avión al registrar → error visible, el formulario se conserva y el reintento no duplica.
- [ ] Crear "Galletas $2.000" desde el celular → aparece en la pantalla en < 2 s.
- [ ] Marcar "Almuerzo especial" como agotado → se ve tachado en la pantalla; desmarcarlo → vuelve a la normalidad.
- [ ] Crear un producto con un nombre repetido → error claro.
- [ ] Iniciar un bingo → banner en la pantalla; finalizarlo → desaparece.
- [ ] Marcar premio entregado (editor) → el neto baja en el panel admin y el % público **no** cambia. El `registrador` no puede hacerlo.
- [ ] Con 25+ productos, el menú de la pantalla sigue cabiendo sin scroll.
- [ ] Monto de $3.000.000 → pide doble confirmación.
- [ ] Anular → el % baja y queda en la auditoría.
- [ ] Simular la meta (meta temporal baja) → estrella, confeti y mensaje; el % se queda en 100. **Restaurar la meta a 50.000.000.**
- [ ] Cortar el wifi del PC 1 minuto → se reconecta solo.
- [ ] `/pantalla` en el video beam real: legible desde el fondo, menú completo sin scroll, la pantalla no se apaga.
- [ ] Los 4 admins inician sesión en sus propios celulares.
- [ ] **Reinicio (6.8)** y verificar el 0 %.

---

## 11. Pendientes

### Del cliente
- [x] Crispetas: $1.000.
- [x] Fichas sin límite: no se cuadra por fichas. Remates: solo el monto.
- [ ] Lista de **postres** con precio (o se cargan en vivo desde `/admin/productos`).
- [x] Admins: angela, johana, felipe (editores) e invitado (registrador). Contraseñas solo en Supabase.
- [x] Bingos: $100.000, $200.000 y $300.000 sin hora fija; Gran Bingo 7:00 p.m. por $1.000.000.
- [x] Tablas de bingo: se pagan en el banco.
- [x] Meta: $50.000.000. Los premios salen del recaudo; el admin ve bruto, premios y neto.
- [x] Transferencias: se verifican por WhatsApp, fuera de la app.
- [ ] Confirmar que **invitado** es el que no puede anular.
- [ ] Confirmar si el termómetro público va sobre el **bruto** (por defecto) o sobre el neto.
- [ ] Logo en alta resolución (opcional).

### Técnicos
- [ ] Cuentas de Supabase y Vercel (con GitHub conectado).
- [x] Internet en la iglesia: sí.
- [ ] Resolución del video beam (1920×1080 o 1280×720).

---

## 12. Contingencia del día

- **Internet:** la iglesia tiene wifi; igual dejar un hotspot de respaldo para el PC. Los admins registran con datos móviles.
- **Si cae la app o la conexión:** cada admin anota en papel (hora, banco/tipo, monto, medio) y lo registra al volver la conexión.
- **PC:** desactivar suspensión y protector de pantalla del sistema operativo.
- **Antes de abrir:** termómetro en 0 %, los 4 admins logueados, un registro de prueba → anularlo → verificar que vuelva a 0 %.

---

## 13. Construcción con Claude en VS Code (orden)

1. *"Lee `termometro-iglesia.md`. Crea el proyecto Vite + React + TS + Tailwind con la estructura de la sección 9, el cliente de Supabase, la paleta de la sección 8 y `vercel.json`."*
2. *"Implementa `Termometro.tsx` (con la estrella de 8.3), `useProgreso.ts` y la página pública (7.1)."*
3. *"Implementa `/pantalla` (7.2)."*
4. *"Implementa el login por usuario (sección 5), `ProtectedRoute` y `/admin` (7.3–7.4)."*
5. *"Implementa `/admin/registrar` (7.5) con idempotencia y confirmación anti-ceros."*
6. *"Implementa `/admin/historial` con anulación y corrección (7.6)."*
7. *"Implementa `/admin/productos` (7.7) y `/admin/bingos` (7.8), y el `BingosPanel` en `/pantalla`."*
8. *"Implementa `/admin/reportes` (7.9)."*
9. *"Revisa todo contra la sección 3 (seguridad) y la checklist de la sección 10."*

**Mínimo para mañana:** pasos 1 a 7 (productos y bingos se usan durante el día). Los reportes se pueden sacar al final del día directo de las vistas en Supabase.
