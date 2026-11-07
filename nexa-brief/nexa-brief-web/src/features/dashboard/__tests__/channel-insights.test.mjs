import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { channelKey, summarizeChannelQueue } from "../lib/channel-insights.ts";

const entry = (extra = {}) => ({
  id: "1",
  platform: "youtube",
  alias: "canal_1",
  scheduledAt: "2026-11-03T07:00:00Z",
  ...extra,
});
describe("Queued publications by channel", () => {
  it("keeps accounts separate across platforms and unusual aliases", () => {
    const groups = summarizeChannelQueue([
      entry(),
      entry({ id: "2", platform: "facebook" }),
      entry({ id: "3", platform: "youtube", alias: "canal_1:extra" }),
    ]);
    assert.equal(groups.size, 3);
    assert.equal(groups.get(channelKey("facebook", "canal_1")).count, 1);
    assert.notEqual(channelKey("youtube", "canal_1:extra"), channelKey("youtube:canal_1", "extra"));
  });
  it("counts each publication only once when pages overlap", () => {
    const groups = summarizeChannelQueue([entry(), entry(), entry({ id: "2" })]);
    assert.equal(groups.get(channelKey("youtube", "canal_1")).count, 2);
  });
  it("chooses the earliest real instant, including overdue ones", () => {
    const groups = summarizeChannelQueue([
      entry(),
      entry({ id: "2", scheduledAt: "2026-11-02T23:00:00-04:00" }),
      entry({ id: "3", scheduledAt: "2026-11-02T21:00:00Z" }),
    ]);
    assert.equal(groups.get(channelKey("youtube", "canal_1")).earliest, "2026-11-02T21:00:00.000Z");
  });
  it("does not invent a date when queued entries lack valid times", () => {
    const groups = summarizeChannelQueue([
      entry({ scheduledAt: null }),
      entry({ id: "2", scheduledAt: "invalid" }),
    ]);
    assert.deepEqual(groups.get(channelKey("youtube", "canal_1")), { count: 2, earliest: null });
  });
});
