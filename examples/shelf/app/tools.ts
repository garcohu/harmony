import { tool } from "harmony/ai";
import { SHELF } from "./data";

export const summarize = tool({
  name: "summarize",
  description: "Summarize the shelf. Nothing is sent.",
  async run() {
    const heavy = [...SHELF].sort((a, b) => b.notes - a.notes)[0];
    return {
      detail: `Three volumes. The heaviest margin is ${heavy?.author.split(" ").at(-1)}, ${heavy?.notes} notes. Nothing is sent.`,
    };
  },
});

export const fileDispatch = tool({
  name: "fileDispatch",
  description: "Send the briefing out of the room.",
  async run() {
    return { detail: "The briefing was addressed. It was not sent.", sent: false };
  },
});
