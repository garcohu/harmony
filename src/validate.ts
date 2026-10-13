import { HarmonyError } from "./errors.js";
import { UNISON, VOICES, type ActionDef, type ActionKind, type Field, type Score, type Voice } from "./types.js";

const NAME = /^[a-z][A-Za-z0-9]*$/;
const SCORE_KEYS = new Set(["name", "unison", "summary", "targets", "actions"]);
const ACTION_KEYS = new Set(["name", "kind", "summary", "files", "voices", "input", "match", "detail", "run"]);
const FIELD_KEYS = new Set(["type", "required", "summary"]);

function fail(message: string): never {
  throw new HarmonyError("INVALID_SCORE", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: Set<string>): string[] {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

function isVoice(value: unknown): value is Voice {
  return typeof value === "string" && (VOICES as readonly string[]).includes(value);
}

function checkFile(file: unknown, action: string): string {
  if (typeof file !== "string" || file.trim() === "") fail(`${action} has an empty file.`);
  if (file.startsWith("/") || /^[A-Za-z]:/.test(file)) fail(`${action} file must be relative: ${file}`);
  const parts = file.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    fail(`${action} file cannot climb out of the project: ${file}`);
  }
  return file;
}

function checkField(key: string, value: unknown, action: string): Field {
  if (!NAME.test(key)) fail(`${action} input "${key}" is not a name.`);
  if (!isRecord(value)) fail(`${action} input "${key}" must be a field.`);
  const extra = unknownKeys(value, FIELD_KEYS);
  if (extra.length) fail(`${action} input "${key}" has unknown ${extra.join(", ")}.`);
  if (value.type !== "string" && value.type !== "number" && value.type !== "boolean") {
    fail(`${action} input "${key}" type must be string, number, or boolean.`);
  }
  if (value.required !== undefined && typeof value.required !== "boolean") {
    fail(`${action} input "${key}" required must be boolean.`);
  }
  if (value.summary !== undefined && typeof value.summary !== "string") {
    fail(`${action} input "${key}" summary must be a string.`);
  }
  const field: Field = { type: value.type };
  if (value.required) field.required = true;
  if (typeof value.summary === "string" && value.summary.trim()) field.summary = value.summary.trim();
  return field;
}

function checkAction(value: unknown, index: number): ActionDef {
  if (!isRecord(value)) fail(`Action ${index + 1} is not an object.`);
  const extra = unknownKeys(value, ACTION_KEYS);
  if (extra.length) fail(`Action ${String(value.name ?? index + 1)} has unknown ${extra.join(", ")}.`);
  const name = value.name;
  if (typeof name !== "string" || !NAME.test(name)) {
    fail(`Action ${index + 1} needs a camelCase name.`);
  }
  const kind = value.kind;
  if (kind !== "read" && kind !== "write") fail(`${name} kind must be read or write.`);
  if (typeof value.summary !== "string" || value.summary.trim() === "") fail(`${name} needs a summary.`);
  if (!Array.isArray(value.files) || value.files.length === 0) fail(`${name} needs at least one file.`);
  const files = value.files.map((file) => checkFile(file, name));
  if (!Array.isArray(value.voices) || value.voices.length === 0) fail(`${name} needs at least one voice.`);
  const voices: Voice[] = [];
  for (const voice of value.voices) {
    if (!isVoice(voice)) fail(`${name} has a voice that is not app, api, or agent.`);
    if (voices.includes(voice)) fail(`${name} lists ${voice} twice.`);
    voices.push(voice);
  }
  let input: Record<string, Field> | undefined;
  if (value.input !== undefined) {
    if (!isRecord(value.input)) fail(`${name} input must be an object of fields.`);
    input = {};
    for (const [key, field] of Object.entries(value.input)) {
      input[key] = checkField(key, field, name);
    }
  }
  let match: ActionDef["match"];
  if (value.match !== undefined) {
    if (typeof value.match === "function") {
      match = value.match as (intent: string) => boolean;
    } else if (Array.isArray(value.match) && value.match.every((term) => typeof term === "string")) {
      if (value.match.length === 0) fail(`${name} match is empty.`);
      if (value.match.some((term) => term.length === 0 || term.length > 64)) {
        fail(`${name} match terms must be 1–64 characters.`);
      }
      match = [...value.match];
    } else {
      fail(`${name} match must be a list of words or a function.`);
    }
  }
  let detail: ActionDef["detail"];
  if (value.detail !== undefined) {
    if (typeof value.detail !== "string" && typeof value.detail !== "function") {
      fail(`${name} detail must be a string or a function.`);
    }
    detail = value.detail as ActionDef["detail"];
  }
  if (value.run !== undefined && typeof value.run !== "function") fail(`${name} run must be a function.`);

  const action: ActionDef = {
    name,
    kind: kind as ActionKind,
    summary: value.summary.trim(),
    files,
    voices,
  };
  if (input) action.input = input;
  if (match) action.match = match;
  if (detail !== undefined) action.detail = detail;
  if (typeof value.run === "function") action.run = value.run as ActionDef["run"];
  return action;
}

export function validateScore(value: unknown): Score {
  if (!isRecord(value)) fail("The score must be an object.");
  const extra = unknownKeys(value, SCORE_KEYS);
  if (extra.length) fail(`The score has unknown ${extra.join(", ")}.`);
  if (typeof value.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(value.name)) {
    fail("The score name must be lowercase words, hyphen allowed.");
  }
  if (value.unison !== UNISON) fail("unison must be 1. Harmony will not keep a second score.");
  if (value.summary !== undefined && typeof value.summary !== "string") fail("summary must be a string.");
  let targets: string[] | undefined;
  if (value.targets !== undefined) {
    if (!Array.isArray(value.targets) || value.targets.some((item) => typeof item !== "string" || !item.trim())) {
      fail("targets must be a list of names.");
    }
    targets = value.targets.map((item) => item.trim());
  }
  if (!Array.isArray(value.actions) || value.actions.length === 0) fail("The score needs at least one action.");
  const actions = value.actions.map((action, index) => checkAction(action, index));
  const seen = new Set<string>();
  for (const action of actions) {
    const key = action.name.toLowerCase();
    if (seen.has(key)) fail(`${action.name} is declared twice.`);
    seen.add(key);
  }
  const score: Score = { name: value.name, unison: UNISON, actions };
  if (typeof value.summary === "string" && value.summary.trim()) score.summary = value.summary.trim();
  if (targets) score.targets = targets;
  return score;
}

export function defineScore(value: unknown): Score {
  return validateScore(value);
}

export function defineAction(value: unknown): ActionDef {
  const score = validateScore({ name: "draft", unison: UNISON, actions: [value] });
  const action = score.actions[0];
  if (!action) fail("Action was empty.");
  return action;
}

export function dataAction(action: ActionDef): ActionDef {
  const copy: ActionDef = {
    name: action.name,
    kind: action.kind,
    summary: action.summary,
    files: [...action.files],
    voices: [...action.voices],
  };
  if (action.input) copy.input = structuredClone(action.input);
  return copy;
}
