export type Block = {
    type: "line";
    tone: "body" | "quiet" | "italic";
    text: string;
} | {
    type: "echo";
    text: string;
} | {
    type: "staff";
    app: string;
    api: string;
    agent: string;
} | {
    type: "step";
    index: string;
    name: string;
    detail: string;
    refused: boolean;
} | {
    type: "gap";
};
export type DeskState = {
    included: string[];
    lastAsk: {
        input: string;
        tool: string | null;
        text: string;
    } | null;
};
export type DeskResult = {
    state: DeskState;
    blocks: Block[];
    code: 0 | 1 | 2;
};
export declare function freshState(): DeskState;
export declare function welcomeBlocks(): Block[];
export declare function reduceAsync(state: DeskState, raw: string): Promise<DeskResult>;
//# sourceMappingURL=desk.d.ts.map