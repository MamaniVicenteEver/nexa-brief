import assert from "node:assert/strict";
import test from "node:test";
import {
  activeDelivery,
  filterGalleryItems,
  getMetricValue,
  makeMetricPoints,
  metricChartPoints,
  publicationFormat,
} from "../gallery-utils.ts";

const filters = {
  categoryId: "node_tech",
  platform: "instagram",
  kind: "all",
  strategyId: "all",
  status: "all",
  metric: "reach",
  window: "48h",
  sort: "desc",
};

const records = [
  {
    publicationId: "one",
    categoryId: "node_tech",
    categoryName: "NodeTech",
    topic: "Tema",
    title: "Primera",
    kind: "image",
    templateId: "daily_fact",
    strategyId: "cifra_que_frena",
    status: "completed",
    createdAt: "2026-10-20T10:00:00Z",
    latestPublishedAt: "2026-10-20T11:00:00Z",
    coverAssetId: "a1",
    coverUrl: null,
    slides: [],
    isDemo: false,
    deliveries: [
      {
        deliveryId: "fb1",
        platform: "facebook",
        accountAlias: "pagina_3",
        placement: "image",
        status: "published",
        publishedAt: null,
        permalink: null,
        metricValue: 8,
        metricName: "reach",
        window: "48h",
      },
      {
        deliveryId: "ig1",
        platform: "instagram",
        accountAlias: "instagram_2",
        placement: "image",
        status: "published",
        publishedAt: null,
        permalink: null,
        metricValue: null,
        metricName: null,
        window: null,
      },
    ],
  },
  {
    publicationId: "two",
    categoryId: "node_history",
    categoryName: "NodeHistory",
    topic: "Tema",
    title: "Segunda",
    kind: "carousel",
    templateId: "five_slides",
    strategyId: "hilo_guardable",
    status: "completed",
    createdAt: "2026-10-19T10:00:00Z",
    latestPublishedAt: "2026-10-19T11:00:00Z",
    coverAssetId: "a2",
    coverUrl: null,
    slides: [],
    isDemo: false,
    deliveries: [
      {
        deliveryId: "ig2",
        platform: "instagram",
        accountAlias: "instagram_3",
        placement: "carousel",
        status: "published",
        publishedAt: null,
        permalink: null,
        metricValue: 21,
        metricName: "reach",
        window: "48h",
      },
    ],
  },
];

test("gallery filters stay scoped to category and platform", () => {
  assert.deepEqual(
    filterGalleryItems(records, filters).map((record) => record.publicationId),
    ["one"],
  );
  assert.deepEqual(
    filterGalleryItems(records, { ...filters, categoryId: "", kind: "carousel" }).map(
      (record) => record.publicationId,
    ),
    ["two"],
  );
  assert.deepEqual(
    filterGalleryItems(records, {
      ...filters,
      categoryId: "",
      platform: "all",
      strategyId: "hilo_guardable",
    }).map((record) => record.publicationId),
    ["two"],
  );
});

test("missing metrics remain unknown instead of becoming zero", () => {
  assert.equal(getMetricValue(records[0].deliveries[1], "reach", "48h"), null);
  assert.equal(getMetricValue(records[0].deliveries[0], "likes", "48h"), null);
});

test("metric chart ignores permission-missing snapshots and needs two valid points", () => {
  const snapshots = [
    { window: "48h", observedAt: "2026-10-20T00:00:00Z", metrics: { reach: 0 }, status: "ok" },
    {
      window: "48h",
      observedAt: "2026-10-21T00:00:00Z",
      metrics: null,
      status: "permission_missing",
    },
    { window: "7d", observedAt: "2026-10-21T00:00:00Z", metrics: { reach: 10 }, status: "ok" },
  ];
  const points = makeMetricPoints(snapshots, "reach", "48h");
  assert.equal(points.length, 1);
  assert.equal(points[0].value, 0);
  assert.equal(metricChartPoints(points.map((point) => point.value)), "");
  assert.match(metricChartPoints([0, 10]), /^0,/);
});

test("delivery selection falls back without resetting the active slide", () => {
  assert.equal(activeDelivery(records[0].deliveries, "ig1")?.deliveryId, "ig1");
  assert.equal(activeDelivery(records[0].deliveries, "missing")?.deliveryId, "fb1");
  assert.equal(activeDelivery([], null), null);
});

test("a Reel delivery appears under the Reel format", () => {
  const reel = {
    ...records[0],
    publicationId: "reel",
    deliveries: [{ ...records[0].deliveries[1], placement: "reel" }],
  };
  reel.kind = publicationFormat(reel.kind, reel.deliveries);
  assert.equal(reel.kind, "reel");
  assert.deepEqual(
    filterGalleryItems([records[0], reel], { ...filters, kind: "reel" }).map(
      (item) => item.publicationId,
    ),
    ["reel"],
  );
});

test("gallery filters a removed delivery and preserves the API metric order", () => {
  const removed = {
    ...records[0],
    publicationId: "removed",
    deliveries: [
      { ...records[0].deliveries[0], status: "published" },
      { ...records[0].deliveries[1], status: "removed_manually" },
    ],
  };
  assert.deepEqual(
    filterGalleryItems([removed], { ...filters, status: "removed_manually" }).map(
      (item) => item.publicationId,
    ),
    ["removed"],
  );
  assert.deepEqual(
    filterGalleryItems([removed], { ...filters, platform: "facebook", status: "removed_manually" }),
    [],
  );
  assert.deepEqual(
    filterGalleryItems([records[1], records[0]], {
      ...filters,
      categoryId: "",
      platform: "all",
    }).map((item) => item.publicationId),
    ["two", "one"],
  );
});
