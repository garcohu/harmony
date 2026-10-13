# Harmony

One app directory. Screens from Expo. Route handlers from Next. AI tools on top of both.

```bash
npx github:garcohu/harmony init shelf
cd shelf
npx harmony dev
```

`harmony dev` serves the screens and the route handlers on one port. The same files are the iOS and Android tree. This version runs them on web. It does not compile a native binary.

## What it takes from each

| | Expo | Next | Harmony |
| --- | --- | --- | --- |
| File is a screen | `app/about.tsx`, `app/index.tsx` | `app/about/page.tsx` | both |
| Layout | `app/_layout.tsx` and `<Slot />` | `app/layout.tsx` and `{children}` | both, in the same layout |
| HTTP handler | `app/health+api.ts` | `app/api/hello/route.ts` | both |
| Dynamic segment | `app/volume/[id].tsx` | `app/volume/[id]/page.tsx` | both |
| Loading and error | | `loading.tsx`, `error.tsx` | yes |
| Route group | `(name)` is not in the URL | `(name)` is not in the URL | yes |
| Dev, build, start | `expo start` | `next dev`, `next build`, `next start` | `harmony dev`, `harmony build`, `harmony start` |
| Project file | `app.json` | `next.config` | `harmony.json` |
| Link, params | `Link`, `useRouter`, `useLocalSearchParams` | `Link`, `useRouter`, `useParams` | `Link`, `useRouter`, `useParams` from `harmony/router` |

A browser navigation (`Accept: text/html`) renders the screen. `fetch` on the same path runs the route handler, when one exists.

## A screen and a handler

```tsx
// app/page.tsx
import { useEffect, useState } from "react";

export default function Home() {
  const [hello, setHello] = useState("");
  useEffect(() => {
    void fetch("/api/hello").then((response) => response.json()).then((body) => setHello(body.hello));
  }, []);
  return <h1>{hello}</h1>;
}
```

```ts
// app/api/hello/route.ts
export function GET() {
  return Response.json({ hello: "Harmony" });
}
```

```tsx
// app/layout.tsx
import type { ReactNode } from "react";
import { Link, Slot } from "harmony/router";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Link href="/">Home</Link>
      {children}
    </div>
  );
}
```

Use `{children}` or `<Slot />`. A layout can use either.

## Commands

| Command | |
| --- | --- |
| `harmony init [name]` | Write `harmony.json`, `app/page.tsx`, a route handler, a tool, and an agent. |
| `harmony dev` | Serve web, handlers, and `POST /_harmony/agent`. `--port` chooses the port. |
| `harmony build` | Bundle the client to `.harmony/build`. |
| `harmony start` | Serve that bundle. |
| `harmony routes` | Screens, handlers, tools, agent. |
| `harmony ask "…"` | Run `app/agent.ts` against the message. |

`harmony.json`:

```json
{ "name": "Shelf", "scheme": "shelf", "platforms": ["ios", "android", "web"] }
```

## AI, on top

A tool is a function. An agent receives a list of tools. It cannot call anything else, including a tool that exists in the project but was not passed in.

```ts
import { agent, tool } from "harmony/ai";

export const summarize = tool({
  name: "summarize",
  description: "Summarize the shelf. Nothing is sent.",
  async run() {
    return { detail: "Three volumes." };
  },
});

export default agent({
  name: "librarian",
  instructions: "Help the reader. Do not send mail.",
  tools: [summarize],
});
```

```bash
harmony ask "summarize the shelf"
```

The default model is local. It picks a tool by the words in your message and the tool's name and description. It does not call a network. Pass your own model when you want one:

```ts
import { ask } from "harmony/ai";

await ask(librarian, "summarize the shelf", {
  model: async ({ input, tools }) => ({ tool: tools[0]?.name, input: {} }),
});
```

`POST /_harmony/agent` with `{ "input": "summarize the shelf" }` does the same thing while `harmony dev` is running.

See [examples/shelf](examples/shelf) for a screen, a dynamic route, an Expo `+api.ts` handler, and an agent that may summarize and may not dispatch.
