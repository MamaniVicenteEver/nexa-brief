import type {
  DeliverySummary,
  GalleryFilters,
  GalleryKind,
  MetricName,
  MetricsWindow,
  PublicationSummary,
} from "./types";

export function publicationFormat(kind: GalleryKind, deliveries: DeliverySummary[]): GalleryKind {
  return deliveries.length > 0 && deliveries.every((delivery) => delivery.placement === "reel")
    ? "reel"
    : kind;
}

export function filterGalleryItems(
  items: PublicationSummary[],
  filters: GalleryFilters,
): PublicationSummary[] {
  return items.filter((item) => {
    if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
    if (filters.kind !== "all" && item.kind !== filters.kind) return false;
    if (filters.strategyId !== "all" && item.strategyId !== filters.strategyId) return false;
    return item.deliveries.some(
      (delivery) =>
        (filters.platform === "all" || delivery.platform === filters.platform) &&
        (filters.status === "all"
          ? delivery.status === "published"
          : delivery.status === filters.status),
    );
  });
}

export function getMetricValue(
  delivery: DeliverySummary,
  metric: MetricName,
  window: MetricsWindow,
): number | null {
  return delivery.metricName === metric && delivery.window === window ? delivery.metricValue : null;
}

export function makeMetricPoints(
  snapshots: Array<{
    window: MetricsWindow;
    observedAt: string;
    metrics: Partial<Record<MetricName, number | null>> | null;
    status: string;
  }>,
  metric: MetricName,
  window: MetricsWindow,
): Array<{ label: string; value: number }> {
  return snapshots
    .filter(
      (snapshot) =>
        snapshot.window === window &&
        snapshot.status === "ok" &&
        snapshot.metrics?.[metric] !== null &&
        snapshot.metrics?.[metric] !== undefined,
    )
    .map((snapshot) => ({
      label: snapshot.observedAt,
      value: snapshot.metrics?.[metric] as number,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function metricChartPoints(values: number[], width = 240, height = 72): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 6 - ((value - min) / spread) * (height - 12);
      return `${x},${y}`;
    })
    .join(" ");
}

export function activeDelivery(
  deliveries: DeliverySummary[],
  deliveryId: string | null,
): DeliverySummary | null {
  return deliveries.find((delivery) => delivery.deliveryId === deliveryId) ?? deliveries[0] ?? null;
}
