#!/usr/bin/env node
import readline from "node:readline";
import { parseLine, reduceAsync, welcomeBlocks } from "./desk.js";
import { isHarmonyError } from "./errors.js";
import { initProject, loadScore, loadSession, saveSession, saveVoices } from "./load.js";
import { render, signalMark } from "./render.js";
function splitSave(raw) {
    const save = /(?:^|\s)--save\b/.test(raw);
    const line = raw.replace(/\s--save\b/g, " ").replace(/[ \t]+/g, " ").trim();
    return { line, save };
}
function fail(error) {
    const message = isHarmonyError(error) ? error.message : error instanceof Error ? error.message : "The desk stopped.";
    render([{ type: "line", tone: "body", text: message }]);
    return isHarmonyError(error) && error.code !== "HOLD" && error.code !== "NOT_SCORED" ? 2 : 1;
}
async function execute(state, score, file, raw, cwd) {
    const { line, save } = splitSave(raw);
    const { cmd, arg } = parseLine(line);
    if (cmd === "init") {
        try {
            const written = initProject(cwd, arg.trim() || "app");
            render([
                { type: "line", tone: "body", text: written },
                { type: "line", tone: "italic", text: "Score written. Start the desk again in this directory." },
            ]);
            return { state, code: 0 };
        }
        catch (error) {
            return { state, code: fail(error) };
        }
    }
    try {
        const result = await reduceAsync(state, line, score);
        const blocks = [...result.blocks];
        if (save) {
            if (file?.endsWith(".json")) {
                saveVoices(file, result.state.actions);
                blocks.push({ type: "line", tone: "quiet", text: "Voices written back to the score." });
            }
            else {
                blocks.push({ type: "line", tone: "italic", text: "This score is code. Edit the voices in the file." });
            }
        }
        render(blocks);
        saveSession(cwd, result.state);
        return { state: result.state, code: result.code };
    }
    catch (error) {
        return { state, code: fail(error) };
    }
}
async function main() {
    const cwd = process.cwd();
    const argv = process.argv.slice(2);
    if (argv[0] === "init") {
        try {
            const file = initProject(cwd, argv[1] ?? "app");
            render([
                { type: "line", tone: "body", text: file },
                { type: "line", tone: "italic", text: "The agent may read. It may not write." },
                { type: "line", tone: "quiet", text: "harmony dev" },
            ]);
        }
        catch (error) {
            process.exitCode = fail(error);
        }
        return;
    }
    const loaded = await loadScore(cwd);
    let state = loadSession(cwd, loaded.score);
    const joined = argv.length ? argv.join(" ") : "";
    if (joined || !process.stdout.isTTY) {
        const { code } = await execute(state, loaded.score, loaded.file, joined || "help", cwd);
        process.exitCode = code;
        return;
    }
    render(welcomeBlocks(loaded.score));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${signalMark(state.dev)} harmony ` });
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
        void execute(state, loaded.score, loaded.file, text, cwd).then((result) => {
            state = result.state;
            rl.setPrompt(`${signalMark(state.dev)} harmony `);
            rl.prompt();
        });
    });
    rl.on("close", () => {
        process.stdout.write("\n");
    });
}
main().catch((error) => {
    process.exitCode = fail(error);
});
//# sourceMappingURL=cli.js.map