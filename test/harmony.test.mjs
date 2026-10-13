import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const bin = path.join(root, "bin", "harmony.js");
const sdk = await import(pathToFileURL(path.join(root, "dist", "index.js")).href);

const {
  HarmonyError,
  call,
  defineAction,
  defineScore,
  freshState,
  grant,
  initProject,
  loadScore,
  loadSession,
  promote,
  reduceAsync,
  rehearse,
  revoke,
  saveSession,
  ship,
  validateScore,
  folioScore,
} = sdk;

function textOf(blocks) {
  return blocks
    .map((block) => {
      if (block.type === "line" || block.type === "echo") return block.text;
      if (block.type === "step") return `${block.index} ${block.name} ${block.detail}`;
      if (block.type === "staff") return `${block.app} ${block.api} ${block.agent}`;
      return "";
    })
    .join("\n");
}

test("the printed folio lets the agent summarize and not dispatch", async () => {
  const score = folioScore();
  let state = freshState(score);
  const first = rehearse(state, score, "summarize the shelf and file the dispatch");
  assert.equal(first.plan.refused, true);
  assert.deepEqual(
    first.plan.steps.map((step) => step.outcome),
    ["played", "refused"],
  );
  assert.match(first.plan.steps[1].detail, /Cadence c-1/);
  state = first.state;
  const promoted = promote(state, "c-1");
  assert.equal(promoted.ok, true);
  state = promoted.state;
  assert.equal(ship(state).ok, false);
  assert.match(ship(state).because, /Play it again/);
  const second = rehearse(state, score, "summarize the shelf and file the dispatch");
  assert.equal(second.plan.refused, false);
  state = second.state;
  const report = ship(state);
  assert.equal(report.ok, true);
  assert.match(report.because, /fileDispatch/);
});

test("call refuses an unscored write and does not run it", async () => {
  let ran = false;
  const score = defineScore({
    name: "gate",
    unison: 1,
    actions: [
      defineAction({
        name: "sendNote",
        kind: "write",
        summary: "Send a note.",
        files: ["api/note.ts"],
        voices: ["app", "api"],
        run() {
          ran = true;
          return { detail: "sent" };
        },
      }),
    ],
  });
  const state = freshState(score);
  const refused = await call(state, score, { name: "sendNote", voice: "agent" });
  assert.equal(refused.result.ok, false);
  assert.equal(refused.result.code, "NOT_SCORED");
  assert.equal(refused.result.cadenceId, "c-1");
  assert.equal(ran, false);
  const allowed = await call(refused.state, score, { name: "sendNote", voice: "api" });
  assert.equal(allowed.result.ok, true);
  assert.equal(ran, true);
});

test("dry call validates input and does not run", async () => {
  let ran = false;
  const score = defineScore({
    name: "notes",
    unison: 1,
    actions: [
      defineAction({
        name: "keepNote",
        kind: "write",
        summary: "Keep a note.",
        files: ["api/note.ts"],
        voices: ["app"],
        input: { note: { type: "string", required: true } },
        run() {
          ran = true;
          return { detail: "kept" };
        },
      }),
    ],
  });
  const state = freshState(score);
  const missing = await call(state, score, { name: "keepNote", voice: "app", dry: true });
  assert.equal(missing.result.ok, false);
  assert.equal(missing.result.code, "INVALID_INPUT");
  const dry = await call(state, score, { name: "keepNote", voice: "app", dry: true, input: { note: "margin" } });
  assert.equal(dry.result.ok, true);
  assert.equal(dry.result.dry, true);
  assert.equal(ran, false);
});

test("a score file rejects a second unison, a bad path, and a duplicate action", () => {
  assert.throws(() => validateScore({ name: "app", unison: 2, actions: [] }), HarmonyError);
  assert.throws(
    () =>
      validateScore({
        name: "app",
        unison: 1,
        actions: [
          {
            name: "readRecord",
            kind: "read",
            summary: "Read.",
            files: ["../secret.ts"],
            voices: ["app"],
          },
        ],
      }),
    /cannot climb/,
  );
  assert.throws(
    () =>
      validateScore({
        name: "app",
        unison: 1,
        actions: [
          { name: "readRecord", kind: "read", summary: "Read.", files: ["api/record.ts"], voices: ["app"] },
          { name: "readRecord", kind: "read", summary: "Again.", files: ["api/record.ts"], voices: ["api"] },
        ],
      }),
    /twice/,
  );
});

test("revoke will not leave an action silent, and grant is idempotent", () => {
  const score = folioScore();
  let state = freshState(score);
  assert.throws(() => revoke(freshState(score), "fileDispatch", "agent"), /never scored/);
  state = grant(state, "fileDispatch", "agent");
  assert.ok(state.actions.find((action) => action.name === "fileDispatch").voices.includes("agent"));
  assert.equal(grant(state, "fileDispatch", "agent"), state);
  const solo = defineScore({
    name: "solo",
    unison: 1,
    actions: [
      defineAction({
        name: "only",
        kind: "read",
        summary: "Only one voice.",
        files: ["api/only.ts"],
        voices: ["agent"],
      }),
    ],
  });
  assert.throws(() => revoke(freshState(solo), "only", "agent"), /no voice/);
});

test("session survives a restart and reset returns to the printed score", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harmony-session-"));
  const score = folioScore();
  const promoted = promote(rehearse(freshState(score), score, "file the dispatch").state, "1");
  assert.equal(promoted.ok, true);
  saveSession(dir, promoted.state);
  const loaded = loadSession(dir, score);
  assert.ok(loaded.actions.find((action) => action.name === "fileDispatch").voices.includes("agent"));
  assert.equal(loaded.cadences.find((cadence) => cadence.id === "c-1").open, false);
});

test("init writes a score the loader accepts", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harmony-init-"));
  const file = initProject(dir, "ledger");
  assert.equal(path.basename(file), "harmony.score.json");
  const loaded = await loadScore(dir);
  assert.equal(loaded.score.name, "ledger");
  assert.equal(loaded.score.actions.length, 2);
  assert.throws(() => initProject(dir, "ledger"), /already exists/);
});

test("the desk and the sdk agree on a refused rehearsal", async () => {
  const score = folioScore();
  const result = await reduceAsync(freshState(score), 'rehearse "summarize the shelf and file the dispatch"', score);
  assert.equal(result.code, 1);
  assert.match(textOf(result.blocks), /fileDispatch/);
  assert.match(textOf(result.blocks), /c-1/);
  const played = await reduceAsync(result.state, "call listShelf --voice api", score);
  assert.equal(played.code, 0);
  assert.match(textOf(played.blocks), /shelf was read/);
});

function run(cwd, args) {
  return spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" });
}

test("the cli holds, then clears, and the counter example gates reset", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harmony-cli-"));
  const refused = run(dir, ["rehearse", "summarize the shelf and file the dispatch"]);
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /fileDispatch/);
  assert.equal(run(dir, ["promote", "c-1"]).status, 0);
  assert.equal(run(dir, ["ship"]).status, 1);
  assert.equal(run(dir, ["rehearse", "summarize the shelf and file the dispatch"]).status, 0);
  const clear = run(dir, ["ship"]);
  assert.equal(clear.status, 0);
  assert.match(clear.stdout, /Clear/);
  const session = JSON.parse(fs.readFileSync(path.join(dir, ".harmony", "session.json"), "utf8"));
  assert.equal(session.v, 1);
  assert.equal(session.score, "folio");

  const counter = path.join(root, "examples", "counter");
  fs.rmSync(path.join(counter, ".harmony"), { recursive: true, force: true });
  const read = run(counter, ["call", "readCount", "--voice", "agent"]);
  assert.equal(read.status, 0, read.stderr || read.stdout);
  assert.match(read.stdout, /Count is 0/);
  const reset = run(counter, ["call", "resetCount", "--voice", "agent"]);
  assert.equal(reset.status, 1);
  assert.match(reset.stdout, /c-1/);
  const saved = run(counter, ["grant", "resetCount", "agent", "--save"]);
  assert.equal(saved.status, 0);
  assert.match(saved.stdout, /This score is code/);
});
