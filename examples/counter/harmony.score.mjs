import { defineAction, defineScore } from "../../dist/index.js";

const count = { value: 0 };

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
      run(_input, ctx) {
        return { detail: `Count is ${count.value}. Read by ${ctx.voice}.`, count: count.value };
      },
    }),
    defineAction({
      name: "resetCount",
      kind: "write",
      summary: "Reset the counter. The agent must ask.",
      files: ["app/counter.tsx", "api/counter.ts"],
      voices: ["app", "api"],
      match: ["reset"],
      run(input, ctx) {
        count.value = 0;
        return { detail: `Counter reset by ${ctx.voice}.`, count: 0, note: input.note };
      },
    }),
  ],
});
