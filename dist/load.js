import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { HarmonyError } from "./errors.js";
import { folioScore } from "./folio.js";
import { freshState } from "./session.js";
import { VOICES } from "./types.js";
import { validateScore } from "./validate.js";
const SESSION = path.join(".harmony", "session.json");
function isVoice(value) {
    return typeof value === "string" && VOICES.includes(value);
}
export async function loadScore(cwd) {
    for (const name of ["harmony.score.mjs", "harmony.score.js"]) {
        const file = path.join(cwd, name);
        if (!fs.existsSync(file))
            continue;
        const imported = (await import(pathToFileURL(file).href));
        const value = imported.default ?? imported.score;
        if (!value)
            throw new HarmonyError("INVALID_SCORE", `${name} must export a score.`);
        return { score: validateScore(value), file };
    }
    const jsonFile = path.join(cwd, "harmony.score.json");
    if (!fs.existsSync(jsonFile))
        return { score: folioScore(), file: null };
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
    }
    catch {
        throw new HarmonyError("INVALID_SCORE", "harmony.score.json is not JSON.");
    }
    return { score: validateScore(parsed), file: jsonFile };
}
function isStep(value) {
    if (!value || typeof value !== "object")
        return false;
    const step = value;
    return (typeof step.name === "string" &&
        (step.outcome === "played" || step.outcome === "refused") &&
        typeof step.detail === "string");
}
function isPlan(value) {
    if (!value || typeof value !== "object")
        return false;
    const plan = value;
    return typeof plan.intent === "string" && typeof plan.refused === "boolean" && Array.isArray(plan.steps) && plan.steps.every(isStep);
}
function isCadence(value) {
    if (!value || typeof value !== "object")
        return false;
    const cadence = value;
    return typeof cadence.id === "string" && typeof cadence.action === "string" && typeof cadence.open === "boolean";
}
export function loadSession(cwd, score) {
    const file = path.join(cwd, SESSION);
    if (!fs.existsSync(file))
        return freshState(score);
    try {
        const raw = JSON.parse(fs.readFileSync(file, "utf8"));
        const savedActions = raw.actions;
        if (raw.v !== 1 || raw.score !== score.name || !Array.isArray(savedActions))
            return freshState(score);
        const base = freshState(score);
        const actions = base.actions.map((action) => {
            const saved = savedActions.find((item) => {
                return Boolean(item) && typeof item === "object" && item.name === action.name;
            });
            if (!saved || !Array.isArray(saved.voices))
                return action;
            const voices = saved.voices.filter(isVoice);
            const unique = voices.filter((voice, index) => voices.indexOf(voice) === index);
            if (!unique.length)
                return action;
            return { ...action, voices: unique };
        });
        const nextCadence = raw.nextCadence;
        const rehearsalCount = raw.rehearsalCount;
        return {
            ...base,
            actions,
            dev: raw.dev === true,
            cadences: Array.isArray(raw.cadences) ? raw.cadences.filter(isCadence) : [],
            nextCadence: typeof nextCadence === "number" && Number.isInteger(nextCadence) && nextCadence > 0 ? nextCadence : 1,
            rehearsalCount: typeof rehearsalCount === "number" && rehearsalCount >= 0 ? rehearsalCount : 0,
            lastRefused: raw.lastRefused === true,
            everRehearsed: raw.everRehearsed === true,
            stale: raw.stale === true,
            lastPlan: isPlan(raw.lastPlan) ? raw.lastPlan : null,
        };
    }
    catch {
        return freshState(score);
    }
}
export function saveSession(cwd, state) {
    const dir = path.join(cwd, ".harmony");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "session.json");
    const tmp = `${file}.tmp`;
    const body = {
        v: 1,
        score: state.score,
        dev: state.dev,
        actions: state.actions.map((action) => ({ name: action.name, voices: action.voices })),
        cadences: state.cadences,
        nextCadence: state.nextCadence,
        rehearsalCount: state.rehearsalCount,
        lastRefused: state.lastRefused,
        everRehearsed: state.everRehearsed,
        stale: state.stale,
        lastPlan: state.lastPlan,
    };
    fs.writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
    fs.renameSync(tmp, file);
}
export function saveVoices(file, actions) {
    if (!file.endsWith(".json")) {
        throw new HarmonyError("IO", "This score is code. Edit the voices in the file.");
    }
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!raw || !Array.isArray(raw.actions))
        throw new HarmonyError("IO", "The score file has no actions.");
    for (const action of raw.actions) {
        const live = actions.find((item) => item.name === action.name);
        if (live)
            action.voices = [...live.voices];
    }
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(raw, null, 2)}\n`);
    fs.renameSync(tmp, file);
}
const STARTER = {
    unison: 1,
    summary: "One score for the screen, the route, and the agent.",
    targets: ["web", "ios", "android"],
    actions: [
        {
            name: "readRecord",
            kind: "read",
            summary: "Read one record. Nothing is written.",
            files: ["app/record.tsx", "api/record.ts"],
            voices: ["app", "api", "agent"],
            match: ["read"],
            input: { id: { type: "string", required: true, summary: "Record id." } },
        },
        {
            name: "writeRecord",
            kind: "write",
            summary: "Write one record. The agent must ask.",
            files: ["app/record.tsx", "api/record.ts"],
            voices: ["app", "api"],
            match: ["write", "save", "send"],
        },
    ],
};
export function initProject(cwd, name = "app") {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        throw new HarmonyError("INVALID_SCORE", "The score name must be lowercase words, hyphen allowed.");
    }
    const file = path.join(cwd, "harmony.score.json");
    if (fs.existsSync(file) || fs.existsSync(path.join(cwd, "harmony.score.mjs")) || fs.existsSync(path.join(cwd, "harmony.score.js"))) {
        throw new HarmonyError("IO", "A score already exists in this directory.");
    }
    const score = validateScore({ ...STARTER, name });
    fs.writeFileSync(file, `${JSON.stringify({ ...score, actions: STARTER.actions }, null, 2)}\n`);
    const ignore = path.join(cwd, ".gitignore");
    const line = ".harmony";
    if (!fs.existsSync(ignore))
        fs.writeFileSync(ignore, `${line}\n`);
    else {
        const text = fs.readFileSync(ignore, "utf8");
        if (!text.split("\n").includes(line))
            fs.appendFileSync(ignore, text.endsWith("\n") ? `${line}\n` : `\n${line}\n`);
    }
    return file;
}
//# sourceMappingURL=load.js.map