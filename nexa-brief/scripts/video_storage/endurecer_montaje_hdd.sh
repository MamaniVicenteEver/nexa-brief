#!/usr/bin/env bash
# Endurece el montaje del disco de respaldos de Nexa en alfred-server.
#
# Qué hace:
#   1. Respalda /etc/fstab y añade noatime a la entrada del disco (menos escrituras al leer videos).
#   2. Detiene nexa-video-storage, desmonta el disco y deja el punto de montaje propiedad de root
#      mientras está desmontado: si el disco falta, el servicio no puede escribir en el SSD.
#   3. Vuelve a montar con fstab y verifica: rw, propietario alfred y escritura para alfred.
#   4. Arranca el servicio de nuevo.
#
# Uso (en alfred-server):   sudo bash endurecer_montaje_hdd.sh
# Idempotente: si ya está aplicado, solo reinicia el montaje y el servicio.

set -euo pipefail

UUID="6E2621FB2621C4C5"
MOUNT="/home/alfred/.local/mnt/nexa-backups"
UNIT="nexa-video-storage.service"
OWNER="alfred"
OWNER_UID=1000
FSTAB="/etc/fstab"
ENTRY="^UUID=${UUID} "

stage="inicio"
on_error() {
    echo "ERROR en el paso: ${stage}." >&2
    echo "Revisar: findmnt ${MOUNT}  y  systemctl --machine=${OWNER}@.host --user status ${UNIT}" >&2
}
trap on_error ERR

if [[ ${EUID} -ne 0 ]]; then
    echo "Ejecutar con sudo." >&2
    exit 1
fi

started="$(date '+%Y-%m-%d %H:%M:%S')"

user_systemctl() {
    systemctl --machine="${OWNER}@.host" --user "$@"
}

stage="comprobar volumen y fstab"
blkid -U "${UUID}" >/dev/null || { echo "No existe el volumen ${UUID}." >&2; exit 1; }
grep -q "${ENTRY}" "${FSTAB}" || { echo "No hay entrada ${UUID} en ${FSTAB}." >&2; exit 1; }

stage="respaldar y ajustar fstab"
backup="${FSTAB}.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "${FSTAB}" "${backup}"
echo "fstab respaldado en ${backup}"
if ! grep "${ENTRY}" "${FSTAB}" | grep -qw noatime; then
    sed -i "/${ENTRY}/s/ rw,/ rw,noatime,/" "${FSTAB}"
    echo "noatime añadido a la entrada del disco"
fi
if ! findmnt --verify --tab-file "${FSTAB}" >/dev/null 2>&1; then
    cp -a "${backup}" "${FSTAB}"
    echo "fstab no valida tras el cambio; restaurado desde ${backup}." >&2
    exit 1
fi

stage="detener servicio de respaldo"
user_systemctl stop "${UNIT}"

stage="desmontar disco"
if mountpoint -q "${MOUNT}"; then
    umount "${MOUNT}"
fi

stage="propietario root mientras el disco esta desmontado"
chown root:root "${MOUNT}"
chmod 0755 "${MOUNT}"

stage="montar con fstab"
systemctl daemon-reload
mount "${MOUNT}"

stage="verificar montaje"
fstype="$(findmnt -n -o FSTYPE "${MOUNT}")"
[[ "${fstype}" == "ntfs3" ]] || { echo "Tipo de sistema inesperado: ${fstype}" >&2; exit 1; }
opts="$(findmnt -n -o OPTIONS "${MOUNT}")"
[[ ",${opts}," == *",rw,"* ]] || { echo "El montaje no es rw: ${opts}" >&2; exit 1; }
if [[ ",${opts}," != *",noatime,"* ]]; then
    echo "AVISO: noatime no aparece en las opciones del montaje: ${opts}" >&2
fi
[[ "$(stat -c %u "${MOUNT}")" == "${OWNER_UID}" ]] || { echo "Propietario inesperado del montaje." >&2; exit 1; }
runuser -u "${OWNER}" -- test -w "${MOUNT}" || { echo "${OWNER} no puede escribir en el montaje." >&2; exit 1; }
echo "Montaje verificado: ${opts}"

stage="arrancar servicio de respaldo"
user_systemctl start "${UNIT}"
user_systemctl is-active "${UNIT}"

stage="revisar kernel"
kernel_log="$(journalctl -k --since "${started}" --no-pager)"
if grep -q "volume is dirty" <<<"${kernel_log}"; then
    echo "AVISO: el kernel reporta volumen sucio tras el montaje." >&2
    exit 1
fi

echo "Listo: disco montado en rw, servicio activo."
