import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { readConfig } from "./config.js";
import { ask } from "./ai.js";
import { HarmonyError } from "./errors.js";
import { matchPath, normalize, specificity } from "./match.js";
import { scan } from "./scan.js";
const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function resolveFrom(base, specifier) {
    try {
        return createRequire(path.join(base, "package.json")).resolve(specifier);
    }
    catch {
        return null;
    }
}
function plugin(cwd) {
    const aliases = {
        harmony: path.join(pkgRoot, "dist", "index.js"),
        "harmony/ai": path.join(pkgRoot, "dist", "ai.js"),
        "harmony/router": path.join(pkgRoot, "dist", "router.js"),
        "harmony/server": path.join(pkgRoot, "dist", "server.js"),
    };
    return {
        name: "harmony",
        setup(build) {
            build.onResolve({ filter: /^harmony(\/[\w-]+)?$/ }, (args) => {
                const hit = aliases[args.path];
                return hit ? { path: hit } : null;
            });
            build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => {
                const hit = resolveFrom(path.join(cwd, "node_modules"), args.path) ?? resolveFrom(path.join(pkgRoot, "node_modules"), args.path);
                return hit ? { path: hit } : null;
            });
        },
    };
}
function entrySource(project, appDir) {
    const lines = [`import { createRoot } from "react-dom/client";`, `import { Router } from "harmony/router";`];
    const routes = [];
    project.screens.forEach((screen, index) => {
        lines.push(`import Page${index} from ${JSON.stringify(screen.file)};`);
        const layouts = screen.layouts.map((file, layoutIndex) => {
            const name = `Layout${index}_${layoutIndex}`;
            lines.push(`import ${name} from ${JSON.stringify(file)};`);
            return name;
        });
        let loading = "null";
        if (screen.loading) {
            loading = `Loading${index}`;
            lines.push(`import ${loading} from ${JSON.stringify(screen.loading)};`);
        }
        let error = "null";
        if (screen.error) {
            error = `Error${index}`;
            lines.push(`import ${error} from ${JSON.stringify(screen.error)};`);
        }
        routes.push(`{ path: ${JSON.stringify(screen.path)}, Page: Page${index}, layouts: [${layouts.join(", ")}], Loading: ${loading}, Error: ${error} }`);
    });
    if (!project.screens.length) {
        return `import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")).render("This project has route handlers and no screens.");
`;
    }
    lines.push(`const routes = [${routes.join(",\n")}];`);
    lines.push(`createRoot(document.getElementById("root")).render(<Router routes={routes} />);`);
    void appDir;
    return lines.join("\n");
}
function html(title) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title.replace(/[&<>]/g, (char) => ({ "&": "&", "<": "<", ">": ">" })[char] ?? char)}</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/_harmony/app.js"></script>
</body>
</html>`;
}
async function compileServer(file, outfile, cwd) {
    await esbuild.build({
        entryPoints: [file],
        outfile,
        bundle: true,
        platform: "node",
        format: "esm",
        jsx: "automatic",
        logLevel: "silent",
        plugins: [plugin(cwd)],
    });
}
function pick(items, pathname) {
    const hits = items
        .map((item) => ({ item, params: matchPath(item.path, pathname) }))
        .filter((hit) => hit.params !== null);
    hits.sort((a, b) => specificity(a.item.path) - specificity(b.item.path));
    return hits[0] ?? null;
}
async function toRequest(req, url) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string")
            headers.set(key, value);
        else if (Array.isArray(value))
            headers.set(key, value.join(", "));
    }
    const method = req.method ?? "GET";
    if (method === "GET" || method === "HEAD")
        return new Request(url, { method, headers });
    const chunks = [];
    for await (const chunk of req)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return new Request(url, { method, headers, body: Buffer.concat(chunks) });
}
async function send(res, response) {
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
        res.setHeader(key, value);
    });
    res.end(Buffer.from(await response.arrayBuffer()));
}
export async function prepare(cwd, watch) {
    const appDir = path.join(cwd, "app");
    const project = scan(appDir);
    const outDir = path.join(cwd, ".harmony", watch ? "dev" : "build");
    fs.mkdirSync(outDir, { recursive: true });
    const entry = path.join(outDir, "entry.tsx");
    fs.writeFileSync(entry, entrySource(project, appDir));
    const outfile = path.join(outDir, "app.js");
    const ctx = await esbuild.context({
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: "esm",
        platform: "browser",
        jsx: "automatic",
        sourcemap: true,
        logLevel: "silent",
        plugins: [plugin(cwd)],
    });
    await ctx.rebuild();
    if (watch)
        await ctx.watch();
    else
        await ctx.dispose();
    return {
        outDir,
        project,
        dispose: async () => {
            if (watch)
                await ctx.dispose();
        },
    };
}
export async function serve(cwd, options) {
    const host = options?.host ?? "127.0.0.1";
    const port = options?.port ?? 3000;
    const watch = options?.watch ?? true;
    const config = readConfig(cwd);
    const built = await prepare(cwd, watch);
    const serverFiles = new Map();
    async function loadModule(source) {
        const stat = fs.statSync(source);
        const cached = serverFiles.get(source);
        const outfile = path.join(built.outDir, "server", `${Buffer.from(source).toString("hex").slice(0, 24)}.mjs`);
        if (!cached || cached.mtime !== stat.mtimeMs) {
            fs.mkdirSync(path.dirname(outfile), { recursive: true });
            await compileServer(source, outfile, cwd);
            serverFiles.set(source, { file: source, mtime: stat.mtimeMs, outfile });
        }
        return (await import(`${pathToFileURL(outfile).href}?t=${stat.mtimeMs}`));
    }
    const server = http.createServer((req, res) => {
        void handle(req, res).catch((error) => {
            const message = error instanceof Error ? error.message : "The server stopped on this request.";
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end(message);
        });
    });
    async function handle(req, res) {
        const url = new URL(req.url ?? "/", `http://${host}`);
        const pathname = normalize(url.pathname);
        if (pathname === "/_harmony/app.js" || pathname === "/_harmony/app.js.map") {
            const file = pathname.endsWith(".map") ? path.join(built.outDir, "app.js.map") : path.join(built.outDir, "app.js");
            if (!fs.existsSync(file)) {
                res.statusCode = 404;
                res.end("The client bundle is not ready.");
                return;
            }
            res.setHeader("content-type", pathname.endsWith(".map") ? "application/json" : "text/javascript; charset=utf-8");
            res.end(fs.readFileSync(file));
            return;
        }
        if (pathname === "/_harmony/agent" && req.method === "POST") {
            if (!built.project.agent)
                throw new HarmonyError("INVALID_PROJECT", "This project has no app/agent.ts.");
            const request = await toRequest(req, url);
            const body = (await request.json());
            const loaded = await loadModule(built.project.agent.file);
            const defn = loaded.default;
            if (!defn || defn.kind !== "harmony.agent")
                throw new HarmonyError("INVALID_PROJECT", "app/agent.ts must default-export agent().");
            const result = await ask(defn, body.input ?? "");
            await send(res, Response.json(result, { status: result.ok ? 200 : 400 }));
            return;
        }
        const accept = req.headers.accept ?? "";
        const screen = pick(built.project.screens, pathname);
        const endpoint = pick(built.project.endpoints, pathname);
        const document = req.method === "GET" && accept.includes("text/html") && screen;
        if (!document && endpoint) {
            const method = req.method ?? "GET";
            if (!endpoint.item.methods.includes(method)) {
                await send(res, new Response(`No ${method} on ${pathname}.`, { status: 405 }));
                return;
            }
            const loaded = await loadModule(endpoint.item.file);
            const handler = loaded[method];
            if (typeof handler !== "function") {
                await send(res, new Response(`No ${method} on ${pathname}.`, { status: 405 }));
                return;
            }
            const response = await handler(await toRequest(req, url), { params: endpoint.params });
            await send(res, response);
            return;
        }
        if (screen && (req.method === "GET" || req.method === "HEAD")) {
            await send(res, new Response(html(config.name), { headers: { "content-type": "text/html; charset=utf-8" } }));
            return;
        }
        await send(res, new Response("Not found.", { status: 404 }));
    }
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => resolve());
    });
    const address = server.address();
    const actual = typeof address === "object" && address ? address.port : port;
    return {
        url: `http://${host}:${actual}`,
        port: actual,
        close: async () => {
            await built.dispose();
            await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        },
    };
}
//# sourceMappingURL=serve.js.map