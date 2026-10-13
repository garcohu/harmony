export type HarmonyCode = "INVALID_PROJECT" | "UNKNOWN_TOOL" | "INVALID_INPUT" | "IO" | "NOT_ALLOWED";

export class HarmonyError extends Error {
  readonly code: HarmonyCode;

  constructor(code: HarmonyCode, message: string) {
    super(message);
    this.name = "HarmonyError";
    this.code = code;
  }
}

export function isHarmonyError(error: unknown): error is HarmonyError {
  return error instanceof HarmonyError;
}
