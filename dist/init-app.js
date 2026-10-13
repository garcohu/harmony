import fs from "node:fs";
import path from "node:path";
import { HarmonyError } from "./errors.js";
const LAYOUT = `import type { ReactNode } from "react";
import { Link } from "harmony/router";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: "Georgia, serif", background: "#F4F1EA", color: "#10110F", minHeight: "100vh", padding: 24 }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Link href="/">Home</Link>
      </nav>
      {children}
    </div>
  );
}
`;
const PAGE = `import { useEffect, useState } from "react";

export default function Home() {
  const [hello, setHello] = useState<string>("");
  useEffect(() => {
    void fetch("/api/hello").then((response) => response.json()).then((body: { hello: string }) => setHello(body.hello));
  }, []);
  return (
    <main>
      <h1 style={{ fontWeight: 500 }}>Hello</h1>
      <p>{hello || "Loading the route handler."}</p>
    </main>
  );
}
`;
const ROUTE = `export function GET() {
  return Response.json({ hello: "Harmony" });
}
`;
const TOOLS = `import { tool } from "harmony/ai";

export const greet = tool({
  name: "greet",
  description: "Greet the person by name.",
  input: { name: { type: "string", required: false, description: "Who to greet." } },
  run({ name }) {
    return { detail: \`Hello \${name || "there"}.\` };
  },
});
`;
const AGENT = `import { agent } from "harmony/ai";
import { greet } from "./tools";

export default agent({
  name: "guide",
  instructions: "Greet people. Do not invent tools.",
  tools: [greet],
});
`;
export function initApp(dir, name) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        throw new HarmonyError("INVALID_PROJECT", "The project name must be lowercase, hyphen allowed.");
    }
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(path.join(dir, "app")) || fs.existsSync(path.join(dir, "harmony.json"))) {
        throw new HarmonyError("IO", "A Harmony project already exists here.");
    }
    fs.mkdirSync(path.join(dir, "app", "api", "hello"), { recursive: true });
    fs.writeFileSync(path.join(dir, "harmony.json"), `${JSON.stringify({ name, scheme: name, platforms: ["ios", "android", "web"] }, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify({
        name,
        private: true,
        type: "module",
        scripts: { dev: "harmony dev", build: "harmony build", start: "harmony start" },
        dependencies: { harmony: "github:garcohu/harmony", react: "^19.2.0", "react-dom": "^19.2.0" },
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules\n.harmony\n");
    fs.writeFileSync(path.join(dir, "app", "layout.tsx"), LAYOUT);
    fs.writeFileSync(path.join(dir, "app", "page.tsx"), PAGE);
    fs.writeFileSync(path.join(dir, "app", "api", "hello", "route.ts"), ROUTE);
    fs.writeFileSync(path.join(dir, "app", "tools.ts"), TOOLS);
    fs.writeFileSync(path.join(dir, "app", "agent.ts"), AGENT);
    return dir;
}
//# sourceMappingURL=init-app.js.map