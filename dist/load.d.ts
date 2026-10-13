import type { DeskState, Score, Voice } from "./types.js";
export type LoadedScore = {
    score: Score;
    file: string | null;
};
export declare function loadScore(cwd: string): Promise<LoadedScore>;
export declare function loadSession(cwd: string, score: Score): DeskState;
export declare function saveSession(cwd: string, state: DeskState): void;
export declare function saveVoices(file: string, actions: {
    name: string;
    voices: Voice[];
}[]): void;
export declare function initProject(cwd: string, name?: string): string;
//# sourceMappingURL=load.d.ts.map