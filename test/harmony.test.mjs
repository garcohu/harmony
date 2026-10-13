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
const { HarmonyError, agent, ask, initApp, scan, serve, tool } = sdk;

function run(cwd, args) {
  return spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" });
}

test("scan reads Next pages and Expo file routes as one tree", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harmony-scan-"));
  const app = path.join(dir, "app");
  fs.mkdirSync(path.join(app, "(public)", "notes"), { recursive: true });
  fs.writeFileSync(path.join(app, "_layout.tsx"), "export default function L(){ return null }\n");
  fs.writeFileSync(path.join(app, "index.tsx"), "export default function H(){ return null }\n");
  fs.writeFileSync(path.join(app, "(public)", "notes", "page.tsx"), "export default function N(){ return null }\n");
  fs.writeFileSync(path.join(app, "about.tsx"), "export default function A(){ return null }\n");
  fs.writeFileSync(path.join(app, "health+api.ts"), "export function GET(){ return new Response('ok') }\n");
  const project = scan(app);
  assert.deepEqual(
    project.screens.map((screen) => screen.path),
    ["/", "/about", "/notes"],
  );
  assert.equal(project.screens[0].layouts.length, 1);
  assert.deepEqual(project.endpoints.map((endpoint) => endpoint.path), ["/health"]);
});

test("the shelf example is the documented tree", () => {
  const project = scan(path.join(root, "examples", "shelf", "app"));
  assert.deepEqual(
    project.screens.map((screen) => [screen.path, path.relative(path.join(root, "examples", "shelf"), screen.file)]),
    [
      ["/", "app/page.tsx"],
      ["/volume/:id", "app/volume/[id]/page.tsx"],
    ],
  );
  assert.deepEqual(
    project.endpoints.map((endpoint) => [endpoint.methods.join(","), endpoint.path]),
    [
      ["GET", "/api/shelf"],
      ["GET", "/health"],
      ["GET", "/volume/:id"],
    ],
  );
  assert.deepEqual(project.tools[0].names, ["summarize", "fileDispatch"]);
  assert.equal(project.agent.name, "librarian");
});

test("an agent cannot call a tool it was not given", async () => {
  let sent = 0;
  const summarize = tool({
    name: "summarize",
    description: "Summarize the shelf. Nothing is sent.",
    run() {
      return { detail: "Three volumes." };
    },
  });
  const fileDispatch = tool({
    name: "fileDispatch",
    description: "Send the briefing out of the room.",
    run() {
      sent += 1;
      return { detail: "sent" };
    },
  });
  const closed = agent({ name: "librarian", instructions: "Do not send.", tools: [summarize] });
  const refused = await ask(closed, "send the briefing");
  assert.equal(refused.tool, null);
  assert.equal(sent, 0);
  const open = agent({ name: "librarian", instructions: "You may send.", tools: [summarize, fileDispatch] });
  const allowed = await ask(open, "send the briefing");
  assert.equal(allowed.tool, "fileDispatch");
  assert.equal(sent, 1);
  const invented = await ask(closed, "send the briefing", {
    model: () => ({ tool: "fileDispatch", input: {} }),
  });
  assert.equal(invented.ok, false);
  assert.equal(sent, 1);
});

test("init writes a project the scanner accepts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harmony-init-"));
  initApp(path.join(dir, "notes"), "notes");
  const project = scan(path.join(dir, "notes", "app"));
  assert.deepEqual(project.screens.map((screen) => screen.path), ["/"]);
  assert.equal(project.endpoints[0].path, "/api/hello");
  assert.equal(project.agent.name, "guide");
  assert.throws(() => initApp(path.join(dir, "notes"), "notes"), HarmonyError);
});

test("dev serves a screen, a route handler, and the agent", async () => {
  const shelf = path.join(root, "examples", "shelf");
  const running = await serve(shelf, { port: 0, host: "127.0.0.1", watch: false });
  try {
    const page = await fetch(running.url + "/", { headers: { accept: "text/html" } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /id="root"/);
    const script = await fetch(running.url + "/_harmony/app.js");
    assert.equal(script.status, 200);
    assert.match(await script.text(), /Router/);
    const list = await fetch(running.url + "/api/shelf");
    assert.equal(list.status, 200);
    const body = await list.json();
    assert.equal(body.shelf.length, 3);
    const volume = await fetch(running.url + "/volume/saturn", { headers: { accept: "application/json" } });
    assert.equal(volume.status, 200);
    assert.equal((await volume.json()).title, "The Rings of Saturn");
    const asScreen = await fetch(running.url + "/volume/saturn", { headers: { accept: "text/html" } });
    assert.match(await asScreen.text(), /id="root"/);
    const health = await fetch(running.url + "/health");
    assert.equal((await health.json()).ok, true);
    const asked = await fetch(running.url + "/_harmony/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: "summarize the shelf" }),
    });
    const answer = await asked.json();
    assert.equal(answer.tool, "summarize");
    assert.match(answer.text, /Sebald/);
    const blocked = await fetch(running.url + "/_harmony/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: "send the briefing" }),
    });
    const denial = await blocked.json();
    assert.equal(denial.tool, null);
  } finally {
    await running.close();
  }
});

test("the cli lists routes and asks the librarian", () => {
  const shelf = path.join(root, "examples", "shelf");
  const routes = run(shelf, ["routes"]);
  assert.equal(routes.status, 0, routes.stderr);
  assert.match(routes.stdout, /\/volume\/:id/);
  assert.match(routes.stdout, /health\+api\.ts/);
  assert.match(routes.stdout, /librarian/);
  const asked = run(shelf, ["ask", "summarize the shelf"]);
  assert.equal(asked.status, 0, asked.stderr);
  assert.match(asked.stdout, /summarize/);
  assert.match(asked.stdout, /Sebald/);
});
