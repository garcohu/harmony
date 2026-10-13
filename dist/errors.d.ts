export type HarmonyCode = "INVALID_PROJECT" | "UNKNOWN_TOOL" | "INVALID_INPUT" | "IO" | "NOT_ALLOWED";
export declare class HarmonyError extends Error {
    readonly code: HarmonyCode;
    constructor(code: HarmonyCode, message: string);
}
export declare function isHarmonyError(error: unknown): error is HarmonyError;
//# sourceMappingURL=errors.d.ts.map