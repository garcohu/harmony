export const VERSION = "1.0.0";
export const UNISON = 1 as const;

export const VOICES = ["app", "api", "agent"] as const;
export type Voice = (typeof VOICES)[number];
export type ActionKind = "read" | "write";

export type Field = {
  type: "string" | "number" | "boolean";
  required?: boolean;
  summary?: string;
};

export type ActionInput = Record<string, unknown>;

export type ActionContext = {
  voice: Voice;
  score: string;
  dry: boolean;
  intent?: string;
};

export type ActionMatch = readonly string[] | ((intent: string) => boolean);

export type ActionDef = {
  name: string;
  kind: ActionKind;
  summary: string;
  files: string[];
  voices: Voice[];
  input?: Record<string, Field>;
  match?: ActionMatch;
  detail?: string | ((input: ActionInput, ctx: ActionContext) => string);
  run?: (input: ActionInput, ctx: ActionContext) => unknown | Promise<unknown>;
};

export type Score = {
  name: string;
  unison: typeof UNISON;
  summary?: string;
  targets?: string[];
  actions: ActionDef[];
};

export type Cadence = {
  id: string;
  action: string;
  open: boolean;
};

export type Step = {
  name: string;
  outcome: "played" | "refused";
  detail: string;
};

export type Plan = {
  intent: string;
  steps: Step[];
  refused: boolean;
};

export type Block =
  | { type: "line"; tone: "body" | "quiet" | "italic"; text: string }
  | { type: "echo"; text: string }
  | { type: "staff"; app: string; api: string; agent: string }
  | { type: "step"; index: string; name: string; detail: string; refused: boolean }
  | { type: "gap" };

/** Live desk. Voices here can differ from the printed score until reset. */
export type DeskState = {
  score: string;
  actions: ActionDef[];
  dev: boolean;
  cadences: Cadence[];
  nextCadence: number;
  rehearsalCount: number;
  lastRefused: boolean;
  everRehearsed: boolean;
  stale: boolean;
  lastPlan: Plan | null;
};

export type CallOk = {
  ok: true;
  dry: boolean;
  name: string;
  voice: Voice;
  detail: string;
  value: unknown;
};

export type CallNo = {
  ok: false;
  code: "NOT_SCORED" | "UNKNOWN_ACTION" | "INVALID_INPUT";
  name: string;
  detail: string;
  cadenceId?: string;
};

export type CallResult = CallOk | CallNo;

export type ShipReport = {
  ok: boolean;
  verdict: "Clear." | "Hold.";
  because: string;
};
