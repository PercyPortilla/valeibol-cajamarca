# Arquitectura global multi-cancha · Bloque 1

## Objetivo

La aplicación existente sigue siendo la web operativa de Valeibol Cajamarca, pero desde este bloque cuenta con una capa de dominio preparada para evolucionar a una plataforma con múltiples negocios, sedes, canchas y deportes.

## Lo que se reutiliza

- `config/business.ts` continúa siendo la fuente de configuración comercial de la web actual.
- Los repositorios de disponibilidad y reservas existentes se mantienen.
- Supabase, autenticación administrativa, reservas y panel admin no se reescriben en este bloque.
- Los IDs del modo local se reutilizan para que los datos demo y el admin local describan la misma cancha.

## Capa de dominio

`lib/domain/models.ts` define los modelos neutrales de plataforma:

- `User`
- `Business`
- `Venue`
- `Court`
- `Sport`
- `Reservation`

Los roles globales preparados son `CUSTOMER`, `OWNER` y `ADMIN`.

Los roles administrativos heredados (`owner`, `admin`, `staff`) se conservan sin cambios por compatibilidad con el backend actual. Su migración o mapeo definitivo pertenece a un bloque posterior de autenticación/autorización.

## Deportes

`config/sports.ts` centraliza inicialmente:

- Vóley
- Fútbol
- Futsal
- Básquet

Agregar un deporte nuevo no requiere repetir strings por la aplicación.

## Primer tenant

`lib/data/demoPlatform.ts` representa la web existente como:

`Valeibol -> sede Valeibol Cajamarca -> Cancha principal -> Vóley`

Este dataset es una representación tipada para arquitectura y fallbacks locales. No reemplaza Supabase ni altera datos productivos.

## Rutas futuras

`lib/platform/routes.ts` reserva contratos de navegación para:

- `/buscar`
- `/voley`
- `/futbol`
- `/complejo/[slug]`
- `/reservar`
- `/mi-cuenta`
- `/propietario`
- `/admin`

No se publican páginas placeholder en este bloque para evitar exponer experiencias incompletas.

## Decisión pendiente para Bloque 2

La base actual ya soporta `businesses` y múltiples `courts`, pero todavía no contiene una entidad `venues`. El modelo `Venue` existe desde este bloque en la capa de dominio; cualquier cambio SQL para materializar sedes debe diseñarse y migrarse explícitamente en el Bloque 2, sin alterar el esquema productivo desde aquí.
