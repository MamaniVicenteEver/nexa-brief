import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentWork, operationFailures, timestamp, upcomingWork } from "../lib/operations.ts";

const event = (extra = {}) => ({
  id: "production:p1",
  title: "Un video",
  category: "node_tech",
  kind: "preparation",
  status: "active",
  phase: "guion",
  videoId: "v1",
  at: "2026-11-02T22:00:00Z",
  error: null,
  ...extra,
});
const job = (extra = {}) => ({
  jobId: "library1",
  title: "Video de Biblioteca",
  category: "node_tech",
  stage: "html_generated",
  isTerminal: false,
  ...extra,
});
const now = Date.parse("2026-11-02T22:00:00Z");

describe("Dashboard operational data", () => {
  it("counts a running video once across preparation, recording and library", () => {
    const events = [
      event(),
      event({
        id: "render:r1",
        kind: "render",
        phase: "capturing",
        recording: { state: "rendering", progress: 0.45, scheduledJobId: "library1" },
      }),
    ];
    const work = currentWork(events, [job()]);
    assert.equal(work.length, 1);
    assert.equal(work[0].kind, "render");
    assert.equal(work[0].progress, 45);
    assert.equal(work[0].href, "/biblioteca/library1");
  });
  it("keeps independent videos and publication destinations", () => {
    const work = currentWork(
      [
        event(),
        event({ id: "p2", videoId: "v2" }),
        event({ id: "pub:1", kind: "publication" }),
        event({ id: "pub:2", kind: "publication" }),
      ],
      [],
    );
    assert.equal(work.length, 4);
  });
  it("does not count future scheduled preparations as running", () => {
    assert.equal(currentWork([event({ status: "scheduled" })], []).length, 0);
    assert.equal(currentWork([event({ status: "ready" })], []).length, 0);
    assert.equal(currentWork([event({ status: "failed" })], []).length, 0);
  });
  it("shows unknown progress as unknown and library stage as last completed", () => {
    const work = currentWork([event({ status: "queued" })], [job()]);
    assert.equal(work.length, 2);
    assert.equal(work.find((x) => x.id === "production:p1").progress, null);
    assert.equal(work.find((x) => x.id === "library1").phase, "html_generated");
  });
  it("keeps overdue executable tasks and distinguishes editorial proposals", () => {
    const rows = upcomingWork(
      [
        event({ id: "future", status: "scheduled", at: "2026-11-03T07:00:00Z" }),
        event({ id: "late", status: "scheduled", at: "2026-11-02T21:00:00Z" }),
        event({ id: "plan", kind: "plan", status: "planned", at: "2026-11-03T08:00:00Z" }),
        event({ id: "old-plan", kind: "plan", status: "planned", at: "2026-11-01T08:00:00Z" }),
      ],
      [],
      now,
    );
    assert.deepEqual(
      rows.map((x) => x.id),
      ["late", "future", "plan"],
    );
    assert.equal(rows[2].kind, "plan");
  });
  it("deduplicates summary and queue publications and does not resurrect completed work", () => {
    const publications = [{ entryId: "q1", title: "Video", scheduledAt: "2026-11-03T07:00:00Z" }];
    assert.equal(
      upcomingWork(
        [event({ id: "publication:q1", kind: "publication", status: "scheduled" })],
        publications,
        now,
      ).length,
      1,
    );
    assert.equal(
      upcomingWork(
        [event({ id: "publication:q1", kind: "publication", status: "done" })],
        publications,
        now,
      ).length,
      0,
    );
    assert.equal(upcomingWork([], publications, now)[0].kind, "publication");
  });
  it("shows failed preparation once and suppresses failures covered by a later successful attempt", () => {
    const failed = event({ status: "failed", error: "Preparation failed" });
    assert.equal(operationFailures([failed], []).length, 1);
    assert.equal(
      operationFailures(
        [failed, event({ id: "retry", at: "2026-11-03T01:00:00Z", status: "ready" })],
        [],
      ).length,
      0,
    );
    const render = event({
      id: "render:1",
      kind: "render",
      status: "failed",
      recording: { scheduledJobId: "library1" },
    });
    assert.equal(operationFailures([render], [{ jobId: "library1" }]).length, 0);
  });
  it("formats a shared instant in the selected timezone, including numeric epoch values", () => {
    const instant = "2026-11-03T02:30:00Z";
    assert.match(timestamp(instant, "es-BO", "America/La_Paz"), /02.*nov.*2026.*22:30/);
    assert.match(timestamp(instant, "es-BO", "UTC"), /03.*nov.*2026.*02:30/);
    assert.equal(
      timestamp(Date.parse(instant) / 1000, "es-BO", "UTC"),
      timestamp(instant, "es-BO", "UTC"),
    );
    assert.equal(timestamp(null, "es-BO", "UTC"), "—");
    assert.equal(timestamp("invalid", "es-BO", "UTC"), "—");
  });
});
