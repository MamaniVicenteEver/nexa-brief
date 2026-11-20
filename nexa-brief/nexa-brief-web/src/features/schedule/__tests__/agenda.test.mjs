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


describe("Explicit scheduled videos", () => {
  const workflow = (extra = {}) => ({
    workflow_id: "w1", video_id: "v1", category_path: "node_actualidad", topic: "SSD y M.2",
    design: "cara-a-cara", record_at: "2026-11-14T10:10:00Z", publish_at: "2026-11-15T04:00:00Z",
    record_state: "scheduled", publish_state: "pending_channels", state: "scheduled", ...extra,
  });
  it("shows midnight on the next Bolivia day and keeps the missing channel visible", () => {
    const events = buildAgenda({...base(), workflows:[workflow()]});
    const tomorrow = filterAgenda(events, {kind:"publication", day:"2026-11-15", range:"day", zone:"America/La_Paz", search:"", status:"upcoming"});
    assert.equal(tomorrow.length, 1);
    assert.equal(tomorrow[0].workflow.publish_state, "pending_channels");
    assert.equal(tomorrow[0].workflowStage, "publication");
  });
  it("keeps one render row while the scheduled recording starts", () => {
    const events = buildAgenda({...base(), workflows:[workflow({record_job_id:"r1",record_state:"recording"})],
      recordings:[{jobId:"r1", videoId:"v1", state:"rendering", startedAt:"2026-11-14T10:20:00Z"}]});
    const renders=events.filter((e)=>e.kind === "render");
    assert.equal(renders.length,1);
    assert.equal(renders[0].at,"2026-11-14T10:10:00Z");
    assert.equal(renders[0].recording.startedAt,"2026-11-14T10:20:00Z");
  });
  it("does not keep a second publication placeholder after queue handoff", () => {
    const events=buildAgenda({...base(),workflows:[workflow({queue_entry_ids:["q1"]})], publications:[{entryId:"q1",jobId:"lib1",status:"queued",scheduledAt:"2026-11-15T04:00:00Z"}]});
    assert.equal(events.filter((e)=>e.kind === "publication").length,1);
  });
});


describe("Workflow review states", () => {
  it("opens preparation-only workflows through their saved plan and retains cancellation", () => {
    const [event]=buildAgenda({...base(),plans:[plan()],productions:[production()], workflows:[{workflow_id:"w2",production_id:"p1",state:"cancelled"}]});
    assert.equal(event.workflow.workflow_id,"w2");
    assert.equal(event.status,"cancelled");
  });
  it("does not describe a queued recorder as actively rendering", () => {
    const [event]=buildAgenda({...base(),workflows:[{workflow_id:"w1",video_id:"v1",topic:"Tema",record_at:"2026-11-14T10:10:00Z",record_state:"recording",record_job_id:"r1",state:"recording"}], recordings:[{jobId:"r1",videoId:"v1",state:"queued",startedAt:null}]});
    assert.equal(event.status,"queued");
  });
  it("keeps dispatch errors in the attention filter", () => {
    const events=buildAgenda({...base(),workflows:[{workflow_id:"w1",video_id:"v1",topic:"Tema",record_at:"2026-11-14T10:10:00Z",record_state:"dispatching",state:"attention",error:"Already recording"}]});
    const errors=filterAgenda(events,{kind:"all",range:"all",day:"2026-11-14",zone:"America/La_Paz",search:"",status:"attention"});
    assert.equal(errors.length,1);
    assert.equal(errors[0].error,"Already recording");
  });
});


it("never links two absent production IDs from unrelated plans and workflows", () => {
  const [event] = buildAgenda({...base(),plans:[plan({productionId:null})],workflows:[{workflow_id:"existing",production_id:null,video_id:"other",state:"cancelled"}]});
  assert.equal(event.workflow,undefined);
  assert.equal(event.status,"scheduled");
});
