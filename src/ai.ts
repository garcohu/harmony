export const VERSION = "2.0.0";

export type Field = {
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
};

export type ToolContext = {
  /** The message the person typed. */
  input: string;
  agent: string;
};

export type Tool<I = Record<string, unknown>> = {
  readonly kind: "harmony.tool";
  name: string;
  description: string;
  input?: Record<string, Field>;
  run: (input: I, ctx: ToolContext) => unknown | Promise<unknown>;
};

export type Agent = {
  readonly kind: "harmony.agent";
  name: string;
  instructions: string;
  tools: readonly Tool[];
};

export type ModelRequest = {
  instructions: string;
  input: string;
  tools: { name: string; description: string; input?: Record<string, Field> }[];
};

export type ModelDecision = {
  tool?: string;
  input?: Record<string, unknown>;
  text?: string;
};

/** Anything that can choose a tool. The default model is local and does not call a network. */
export type Model = (request: ModelRequest) => Promise<ModelDecision> | ModelDecision;

export type AskResult = {
  ok: boolean;
  agent: string;
  tool: string | null;
  text: string;
  value: unknown;
};

const NAME = /^[a-z][A-Za-z0-9]*$/;

export function tool<I = Record<string, unknown>>(def: {
  name: string;
  description: string;
  input?: Record<string, Field>;
  run: (input: I, ctx: ToolContext) => unknown | Promise<unknown>;
}): Tool<I> {
  if (!NAME.test(def.name)) throw new Error(`Tool name must be camelCase: ${def.name}`);
  if (!def.description.trim()) throw new Error(`${def.name} needs a description.`);
  return { kind: "harmony.tool", ...def };
}

export function agent(def: { name: string; instructions: string; tools: readonly Tool[] }): Agent {
  if (!def.name.trim()) throw new Error("An agent needs a name.");
  const seen = new Set<string>();
  for (const item of def.tools) {
    if (item.kind !== "harmony.tool") throw new Error("An agent can only hold tools made with tool().");
    if (seen.has(item.name)) throw new Error(`${item.name} is on this agent twice.`);
    seen.add(item.name);
  }
  return { kind: "harmony.agent", ...def };
}

function words(value: string): string[] {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
}

/** Picks a tool by shared words. It cannot see tools that were not passed in. */
export function localModel(request: ModelRequest): ModelDecision {
  let best: { name: string; score: number } | null = null;
  const query = new Set(words(request.input));
  for (const item of request.tools) {
    const hay = new Set([...words(item.name), ...words(item.description)]);
    let score = 0;
    for (const word of query) if (hay.has(word)) score += 1;
    if (score > (best?.score ?? 0)) best = { name: item.name, score };
  }
  if (!best) {
    return { text: request.tools.length ? "No tool on this agent matches. It will not invent one." : "This agent has no tools." };
  }
  const chosen = request.tools.find((item) => item.name === best.name);
  const input: Record<string, unknown> = {};
  const quoted = request.input.match(/"([^"]*)"|'([^']*)'/);
  const literal = quoted?.[1] ?? quoted?.[2];
  if (literal && chosen?.input) {
    const field = Object.entries(chosen.input).find(([, spec]) => spec.type === "string");
    if (field) input[field[0]] = literal;
  }
  return { tool: best.name, input };
}

function coerce(value: unknown, type: Field["type"], key: string): unknown {
  if (typeof value === type) return value;
  if (typeof value !== "string") throw new Error(`${key} must be a ${type}.`);
  if (type === "number") {
    if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error(`${key} must be a number.`);
    return Number(value);
  }
  if (type === "boolean") {
    if (value !== "true" && value !== "false") throw new Error(`${key} must be true or false.`);
    return value === "true";
  }
  return value;
}

export async function ask(defn: Agent, input: string, options?: { model?: Model }): Promise<AskResult> {
  const text = input.trim();
  if (!text) return { ok: false, agent: defn.name, tool: null, text: "ask needs a message.", value: null };
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
  const parsed: Record<string, unknown> = {};
  try {
    for (const [key, value] of Object.entries(raw)) {
      const field = found.input?.[key];
      if (!field) throw new Error(`${found.name} has no input named ${key}.`);
      parsed[key] = coerce(value, field.type, key);
    }
    for (const [key, field] of Object.entries(found.input ?? {})) {
      if (field.required && (parsed[key] === undefined || parsed[key] === "")) {
        throw new Error(`${found.name} needs ${key}.`);
      }
    }
  } catch (error) {
    return {
      ok: false,
      agent: defn.name,
      tool: found.name,
      text: error instanceof Error ? error.message : "Invalid input.",
      value: null,
    };
  }
  const value = await found.run(parsed, { input: text, agent: defn.name });
  const detail =
    value && typeof value === "object" && "detail" in value && typeof (value as { detail: unknown }).detail === "string"
      ? (value as { detail: string }).detail
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  return { ok: true, agent: defn.name, tool: found.name, text: detail, value };
}
