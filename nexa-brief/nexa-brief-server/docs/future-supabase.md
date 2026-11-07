# Supabase futuro: local primero

El almacenamiento disponible hoy es local. Este documento describe una posible
transición, **no una integración implementada**: ninguna de las variables de
Supabase de abajo se consume actualmente y no debe añadirse como configuración
activa hasta desarrollar y probar los adapters. No hace falta una cuenta de
Supabase para usar Nexa Brief localmente. Seleccionar un proveedor no instalado
no debe recurrir silenciosamente al almacenamiento de otro perfil o backend.

El manifiesto local puede seguir seleccionando los proveedores existentes:

```json
{
  "schema_version": 2,
  "id": "mi-perfil",
  "providers": {
    "records": "json",
    "publications": "json",
    "media": "filesystem",
    "credentials": "encrypted_json",
    "users": "json"
  }
}
```

`records` reúne colecciones y documentos; `publications` es el repositorio de
publicaciones y `media` selecciona tanto archivos de biblioteca como medios de
publicación. Para un proveedor remoto habrá que registrar implementaciones para
los dos contratos diferentes `files` y `media`, además de los otros puertos
seleccionados. `credentials` y `users` son elecciones independientes: no se
deben migrar tokens de redes ni usuarios implícitamente al cambiar registros.
El contrato de usuarios todavía no está conectado; debe rechazarse explícitamente
una selección distinta del valor local hasta que exista una implementación real.
Los proveedores que no estén registrados deben devolver un error `not installed`
antes de usarse, sin crear datos en el backend local como sustituto.

## Variables que podrían necesitarse más adelante

Estos nombres son **propuestas**, no variables soportadas hoy. Sus valores se
configurarían fuera del repositorio y de los perfiles exportados. No colocar
credenciales ni cadenas de conexión en `profile.json`, capturas, prompts,
logs o archivos de ejemplo.

| Propuesta | Ubicación | Cuándo se necesitaría |
|---|---|---|
| `SUPABASE_URL` | Backend; también frontend solo si este llama directamente a Supabase | Dirección del proyecto para un adapter de Data API, Storage o Auth. |
| `SUPABASE_PUBLISHABLE_KEY` | Cliente público y/o backend | Solo si se usa la API pública; en el navegador se expone por diseño. Requiere Auth, grants mínimos y políticas RLS verificadas antes de conectar datos reales. |
| `SUPABASE_SECRET_KEY` | Backend exclusivamente | Opcional y solo para operaciones administrativas justificadas. Concede privilegios elevados y normalmente elude RLS; no es necesaria para el modo local ni como credencial general de la aplicación. |
| `SUPABASE_DB_POOLER_URL` | Backend exclusivamente | Opcional si un adapter usa PostgreSQL directamente. Contiene credenciales de un rol específico de aplicación, con los grants mínimos; no usar el rol `postgres` ni uno con `BYPASSRLS` para operaciones ordinarias. |

La publishable key identifica la aplicación; Auth identifica al usuario. Las
secret keys y la antigua `service_role` son privilegiadas y no se exponen en
frontend, agentes ni herramientas. Una secret key puede no ser necesaria en
absoluto. [Claves de API de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Si se elige conexión SQL, obtener host, puerto y modo del proyecto, sin construir
el hostname a partir de la región. El pooler compartido usa un nombre de usuario
diferente para roles personalizados. En modo transacción hay restricciones de
estado de sesión y sentencias preparadas; seleccionar modo y driver según las
operaciones reales. Nunca enviar la URL de PostgreSQL al navegador.
[Conexiones y pooler](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Fases antes de activar un proveedor remoto

1. Mantener JSON y filesystem como fuente local; crear un proyecto remoto de
   prueba separado, con datos sintéticos. Definir esquemas, propiedad de datos,
   copias de seguridad y migraciones reversibles antes de transferir datos.
2. Implementar cada puerto según necesidad, sin acoplar dominio al proveedor:
   `RecordCollection`, `DocumentStore`, `FileStorage`, repositorio y medios de
   publicaciones. Preservar claves estables y descargar a una caché técnica por
   perfil cuando `local_path()` sea necesario. No enviar credenciales al agente.
3. Sustituir locks locales de operaciones compuestas por coordinación atómica
   del backend remoto: unicidad de entregas y reclamos, actualizaciones
   condicionales e incrementos entre procesos. Verificar la compatibilidad del
   modo de pooler elegido con la estrategia transaccional usada; un lock de
   archivo local no coordina instancias en máquinas distintas.
4. Si se expone Data API, activar RLS y definir grants y políticas por operación
   y perfil/organización. El identificador de perfil local por sí solo no es
   autorización: validar membresía con identidad confiable y probar lecturas y
   escrituras entre dos usuarios/perfiles, incluidos accesos denegados. RLS y
   grants son controles distintos. [RLS y grants](https://supabase.com/docs/guides/database/postgres/row-level-security).
5. Probar localmente contratos, conflictos, fallos, retries idempotentes,
   expiración y autorización, integridad de objetos y recuperación de backup.
   Ejecutar una migración de ensayo verificable por conteo y hash; conservar el
   origen y documentar cómo revertir antes de cambiar el perfil seleccionado.
6. Agregar únicamente las variables efectivamente consumidas por el adapter que
   se entregue, documentar cómo inyectarlas y reiniciar los procesos al cambiar
   de perfil: actualmente hay componentes de persistencia cacheados en proceso.

Las credenciales OAuth de canales, sesiones de servicios y secretos del proveedor
no forman parte del catálogo de datos que se exporta para producción. Su gestión
remota, cifrado, acceso privilegiado, rotación y restauración son un proyecto
separado. El aislamiento de agentes v2 sigue bloqueado hasta verificarse de forma
independiente del backend de almacenamiento.
