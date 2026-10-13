import fs from "node:fs";
import path from "node:path";
import { HarmonyError } from "./errors.js";
const ALLOWED = new Set(["name", "scheme", "platforms"]);
export function readConfig(cwd) {
    const fallback = {
        name: path.basename(cwd) || "app",
        scheme: "harmony",
        platforms: ["ios", "android", "web"],
    };
    const file = path.join(cwd, "harmony.json");
    if (!fs.existsSync(file))
        return fallback;
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    catch {
        throw new HarmonyError("INVALID_PROJECT", "harmony.json is not JSON.");
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new HarmonyError("INVALID_PROJECT", "harmony.json must be an object.");
    }
    const record = raw;
    const extra = Object.keys(record).filter((key) => !ALLOWED.has(key));
    if (extra.length)
        throw new HarmonyError("INVALID_PROJECT", `harmony.json has unknown ${extra.join(", ")}.`);
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : fallback.name;
    const scheme = typeof record.scheme === "string" && record.scheme.trim() ? record.scheme.trim() : fallback.scheme;
    let platforms = fallback.platforms;
    if (record.platforms !== undefined) {
        if (!Array.isArray(record.platforms) || record.platforms.some((item) => typeof item !== "string" || !item.trim())) {
            throw new HarmonyError("INVALID_PROJECT", "platforms must be a list of names.");
        }
        platforms = record.platforms.map((item) => item.trim());
    }
    return { name, scheme, platforms };
}
//# sourceMappingURL=config.js.map