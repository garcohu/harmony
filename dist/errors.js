export class HarmonyError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "HarmonyError";
        this.code = code;
    }
}
export function isHarmonyError(error) {
    return error instanceof HarmonyError;
}
//# sourceMappingURL=errors.js.map