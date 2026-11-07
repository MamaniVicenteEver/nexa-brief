# Aislamiento de agentes en perfiles v2/v3

Los perfiles v2/v3 seleccionan ejecutores aislados desde `AgentRunnerPort`.
Codex se habilita exclusivamente para el binario, kernel y política verificados
en alfred-server. Claude utiliza el binario fijado y únicamente herramientas de
archivos. Las rutas legacy directas de CLI, imágenes y delegación siguen bloqueadas;
no existe una opción del perfil que anule esas guardas. V1 conserva compatibilidad.

La producción v3 prepara un workspace privado por video con el contrato público
del diseño y sus componentes. El agente escribe guion y storyboard; el host realiza
voz, transcripción, validación y demás operaciones del pipeline mediante servicios
y adapters existentes. No se concede acceso al motor completo ni a datos de otros
videos. Los prototipos reciben su referencia y contexto público, y la validación
smoke se ejecuta desde el host con entradas y tiempo limitados.

Las consultas de texto usan un temporal vacío; un esquema de respuesta se valida
antes de copiarlo. El entorno del proceso se construye con una lista permitida.
El login permanece a cargo del harness del CLI fuera del alcance de herramientas;
no se leen ni copian credenciales para preparar el contexto. No se comprobó una
llamada real con suscripción: las pruebas nativas usan proveedores HTTP falsos.

- [Verificación de Codex y límites](verification-codex-isolation.md).
- [Verificación de Claude y límites](verification-claude-isolation.md).
- [Layout y migración](profile-layout-v3-2026-11.md).

Los permisos 0700 y las instrucciones Markdown no aíslan por sí solos a procesos
del mismo usuario. La política restringe las herramientas disponibles al modelo;
el host, su administrador y el harness siguen siendo confiables. No se debe
habilitar Bash en Claude cuando su sandbox nativo falle ni sustituir una política
fallida por el runner legacy. Las versiones o alcances no verificados devuelven
`agent_isolation_unavailable` antes de iniciar la ejecución.

Los scripts `probe-agent-isolation.py`, `probe-codex-permissions.py` y
`probe-claude-isolation.py` documentan pruebas parciales de diagnóstico. Sus
resultados no equivalen a una aprobación automática de una versión nueva.
