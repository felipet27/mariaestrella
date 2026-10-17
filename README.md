# Termómetro de Recaudo — San Isidro

Parroquia María Estrella de la Nueva Evangelización · domingo 18 de octubre de 2026.
La especificación completa está en [termometro-iglesia.md](termometro-iglesia.md).

| Ruta | Quién | Qué |
|---|---|---|
| `/` | Público (celular) | Termómetro en % (nunca montos) |
| `/pantalla` | Video beam | Termómetro, bingos, menú y QR (1080p y 720p) |
| `/admin` | 4 administradores | Resumen: bruto, premios, neto, alertas por banco |
| `/admin/registrar` | Admins | Registrar recaudos, donaciones y remates |
| `/admin/historial` | Admins | Historial; anular y corregir (solo editores) |
| `/admin/productos` | Admins | Productos nuevos, precios, AGOTADO |
| `/admin/bingos` | Admins | Iniciar y finalizar bingos; premio entregado (solo editores) |
| `/admin/reportes` | Admins | Balance, totales, gráfico por hora, auditoría y CSV |
| `/admin/ajustes` | **Solo felipe** | Textos, meta, puntos, usuarios, bingos extra y reinicio |

## 1. Supabase

1. Crear el proyecto en supabase.com (región cercana, p. ej. São Paulo).
2. **SQL Editor** → pegar todo [supabase/schema.sql](supabase/schema.sql) → **Run**.
3. **Authentication → Sign In / Providers → Email**: desactivar *Allow new users to sign up*.
4. **Authentication → Users → Add user → Create new user** (×4), con **Auto Confirm User**:
   `angela@sanisidro.com`, `johana@sanisidro.com`, `felipe@sanisidro.com`, `invitado@sanisidro.com`.
   Las contraseñas se escriben **solo ahí**.
5. **SQL Editor** → correr [supabase/perfiles.sql](supabase/perfiles.sql). Debe listar 4 perfiles.
6. **SQL Editor** → correr [supabase/002_ajustes_felipe.sql](supabase/002_ajustes_felipe.sql) (sección ⚙️ Ajustes, solo para felipe). Debe listar 4 funciones.
   Luego correr [supabase/003_frases_y_bingos.sql](supabase/003_frases_y_bingos.sql) (frases editables y bingos jugados no se repiten).
   Luego [supabase/004_corregir_reinicio.sql](supabase/004_corregir_reinicio.sql) y [supabase/005_desglose_productos.sql](supabase/005_desglose_productos.sql) (desglose por producto).
7. **Project Settings → API**: copiar la *Project URL* y la *anon / publishable key*.
   La `service_role` **nunca** se usa en este proyecto.

## 2. Local

```bash
cp .env.example .env.local   # llenar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## 3. Vercel

1. *Add New → Project* → importar `felipet27/mariaestrella` (Vite se detecta solo).
2. *Environment Variables*: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Deploy. `vercel.json` ya redirige todas las rutas a la SPA.

## 4. Pruebas y reinicio

Se hacen con la checklist de la sección 10 de la especificación. Para probar el 100 %, `felipe` baja la meta en `/admin/pruebas` y luego la restaura.
**Antes de abrir el evento**: `/admin/pruebas` → *Reiniciar datos* (o correr [supabase/reinicio.sql](supabase/reinicio.sql)) y verificar que el termómetro quede en 0 %.

## El día del evento

- PC del video beam: abrir `/pantalla`, tocar *Pantalla completa* y desactivar la suspensión del sistema.
- Si se cae la conexión: anotar en papel (hora, banco/tipo, monto, medio) y registrar al volver.
