import { ask, Unshapely } from 'tools';
/** Four lines, no more, no fewer. The mind is told so in a schema, not only in words. */
const verseSchema = {
    type: 'object',
    properties: {
        lines: {
            type: 'array',
            items: { type: 'string' },
            minItems: 4,
            maxItems: 4,
        },
    },
    required: ['lines'],
};
/** Asks the mind for a verse. Throws Unshapely if it answers in a shape that is not a verse. */
export async function askVerse(instruction, verse, temperature) {
    const answer = await ask({
        instruction,
        input: verse,
        schema: verseSchema,
        temperature,
    });
    const lines = answer?.lines;
    if (!Array.isArray(lines) ||
        !lines.every((line) => typeof line === 'string')) {
        throw new Unshapely(JSON.stringify(answer));
    }
    return lines.map((line) => line.trim());
}
//# sourceMappingURL=mind.js.map