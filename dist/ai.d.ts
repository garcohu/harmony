export declare const VERSION = "2.0.0";
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
    tools: {
        name: string;
        description: string;
        input?: Record<string, Field>;
    }[];
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
export declare function tool<I = Record<string, unknown>>(def: {
    name: string;
    description: string;
    input?: Record<string, Field>;
    run: (input: I, ctx: ToolContext) => unknown | Promise<unknown>;
}): Tool<I>;
export declare function agent(def: {
    name: string;
    instructions: string;
    tools: readonly Tool[];
}): Agent;
/** Picks a tool by shared words. It cannot see tools that were not passed in. */
export declare function localModel(request: ModelRequest): ModelDecision;
export declare function ask(defn: Agent, input: string, options?: {
    model?: Model;
}): Promise<AskResult>;
//# sourceMappingURL=ai.d.ts.map