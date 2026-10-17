-- Reinicio ANTES de abrir el evento (después de las pruebas). Sección 6.8.
-- Deja el termómetro en 0 %, bingos en "programado", nada agotado y la auditoría vacía.

-- Por si se cambió la meta para probar el confeti:
update public.config_privada set meta = 50000000 where id = 1;

truncate public.ingresos, public.auditoria restart identity cascade;
update public.bingos set estado = 'programado', premio_entregado = false,
                         premio_entregado_por = null, premio_entregado_en = null, actualizado_en = now()
 where id > 0;
update public.productos set agotado = false where agotado;
truncate public.auditoria restart identity;  -- limpia lo que dejaron los update anteriores
select public.recalcular_progreso();          -- truncate no dispara los triggers

-- Verificar: debe dar 0 y false
select porcentaje, meta_alcanzada from public.progreso_publico;
select meta from public.config_privada;
