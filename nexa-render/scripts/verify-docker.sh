#!/usr/bin/env sh
# Verifica el stack Docker completo: Redis, API, web y un render real.
set -eu

compose() {
  docker compose "$@"
}

wait_for_url() {
  url="$1"
  attempts=0
  while [ "$attempts" -lt 45 ]; do
    if curl --location --fail --silent --show-error --output /dev/null "$url"; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  echo "La URL no respondió a tiempo: $url" >&2
  return 1
}

echo "Iniciando nexa-render..."
compose up -d --build

echo "Comprobando Redis..."
[ "$(compose exec -T redis redis-cli ping)" = "PONG" ]

echo "Comprobando API y web..."
wait_for_url "http://127.0.0.1:4000/api/v1/health"
wait_for_url "http://127.0.0.1:3000/es"

echo "Enviando un render HTML de un segundo..."
job_id="$(compose exec -T server node -e '
const run = async () => {
  const response = await fetch("http://127.0.0.1:4000/api/v1/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: {
        kind: "html",
        html: "<main>Docker verification</main>",
        css: "body{margin:0;display:grid;place-items:center;height:100vh;background:#101828;color:#fff;font:48px sans-serif}",
      },
      engine: "playwright",
      formats: ["desktop"],
      durationSeconds: 1,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  console.log((await response.json()).jobId);
};
run().catch((error) => { console.error(error); process.exit(1); });
')"

attempts=0
while [ "$attempts" -lt 45 ]; do
  status="$(compose exec -T server node -e '
const run = async () => {
  const response = await fetch("http://127.0.0.1:4000/api/v1/jobs/" + process.argv[1]);
  if (!response.ok) throw new Error(await response.text());
  const job = await response.json();
  console.log(job.status);
  if (job.status === "failed") process.exitCode = 2;
};
run().catch((error) => { console.error(error); process.exit(1); });
' "$job_id")"
  [ "$status" = "completed" ] && break
  [ "$status" = "failed" ] && { echo "El render falló." >&2; exit 1; }
  attempts=$((attempts + 1))
  sleep 1
done

[ "$status" = "completed" ] || { echo "El render excedió 45 segundos." >&2; exit 1; }
wait_for_url "http://127.0.0.1:4000/files/$job_id/desktop.mp4"

echo "OK: Redis, API, web y render MP4 verificados. Job: $job_id"
