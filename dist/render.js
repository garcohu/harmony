const tty = Boolean(process.stdout.isTTY);
function paint(text, tone) {
    if (!tty)
        return text;
    if (tone === "quiet")
        return `\x1b[38;2;138;134;126m${text}\x1b[0m`;
    if (tone === "italic")
        return `\x1b[3m${text}\x1b[0m`;
    return text;
}
export function render(blocks) {
    const out = [];
    for (const block of blocks) {
        if (block.type === "gap") {
            out.push("");
            continue;
        }
        if (block.type === "echo") {
            out.push(paint(`› ${block.text}`, "quiet"));
            continue;
        }
        if (block.type === "staff") {
            out.push(`  ${paint("app", "quiet")}    ${block.app}    ${paint("api", "quiet")}    ${block.api}    ${paint("agent", "quiet")}    ${block.agent}`);
            continue;
        }
        if (block.type === "step") {
            const mark = block.refused ? paint("refused", "quiet") : paint("played", "quiet");
            out.push(`${paint(block.index, "quiet")}  ${block.name}  ${mark}`);
            out.push(`    ${paint(block.detail, "italic")}`);
            continue;
        }
        out.push(paint(block.text, block.tone));
    }
    if (out.length)
        process.stdout.write(`${out.join("\n")}\n`);
}
export function signalMark(on) {
    if (!on)
        return "·";
    if (!tty)
        return "■";
    return "\x1b[38;2;214;255;74m■\x1b[0m";
}
//# sourceMappingURL=render.js.map