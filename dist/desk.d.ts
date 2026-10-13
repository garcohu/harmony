import type { Block, DeskState, Score, Voice } from "./types.js";
export type DeskResult = {
    state: DeskState;
    blocks: Block[];
    code: 0 | 1 | 2;
};
export declare function staffBlock(state: Pick<DeskState, "dev" | "actions">): Block;
export declare function welcomeBlocks(score?: Score): Block[];
export declare function parseLine(raw: string): {
    cmd: string;
    arg: string;
};
export declare function tokenize(input: string): string[];
export declare function parseCall(arg: string): {
    name: string;
    voice: Voice;
    dry: boolean;
    input: Record<string, string>;
};
export declare function reduce(state: DeskState, raw: string, score?: Score): DeskResult;
export declare function reduceAsync(state: DeskState, raw: string, score?: Score): Promise<DeskResult>;
//# sourceMappingURL=desk.d.ts.map