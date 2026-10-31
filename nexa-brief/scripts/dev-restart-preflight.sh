#!/usr/bin/env bash
# No detener ningún servicio si no podemos identificar sus procesos o drenar TikTok.
set -euo pipefail

command -v ss >/dev/null || { echo 'No se pudo verificar el dueño de los puertos; reinicio abortado.' >&2; exit 1; }
tiktok_running=false
for port in 8100 8000 3000; do
  listener=$(ss -ltnpH "sport = :$port")
  if [[ -z "$listener" ]]; then
    continue
  fi
  if [[ ! "$listener" =~ pid=[0-9]+ ]]; then
    echo "El puerto $port está ocupado sin PID controlable; reinicio abortado antes de detener servicios." >&2
    exit 1
  fi
  if [[ "$port" == 8100 ]]; then
    tiktok_running=true
  fi
done

if [[ "$tiktok_running" == true ]]; then
  echo 'TikTok está activo y falta integrar un drenaje verificable de sus trabajos; reinicio abortado antes de detener servicios.' >&2
  exit 1
fi
