/** `/volume/:id` against `/volume/saturn`. Static segments win over dynamic ones when several routes match. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const path = normalize(pathname);
  const expected = pattern === "" ? "/" : pattern;
  if (expected === "/") return path === "/" ? {} : null;
  const left = expected.split("/").filter(Boolean);
  const right = path.split("/").filter(Boolean);
  if (left.length !== right.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < left.length; i += 1) {
    const want = left[i] ?? "";
    const got = right[i] ?? "";
    if (want.startsWith(":")) params[decodeURIComponent(want.slice(1))] = decodeURIComponent(got);
    else if (want !== got) return null;
  }
  return params;
}

export function normalize(pathname: string): string {
  const bare = pathname.split("?")[0] ?? "/";
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare || "/";
}

export function specificity(pattern: string): number {
  return pattern.split("/").filter((part) => part.startsWith(":")).length;
}
