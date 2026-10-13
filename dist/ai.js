export const VERSION = "2.0.0";
const NAME = /^[a-z][A-Za-z0-9]*$/;
export function tool(def) {
    if (!NAME.test(def.name))
        throw new Error(`Tool name must be camelCase: ${def.name}`);
    if (!def.description.trim())
        throw new Error(`${def.name} needs a description.`);
    return { kind: "harmony.tool", ...def };
}
export function agent(def) {
    if (!def.name.trim())
        throw new Error("An agent needs a name.");
    const seen = new Set();
    for (const item of def.tools) {
        if (item.kind !== "harmony.tool")
            throw new Error("An agent can only hold tools made with tool().");
        if (seen.has(item.name))
            throw new Error(`${item.name} is on this agent twice.`);
        seen.add(item.name);
    }
    return { kind: "harmony.agent", ...def };
}
function words(value) {
    return value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 3);
}
/** Picks a tool by shared words. It cannot see tools that were not passed in. */
export function localModel(request) {
    let best = null;
    const query = new Set(words(request.input));
    for (const item of request.tools) {
        const hay = new Set([...words(item.name), ...words(item.description)]);
        let score = 0;
        for (const word of query)
            if (hay.has(word))
                score += 1;
        if (score > (best?.score ?? 0))
            best = { name: item.name, score };
    }
    if (!best) {
        return { text: request.tools.length ? "No tool on this agent matches. It will not invent one." : "This agent has no tools." };
    }
    const chosen = request.tools.find((item) => item.name === best.name);
    const input = {};
    const quoted = request.input.match(/"([^"]*)"|'([^']*)'/);
    const literal = quoted?.[1] ?? quoted?.[2];
    if (literal && chosen?.input) {
        const field = Object.entries(chosen.input).find(([, spec]) => spec.type === "string");
        if (field)
            input[field[0]] = literal;
    }
    return { tool: best.name, input };
}
function coerce(value, type, key) {
    if (typeof value === type)
        return value;
    if (typeof value !== "string")
        throw new Error(`${key} must be a ${type}.`);
    if (type === "number") {
        if (!/^-?\d+(\.\d+)?$/.test(value))
            throw new Error(`${key} must be a number.`);
        return Number(value);
    }
    if (type === "boolean") {
        if (value !== "true" && value !== "false")
            throw new Error(`${key} must be true or false.`);
        return value === "true";
    }
    return value;
}
export async function ask(defn, input, options) {
    const text = input.trim();
    if (!text)
        return { ok: false, agent: defn.name, tool: null, text: "ask needs a message.", value: null };
    const model = options?.model ?? localModel;
    const decision = await model({
        instructions: defn.instructions,
        input: text,
        tools: defn.tools.map((item) => ({
            name: item.name,
            description: item.description,
            ...(item.input ? { input: item.input } : {}),
        })),
    });
    if (!decision.tool) {
        return { ok: true, agent: defn.name, tool: null, text: decision.text ?? "No tool was called.", value: null };
    }
    const found = defn.tools.find((item) => item.name === decision.tool);
    if (!found) {
        return {
            ok: false,
            agent: defn.name,
            tool: decision.tool,
            text: `${decision.tool} is not on ${defn.name}. The agent cannot invent a tool.`,
            value: null,
        };
    }
    const raw = decision.input ?? {};
    const parsed = {};
    try {
        for (const [key, value] of Object.entries(raw)) {
            const field = found.input?.[key];
            if (!field)
                throw new Error(`${found.name} has no input named ${key}.`);
            parsed[key] = coerce(value, field.type, key);
        }
        for (const [key, field] of Object.entries(found.input ?? {})) {
            if (field.required && (parsed[key] === undefined || parsed[key] === "")) {
                throw new Error(`${found.name} needs ${key}.`);
            }
        }
    }
    catch (error) {
        return {
            ok: false,
            agent: defn.name,
            tool: found.name,
            text: error instanceof Error ? error.message : "Invalid input.",
            value: null,
        };
    }
    const value = await found.run(parsed, { input: text, agent: defn.name });
    const detail = value && typeof value === "object" && "detail" in value && typeof value.detail === "string"
        ? value.detail
        : typeof value === "string"
            ? value
            : JSON.stringify(value);
    return { ok: true, agent: defn.name, tool: found.name, text: detail, value };
}
//# sourceMappingURL=ai.js.map