import { HarmonyError } from "./errors.js";
import { folioScore, SHELF } from "./folio.js";
import {
  callAction,
  check,
  findAction,
  freshState,
  grant,
  parseVoice,
  promote,
  rehearse,
  resetSession,
  revoke,
  scoreAction,
  ship,
  signature,
} from "./session.js";
import type { ActionDef, Block, DeskState, Score, Voice } from "./types.js";
import { VERSION } from "./types.js";

function line(text: string): Block {
  return { type: "line", tone: "body", text };
}
function quiet(text: string): Block {
  return { type: "line", tone: "quiet", text };
}
function italic(text: string): Block {
  return { type: "line", tone: "italic", text };
}
function gap(): Block {
  return { type: "gap" };
}

export type DeskResult = { state: DeskState; blocks: Block[]; code: 0 | 1 | 2 };

function done(state: DeskState, blocks: Block[], code: 0 | 1 | 2 = 0): DeskResult {
  return { state, blocks, code };
}

export function staffBlock(state: Pick<DeskState, "dev" | "actions">): Block {
  const n = state.actions.filter((action) => action.voices.includes("agent")).length;
  if (!state.dev) return { type: "staff", app: "idle", api: "idle", agent: "quiet" };
  const routes = new Set(state.actions.flatMap((action) => action.files.filter((file) => file.startsWith("api/"))));
  const count = routes.size;
  return {
    type: "staff",
    app: "bound",
    api: count === 1 ? "1 route" : `${count} routes`,
    agent: n === 1 ? "1 in voice" : `${n} in voice`,
  };
}

export function welcomeBlocks(score: Score = folioScore()): Block[] {
  const state = freshState(score);
  const room = score.name === "folio" ? "folio, a reading room." : `${score.name}. ${score.summary ?? "One score."}`;
  return [
    line(`harmony ${VERSION}`),
    italic(room),
    gap(),
    line("The agent does not get tools."),
    line("It gets the actions you already wrote."),
    gap(),
    staffBlock(state),
    gap(),
    quiet("Type help. Or dev, to bind the staff."),
  ];
}

function voiceList(voices: Voice[]): string {
  return voices.length ? voices.join("  ") : "no voice";
}

function agentPermit(actions: ActionDef[]): string {
  const summarize = actions.find((action) => action.name === "summarizeShelf")?.voices.includes("agent");
  const dispatch = actions.find((action) => action.name === "fileDispatch")?.voices.includes("agent");
  if (summarize !== undefined || dispatch !== undefined) {
    if (summarize && dispatch) return "The agent may summarize, and it may dispatch.";
    if (summarize && !dispatch) return "The agent may summarize. It may not dispatch.";
    if (!summarize && dispatch) return "The agent may dispatch. It may not summarize.";
    return "The agent is scored on neither brief nor dispatch.";
  }
  const named = actions.filter((action) => action.voices.includes("agent")).map((action) => action.name);
  if (!named.length) return "The agent is scored on nothing.";
  return `The agent may play ${named.join(", ")}.`;
}

const HELP: Record<string, string> = {
  rehearse: "Plays an intent as the agent. A missing voice becomes a cadence. A write is addressed, never sent.",
  call: "call <action> --voice agent runs that function. --dry addresses it and does not run it. A missing voice becomes a cadence.",
  promote: "promote c-1 grants the agent that action. The score changes. Rehearse again before you ship.",
  grant: "grant <action> [voice] adds a voice. Defaults to agent. --save writes it back to a JSON score.",
  revoke: "revoke <action> [voice] takes a voice back. Defaults to agent. An action cannot be left silent.",
  ship: "Holds if a cadence is open, the score changed, or nothing has been rehearsed.",
  dev: "Binds three runtimes. Web, iOS, and Android for the app. Typed routes for the API. Unison for the agent.",
  check: "Validates the score that is already loaded. A bad score never reaches the desk.",
  functions: "The actions as functions: name, inputs, kind, and voices.",
  init: "Writes harmony.score.json in the current directory. Refuses to overwrite.",
};

function help(arg: string): Block[] {
  if (arg) {
    const key = arg.toLowerCase();
    const note = HELP[key];
    if (!note) return [line(`No manual entry for ${arg}.`), quiet("Try help.")];
    return [line(key), italic(note)];
  }
  return [
    line(`harmony ${VERSION}  —  the desk`),
    gap(),
    quiet("help            this index"),
    quiet("check           validate the score"),
    quiet("score           actions and their voices"),
    quiet("functions       callable signatures"),
    quiet("dev             bind app, api, agent"),
    quiet("stop            release the runtimes"),
    quiet("rehearse        dry-run an intent"),
    quiet("call            run one function"),
    quiet("cadence         what the agent asked"),
    quiet("promote c-1     grant a voice from a cadence"),
    quiet("grant           add a voice"),
    quiet("revoke          take a voice back"),
    quiet("ship            the release check"),
    quiet("targets         web, ios, android"),
    quiet("routes          the file tree"),
    quiet("folio           the loaded score"),
    quiet("show            one action"),
    quiet("init            write a score file"),
    quiet("reset           the printed score"),
    quiet("clear           wipe the desk, not the score"),
    quiet("exit            leave the prompt"),
    gap(),
    italic("The live score is .harmony/session.json. The printed score is harmony.score.json."),
  ];
}

function showScore(state: DeskState): Block[] {
  const blocks: Block[] = [quiet(`${state.score}  ·  the score`), gap()];
  for (const action of state.actions) {
    blocks.push(line(action.name));
    blocks.push(quiet(`${action.kind}   ·   ${voiceList(action.voices)}`));
    blocks.push(italic(action.summary));
    blocks.push(gap());
  }
  const agent = state.actions.filter((action) => action.voices.includes("agent")).length;
  blocks.push(quiet(`${agent} of ${state.actions.length} answer to the agent.`));
  return blocks;
}

function showFunctions(state: DeskState): Block[] {
  const blocks: Block[] = [quiet("functions"), gap()];
  for (const action of state.actions) {
    blocks.push(line(signature(action)));
    blocks.push(quiet(`${action.kind}   ·   ${voiceList(action.voices)}`));
  }
  return blocks;
}

const TARGETS: Record<string, string> = {
  web: "One bundle. The same screens.",
  ios: "Simulator and device. No second tree.",
  android: "Emulator and device. The primitives compile.",
};

function showTargets(score: Score): Block[] {
  const names = score.targets?.length ? score.targets : ["web", "ios", "android"];
  const blocks: Block[] = [quiet("one project, three surfaces"), gap()];
  for (const name of names) {
    blocks.push(line(name));
    blocks.push(italic(TARGETS[name] ?? "On the score."));
  }
  return blocks;
}

function showRoutes(state: DeskState): Block[] {
  const files: string[] = [];
  for (const action of state.actions) {
    for (const file of action.files) {
      if (!files.includes(file)) files.push(file);
    }
  }
  return [
    quiet(`${state.score}/`),
    ...files.map((file) => quiet(`  ${file}`)),
    gap(),
    italic("The screen, the route, and the agent import the same actions."),
  ];
}

function showFolio(score: Score): Block[] {
  if (score.name !== "folio") {
    return [
      quiet(`${score.name}  ·  unison ${score.unison}`),
      gap(),
      italic(score.summary ?? "A score you wrote."),
      quiet(`${score.actions.length} actions.`),
    ];
  }
  return [
    quiet("folio  ·  a private reading room"),
    gap(),
    ...SHELF.flatMap((volume, index) => [
      line(`${String(index + 1).padStart(2, "0")}   ${volume.title}`),
      quiet(`${volume.author}   ·   ${volume.notes} notes`),
    ]),
    gap(),
    italic("The agent may read these. It may not send them."),
  ];
}

export function parseLine(raw: string): { cmd: string; arg: string } {
  let text = raw.trim();
  if (/^harmony\b/i.test(text)) text = text.replace(/^harmony\b/i, "").trim();
  if (!text) return { cmd: "", arg: "" };
  const match = text.match(/^(\S+)\s+([\s\S]+)$/);
  const cmd = match?.[1];
  const rawArg = match?.[2];
  if (!cmd || rawArg === undefined) return { cmd: text.toLowerCase(), arg: "" };
  let arg = rawArg.trim();
  if (
    (arg.startsWith('"') && arg.endsWith('"') && arg.length >= 2) ||
    (arg.startsWith("'") && arg.endsWith("'") && arg.length >= 2)
  ) {
    arg = arg.slice(1, -1);
  }
  return { cmd: cmd.toLowerCase(), arg };
}

export function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of input.matchAll(re)) {
    out.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return out;
}

export function parseCall(arg: string): { name: string; voice: Voice; dry: boolean; input: Record<string, string> } {
  const tokens = tokenize(arg);
  const name = tokens[0] ?? "";
  if (!name || name.startsWith("--")) throw new HarmonyError("INVALID_INPUT", "call needs an action.");
  let voice: Voice = "agent";
  let dry = false;
  const input: Record<string, string> = {};
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i] ?? "";
    if (token === "--dry") {
      dry = true;
      continue;
    }
    if (token === "--voice") {
      voice = parseVoice(tokens[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--input") {
      const pair = tokens[i + 1];
      i += 1;
      if (!pair || !pair.includes("=") || pair.startsWith("=")) {
        throw new HarmonyError("INVALID_INPUT", "--input is key=value.");
      }
      const cut = pair.indexOf("=");
      const key = pair.slice(0, cut);
      input[key] = pair.slice(cut + 1);
      continue;
    }
    throw new HarmonyError("INVALID_INPUT", `Unknown flag ${token}.`);
  }
  return { name, voice, dry, input };
}

function parseGrant(arg: string): { name: string; voice: Voice } {
  const tokens = tokenize(arg).filter((token) => token !== "--save");
  const name = tokens[0] ?? "";
  const voice = parseVoice(tokens[1], "agent");
  if (tokens.length > 2) throw new HarmonyError("INVALID_INPUT", "grant takes an action and an optional voice.");
  return { name, voice };
}

function valueLine(value: unknown): Block[] {
  if (value === undefined) return [];
  let text = "";
  try {
    text = JSON.stringify(value);
  } catch {
    return [];
  }
  if (!text || text === "{}") return [];
  return [quiet(text)];
}

export function reduce(state: DeskState, raw: string, score: Score = folioScore()): DeskResult {
  try {
    return dispatch(state, raw, score);
  } catch (error) {
    if (error instanceof HarmonyError) {
      const code = error.code === "INVALID_INPUT" || error.code === "UNKNOWN_COMMAND" ? 2 : 1;
      return done(state, [line(error.message)], code);
    }
    throw error;
  }
}

function dispatch(state: DeskState, raw: string, score: Score): DeskResult {
  const { cmd, arg } = parseLine(raw);
  if (!cmd) return done(state, []);

  switch (cmd) {
    case "help":
    case "man":
    case "?":
      return done(state, help(arg));
    case "score":
    case "voices":
      return done(state, showScore(state));
    case "functions":
    case "fn":
      return done(state, showFunctions(state));
    case "check":
      return done(state, check(score, state).lines.map((text, index) => (index === 0 ? quiet(text) : line(text))));
    case "dev":
      if (state.dev) {
        return done(state, [
          line("The staff is already bound."),
          staffBlock(state),
          quiet("App on :3000. API on :3001. The agent is scored, not loose."),
        ]);
      }
      return done({ ...state, dev: true }, [
        line("Binding the staff."),
        staffBlock({ ...state, dev: true }),
        gap(),
        italic("The square is live."),
        quiet(agentPermit(state.actions)),
      ]);
    case "stop":
      if (!state.dev) return done(state, [line("Nothing is bound.")]);
      return done({ ...state, dev: false }, [line("Runtimes released."), staffBlock({ ...state, dev: false })]);
    case "rehearse": {
      if (!arg.trim()) {
        return done(
          state,
          [quiet("Rehearse needs an intent."), italic('rehearse "summarize the shelf and file the dispatch"')],
          2,
        );
      }
      const result = rehearse(state, score, arg);
      if (result.plan.steps.length === 0) {
        return done(state, [
          line("Nothing on the score matches that."),
          italic("The agent will not invent an action."),
          gap(),
          quiet('rehearse "summarize the shelf and file the dispatch"'),
        ]);
      }
      const blocks: Block[] = [quiet(`rehearsal  ·  ${score.name}  ·  dry`), gap()];
      result.plan.steps.forEach((step, index) => {
        blocks.push({
          type: "step",
          index: String(index + 1).padStart(2, "0"),
          name: step.name,
          detail: step.detail,
          refused: step.outcome === "refused",
        });
      });
      blocks.push(gap());
      blocks.push(
        italic(
          result.plan.refused
            ? "Rehearsal stopped. Promote the cadence, or take the write out of the intent."
            : "Rehearsal clean. The room is unchanged.",
        ),
      );
      return done(result.state, blocks, result.plan.refused ? 1 : 0);
    }
    case "cadence": {
      const open = state.cadences.filter((cadence) => cadence.open);
      if (!open.length) {
        return done(state, [italic("No open cadence. The agent has not asked to change the score.")]);
      }
      const blocks: Block[] = [quiet("open cadences"), gap()];
      for (const cadence of open) {
        blocks.push(line(cadence.id), quiet(cadence.action), italic("Grant the agent this voice, or leave it unanswered."), gap());
      }
      return done(state, blocks);
    }
    case "promote": {
      if (!arg.trim()) return done(state, [quiet("promote needs an id. Try cadence.")], 2);
      const result = promote(state, arg);
      if (!result.ok && result.reason === "missing") return done(state, [line(`No cadence named ${result.id}.`)], 2);
      if (!result.ok) return done(state, [italic(`${result.id} is already on the score.`)]);
      return done(result.state, [
        line(`${result.id} promoted.`),
        italic(`${result.action} now answers to the agent.`),
        quiet("The score changed. Rehearse again before you ship."),
      ]);
    }
    case "grant": {
      const parsed = parseGrant(arg);
      if (!parsed.name) return done(state, [quiet("grant needs an action.")], 2);
      const before = findAction(state, parsed.name);
      if (!before) return done(state, [line(`No action named ${parsed.name}.`)], 2);
      if (before.voices.includes(parsed.voice)) {
        return done(state, [italic(`${parsed.voice} is already scored on ${before.name}.`)]);
      }
      const next = grant(state, parsed.name, parsed.voice);
      return done(next, [
        line(`${parsed.voice} may play ${before.name}.`),
        quiet("The score changed. Rehearse again before you ship."),
      ]);
    }
    case "revoke": {
      const parsed = parseGrant(arg);
      if (!parsed.name) return done(state, [quiet("revoke needs an action. revoke fileDispatch")], 2);
      const current = findAction(state, parsed.name);
      try {
        const next = revoke(state, parsed.name, parsed.voice);
        const name = current?.name ?? parsed.name;
        const text = parsed.voice === "agent" ? `The agent no longer plays ${name}.` : `${parsed.voice} no longer plays ${name}.`;
        return done(next, [line(text)]);
      } catch (error) {
        if (error instanceof HarmonyError && (error.code === "NOT_SCORED" || error.code === "INVALID_INPUT")) {
          return done(state, [italic(error.message)], error.code === "INVALID_INPUT" ? 2 : 0);
        }
        throw error;
      }
    }
    case "ship": {
      const report = ship(state);
      return done(
        state,
        [quiet(`ship  ·  ${state.score}`), gap(), staffBlock(state), gap(), line(report.verdict), italic(report.because)],
        report.ok ? 0 : 1,
      );
    }
    case "targets":
      return done(state, showTargets(score));
    case "routes":
      return done(state, showRoutes(state));
    case "show": {
      const action = findAction(state, arg);
      if (!action) {
        return done(state, [line(arg ? `No action named ${arg}.` : "show needs an action."), quiet("Try show fileDispatch.")], 2);
      }
      const printed = scoreAction(score, action.name);
      const scored = action.voices.includes("agent");
      const fields = Object.entries(printed?.input ?? action.input ?? {});
      return done(state, [
        line(signature(printed ?? action)),
        quiet(`${action.kind}   ·   ${voiceList(action.voices)}`),
        ...action.files.map((file) => quiet(file)),
        ...fields.map(([key, field]) => quiet(`${key}${field.required ? "" : "?"}  ${field.type}  ${field.summary ?? ""}`.trim())),
        gap(),
        italic(action.summary),
        italic(scored ? "The agent is scored on this action." : "The agent is not scored. It must ask."),
      ]);
    }
    case "folio":
      return done(state, showFolio(score));
    case "version":
    case "--version":
    case "-v":
      return done(state, [line(`harmony ${VERSION}`), quiet("unison 1"), italic("The square is the only signal.")]);
    case "clear":
      return done(state, [italic("The desk is clear. The score is not.")]);
    case "reset": {
      const next = resetSession(state, score);
      return done(next, [
        line(score.name === "folio" ? "Score restored to the printed folio." : `Score restored to the printed ${score.name}.`),
        italic(score.name === "folio" ? "The agent may summarize. It may not dispatch." : "Voices match the printed score again."),
        staffBlock(next),
      ]);
    }
    case "create":
      return done(state, [
        line(`This desk already holds ${score.name}.`),
        italic("Harmony will not start a second score beside the one you can hear."),
        quiet("Read it with score. Restore it with reset."),
      ]);
    case "init":
      return done(state, [
        line("init writes a score file."),
        italic("Run it from the shell, in an empty directory: harmony init"),
      ]);
    default:
      return done(state, [line(`No such command: ${cmd}.`), italic("Harmony will not invent one."), quiet("Try help.")], 2);
  }
}

export async function reduceAsync(state: DeskState, raw: string, score: Score = folioScore()): Promise<DeskResult> {
  const { cmd, arg } = parseLine(raw);
  if (cmd !== "call") return reduce(state, raw, score);
  try {
    const request = parseCall(arg);
    const result = await callAction(state, score, request);
    const call = result.result;
    if (!call.ok) {
      const blocks = [quiet(`call  ·  ${request.voice}  ·  ${call.name}`), gap(), line("Refused."), italic(call.detail)];
      return done(result.state, blocks, 1);
    }
    const blocks = [
      quiet(`call  ·  ${call.voice}  ·  ${call.name}${call.dry ? "  ·  dry" : ""}`),
      gap(),
      line("Played."),
      italic(call.detail),
      ...valueLine(call.value),
    ];
    return done(result.state, blocks, 0);
  } catch (error) {
    if (error instanceof HarmonyError) return done(state, [line(error.message)], 2);
    throw error;
  }
}
