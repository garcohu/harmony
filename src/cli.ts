#!/usr/bin/env node
import path from "node:path";
import { VERSION } from "./ai.js";
import { readConfig } from "./config.js";
import { isHarmonyError } from "./errors.js";
import { initApp } from "./init-app.js";
import { scan } from "./scan.js";

function fail(error: unknown): number {
  const message = isHarmonyError(error) ? error.message : error instanceof Error ? error.message : "Harmony stopped.";
  process.stderr.write(`${message}\n`);
  return 1;
}

function rel(cwd: string, file: string): string {
  return path.relative(cwd, file).split(path.sep).join("/");
}

function printRoutes(cwd: string): void {
  const config = readConfig(cwd);
  const project = scan(path.join(cwd, "app"));
  const lines = [
    config.name,
    `platforms  ${config.platforms.join("  ")}`,
    `scheme     ${config.scheme}://`,
    "",
    "screens",
    ...(project.screens.length
      ? project.screens.map((screen) => `  ${screen.path.padEnd(16)} ${rel(cwd, screen.file)}`)
      : ["  none"]),
    "",
    "handlers",
    ...(project.endpoints.length
      ? project.endpoints.flatMap((endpoint) =>
          endpoint.methods.map((method) => `  ${method.padEnd(6)} ${endpoint.path.padEnd(16)} ${rel(cwd, endpoint.file)}`),
        )
      : ["  none"]),
    "",
    "tools",
    ...(project.tools.length
      ? project.tools.flatMap((file) => file.names.map((name) => `  ${name.padEnd(16)} ${rel(cwd, file.file)}`))
      : ["  none"]),
    "",
    "agent",
    project.agent ? `  ${(project.agent.name ?? "agent").padEnd(16)} ${rel(cwd, project.agent.file)}` : "  none",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function help(): void {
  process.stdout.write(`harmony ${VERSION}

init [name]       create an app directory
dev               serve screens, route handlers, and the agent
build             bundle the client
start             serve the build
routes            list screens, handlers, tools, and the agent
ask "…"           run the agent against its tools

Screens use Expo file routes and Next pages. Handlers use Expo +api and Next route.ts.
The agent can call only the tools you passed it.
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0] ?? "";
  const cwd = process.cwd();
  if (cmd === "" || cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    return;
  }
  if (cmd === "version" || cmd === "--version" || cmd === "-v") {
    process.stdout.write(`harmony ${VERSION}\n`);
    return;
  }
  if (cmd === "init") {
    const name = argv[1] ?? path.basename(cwd);
    const dir = argv[1] ? path.resolve(cwd, argv[1]) : cwd;
    initApp(dir, name);
    process.stdout.write(`${dir}\n`);
    process.stdout.write("harmony dev\n");
    return;
  }
  if (cmd === "routes") {
    printRoutes(cwd);
    return;
  }
  if (cmd === "dev" || cmd === "start" || cmd === "build") {
    const { prepare, serve } = await import("./serve.js");
    if (cmd === "build") {
      const built = await prepare(cwd, false);
      await built.dispose();
      process.stdout.write(`${path.join(cwd, ".harmony", "build")}\n`);
      process.stdout.write("harmony start\n");
      return;
    }
    const portFlag = argv.indexOf("--port");
    const port = portFlag >= 0 ? Number(argv[portFlag + 1]) : cmd === "start" ? 3000 : 3000;
    if (!Number.isInteger(port) || port <= 0) throw new Error("--port needs a number.");
    const running = await serve(cwd, { port, watch: cmd === "dev" });
    const config = readConfig(cwd);
    const project = scan(path.join(cwd, "app"));
    process.stdout.write(`harmony ${cmd}\n`);
    process.stdout.write(`web        ${running.url}\n`);
    process.stdout.write(`scheme     ${config.scheme}://\n`);
    process.stdout.write(`screens    ${project.screens.length}\n`);
    process.stdout.write(`handlers   ${project.endpoints.length}\n`);
    process.stdout.write(`agent      ${project.agent?.name ?? "none"}\n`);
    process.stdout.write("The same screens are the iOS and Android tree. This process serves web.\n");
    await new Promise<void>((resolve) => {
      const stop = () => {
        void running.close().finally(() => resolve());
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
    return;
  }
  if (cmd === "ask") {
    const input = argv.slice(1).join(" ").trim();
    if (!input) {
      process.stderr.write("ask needs a message.\n");
      process.exitCode = 1;
      return;
    }
    const project = scan(path.join(cwd, "app"));
    if (!project.agent) throw new Error("This project has no app/agent.ts.");
    const { pathToFileURL } = await import("node:url");
    const esbuild = (await import("esbuild")).default;
    const outfile = path.join(cwd, ".harmony", "ask.mjs");
    const { fileURLToPath } = await import("node:url");
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    await esbuild.build({
      entryPoints: [project.agent.file],
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
      logLevel: "silent",
      alias: {
        "harmony/ai": path.join(root, "dist", "ai.js"),
      },
    });
    const loaded = (await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`)) as { default?: { kind?: string; name?: string } };
    if (!loaded.default || loaded.default.kind !== "harmony.agent") throw new Error("app/agent.ts must default-export agent().");
    const { ask } = await import("./ai.js");
    const result = await ask(loaded.default as Parameters<typeof ask>[0], input);
    process.stdout.write(`${result.agent}${result.tool ? `  ·  ${result.tool}` : ""}\n`);
    process.stdout.write(`${result.text}\n`);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  process.stderr.write(`No such command: ${cmd}.\n`);
  process.stderr.write("Try harmony help.\n");
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.exitCode = fail(error);
});
