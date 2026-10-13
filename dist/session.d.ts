import type { ActionDef, ActionInput, CallResult, DeskState, Plan, Score, ShipReport, Voice } from "./types.js";
export declare function freshState(score?: Score): DeskState;
export declare function findAction(state: DeskState, name: string): ActionDef | undefined;
export declare function scoreAction(score: Score, name: string): ActionDef | undefined;
export declare function parseVoice(value: string | undefined, fallback?: Voice): Voice;
export declare function rehearse(state: DeskState, score: Score, intent: string): {
    state: DeskState;
    plan: Plan;
};
export declare function promote(state: DeskState, idRaw: string): {
    ok: true;
    state: DeskState;
    id: string;
    action: string;
} | {
    ok: false;
    state: DeskState;
    id: string;
    reason: "missing" | "closed";
};
export declare function grant(state: DeskState, name: string, voice: Voice): DeskState;
export declare function revoke(state: DeskState, name: string, voice: Voice): DeskState;
export declare function readInput(action: ActionDef, raw: ActionInput): ActionInput;
export declare function callAction(state: DeskState, score: Score, request: {
    name: string;
    voice: Voice;
    input?: ActionInput;
    dry?: boolean;
}): Promise<{
    state: DeskState;
    result: CallResult;
}>;
export declare function ship(state: DeskState): ShipReport;
export declare function check(score: Score, state: DeskState): {
    ok: true;
    lines: string[];
};
export declare function signature(action: ActionDef): string;
export declare function resetSession(state: DeskState, score: Score): DeskState;
//# sourceMappingURL=session.d.ts.map