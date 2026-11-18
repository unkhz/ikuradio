// Sections: an iteration heard as the parts it is built of. A verse of four
// lines is one section, and so is a chorus. A section begins where its first
// line begins and lasts until the next section begins, rest included.
/** The sections of an iteration, in the order they are sung. */
export function sections(lines) {
    const found = [];
    for (const line of lines) {
        const current = found.at(-1);
        if (current && current.part === line.part && line.index > 0) {
            current.lines.push(line);
        }
        else {
            found.push({
                part: line.part,
                kind: line.part === 'bridge' ? 'bridge:verse>chorus' : line.part,
                at: line.at,
                seconds: 0,
                lines: [line],
            });
        }
    }
    for (const [i, section] of found.entries()) {
        const last = section.lines.at(-1);
        section.seconds = last.at + last.seconds - section.at;
        if (section.part === 'bridge') {
            const from = found[i - 1]?.part === 'chorus' ? 'chorus' : 'verse';
            const to = found[i + 1]?.part === 'chorus' ? 'chorus' : 'verse';
            section.from = from;
            section.to = to;
            section.kind = `bridge:${from}>${to}`;
        }
    }
    return found;
}
//# sourceMappingURL=sections.js.map