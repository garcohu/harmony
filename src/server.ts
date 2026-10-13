export type RouteContext = {
  params: Record<string, string>;
};

export type RouteHandler = (request: Request, context: RouteContext) => Response | Promise<Response>;

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}
