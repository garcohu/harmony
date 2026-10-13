export type Screen = {
    path: string;
    file: string;
    layouts: string[];
    loading: string | null;
    error: string | null;
};
export type Endpoint = {
    path: string;
    file: string;
    methods: string[];
};
export type ToolFile = {
    file: string;
    names: string[];
};
export type Project = {
    screens: Screen[];
    endpoints: Endpoint[];
    tools: ToolFile[];
    agent: {
        file: string;
        name: string | null;
    } | null;
};
export declare function scan(appDir: string): Project;
//# sourceMappingURL=scan.d.ts.map