import { type Project } from "./scan.js";
export type Running = {
    url: string;
    port: number;
    close: () => Promise<void>;
};
export declare function prepare(cwd: string, watch: boolean): Promise<{
    outDir: string;
    project: Project;
    dispose: () => Promise<void>;
}>;
export declare function serve(cwd: string, options?: {
    port?: number;
    host?: string;
    watch?: boolean;
}): Promise<Running>;
//# sourceMappingURL=serve.d.ts.map