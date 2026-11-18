import { describe, expect, it } from 'bun:test';
import golden from './fixtures/writer.json' with { type: 'json' };
import { writeOverGuide } from './writer.js';
import { degreeToMidi, modes } from './scale.js';
import { wrongness } from './wrongness.js';
const guides = new Map(golden.flatMap((g) => (g.guideOf ? [[g.guideOf, g.guide]] : [])));
const lines = golden.filter((g) => Array.isArray(g.degrees));
const write = ({ mode, seed, i, sprinkle, from, previous, closes, line }, more = {}) => {
    const key = { tonic: 57, mode: modes[mode] };
    return writeOverGuide({
        syllables: line,
        guide: guides.get(`${mode}:${seed}`),
        low: -5,
        high: 9,
        random: wrongness(`gw:${mode}:${seed}:${i}:${sprinkle}`),
        semitones: (a, b) => Math.abs(degreeToMidi(a, key) - degreeToMidi(b, key)),
        from: from ?? undefined,
        closes,
        previous: previous ?? undefined,
        sprinkle,
        ...more,
    });
};
describe('the melody Facet in the writer', () => {
    it('writes exactly what it always wrote with its defaults, and with them given', () => {
        expect(lines).toHaveLength(144);
        for (const line of lines) {
            expect(write(line)).toEqual(line.degrees);
            expect(write(line, { ceiling: 2, span: 0, travel: 0 })).toEqual(line.degrees);
        }
    });
    // a third of the lines are enough to tell which way a setting leans
    const some = lines.filter((_, k) => k % 3 === 0);
    const peaks = (more) => some.map((line) => Math.max(...write(line, more)));
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    it('stays lower under a lower ceiling, and climbs to the top under none', () => {
        const usual = mean(peaks({}));
        const low = mean(peaks({ ceiling: 5 }));
        const top = mean(peaks({ ceiling: 0 }));
        expect(low).toBeLessThan(usual - 1);
        // the ceiling pulls up as well as it holds down: a step or more either way
        expect(top).toBeGreaterThan(usual + 1);
        expect(Math.max(...peaks({ ceiling: 5 }))).toBeLessThanOrEqual(9 - 5 + 3);
    });
    it('moves less with travel, and keeps narrower with span', () => {
        const moved = (more) => mean(some.map((line) => write(line, more).reduce((sum, d, i, all) => sum + (i ? Math.abs(d - all[i - 1]) : 0), 0)));
        expect(moved({ travel: 0.6 })).toBeLessThan(moved({}) * 0.85);
        const wide = (more) => mean(some.filter((l) => l.sprinkle > 0).map((line) => {
            const written = write(line, more);
            return Math.max(...written) - Math.min(...written);
        }));
        expect(wide({ span: 1.5 })).toBeLessThan(wide({}) * 0.85);
    });
});
//# sourceMappingURL=writermelody.test.js.map