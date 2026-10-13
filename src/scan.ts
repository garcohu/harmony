import fs from "node:fs";
import path from "node:path";
import { HarmonyError } from "./errors.js";

export type Screen = {
  path: string;
  file: string;
  layouts: string[];
  loading: string | null;
  error: string | null;
};

export type Endpoint = {
  path: string;
  file: string;
  methods: string[];
};

export type ToolFile = {
  file: string;
  names: string[];
};

export type Project = {
  screens: Screen[];
  endpoints: Endpoint[];
  tools: ToolFile[];
  agent: { file: string; name: string | null } | null;
};

const SCREEN_EXT = new Set([".tsx", ".ts", ".jsx", ".js"]);
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

function urlOf(segments: string[]): string {
  return segments.length ? `/${segments.join("/")}` : "/";
}

function readMethods(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  const found = new Set<string>();
  for (const name of METHODS) {
    const fn = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`);
    const cn = new RegExp(`export\\s+(?:const|let)\\s+${name}\\s*=`);
    if (fn.test(source) || cn.test(source)) found.add(name);
  }
  return [...found];
}

function toolNames(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  const names: string[] = [];
  for (const match of source.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=\s*tool\s*\(/g)) {
    const start = match.index ?? 0;
    const slice = source.slice(start, start + 400);
    const named = slice.match(/name\s*:\s*["']([^"']+)["']/);
    names.push(named?.[1] ?? match[1] ?? "");
  }
  return names.filter(Boolean);
}

function agentName(file: string): string | null {
  const source = fs.readFileSync(file, "utf8");
  return source.match(/agent\s*\(\s*\{[\s\S]*?\bname\s*:\s*["']([^"']+)["']/)?.[1] ?? null;
}

type Chain = { layout?: string; loading?: string; error?: string };

function isLayout(name: string): boolean {
  return name === "layout.tsx" || name === "layout.ts" || name === "_layout.tsx" || name === "_layout.ts" || name === "layout.jsx" || name === "_layout.jsx";
}

export function scan(appDir: string): Project {
  if (!fs.existsSync(appDir)) throw new HarmonyError("INVALID_PROJECT", `No app directory at ${appDir}`);
  const screens: Screen[] = [];
  const endpoints: Endpoint[] = [];
  const tools: ToolFile[] = [];
  const agents: { file: string; name: string | null }[] = [];

  function addScreen(routePath: string, file: string, chain: Chain[]) {
    if (screens.some((screen) => screen.path === routePath)) {
      throw new HarmonyError("INVALID_PROJECT", `Two screens claim ${routePath}.`);
    }
    const layouts = chain.flatMap((item) => (item.layout ? [item.layout] : []));
    const loading = [...chain].reverse().find((item) => item.loading)?.loading ?? null;
    const error = [...chain].reverse().find((item) => item.error)?.error ?? null;
    screens.push({ path: routePath, file, layouts, loading, error });
  }

  function addEndpoint(routePath: string, file: string) {
    if (endpoints.some((endpoint) => endpoint.path === routePath)) {
      throw new HarmonyError("INVALID_PROJECT", `Two route handlers claim ${routePath}.`);
    }
    const methods = readMethods(file);
    if (!methods.length) throw new HarmonyError("INVALID_PROJECT", `${path.relative(appDir, file)} exports no HTTP method.`);
    endpoints.push({ path: routePath, file, methods });
  }

  function walk(dir: string, segments: string[], chain: Chain[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    const here: Chain = {};
    for (const entry of entries) {
      if (!entry.isFile() || !isLayout(entry.name)) continue;
      if (here.layout) throw new HarmonyError("INVALID_PROJECT", `Two layouts in ${dir}.`);
      here.layout = path.join(dir, entry.name);
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name === "loading.tsx" || entry.name === "loading.ts") here.loading = path.join(dir, entry.name);
      if (entry.name === "error.tsx" || entry.name === "error.ts") here.error = path.join(dir, entry.name);
    }
    const next = [...chain, here];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const file = path.join(dir, entry.name);
      const ext = path.extname(entry.name);
      const stem = entry.name.slice(0, -ext.length);
      if (entry.name === "tools.ts" || entry.name === "tools.tsx" || stem.endsWith(".tool")) {
        tools.push({ file, names: toolNames(file) });
        continue;
      }
      if (entry.name === "agent.ts" || entry.name === "agent.tsx") {
        agents.push({ file, name: agentName(file) });
        continue;
      }
      if (entry.name === "route.ts" || entry.name === "route.js") {
        addEndpoint(urlOf(segments), file);
        continue;
      }
      if (stem.endsWith("+api")) {
        const leaf = stem.slice(0, -"+api".length);
        addEndpoint(urlOf(leaf ? [...segments, leaf] : segments), file);
        continue;
      }
      if (isLayout(entry.name) || entry.name.startsWith("loading.") || entry.name.startsWith("error.")) continue;
      if (stem === "page" || stem === "index") {
        addScreen(urlOf(segments), file, next);
        continue;
      }
      if (ext !== ".tsx" && ext !== ".jsx") continue;
      if (stem.startsWith("(") || stem.startsWith("_") || stem.startsWith("@")) continue;
      if (stem.startsWith("[...")) {
        throw new HarmonyError("INVALID_PROJECT", `Catch-all routes are not in Harmony 2.0 (${entry.name}).`);
      }
      const part = stem.startsWith("[") && stem.endsWith("]") ? `:${stem.slice(1, -1)}` : stem;
      addScreen(urlOf([...segments, part]), file, next);
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_") || entry.name.startsWith("@")) continue;
      if (entry.name.startsWith("[...") ) {
        throw new HarmonyError("INVALID_PROJECT", `Catch-all routes are not in Harmony 2.0 (${entry.name}).`);
      }
      const group = entry.name.startsWith("(") && entry.name.endsWith(")");
      const dynamic = entry.name.startsWith("[") && entry.name.endsWith("]");
      const part = group ? null : dynamic ? `:${entry.name.slice(1, -1)}` : entry.name;
      walk(path.join(dir, entry.name), part ? [...segments, part] : segments, next);
    }
  }

  walk(appDir, [], []);
  screens.sort((a, b) => a.path.localeCompare(b.path));
  endpoints.sort((a, b) => a.path.localeCompare(b.path));
  tools.sort((a, b) => a.file.localeCompare(b.file));
  agents.sort((a, b) => a.file.length - b.file.length);
  return { screens, endpoints, tools, agent: agents[0] ?? null };
}
