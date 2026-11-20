/** Tiempo relativo corto en español (ej. "hace 5 min") a partir de un ISO timestamp. */
export function formatRelativeTime(isoTimestamp: string): string {
  const deltaSeconds = Math.max(0, (Date.now() - new Date(isoTimestamp).getTime()) / 1000);

  if (deltaSeconds < 60) return "justo ahora";
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(isoTimestamp).toLocaleDateString("es", { day: "2-digit", month: "short" });
}
