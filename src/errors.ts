export type HarmonyCode =
  | "INVALID_SCORE"
  | "UNKNOWN_ACTION"
  | "NOT_SCORED"
  | "INVALID_INPUT"
  | "HOLD"
  | "UNKNOWN_COMMAND"
  | "IO";

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
