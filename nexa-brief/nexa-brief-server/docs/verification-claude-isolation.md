# Ensayo sintético: aislamiento de Claude Code

El 5 de noviembre de 2026 se probó Claude Code **2.1.309** en `alfred-server`
con un proveedor HTTP falso en loopback, una clave ficticia, HOME y configuración
nuevos y fixtures bajo `/tmp/nexa-agent-isolation-profesional-20261105/claude`.
No se consultaron sesiones ni credenciales reales, no se invocó un modelo y no
se cambió el estado del perfil. Los comandos del modelo falso eran fijos.

El servidor no tenía `socat` en PATH: Claude rechazó iniciar el sandbox con
`failIfUnavailable`. Se extrajo el paquete oficial APT `socat`
`1.8.1.1-1ubuntu0.1` en
`/home/alfred/.local/lib/nexa-brief/tools/socat-20261105/usr/bin`; no se instaló
un paquete en el sistema ni se modificó un servicio. Con ese PATH y los flags
`--safe-mode --restricted --strict-mcp-config`, se probó primero la política
con seis herramientas y luego el modo de archivos, que anuncia exactamente
`Read`, `Write`, `Edit`, `Glob` y `Grep`, sin Bash ni herramientas de red.
También se probó el modo de lectura, que solo anuncia `Read`, `Glob` y `Grep`.
En estas pruebas:

- `Read` leyó el archivo permitido y rechazó el archivo privado, el symlink de
  escape y `/proc/self/environ`.
- `Glob` y `Grep` rechazaron el directorio privado y symlinks de escape;
  `Write` y `Edit` funcionaron en el archivo de trabajo, y la escritura fuera
  del workspace o por symlink fue rechazada. El modo de lectura no ofrece
  `Write` ni `Edit`.
- Los hooks y MCP de la configuración sintética no se ejecutaron.
- **Bash no ejecutó ni `printf`:** su helper falló con
  `apply-seccomp: write /proc/self/setgroups ... Permission denied`. Así, no se
  verificaron la red, el entorno heredado, el acceso a ficheros ni la evasión
  de sandbox desde Bash. La presencia de `bwrap` y un `bwrap --unshare-all true`
  exitoso no prueban que el sandbox del CLI funcione.

La opción `sandbox.enableWeakerNestedSandbox` tampoco permitió ejecutar `printf`.
No se incorporó a la política: Anthropic indica que esta opción comparte el
`/proc` del contenedor y requiere una frontera exterior suficiente. Tampoco se
probó ni modificó la autenticación real de suscripción. `--bare` no es una
alternativa transparente: la ayuda del CLI indica que no usa OAuth y, en este
ensayo, no ofrecía algunas herramientas necesarias.

El candidato reproducible es [probe-claude-isolation.py](../scripts/probe-claude-isolation.py),
que devuelve un resultado no listo y estado no cero mientras falle alguna prueba;
los checks dependientes de Bash aparecen como `null` cuando Bash no arranca.
Aunque pasaran, no validarían por sí solos la autenticación, otros canales ni
una configuración distinta. [isolated_claude.py](../src/adapters/agent/infrastructure/isolated_claude.py)
implementa el runner de archivos seleccionado por la fábrica en v2/v3. La prueba
integrada con el CLI real, configuración sintética y API falsa comprobó la
escritura, el resultado y los contadores de uso. El runner usa un temporal vacío para consultas de solo lectura y exige, para
escritura, un workspace exclusivo sin symlinks/hardlinks ni nombres privados,
entorno limitado, directorio de configuración fuera del workspace y hash
previamente verificado del binario. El HOME temporal y el workspace no deben
contener credenciales; preparar el contexto autorizado corresponde al supervisor.

El método `available` comprueba la presencia del binario fijado, configuración y
dependencias: no demuestra que la sesión existente funcione. La autenticación
real, el uso de suscripción y una generación completa no se probaron. La revisión
automática rechazó consultar el estado de autenticación real bajo la restricción
de no leer sesiones/configuración real. No se intentó otro procedimiento.
La política de permisos nativa no es una certificación general contra carreras
de otros procesos del mismo usuario ni contra otras versiones del CLI o del host.

La posible mediación por hook necesita otro diseño: `--safe-mode` desactiva los
hooks. Sería necesario cargar solo un hook confiable, no modificable por el
agente, comprobar que todas las ejecuciones Bash pasan por él y demostrar una
frontera equivalente de archivos, red, credenciales, procesos y cancelación.
Nunca se debe cambiar a Bash sin aislamiento por un fallo del sandbox nativo.

Referencias oficiales: [sandbox de Claude Code](https://code.claude.com/docs/en/sandboxing),
[referencia de opciones](https://code.claude.com/docs/en/settings-reference), y
[permisos](https://code.claude.com/docs/en/permissions).

## Instrucciones y memoria automáticas

Un ensayo adicional con HOME/config ficticios y proveedor local simulado comprobó
cinco marcadores: CLAUDE.md del padre, global y del workspace, una skill y MEMORY.md.
Los cinco aparecieron en el control positivo; ninguno apareció en las dos
solicitudes con `--safe-mode --restricted` y la política de archivos del runner.
El control de memoria permitió expresamente la lectura externa ficticia; la
variante restringida mantuvo `blockReadsOutsideWorkingDirectories=true`. El
control de skills habilitó Skill/slash y la variante restringida las deshabilitó.
Esto demuestra ausencia en los requests al proveedor, no ausencia de aperturas
locales de archivos por el harness. No se usaron configuración ni sesiones reales.
