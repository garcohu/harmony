import { detect } from "./detect.js";
import { HarmonyError } from "./errors.js";
import { detailOf, folioScore } from "./folio.js";
import { VOICES } from "./types.js";
import { dataAction } from "./validate.js";
export function freshState(score = folioScore()) {
    return {
        score: score.name,
        actions: score.actions.map((action) => dataAction(action)),
        dev: false,
        cadences: [],
        nextCadence: 1,
        rehearsalCount: 0,
        lastRefused: false,
        everRehearsed: false,
        stale: false,
        lastPlan: null,
    };
}
export function findAction(state, name) {
    const q = name.trim().toLowerCase();
    if (!q)
        return undefined;
    return state.actions.find((action) => action.name.toLowerCase() === q);
}
export function scoreAction(score, name) {
    const q = name.trim().toLowerCase();
    return score.actions.find((action) => action.name.toLowerCase() === q);
}
function isVoice(value) {
    return VOICES.includes(value);
}
export function parseVoice(value, fallback = "agent") {
    if (value === undefined || value === "")
        return fallback;
    const voice = value.trim().toLowerCase();
    if (!isVoice(voice))
        throw new HarmonyError("INVALID_INPUT", "Voice must be app, api, or agent.");
    return voice;
}
function fileCadence(state, action) {
    const existing = state.cadences.find((cadence) => cadence.open && cadence.action === action);
    if (existing)
        return { state, id: existing.id, created: false };
    const id = `c-${state.nextCadence}`;
    return {
        created: true,
        id,
        state: {
            ...state,
            nextCadence: state.nextCadence + 1,
            cadences: [...state.cadences, { id, action, open: true }],
        },
    };
}
function refusal(created, id) {
    return created
        ? `Not scored for the agent. Cadence ${id} asks for the voice. Nothing left the room.`
        : `Still not scored. ${id} is already open. Nothing left the room.`;
}
export function rehearse(state, score, intent) {
    const text = intent.trim();
    if (!text)
        throw new HarmonyError("INVALID_INPUT", "Rehearse needs an intent.");
    const names = detect(text, score);
    if (names.length === 0) {
        return {
            state,
            plan: { intent: text, steps: [], refused: false },
        };
    }
    let next = {
        ...state,
        actions: state.actions.map((action) => dataAction(action)),
        cadences: state.cadences.map((cadence) => ({ ...cadence })),
    };
    const steps = [];
    for (const name of names) {
        const live = next.actions.find((action) => action.name === name);
        const printed = scoreAction(score, name);
        if (!live || !printed)
            continue;
        if (!live.voices.includes("agent")) {
            const filed = fileCadence(next, name);
            next = filed.state;
            steps.push({ name, outcome: "refused", detail: refusal(filed.created, filed.id) });
            continue;
        }
        steps.push({
            name,
            outcome: "played",
            detail: detailOf(printed, {}, { voice: "agent", score: score.name, dry: true, intent: text }),
        });
    }
    const refused = steps.some((step) => step.outcome === "refused");
    const plan = { intent: text, steps, refused };
    return {
        state: {
            ...next,
            rehearsalCount: next.rehearsalCount + 1,
            everRehearsed: true,
            lastRefused: refused,
            stale: false,
            lastPlan: plan,
        },
        plan,
    };
}
export function promote(state, idRaw) {
    if (!idRaw.trim())
        throw new HarmonyError("INVALID_INPUT", "promote needs an id.");
    const id = idRaw.trim().toLowerCase().startsWith("c-") ? idRaw.trim().toLowerCase() : `c-${idRaw.trim()}`;
    const cadence = state.cadences.find((item) => item.id === id);
    if (!cadence)
        return { ok: false, state, id, reason: "missing" };
    if (!cadence.open)
        return { ok: false, state, id, reason: "closed" };
    const actions = state.actions.map((action) => {
        if (action.name !== cadence.action || action.voices.includes("agent"))
            return dataAction(action);
        return dataAction({ ...action, voices: [...action.voices, "agent"] });
    });
    return {
        ok: true,
        id,
        action: cadence.action,
        state: {
            ...state,
            actions,
            cadences: state.cadences.map((item) => (item.id === id ? { ...item, open: false } : { ...item })),
            stale: true,
        },
    };
}
export function grant(state, name, voice) {
    const action = findAction(state, name);
    if (!action)
        throw new HarmonyError("UNKNOWN_ACTION", name ? `No action named ${name}.` : "grant needs an action.");
    if (action.voices.includes(voice))
        return state;
    const actions = state.actions.map((item) => item.name === action.name ? dataAction({ ...item, voices: [...item.voices, voice] }) : dataAction(item));
    const cadences = voice === "agent"
        ? state.cadences.map((cadence) => (cadence.action === action.name ? { ...cadence, open: false } : { ...cadence }))
        : state.cadences.map((cadence) => ({ ...cadence }));
    return { ...state, actions, cadences, stale: state.everRehearsed ? true : state.stale };
}
export function revoke(state, name, voice) {
    const action = findAction(state, name);
    if (!action)
        throw new HarmonyError("UNKNOWN_ACTION", name ? `No action named ${name}.` : "revoke needs an action.");
    if (!action.voices.includes(voice)) {
        const message = voice === "agent"
            ? `The agent was never scored on ${action.name}.`
            : `${voice} was never scored on ${action.name}.`;
        throw new HarmonyError("NOT_SCORED", message);
    }
    if (action.voices.length === 1) {
        throw new HarmonyError("INVALID_INPUT", `${action.name} would have no voice. Harmony will not leave it silent.`);
    }
    const actions = state.actions.map((item) => item.name === action.name
        ? dataAction({ ...item, voices: item.voices.filter((itemVoice) => itemVoice !== voice) })
        : dataAction(item));
    return { ...state, actions, stale: state.everRehearsed ? true : state.stale };
}
function coerce(value, type, key) {
    if (typeof value === type)
        return value;
    if (typeof value !== "string") {
        throw new HarmonyError("INVALID_INPUT", `${key} must be a ${type}.`);
    }
    if (type === "string")
        return value;
    if (type === "number") {
        if (!/^-?\d+(\.\d+)?$/.test(value))
            throw new HarmonyError("INVALID_INPUT", `${key} must be a number.`);
        return Number(value);
    }
    if (value !== "true" && value !== "false")
        throw new HarmonyError("INVALID_INPUT", `${key} must be true or false.`);
    return value === "true";
}
export function readInput(action, raw) {
    const fields = action.input ?? {};
    const input = {};
    for (const [key, value] of Object.entries(raw)) {
        if (key === "__proto__" || key === "prototype" || key === "constructor") {
            throw new HarmonyError("INVALID_INPUT", `${key} is not an input.`);
        }
        const field = fields[key];
        if (!field)
            throw new HarmonyError("INVALID_INPUT", `${action.name} has no input named ${key}.`);
        input[key] = coerce(value, field.type, key);
    }
    for (const [key, field] of Object.entries(fields)) {
        if (field.required && (input[key] === undefined || input[key] === "")) {
            throw new HarmonyError("INVALID_INPUT", `${action.name} needs ${key}.`);
        }
    }
    return input;
}
export async function callAction(state, score, request) {
    const live = findAction(state, request.name);
    const printed = scoreAction(score, request.name);
    if (!live || !printed) {
        return {
            state,
            result: {
                ok: false,
                code: "UNKNOWN_ACTION",
                name: request.name.trim() || "(none)",
                detail: request.name.trim() ? `No action named ${request.name.trim()}.` : "call needs an action.",
            },
        };
    }
    let input;
    try {
        input = readInput(printed, request.input ?? {});
    }
    catch (error) {
        if (error instanceof HarmonyError) {
            return { state, result: { ok: false, code: "INVALID_INPUT", name: live.name, detail: error.message } };
        }
        throw error;
    }
    if (!live.voices.includes(request.voice)) {
        if (request.voice !== "agent") {
            return {
                state,
                result: {
                    ok: false,
                    code: "NOT_SCORED",
                    name: live.name,
                    detail: `${request.voice} is not scored on ${live.name}.`,
                },
            };
        }
        const filed = fileCadence(state, live.name);
        return {
            state: filed.state,
            result: {
                ok: false,
                code: "NOT_SCORED",
                name: live.name,
                cadenceId: filed.id,
                detail: refusal(filed.created, filed.id),
            },
        };
    }
    const dry = Boolean(request.dry);
    const ctx = { voice: request.voice, score: score.name, dry, intent: "" };
    if (dry || !printed.run) {
        return {
            state,
            result: {
                ok: true,
                dry: true,
                name: live.name,
                voice: request.voice,
                detail: detailOf(printed, input, ctx),
                value: undefined,
            },
        };
    }
    const value = await printed.run(input, { ...ctx, dry: false });
    const detail = value && typeof value === "object" && "detail" in value && typeof value.detail === "string"
        ? value.detail
        : typeof value === "string"
            ? value
            : detailOf(printed, input, { ...ctx, dry: false });
    return {
        state,
        result: { ok: true, dry: false, name: live.name, voice: request.voice, detail, value },
    };
}
export function ship(state) {
    const open = state.cadences.filter((cadence) => cadence.open);
    const silent = state.actions.filter((action) => action.voices.length === 0);
    const writes = state.actions.filter((action) => action.kind === "write" && action.voices.includes("agent"));
    if (silent.length) {
        return {
            ok: false,
            verdict: "Hold.",
            because: `${silent.map((action) => action.name).join(", ")} has no voice. It cannot be played.`,
        };
    }
    if (open.length) {
        return {
            ok: false,
            verdict: "Hold.",
            because: `${open.map((cadence) => cadence.id).join(", ")} still open. Answer the agent, or leave the write off the score.`,
        };
    }
    if (!state.everRehearsed) {
        return {
            ok: false,
            verdict: "Hold.",
            because: "No rehearsal on record. The desk will not ship a voice it has not heard.",
        };
    }
    if (state.stale) {
        return {
            ok: false,
            verdict: "Hold.",
            because: "The score changed after the last rehearsal. Play it again.",
        };
    }
    if (state.lastRefused) {
        return {
            ok: false,
            verdict: "Hold.",
            because: "The last rehearsal stopped. The agent would have stopped too.",
        };
    }
    if (writes.length) {
        return {
            ok: true,
            verdict: "Clear.",
            because: `${writes.map((action) => action.name).join(", ")} is a write, and the agent may play it. You put it on the score.`,
        };
    }
    return { ok: true, verdict: "Clear.", because: "The last rehearsal matches the score." };
}
export function check(score, state) {
    const agent = state.actions.filter((action) => action.voices.includes("agent"));
    const writes = agent.filter((action) => action.kind === "write").map((action) => action.name);
    const lines = [
        `${score.name}  ·  unison ${score.unison}`,
        `${state.actions.length} actions. ${agent.length} answer to the agent.`,
    ];
    if (writes.length)
        lines.push(`${writes.join(", ")} is a write the agent may play.`);
    lines.push("The score holds.");
    return { ok: true, lines };
}
export function signature(action) {
    const fields = Object.entries(action.input ?? {});
    const args = fields.map(([key, field]) => (field.required ? key : `${key}?`)).join(", ");
    return `${action.name}(${args})`;
}
export function resetSession(state, score) {
    return { ...freshState(score), dev: state.dev };
}
//# sourceMappingURL=session.js.map