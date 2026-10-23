# Prompt operativo · Bloque 2 — Base de datos global multi-cancha

Trabaja sobre el proyecto existente de Valeibol tomando el Bloque 1 como completado.

## Objetivo

Extender la base Supabase existente hacia una plataforma global multi-negocio y multi-cancha sin crear un backend paralelo ni romper las reservas, administración, RLS o RPC actuales.

## Reglas

- Reutilizar `businesses`, `courts`, `profiles`, `customers`, `reservations`, horarios, precios y repositorios existentes.
- Introducir `venues` como sede física de un negocio.
- Introducir `sports` como catálogo normalizado.
- Vincular cada cancha a un negocio, sede y deporte.
- Introducir `user_accounts` como identidad global de plataforma vinculada a `auth.users`.
- Roles globales: CUSTOMER, OWNER y ADMIN.
- Conservar `profiles.role = owner/admin/staff` como membresía administrativa por negocio para compatibilidad; no convertir `staff` en administrador global.
- Mantener reservas anónimas existentes; `customers.user_id` y `reservations.user_id` deben ser opcionales.
- El ADMIN global puede gestionar todos los negocios; OWNER puede gestionar negocios propios; membresías administrativas existentes conservan sus permisos actuales.
- Ningún usuario autenticado puede autoelevar su rol global mediante DML directo.
- Mantener RLS y mínimo privilegio.
- Toda superficie pública debe ser sanitizada y no exponer PII.
- No modificar Next.js ni dependencias ajenas al bloque.
- No hacer deploy ni cambios remotos.

## Migración

Crear la migración usando Supabase CLI y realizar backfill compatible con datos existentes.

Debe incluir:

- enum de rol global;
- `sports`;
- `venues`;
- `user_accounts`;
- `businesses.owner_user_id`;
- `courts.venue_id`, `courts.sport_id`, `courts.surface`;
- vínculo opcional de clientes y reservas con usuarios globales;
- índices y FKs;
- triggers `updated_at`;
- creación automática de `user_accounts` para nuevos `auth.users`;
- helpers de autorización global compatibles con `profiles` existentes;
- RLS y grants explícitos;
- RPC pública sanitizada para catálogo multi-cancha.

## Compatibilidad

Valeibol debe quedar como primer tenant con:

- business ID existente;
- una sede principal;
- cancha principal;
- deporte vóley;
- tarifas, horarios y reservas existentes intactos.

Actualizar el seed local y los IDs demo para usar los mismos IDs que Supabase.

## Validación

Ejecutar:

- TypeScript;
- ESLint;
- tests Node existentes y nuevos;
- reset/migraciones Supabase local cuando el entorno lo permita;
- tests SQL;
- build de producción.

Corregir cualquier error causado por este bloque antes de continuar.

Detener el Bloque 2 solo cuando quede PASS o documentar con precisión un bloqueo externo real.
