export type RouteContext = {
    params: Record<string, string>;
};
export type RouteHandler = (request: Request, context: RouteContext) => Response | Promise<Response>;
export declare function json(data: unknown, status?: number): Response;
//# sourceMappingURL=server.d.ts.map