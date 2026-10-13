import { defineScore } from "./validate.js";
export const SHELF = [
    { title: "The Living Mountain", author: "Nan Shepherd", notes: 4 },
    { title: "The Rings of Saturn", author: "W.G. Sebald", notes: 11 },
    { title: "Invisible Cities", author: "Italo Calvino", notes: 2 },
];
export function pickVolume(intent, input = {}) {
    const q = `${intent} ${String(input.volume ?? "")} ${String(input.title ?? "")}`.toLowerCase();
    if (q.includes("shepherd") || q.includes("mountain"))
        return SHELF[0];
    if (q.includes("calvino") || q.includes("cities") || q.includes("invisible"))
        return SHELF[2];
    return SHELF[1];
}
function lower(intent) {
    return intent.toLowerCase();
}
const actions = [
    {
        name: "listShelf",
        kind: "read",
        summary: "Read the shelf. Titles, authors, how many notes in the margin.",
        files: ["app/shelf.tsx", "api/shelf.ts"],
        voices: ["app", "api"],
        match(intent) {
            const q = lower(intent);
            const summarize = /summar|brief/.test(q);
            const dispatch = /dispatch|publish|\bsend\b|\bfile\b/.test(q);
            return /\blist\b/.test(q) || (/\bshelf\b/.test(q) && !summarize && !dispatch);
        },
        detail() {
            return "Shepherd, 4 notes. Sebald, 11. Calvino, 2. The shelf was read.";
        },
        run(_input, ctx) {
            return {
                detail: "Shepherd, 4 notes. Sebald, 11. Calvino, 2. The shelf was read.",
                voice: ctx.voice,
                shelf: SHELF.map((volume) => ({ ...volume })),
            };
        },
    },
    {
        name: "openVolume",
        kind: "read",
        summary: "Open one volume. The page, and the notes already there.",
        files: ["app/volume/[id].tsx", "api/volume.ts"],
        voices: ["app", "api"],
        input: {
            volume: { type: "string", required: false, summary: "Title, author, or a word from either." },
        },
        match(intent) {
            const q = lower(intent);
            return (/open|sebald|shepherd|calvino|saturn|mountain|cities/.test(q) ||
                (/\bread\b/.test(q) && !/\bshelf\b/.test(q)));
        },
        detail(input, ctx) {
            const volume = pickVolume(ctx.intent ?? "", input);
            return `Opened ${volume.title}. ${volume.author}. ${volume.notes} notes in the margin. Read only.`;
        },
        run(input, ctx) {
            const volume = pickVolume(ctx.intent ?? "", input);
            return {
                detail: `Opened ${volume.title}. ${volume.author}. ${volume.notes} notes in the margin. Read only.`,
                voice: ctx.voice,
                volume: { ...volume },
            };
        },
    },
    {
        name: "annotate",
        kind: "write",
        summary: "Leave a margin note. A human hand. Not an agent's.",
        files: ["app/margin.tsx", "api/annotate.ts"],
        voices: ["app", "api"],
        input: {
            note: { type: "string", required: true, summary: "The margin note." },
        },
        match(intent) {
            return /annotat|margin|\bnote\b/.test(lower(intent));
        },
        detail() {
            return "A margin note was drafted and discarded. The page is still clean.";
        },
        run(input, ctx) {
            if (ctx.voice === "agent") {
                return { detail: "A margin note was drafted and discarded. The page is still clean.", kept: false };
            }
            return { detail: "A margin note was kept.", kept: true, note: input.note, voice: ctx.voice };
        },
    },
    {
        name: "summarizeShelf",
        kind: "read",
        summary: "Brief the shelf. Held in the room. Nothing is sent.",
        files: ["api/summarize.ts"],
        voices: ["app", "api", "agent"],
        match(intent) {
            return /summar|brief/.test(lower(intent));
        },
        detail() {
            return "Three volumes. The heaviest margin is Sebald, 11 notes. The briefing stays in the room.";
        },
        run(_input, ctx) {
            return {
                detail: "Three volumes. The heaviest margin is Sebald, 11 notes. The briefing stays in the room.",
                voice: ctx.voice,
                sent: false,
            };
        },
    },
    {
        name: "fileDispatch",
        kind: "write",
        summary: "Send the briefing out of the room. The agent must ask.",
        files: ["app/dispatch.tsx", "api/dispatch.ts"],
        voices: ["app", "api"],
        match(intent) {
            return /dispatch|publish|\bsend\b|\bfile\b/.test(lower(intent));
        },
        detail() {
            return "The briefing was addressed to the desk. Rehearsal does not send it.";
        },
        run(_input, ctx) {
            return {
                detail: "The briefing was addressed to the desk. It was not sent.",
                sent: false,
                voice: ctx.voice,
            };
        },
    },
];
let cached = null;
export function folioScore() {
    if (!cached)
        cached = defineScore({
            name: "folio",
            unison: 1,
            summary: "A private reading room. The agent may read the shelf. It may not send the briefing.",
            targets: ["web", "ios", "android"],
            actions,
        });
    return cached;
}
export function initialActions() {
    return folioScore().actions.map((action) => ({
        name: action.name,
        kind: action.kind,
        summary: action.summary,
        files: [...action.files],
        voices: [...action.voices],
        ...(action.input ? { input: structuredClone(action.input) } : {}),
    }));
}
export const MANUAL = [
    { cmd: "help", run: "help", blurb: "The index of the desk." },
    { cmd: "check", run: "check", blurb: "Validate the score on disk." },
    { cmd: "score", run: "score", blurb: "Every action, and who may play it." },
    { cmd: "functions", run: "functions", blurb: "The callable signatures." },
    { cmd: "dev", run: "dev", blurb: "Bind the app, the API, and the agent." },
    { cmd: "stop", run: "stop", blurb: "Release the three runtimes." },
    {
        cmd: 'rehearse "…"',
        run: 'rehearse "summarize the shelf and file the dispatch"',
        blurb: "Dry-run an intent. Writes stay in the room.",
    },
    {
        cmd: "call",
        run: "call listShelf --voice api",
        blurb: "Run one function, if that voice is scored.",
    },
    { cmd: "cadence", run: "cadence", blurb: "What the agent asked to change." },
    { cmd: "promote", run: "cadence", blurb: "Grant a voice. Then rehearse again." },
    { cmd: "ship", run: "ship", blurb: "Refuse to release an unrehearsed staff." },
    { cmd: "targets", run: "targets", blurb: "Web, iOS, Android. One preview." },
    { cmd: "routes", run: "routes", blurb: "The file tree. Screens beside servers." },
    { cmd: "folio", run: "folio", blurb: "The sample score: a private reading room." },
    { cmd: "reset", run: "reset", blurb: "Restore the printed score." },
];
export function detailOf(action, input, ctx) {
    if (typeof action.detail === "function")
        return action.detail(input, ctx);
    if (typeof action.detail === "string" && action.detail.trim())
        return action.detail;
    return action.summary;
}
//# sourceMappingURL=folio.js.map