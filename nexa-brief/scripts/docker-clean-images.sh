#!/usr/bin/env bash
# Remove only obsolete tagged images belonging to this Compose project.
set -Eeuo pipefail
for repo in nexa-brief-api nexa-brief-web; do
  docker image inspect "$repo:latest" >/dev/null
  docker image inspect "$repo:previous" >/dev/null || { echo "Falta $repo:previous; no se limpia $repo." >&2; continue; }
  while IFS= read -r tag; do
    [[ -z "$tag" || "$tag" == "$repo:latest" || "$tag" == "$repo:previous" ]] && continue
    id=$(docker image inspect --format '{{.Id}}' "$tag")
    project=$(docker image inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$tag")
    [[ "$project" == nexa-brief ]] || continue
    # Never remove the final reference to an image used by any container.
    active=$(docker ps -a -q --no-trunc | xargs -r docker inspect --format '{{.Image}}' | awk -v id="$id" '$0 == id {print}')
    current=$(docker image inspect --format '{{.Id}}' "$repo:latest")
    previous=$(docker image inspect --format '{{.Id}}' "$repo:previous")
    if [[ -n "$active" && "$id" != "$current" && "$id" != "$previous" ]]; then
      echo "Se conserva $tag: usada por un contenedor."
      continue
    fi
    docker image rm "$tag" || echo "Se conserva $tag: Docker no permitió eliminarla." >&2
  done < <(docker image ls "$repo" --format '{{.Repository}}:{{.Tag}}' | sort -u)
done
# Remove untagged intermediate images from this project only, when unused.
while IFS= read -r id; do
  [[ -z "$id" ]] && continue
  service=$(docker image inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$id")
  [[ "$service" == api || "$service" == web ]] || continue
  used=$(docker ps -a -q --no-trunc | xargs -r docker inspect --format '{{.Image}}' | awk -v id="$id" '$0 == id {print}')
  [[ -n "$used" ]] && continue
  docker image rm "$id" || echo "Se conserva la imagen sin etiqueta $id." >&2
done < <(docker image ls --all --quiet --no-trunc --filter 'dangling=true' --filter 'label=com.docker.compose.project=nexa-brief' | sort -u)
