# Regla de integración

**Merge a `main` cuando un bloque funcional esté terminado y probado.**

Un bloque está listo para merge solo cuando:

- su alcance funcional está completo;
- las pruebas automáticas aplicables pasan;
- no existe un FAIL crítico conocido;
- las validaciones externas críticas propias de ese bloque, si aplican, están completas.

Los bloques bloqueados por credenciales, permisos, cuota o servicios externos permanecen fuera de `main` hasta cumplir esas condiciones.
