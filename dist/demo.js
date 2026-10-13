import { agent, tool } from "./ai.js";
export const summarize = tool({
    name: "summarize",
    description: "Summarize the shelf. Nothing is sent.",
    async run() {
        return { detail: "Three volumes. The heaviest margin is Sebald, 11 notes. The briefing stays in the room." };
    },
});
export const fileDispatch = tool({
    name: "fileDispatch",
    description: "Send the briefing out of the room.",
    async run() {
        return { detail: "The briefing was addressed. It was not sent." };
    },
});
const ALL = { summarize, fileDispatch };
export function librarian(names) {
    return agent({
        name: "librarian",
        instructions: "Help the reader. Use only the tools you were given.",
        tools: names.flatMap((name) => (ALL[name] ? [ALL[name]] : [])),
    });
}
//# sourceMappingURL=demo.js.map