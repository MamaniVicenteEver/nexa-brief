import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAgenda, dateInZone, filterAgenda, planInstant, shiftDay } from "../lib/agenda.ts";

const plan = (extra = {}) => ({
  itemId: "plan1",
  date: "2026-11-03",
  time: "03:00",
  categoryPath: "node_tech",
  design: "rough",
  topic: "Un tema",
  angle: "",
  description: "",
  productionId: "p1",
  productionState: "queued",
  videoId: "v1",
  createdAt: "2026-11-02T20:00:00Z",
  generationAt: "2026-11-03T07:00:00Z",
  timezone: "America/La_Paz",
  ...extra,
});
const production = (extra = {}) => ({
  productionId: "p1",
  videoId: "v1",
  categoryPath: "node_tech",
  design: "rough",
  topic: "Un tema",
  state: "queued",
  phase: null,
  error: null,
  recordJobId: null,
  planItemId: "plan1",
  createdAt: "2026-11-02T20:00:00Z",
  ...extra,
});
const base = () => ({
  plans: [],
  productions: [],
  recordings: [],
  publications: [],
  jobs: [],
  now: Date.parse("2026-11-02T22:00:00Z"),
});

describe("Agenda chronology and independent stages", () => {
  it("uses the absolute batch instant instead of reading its local wall time as UTC", () => {
    assert.equal(planInstant(plan()), "2026-11-03T07:00:00.000Z");
    assert.equal(dateInZone("2026-11-03T02:00:00Z", "America/La_Paz"), "2026-11-02");
  });
  it("keeps editorial references distinct from scheduled generation", () => {
    const [event] = buildAgenda({
      ...base(),
      plans: [plan({ generationAt: null, productionId: null, productionState: null })],
    });
    assert.equal(event.kind, "plan");
    assert.equal(event.status, "planned");
    assert.equal(event.at, "2026-11-03T03:00:00.000Z");
  });
  it("links the current production once and identifies future requests", () => {
    const events = buildAgenda({ ...base(), plans: [plan()], productions: [production()] });
    assert.equal(events.length, 1);
    assert.equal(events[0].status, "scheduled");
    assert.equal(events[0].production.productionId, "p1");
  });
  it("shows work from other chats with its actual phase", () => {
    const [event] = buildAgenda({
      ...base(),
      productions: [production({ state: "producing", phase: "transcribe" })],
    });
    assert.equal(event.kind, "preparation");
    assert.equal(event.status, "active");
    assert.equal(event.phase, "transcribe");
  });
  it("never invents render or publication tasks when preparation finishes", () => {
    const events = buildAgenda({
      ...base(),
      plans: [plan()],
      productions: [production({ state: "ready", phase: "ready" })],
    });
    assert.deepEqual(
      events.map((event) => event.kind),
      ["preparation"],
    );
    assert.equal(events[0].status, "ready");
  });
  it("keeps renders without start times visible without guessing appointments", () => {
    const recording = {
      jobId: "r1",
      videoId: "v1",
      state: "queued",
      categoryPath: "node_tech",
      startedAt: null,
      title: "Un tema",
    };
    const [event] = buildAgenda({ ...base(), recordings: [recording] });
    assert.equal(event.at, null);
    assert.equal(
      filterAgenda([event], {
        kind: "render",
        day: "2026-11-02",
        range: "day",
        zone: "America/La_Paz",
        search: "",
        status: "all",
      }).length,
      1,
    );
  });
  it("sorts stages by instant and links publication library IDs to their video", () => {
    const recording = {
      jobId: "r1",
      scheduledJobId: "lib1",
      videoId: "v1",
      state: "done",
      categoryPath: "node_tech",
      startedAt: "2026-11-03T08:00:00Z",
      title: "Un tema",
    };
    const publication = {
      entryId: "q1",
      jobId: "lib1",
      scheduledAt: "2026-11-03T12:00:00Z",
      status: "queued",
    };
    const events = buildAgenda({
      ...base(),
      plans: [plan()],
      productions: [production()],
      recordings: [recording],
      publications: [publication],
    });
    assert.deepEqual(
      events.map((event) => event.kind),
      ["preparation", "render", "publication"],
    );
    assert.equal(events[2].videoId, "v1");
  });
  it("filters seven local days across month and year boundaries", () => {
    assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
    const events = buildAgenda({
      ...base(),
      plans: [plan(), plan({ itemId: "p2", generationAt: "2026-11-10T07:00:00Z" })],
    });
    assert.equal(
      filterAgenda(events, {
        kind: "preparation",
        day: "2026-11-03",
        range: "week",
        zone: "America/La_Paz",
        search: "tema",
        status: "upcoming",
      }).length,
      1,
    );
  });
  it("preserves failed requests in search and attention filters", () => {
    const events = buildAgenda({
      ...base(),
      productions: [production({ state: "incomplete", error: "Needs review" })],
    });
    const result = filterAgenda(events, {
      kind: "all",
      range: "all",
      day: "2026-11-02",
      zone: "UTC",
      search: "v1",
      status: "attention",
    });
    assert.equal(result[0].error, "Needs review");
  });
});
