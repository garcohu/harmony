/** `/volume/:id` against `/volume/saturn`. Static segments win over dynamic ones when several routes match. */
export declare function matchPath(pattern: string, pathname: string): Record<string, string> | null;
export declare function normalize(pathname: string): string;
export declare function specificity(pattern: string): number;
//# sourceMappingURL=match.d.ts.map