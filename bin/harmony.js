#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const VERSION = "0.9.0";
const SHELF = [
  { title: "The Living Mountain", author: "Nan Shepherd", notes: 4 },
  { title: "The Rings of Saturn", author: "W.G. Sebald", notes: 11 },
  { title: "Invisible Cities", author: "Italo Calvino", notes: 2 },
];

const stateFile = path.join(process.cwd(), ".harmony", "state.json");
const tty = process.stdout.isTTY;

function paint(text, tone) {
  if (!tty) return text;
  if (tone === "quiet") return `\x1b[38;2;138;134;126m${text}\x1b[0m`;
  if (tone === "italic") return `\x1b[3m${text}\x1b[0m`;
  return text;
}

function signalMark(on) {
  if (!on) return "·";
  if (!tty) return "■";
  return "\x1b[38;2;214;255;74m■\x1b[0m";
}

function initialActions() {
  return [
    {
      name: "listShelf",
      kind: "read",
      summary: "Read the shelf. Titles, authors, how many notes in the margin.",
      files: ["app/shelf.tsx", "api/shelf.ts"],
      voices: ["app", "api"],
    },
    {
      name: "openVolume",
      kind: "read",
      summary: "Open one volume. The page, and the notes already there.",
      files: ["app/volume/[id].tsx", "api/volume.ts"],
      voices: ["app", "api"],
    },
    {
      name: "annotate",
      kind: "write",
      summary: "Leave a margin note. A human hand. Not an agent's.",
      files: ["app/margin.tsx", "api/annotate.ts"],
      voices: ["app", "api"],
    },
    {
      name: "summarizeShelf",
      kind: "read",
      summary: "Brief the shelf. Held in the room. Nothing is sent.",
      files: ["api/summarize.ts"],
      voices: ["app", "api", "agent"],
    },
    {
      name: "fileDispatch",
      kind: "write",
      summary: "Send the briefing out of the room. The agent must ask.",
      files: ["app/dispatch.tsx", "api/dispatch.ts"],
      voices: ["app", "api"],
    },
  ];
}

function freshState() {
  return {
    actions: initialActions(),
    dev: false,
    cadences: [],
    nextCadence: 1,
    rehearsalCount: 0,
    lastRefused: false,
    everRehearsed: false,
    stale: false,
  };
}

function loadState() {
  try {
    const raw = fs.readFileSync(stateFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.actions)) return freshState();
    return { ...freshState(), ...parsed };
  } catch {
    return freshState();
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
}

function agentCount(actions) {
  return actions.filter((action) => action.voices.includes("agent")).length;
}

function staffBlock(state) {
  const n = agentCount(state.actions);
  if (!state.dev) return { type: "staff", app: "idle", api: "idle", agent: "quiet" };
  return {
    type: "staff",
    app: "bound",
    api: "5 routes",
    agent: n === 1 ? "1 in voice" : `${n} in voice`,
  };
}

function line(text) {
  return { type: "line", tone: "body", text };
}
function quiet(text) {
  return { type: "line", tone: "quiet", text };
}
function italic(text) {
  return { type: "line", tone: "italic", text };
}
function gap() {
  return { type: "gap" };
}

function voiceList(voices) {
  return voices.length ? voices.join("  ") : "no voice";
}

function agentPermit(actions) {
  const summarize = actions.find((action) => action.name === "summarizeShelf")?.voices.includes("agent");
  const dispatch = actions.find((action) => action.name === "fileDispatch")?.voices.includes("agent");
  if (summarize && dispatch) return "The agent may summarize, and it may dispatch.";
  if (summarize && !dispatch) return "The agent may summarize. It may not dispatch.";
  if (!summarize && dispatch) return "The agent may dispatch. It may not summarize.";
  return "The agent is scored on neither brief nor dispatch.";
}

function findAction(state, name) {
  const q = name.trim().toLowerCase();
  return state.actions.find((action) => action.name.toLowerCase() === q);
}

function withActions(state, actions) {
  return { ...state, actions, stale: state.everRehearsed ? true : state.stale };
}

function fileCadence(state, action) {
  const existing = state.cadences.find((cadence) => cadence.open && cadence.action === action);
  if (existing) return { state, id: existing.id, created: false };
  const id = `c-${state.nextCadence}`;
  return {
    created: true,
    id,
    state: {
      ...state,
      nextCadence: state.nextCadence + 1,
      cadences: [...state.cadences, { id, action, open: true }],
    },
  };
}

function pickVolume(intent) {
  const q = intent.toLowerCase();
  if (q.includes("shepherd") || q.includes("mountain")) return SHELF[0];
  if (q.includes("calvino") || q.includes("cities") || q.includes("invisible")) return SHELF[2];
  return SHELF[1];
}

function playDetail(name, intent) {
  if (name === "listShelf") return "Shepherd, 4 notes. Sebald, 11. Calvino, 2. The shelf was read.";
  if (name === "openVolume") {
    const volume = pickVolume(intent);
    return `Opened ${volume.title}. ${volume.author}. ${volume.notes} notes in the margin. Read only.`;
  }
  if (name === "annotate") return "A margin note was drafted and discarded. The page is still clean.";
  if (name === "summarizeShelf") {
    return "Three volumes. The heaviest margin is Sebald, 11 notes. The briefing stays in the room.";
  }
  return "The briefing was addressed to the desk. Rehearsal does not send it.";
}

function detect(intent) {
  const q = intent.toLowerCase();
  const summarize = /summar|brief/.test(q);
  const dispatch = /dispatch|publish|\bsend\b|\bfile\b/.test(q);
  const names = [];
  if (/\blist\b/.test(q) || (/\bshelf\b/.test(q) && !summarize && !dispatch)) names.push("listShelf");
  if (
    /open|sebald|shepherd|calvino|saturn|mountain|cities/.test(q) ||
    (/\bread\b/.test(q) && !/\bshelf\b/.test(q))
  ) {
    names.push("openVolume");
  }
  if (/annotat|margin|\bnote\b/.test(q)) names.push("annotate");
  if (summarize) names.push("summarizeShelf");
  if (dispatch) names.push("fileDispatch");
  return names;
}

function rehearse(state, intent) {
  const text = intent.trim();
  if (!text) {
    return {
      state,
      blocks: [quiet("Rehearse needs an intent."), italic('rehearse "summarize the shelf and file the dispatch"')],
    };
  }
  const names = detect(text);
  if (names.length === 0) {
    return {
      state,
      blocks: [
        line("Nothing on the score matches that."),
        italic("The agent will not invent an action."),
        gap(),
        quiet('rehearse "summarize the shelf and file the dispatch"'),
      ],
    };
  }
  let next = {
    ...state,
    actions: state.actions.map((action) => ({ ...action, voices: [...action.voices] })),
    cadences: state.cadences.map((cadence) => ({ ...cadence })),
  };
  const blocks = [quiet("rehearsal  ·  folio  ·  dry"), gap()];
  const steps = [];
  names.forEach((name, index) => {
    const action = next.actions.find((item) => item.name === name);
    if (!action) return;
    if (!action.voices.includes("agent")) {
      const filed = fileCadence(next, name);
      next = filed.state;
      const detail = filed.created
        ? `Not scored for the agent. Cadence ${filed.id} asks for the voice. Nothing left the room.`
        : `Still not scored. ${filed.id} is already open. Nothing left the room.`;
      steps.push({ outcome: "refused" });
      blocks.push({
        type: "step",
        index: String(index + 1).padStart(2, "0"),
        name,
        detail,
        refused: true,
      });
      return;
    }
    steps.push({ outcome: "played" });
    blocks.push({
      type: "step",
      index: String(index + 1).padStart(2, "0"),
      name,
      detail: playDetail(name, text),
      refused: false,
    });
  });
  const refused = steps.some((step) => step.outcome === "refused");
  next = {
    ...next,
    rehearsalCount: next.rehearsalCount + 1,
    everRehearsed: true,
    lastRefused: refused,
    stale: false,
  };
  blocks.push(gap());
  blocks.push(
    italic(
      refused
        ? "Rehearsal stopped. Promote the cadence, or take the write out of the intent."
        : "Rehearsal clean. The room is unchanged.",
    ),
  );
  return { state: next, blocks };
}

function help(arg) {
  if (arg) {
    const notes = {
      rehearse: "Plays an intent as the agent. A missing voice becomes a cadence. A write is addressed, never sent.",
      promote: "promote c-1 grants the agent that action. The score changes. Rehearse again before you ship.",
      ship: "Holds if a cadence is open, the score changed, or nothing has been rehearsed.",
      dev: "Binds three runtimes. Web, iOS, and Android for the app. Typed routes for the API. Unison for the agent.",
      revoke: "revoke fileDispatch takes the agent off that action.",
    };
    const key = arg.toLowerCase();
    if (!notes[key]) return [line(`No manual entry for ${arg}.`), quiet("Try help.")];
    return [line(key), italic(notes[key])];
  }
  return [
    line(`harmony ${VERSION}  —  the desk`),
    gap(),
    quiet("help            this index"),
    quiet("score           actions and their voices"),
    quiet("dev             bind app, api, agent"),
    quiet("stop            release the runtimes"),
    quiet("rehearse        dry-run an intent"),
    quiet("cadence         what the agent asked"),
    quiet("promote c-1     grant a voice"),
    quiet("revoke          take a voice back"),
    quiet("ship            the release check"),
    quiet("targets         web, ios, android"),
    quiet("routes          the file tree"),
    quiet("folio           the reading room"),
    quiet("show            one action"),
    quiet("reset           the printed score"),
    quiet("clear           wipe the desk, not the score"),
    quiet("exit            leave the prompt"),
    gap(),
    italic("State lives in .harmony/state.json."),
  ];
}

function showScore(state) {
  const blocks = [quiet("folio  ·  the score"), gap()];
  state.actions.forEach((action) => {
    blocks.push(line(action.name));
    blocks.push(quiet(`${action.kind}   ·   ${voiceList(action.voices)}`));
    blocks.push(italic(action.summary));
    blocks.push(gap());
  });
  blocks.push(quiet(`${agentCount(state.actions)} of ${state.actions.length} answer to the agent.`));
  return blocks;
}

function ship(state) {
  const open = state.cadences.filter((cadence) => cadence.open);
  const silent = state.actions.filter((action) => action.voices.length === 0);
  const writes = state.actions.filter((action) => action.kind === "write" && action.voices.includes("agent"));
  const blocks = [quiet("ship  ·  folio"), gap(), staffBlock(state), gap()];
  let verdict = "Clear.";
  let because = "The last rehearsal matches the score.";
  if (silent.length) {
    verdict = "Hold.";
    because = `${silent.map((action) => action.name).join(", ")} has no voice. It cannot be played.`;
  } else if (open.length) {
    verdict = "Hold.";
    because = `${open.map((cadence) => cadence.id).join(", ")} still open. Answer the agent, or leave the write off the score.`;
  } else if (!state.everRehearsed) {
    verdict = "Hold.";
    because = "No rehearsal on record. The desk will not ship a voice it has not heard.";
  } else if (state.stale) {
    verdict = "Hold.";
    because = "The score changed after the last rehearsal. Play it again.";
  } else if (state.lastRefused) {
    verdict = "Hold.";
    because = "The last rehearsal stopped. The agent would have stopped too.";
  } else if (writes.length) {
    because = `${writes.map((action) => action.name).join(", ")} is a write, and the agent may play it. You put it on the score.`;
  }
  blocks.push(line(verdict));
  blocks.push(italic(because));
  return blocks;
}

function parse(raw) {
  let text = raw.trim();
  if (/^harmony\b/i.test(text)) text = text.replace(/^harmony\b/i, "").trim();
  if (!text) return { cmd: "", arg: "" };
  const match = text.match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) return { cmd: text.toLowerCase(), arg: "" };
  let arg = match[2].trim();
  if (
    (arg.startsWith('"') && arg.endsWith('"') && arg.length >= 2) ||
    (arg.startsWith("'") && arg.endsWith("'") && arg.length >= 2)
  ) {
    arg = arg.slice(1, -1);
  }
  return { cmd: match[1].toLowerCase(), arg };
}

function reduce(state, raw) {
  const { cmd, arg } = parse(raw);
  if (!cmd) return { state, blocks: [] };
  switch (cmd) {
    case "help":
    case "man":
    case "?":
      return { state, blocks: help(arg) };
    case "score":
    case "voices":
      return { state, blocks: showScore(state) };
    case "dev":
      if (state.dev) {
        return {
          state,
          blocks: [
            line("The staff is already bound."),
            staffBlock(state),
            quiet("App on :3000. API on :3001. The agent is scored, not loose."),
          ],
        };
      }
      return {
        state: { ...state, dev: true },
        blocks: [
          line("Binding the staff."),
          staffBlock({ ...state, dev: true }),
          gap(),
          italic("The square is live."),
          quiet(agentPermit(state.actions)),
        ],
      };
    case "stop":
      if (!state.dev) return { state, blocks: [line("Nothing is bound.")] };
      return {
        state: { ...state, dev: false },
        blocks: [line("Runtimes released."), staffBlock({ ...state, dev: false })],
      };
    case "rehearse":
      return rehearse(state, arg);
    case "cadence": {
      const open = state.cadences.filter((cadence) => cadence.open);
      if (!open.length) {
        return { state, blocks: [italic("No open cadence. The agent has not asked to change the score.")] };
      }
      const blocks = [quiet("open cadences"), gap()];
      open.forEach((cadence) => {
        blocks.push(line(cadence.id), quiet(cadence.action), italic("Grant the agent this voice, or leave it unanswered."), gap());
      });
      return { state, blocks };
    }
    case "promote": {
      if (!arg) return { state, blocks: [quiet("promote needs an id. Try cadence.")] };
      const id = arg.toLowerCase().startsWith("c-") ? arg.toLowerCase() : `c-${arg}`;
      const cadence = state.cadences.find((item) => item.id === id);
      if (!cadence) return { state, blocks: [line(`No cadence named ${id}.`)] };
      if (!cadence.open) return { state, blocks: [italic(`${id} is already on the score.`)] };
      const actions = state.actions.map((action) => {
        if (action.name !== cadence.action || action.voices.includes("agent")) return action;
        return { ...action, voices: [...action.voices, "agent"] };
      });
      return {
        state: {
          ...state,
          actions,
          cadences: state.cadences.map((item) => (item.id === id ? { ...item, open: false } : item)),
          stale: true,
        },
        blocks: [
          line(`${id} promoted.`),
          italic(`${cadence.action} now answers to the agent.`),
          quiet("The score changed. Rehearse again before you ship."),
        ],
      };
    }
    case "revoke": {
      const action = findAction(state, arg);
      if (!action) return { state, blocks: [quiet("revoke needs an action. revoke fileDispatch")] };
      if (!action.voices.includes("agent")) {
        return { state, blocks: [italic(`The agent was never scored on ${action.name}.`)] };
      }
      const actions = state.actions.map((item) =>
        item.name === action.name ? { ...item, voices: item.voices.filter((voice) => voice !== "agent") } : item,
      );
      return { state: withActions(state, actions), blocks: [line(`The agent no longer plays ${action.name}.`)] };
    }
    case "ship":
      return { state, blocks: ship(state) };
    case "targets":
      return {
        state,
        blocks: [
          quiet("one project, three surfaces"),
          gap(),
          line("web"),
          italic("One bundle. The same screens."),
          line("ios"),
          italic("Simulator and device. No second tree."),
          line("android"),
          italic("Emulator and device. The primitives compile."),
        ],
      };
    case "routes":
      return {
        state,
        blocks: [
          quiet("folio/"),
          quiet("  app/shelf.tsx"),
          quiet("  app/volume/[id].tsx"),
          quiet("  app/margin.tsx"),
          quiet("  app/dispatch.tsx"),
          quiet("  api/shelf.ts"),
          quiet("  api/volume.ts"),
          quiet("  api/annotate.ts"),
          quiet("  api/summarize.ts"),
          quiet("  api/dispatch.ts"),
          quiet("  agent/score.ts"),
          gap(),
          italic("The screen, the route, and the agent import the same actions."),
        ],
      };
    case "show": {
      const action = findAction(state, arg);
      if (!action) {
        return {
          state,
          blocks: [line(arg ? `No action named ${arg}.` : "show needs an action."), quiet("Try show fileDispatch.")],
        };
      }
      const scored = action.voices.includes("agent");
      return {
        state,
        blocks: [
          line(action.name),
          quiet(`${action.kind}   ·   ${voiceList(action.voices)}`),
          ...action.files.map((file) => quiet(file)),
          gap(),
          italic(action.summary),
          italic(scored ? "The agent is scored on this action." : "The agent is not scored. It must ask."),
        ],
      };
    }
    case "folio":
      return {
        state,
        blocks: [
          quiet("folio  ·  a private reading room"),
          gap(),
          ...SHELF.flatMap((volume, index) => [
            line(`${String(index + 1).padStart(2, "0")}   ${volume.title}`),
            quiet(`${volume.author}   ·   ${volume.notes} notes`),
          ]),
          gap(),
          italic("The agent may read these. It may not send them."),
        ],
      };
    case "version":
    case "--version":
    case "-v":
      return {
        state,
        blocks: [line(`harmony ${VERSION}`), quiet("unison 1"), italic("The square is the only signal.")],
      };
    case "clear":
      return { state, blocks: [italic("The desk is clear. The score is not.")] };
    case "reset":
      return {
        state: { ...freshState(), dev: state.dev },
        blocks: [
          line("Score restored to the printed folio."),
          italic("The agent may summarize. It may not dispatch."),
          staffBlock({ dev: state.dev, actions: freshState().actions }),
        ],
      };
    case "create":
      return {
        state,
        blocks: [
          line("This desk already holds folio."),
          italic("Harmony will not start a second score beside the one you can hear."),
          quiet("Read it with score. Restore it with reset."),
        ],
      };
    default:
      return {
        state,
        blocks: [line(`No such command: ${cmd}.`), italic("Harmony will not invent one."), quiet("Try help.")],
      };
  }
}

function render(blocks, dev) {
  const out = [];
  for (const block of blocks) {
    if (block.type === "gap") {
      out.push("");
      continue;
    }
    if (block.type === "staff") {
      out.push(
        `  ${paint("app", "quiet")}    ${block.app}    ${paint("api", "quiet")}    ${block.api}    ${paint("agent", "quiet")}    ${block.agent}`,
      );
      continue;
    }
    if (block.type === "step") {
      const mark = block.refused ? paint("refused", "quiet") : paint("played", "quiet");
      out.push(`${paint(block.index, "quiet")}  ${block.name}  ${mark}`);
      out.push(`    ${paint(block.detail, "italic")}`);
      continue;
    }
    out.push(paint(block.text, block.tone));
  }
  process.stdout.write(out.join("\n") + (out.length ? "\n" : ""));
  return dev;
}

function runLine(state, raw) {
  const result = reduce(state, raw);
  render(result.blocks, result.state.dev);
  saveState(result.state);
  return result.state;
}

function fromArgv(argv) {
  if (argv.length === 0) return "";
  const [cmd, ...rest] = argv;
  if (!rest.length) return cmd;
  const arg = rest.join(" ");
  return `${cmd} ${arg}`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length > 0 || !tty) {
    const command = fromArgv(argv) || "help";
    const state = loadState();
    runLine(state, command);
    return;
  }

  let state = loadState();
  const welcome = [
    line(`harmony ${VERSION}`),
    italic("folio, a reading room."),
    gap(),
    line("The agent does not get tools."),
    line("It gets the actions you already wrote."),
    gap(),
    staffBlock(state),
    gap(),
    quiet("Type help. Or dev, to bind the staff."),
  ];
  render(welcome, state.dev);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${signalMark(state.dev)} harmony `,
  });
  rl.prompt();
  rl.on("line", (input) => {
    const text = input.trim();
    if (!text) {
      rl.prompt();
      return;
    }
    if (text === "exit" || text === "quit") {
      rl.close();
      return;
    }
    state = runLine(state, text);
    rl.setPrompt(`${signalMark(state.dev)} harmony `);
    rl.prompt();
  });
  rl.on("close", () => {
    process.stdout.write("\n");
  });
}

main();
