#!/usr/bin/env bash
# Cierra únicamente procesos Blender/MCP identificados por el agente que los abrió.
# Sin argumentos, solo muestra el inventario. La antigüedad no demuestra inactividad.
set -u
usage() { echo 'Uso: cerrar-blender-mcp.sh [--pid PID ...]'; }
if [ "$#" -eq 0 ]; then
  echo 'Inventario (no se cerró ningún proceso):'
  ps -eo pid=,ppid=,etimes=,args= | grep -E '[m]cp-for-blender|[s]sh -T .*blender-mcp|[/]blender([[:space:]]|$)|[x]vfb-run .*blender' || true
  exit 0
fi
pids=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --pid)
      shift
      if [ "$#" -eq 0 ] || [[ ! "$1" =~ ^[1-9][0-9]*$ ]]; then usage >&2; exit 2; fi
      pids+=("$1");;
    *) echo 'No se cierran procesos por antigüedad ni de forma global; identifica primero cada PID de tu trabajo.' >&2; usage >&2; exit 2;;
  esac
  shift
done
self_uid=$(id -u)
# Validar toda la selección antes de enviar ninguna señal.
for pid in "${pids[@]}"; do
  uid=$(ps -p "$pid" -o uid= | tr -d ' ') || { echo "PID $pid no existe" >&2; exit 1; }
  cmd=$(ps -p "$pid" -o args=) || { echo "PID $pid no existe" >&2; exit 1; }
  [ "$uid" = "$self_uid" ] || { echo "PID $pid pertenece a otro usuario" >&2; exit 1; }
  case "$cmd" in
    *mcp-for-blender*|*'ssh -T '*blender-mcp*|*'/blender '*|*'/blender'|*'xvfb-run '*blender*) ;;
    *) echo "PID $pid no es un proceso Blender/MCP reconocido" >&2; exit 1;;
  esac
done
for pid in "${pids[@]}"; do
  kill -TERM "$pid" || { echo "No se pudo cerrar PID $pid" >&2; exit 1; }
  echo "Señal de cierre enviada a $pid"
done
