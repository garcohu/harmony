/** The shelf example, kept in step with examples/shelf. The site and the tests both read this. */
export declare const SHELF: {
    readonly name: "Shelf";
    readonly platforms: readonly ["ios", "android", "web"];
    readonly screens: readonly [{
        readonly path: "/";
        readonly file: "app/page.tsx";
    }, {
        readonly path: "/volume/:id";
        readonly file: "app/volume/[id]/page.tsx";
    }];
    readonly handlers: readonly [{
        readonly methods: readonly ["GET"];
        readonly path: "/api/shelf";
        readonly file: "app/api/shelf/route.ts";
    }, {
        readonly methods: readonly ["GET"];
        readonly path: "/health";
        readonly file: "app/health+api.ts";
    }, {
        readonly methods: readonly ["GET"];
        readonly path: "/volume/:id";
        readonly file: "app/volume/[id]/route.ts";
    }];
    readonly tools: readonly [{
        readonly name: "summarize";
        readonly description: "Summarize the shelf. Nothing is sent.";
        readonly on: true;
    }, {
        readonly name: "fileDispatch";
        readonly description: "Send the briefing out of the room.";
        readonly on: false;
    }];
    readonly agent: "librarian";
};
//# sourceMappingURL=manifest.d.ts.map