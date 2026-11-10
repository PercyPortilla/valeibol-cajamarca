# SportCenter Caxas · diagnóstico del acceso global a un negocio

Fecha: 10 de noviembre de 2026. Incidencia aún reproducible por el usuario tras `c97a192`.

## Hallazgo y alcance

`proxy.ts` borraba `caxas-platform-business` en **toda** solicitud a `/admin-global` (incluidas precargas de Next.js, solicitudes RSC y navegación interna). Estas respuestas podían competir con el `POST /api/admin-global/select-business` y anular la selección de tenant. **No está demostrado** que esta carrera fuese la causa exacta del caso autenticado: no se han leído cookies ni iniciado sesión como el usuario.

## Correcciones

1. `shouldClearPlatformBusinessSelection` limita la limpieza al `GET` de un documento real; descarta RSC, prefetch, `sec-fetch-dest` no documental y POST. Los enlaces explícitos de retorno al global en `AdminShell` se convierten a navegación de documento para conservar la limpieza deliberada.
2. El selector POST autentica primero al ADMIN global y después realiza un `get_current_admin_context` con el business ID seleccionado como header explícito; solo instala la cookie si el RPC devuelve ese mismo negocio y rol `admin`. Esto verifica la integración del backend y evita redirigir falsamente a una página operativa sin contexto reconocido.
3. Si el RPC rechaza el negocio, muestra `SC-02` en el global. Si el dashboard falla después de seleccionar, muestra `SC-11` (no llegó selección cookie) o `SC-12` (selección presente, contexto operativo rechazado). Son indicadores sin UUID, cookies, correos ni tokens.

La base de datos de producción, perfiles, `user_accounts`, RLS y funciones SQL **no se modificaron**. El scope continúa dependiendo de `public.is_platform_admin()`, el UUID validado y el header en PostgREST.

## Criterios de comprobación

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- POST anónimo de origen correcto: redirige a login sin cookie de selección.
- POST de origen ajeno: rechazo `403` sin cookie.
- GET del selector: inerte, sin cookie.
- Confirmar posteriormente con sesión auténtica que el botón abre `/admin` y que el retorno al global limpia el scope.

Si reaparece el error, el código SC-02, SC-11 o SC-12 permitirá localizar el siguiente paso sin solicitar secretos. No afirmar resolución end-to-end hasta completar la prueba autenticada.
