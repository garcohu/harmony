/** The shelf example, kept in step with examples/shelf. The site and the tests both read this. */
export const SHELF = {
    name: "Shelf",
    platforms: ["ios", "android", "web"],
    screens: [
        { path: "/", file: "app/page.tsx" },
        { path: "/volume/:id", file: "app/volume/[id]/page.tsx" },
    ],
    handlers: [
        { methods: ["GET"], path: "/api/shelf", file: "app/api/shelf/route.ts" },
        { methods: ["GET"], path: "/health", file: "app/health+api.ts" },
        { methods: ["GET"], path: "/volume/:id", file: "app/volume/[id]/route.ts" },
    ],
    tools: [
        { name: "summarize", description: "Summarize the shelf. Nothing is sent.", on: true },
        { name: "fileDispatch", description: "Send the briefing out of the room.", on: false },
    ],
    agent: "librarian",
};
//# sourceMappingURL=manifest.js.map