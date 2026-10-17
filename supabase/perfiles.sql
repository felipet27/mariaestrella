-- Correr DESPUÉS de crear los 4 usuarios en Authentication → Users
-- (Add user → Create new user, con "Auto Confirm User" marcado):
--   angela@sanisidro.com · johana@sanisidro.com · felipe@sanisidro.com · invitado@sanisidro.com
-- Las contraseñas se escriben SOLO en el dashboard.
--
-- No hace falta copiar UUID: se toman de auth.users por el correo.

insert into public.perfiles (id, usuario, nombre, rol)
select u.id, x.usuario, x.nombre, x.rol
  from (values
    ('angela',   'Angela',   'editor'),
    ('johana',   'Johana',   'editor'),
    ('felipe',   'Felipe',   'editor'),
    ('invitado', 'Invitado', 'registrador')
  ) as x(usuario, nombre, rol)
  join auth.users u on lower(u.email) = x.usuario || '@sanisidro.com'
on conflict (id) do update set usuario = excluded.usuario, nombre = excluded.nombre, rol = excluded.rol, activo = true;

-- Verificar: deben salir 4 filas
select usuario, nombre, rol, activo from public.perfiles order by usuario;
