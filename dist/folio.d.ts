import type { ActionContext, ActionDef, ActionInput, Score } from "./types.js";
export declare const SHELF: readonly [{
    readonly title: "The Living Mountain";
    readonly author: "Nan Shepherd";
    readonly notes: 4;
}, {
    readonly title: "The Rings of Saturn";
    readonly author: "W.G. Sebald";
    readonly notes: 11;
}, {
    readonly title: "Invisible Cities";
    readonly author: "Italo Calvino";
    readonly notes: 2;
}];
export declare function pickVolume(intent: string, input?: ActionInput): {
    readonly title: "The Living Mountain";
    readonly author: "Nan Shepherd";
    readonly notes: 4;
} | {
    readonly title: "The Rings of Saturn";
    readonly author: "W.G. Sebald";
    readonly notes: 11;
} | {
    readonly title: "Invisible Cities";
    readonly author: "Italo Calvino";
    readonly notes: 2;
};
export declare function folioScore(): Score;
export declare function initialActions(): ActionDef[];
export declare const MANUAL: {
    cmd: string;
    run: string;
    blurb: string;
}[];
export declare function detailOf(action: ActionDef, input: ActionInput, ctx: ActionContext): string;
//# sourceMappingURL=folio.d.ts.map