import { ask } from "./ai.js";
import { librarian } from "./demo.js";
import { SHELF } from "./manifest.js";
function line(text) {
    return { type: "line", tone: "body", text };
}
function quiet(text) {
    return { type: "line", tone: "quiet", text };
}
function italic(text) {
    return { type: "line", tone: "italic", text };
}
function gap() {
    return { type: "gap" };
}
export function freshState() {
    return {
        included: SHELF.tools.filter((item) => item.on).map((item) => item.name),
        lastAsk: null,
    };
}
export function welcomeBlocks() {
    return [
        line("harmony 2.0.0"),
        italic("One app directory. Screens, route handlers, then the agent."),
        gap(),
        {
            type: "staff",
            app: `${SHELF.screens.length} screens`,
            api: `${SHELF.handlers.length} handlers`,
            agent: SHELF.agent,
        },
        gap(),
        quiet("Type routes. Or ask to summarize the shelf."),
    ];
}
function parse(raw) {
    let text = raw.trim();
    if (/^harmony\b/i.test(text))
        text = text.replace(/^harmony\b/i, "").trim();
    const match = text.match(/^(\S+)(?:\s+([\s\S]+))?$/);
    if (!match?.[1])
        return { cmd: "", arg: "" };
    let arg = (match[2] ?? "").trim();
    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'")))
        arg = arg.slice(1, -1);
    return { cmd: match[1].toLowerCase(), arg };
}
function routes() {
    return [
        quiet(`${SHELF.name}  ·  ${SHELF.platforms.join("  ")}`),
        gap(),
        line("screens"),
        ...SHELF.screens.map((screen) => quiet(`${screen.path.padEnd(16)} ${screen.file}`)),
        gap(),
        line("handlers"),
        ...SHELF.handlers.map((handler) => quiet(`${handler.methods.join(" ")}  ${handler.path.padEnd(16)} ${handler.file}`)),
        gap(),
        italic("page.tsx is a screen. route.ts and +api.ts are the server. Same path, one process."),
    ];
}
export async function reduceAsync(state, raw) {
    const { cmd, arg } = parse(raw);
    if (!cmd)
        return { state, blocks: [], code: 0 };
    if (cmd === "help") {
        return {
            state,
            code: 0,
            blocks: [
                line("harmony 2.0.0"),
                quiet("routes          screens, handlers, tools"),
                quiet("dev             the dev server"),
                quiet("build           bundle the client"),
                quiet("start           serve the build"),
                quiet("ask \"…\"         run the agent"),
                quiet("tools           what the agent may call"),
                quiet("include         give the agent a tool"),
                quiet("exclude         take a tool back"),
                gap(),
                italic("In a project, these commands are the real CLI. This desk runs the agent for Shelf."),
            ],
        };
    }
    if (cmd === "routes")
        return { state, blocks: routes(), code: 0 };
    if (cmd === "dev" || cmd === "start") {
        return {
            state,
            code: 0,
            blocks: [
                line(`harmony ${cmd}`),
                quiet("web        http://127.0.0.1:3000"),
                quiet("scheme     shelf://"),
                {
                    type: "staff",
                    app: `${SHELF.screens.length} screens`,
                    api: `${SHELF.handlers.length} handlers`,
                    agent: state.included.length ? SHELF.agent : "no tools",
                },
                gap(),
                italic("The same screens are the iOS and Android tree. The process serves web, the handlers, and the agent."),
            ],
        };
    }
    if (cmd === "build") {
        return { state, code: 0, blocks: [line(".harmony/build"), quiet("harmony start")] };
    }
    if (cmd === "tools") {
        return {
            state,
            code: 0,
            blocks: SHELF.tools.map((item) => quiet(`${state.included.includes(item.name) ? "on " : "off"}  ${item.name}  ${item.description}`)),
        };
    }
    if (cmd === "include" || cmd === "exclude") {
        const known = SHELF.tools.find((item) => item.name === arg);
        if (!known)
            return { state, code: 2, blocks: [line(arg ? `No tool named ${arg}.` : `${cmd} needs a tool.`)] };
        const has = state.included.includes(known.name);
        const included = cmd === "include" ? (has ? state.included : [...state.included, known.name]) : state.included.filter((name) => name !== known.name);
        return {
            state: { ...state, included },
            code: 0,
            blocks: [line(cmd === "include" ? `${known.name} is on the agent.` : `${known.name} is off the agent.`)],
        };
    }
    if (cmd === "ask") {
        if (!arg)
            return { state, code: 2, blocks: [quiet("ask needs a message."), italic('ask "summarize the shelf"')] };
        const result = await ask(librarian(state.included), arg);
        return {
            state: { ...state, lastAsk: { input: arg, tool: result.tool, text: result.text } },
            code: result.ok ? 0 : 1,
            blocks: [
                quiet(`${result.agent}${result.tool ? `  ·  ${result.tool}` : ""}`),
                gap(),
                italic(result.text),
            ],
        };
    }
    if (cmd === "init") {
        return { state, code: 0, blocks: [line("harmony init my-app"), italic("Writes app/page.tsx, a route handler, a tool, and an agent.")] };
    }
    return { state, code: 2, blocks: [line(`No such command: ${cmd}.`), quiet("Try help.")] };
}
//# sourceMappingURL=desk.js.map