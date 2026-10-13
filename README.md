# Harmony

The CLI where the app, the API, and the agent share one score.

The agent does not get a bag of tools. It gets the actions you already wrote, and only the voices you allowed. A missing voice becomes a cadence. A rehearsal can play a write without sending it. `ship` holds until that rehearsal matches the score.

## Install

```bash
npx github:garcohu/harmony
```

Or install it on the path:

```bash
npm install -g github:garcohu/harmony
harmony
```

Requires Node 20 or newer. No dependencies.

## The sample score

The desk opens on **folio**, a reading room. State is written to `.harmony/state.json` in the current directory, so `promote` and `ship` survive the next invocation.

```bash
harmony dev
harmony rehearse "summarize the shelf and file the dispatch"
harmony cadence
harmony promote c-1
harmony rehearse "summarize the shelf and file the dispatch"
harmony ship
```

`fileDispatch` is refused until you promote it. The second rehearsal is clean. `ship` then says clear.

With no arguments in a terminal, Harmony opens a prompt. `exit` leaves. The square is signal only while the staff is bound.

## Commands

| Command | What it does |
| --- | --- |
| `help` | Index of the desk |
| `score` | Actions and their voices |
| `dev` / `stop` | Bind or release app, API, and agent |
| `rehearse "..."` | Dry-run an intent |
| `cadence` | What the agent asked to change |
| `promote c-1` | Grant a voice |
| `revoke <action>` | Take the agent off an action |
| `ship` | Release check |
| `targets` | Web, iOS, Android |
| `routes` | The file tree |
| `folio` | The reading room |
| `show <action>` | One action |
| `reset` | Restore the printed score |
