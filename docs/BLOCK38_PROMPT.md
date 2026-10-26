# BLOQUE 38 — Perfil del cliente y autocompletado de reservas

Implementado sobre B20–B37 cerrados.

## Alcance

- `Mi cuenta` incorpora `Mis datos` con nombre, WhatsApp y email de acceso solo lectura.
- `get_my_customer_profile()` y `update_my_customer_profile(...)` derivan identidad solo desde `auth.uid()`.
- No se acepta `user_id`, `business_id`, role ni is_active desde el navegador.
- El perfil de cliente vive en `user_accounts`; no modifica membresías tenant en `profiles`.
- `ReservationDialog` consulta el perfil propio cuando existe sesión y precarga nombre/WhatsApp.
- Cambiar nombre/teléfono dentro de una reserva no modifica el perfil global.
- Guest booking sigue funcionando sin perfil.

## Fuera de alcance

- Cambio de email, avatar, roles, multi-negocio, ownership y pagos.
- Commit, push, deploy o cambios remotos sin autorización explícita.

