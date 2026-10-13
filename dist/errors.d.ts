export type HarmonyCode = "INVALID_SCORE" | "UNKNOWN_ACTION" | "NOT_SCORED" | "INVALID_INPUT" | "HOLD" | "UNKNOWN_COMMAND" | "IO";
export declare class HarmonyError extends Error {
    readonly code: HarmonyCode;
    constructor(code: HarmonyCode, message: string);
}
export declare function isHarmonyError(error: unknown): error is HarmonyError;
//# sourceMappingURL=errors.d.ts.map