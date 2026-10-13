# Harmony

The SDK and CLI where the app, the API, and the agent share one score.

The agent does not get a bag of tools. It gets the actions you already wrote, and only the voices you allowed. A missing voice becomes a cadence. A rehearsal can address a write without running it. `ship` holds until that rehearsal matches the live score.

Unison is 1. Harmony will not keep a second score beside the one you can hear.

## Install

Node 20 or newer.

```bash
npx github:garcohu/harmony
```

```bash
npm install github:garcohu/harmony
```

The package ships its build. There is nothing to compile on install.

## A score

`harmony.score.json` is the printed contract. `harmony.score.mjs` is the same contract when an action has a function.

```js
import { defineAction, defineScore } from "harmony";

export default defineScore({
  name: "counter",
  unison: 1,
  summary: "One counter. The agent may read it. It may not reset it.",
  targets: ["web", "ios", "android"],
  actions: [
    defineAction({
      name: "readCount",
      kind: "read",
      summary: "Read the counter.",
      files: ["app/counter.tsx", "api/counter.ts"],
      voices: ["app", "api", "agent"],
      match: ["read", "count"],
      async run(_input, ctx) {
        return { detail: `Read by ${ctx.voice}.`, count: 0 };
      },
    }),
    defineAction({
      name: "resetCount",
      kind: "write",
      summary: "Reset the counter. The agent must ask.",
      files: ["app/counter.tsx", "api/counter.ts"],
      voices: ["app", "api"],
      match: ["reset"],
      run() {
        return { detail: "Counter reset.", count: 0 };
      },
    }),
  ],
});
```

Rules the loader enforces:

- `unison` is `1`
- action names are camelCase and unique
- `kind` is `read` or `write`
- every action has a summary, at least one file, and at least one voice
- files are relative and cannot contain `..`
- voices are `app`, `api`, or `agent`
- inputs are `string`, `number`, or `boolean`

With no score file in the current directory, the desk opens the built-in **folio**: a reading room where the agent may summarize and may not dispatch.

`harmony init ledger` writes a starter `harmony.score.json` and ignores `.harmony`.

## Commands

| Command | What it does |
| --- | --- |
| `init [name]` | Write `harmony.score.json`. Refuses to overwrite. |
| `check` | Confirm the loaded score. |
| `score` | Actions and their live voices. |
| `functions` | Callable signatures. |
| `show <action>` | One action, its files, and its inputs. |
| `dev` / `stop` | Bind or release the staff. |
| `rehearse "<intent>"` | Dry-run. Matching actions are played or refused. Nothing is called. |
| `call <action> --voice agent` | Run the function if that voice is scored. |
| `call <action> --dry --input key=value` | Validate and address it. Do not run it. |
| `cadence` | Open requests from the agent. |
| `promote c-1` | Grant the agent the action that cadence asked for. |
| `grant <action> [voice]` | Add a voice. Defaults to `agent`. |
| `revoke <action> [voice]` | Take a voice back. An action cannot be left silent. |
| `ship` | Release check. Exit 1 on hold. |
| `targets` | The surfaces on the score. |
| `routes` | The files the actions name. |
| `reset` | Restore the printed voices. |
| `folio` | Describe the loaded score. |

`--save` on `grant`, `revoke`, or `promote` writes voices back when the score is JSON. A `.mjs` score is code: edit the file.

Exit `0` when the command holds. Exit `1` when a rehearsal refuses, a call is not scored, or `ship` holds. Exit `2` when the command or the score is malformed.

The live desk is `.harmony/session.json`. It is local. The printed score stays what you committed until you `--save` or edit it.

## SDK

```js
import { call, defineScore, freshState, rehearse, ship } from "harmony";

const score = defineScore({ /* ... */ });
let state = freshState(score);

const planned = rehearse(state, score, "read the record and send it");
state = planned.state;

const result = await call(state, score, {
  name: "sendRecord",
  voice: "agent",
  input: { id: "4" },
});

if (!result.result.ok) {
  // result.result.cadenceId is set when the agent asked for a voice
}

const report = ship(state);
```

`call` returns `{ state, result }`. A refused agent call files a cadence and does not run the function. `--dry`, and any action with no `run`, returns the detail and does not call.

`rehearse` never calls `run`. It uses each action's `match`: a list of words, or a function on a JavaScript score.

## Folio

```bash
harmony dev
harmony rehearse "summarize the shelf and file the dispatch"
harmony promote c-1
harmony rehearse "summarize the shelf and file the dispatch"
harmony ship
```

The first rehearsal plays `summarizeShelf` and refuses `fileDispatch`. After `promote`, the second rehearsal is clean. `ship` then says clear: you put the write on the score.

`call fileDispatch --voice agent` files `c-1` and does not send. Folio's own `run` never sends, even when a voice is allowed. Replace `run` when a write should leave the room.
