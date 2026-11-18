// The Singers are throats: a body (male, female or child), and the part each
// one sings. A Song gathers a small choir. The first voice leads and sings
// every line. The others only join in the chorus, the way a congregation
// knows the refrain but not the verses.
const bodies = ['female', 'male', 'child'];
/** The voices that may join the lead, from the closest harmony to the widest. */
const parts = [
    { harmony: -2, gain: 0.55 },
    { harmony: -4, gain: 0.45 },
    { harmony: -7, gain: 0.4 },
];
/** The choir the song was first sung with: the voice it had alone, now with two others behind it. */
export const firstChoir = [
    { body: 'female', harmony: 0, gain: 1 },
    { body: 'child', harmony: -2, gain: 0.55 },
    { body: 'male', harmony: -4, gain: 0.45 },
];
/**
 * A throat for a singer: somewhere between soft and breathy, and pressed and
 * clear, never far from how Chimera sings by default. The softer a throat
 * breathes, the more air escapes it.
 */
export function throatOf(random, breath) {
    // the Mood's breath, if it has one, give or take a little; otherwise anywhere
    const press = breath
        ? Math.min(1, Math.max(0, centres[breath] + (random() - 0.5) * 0.3))
        : random();
    const round = (n) => Math.round(n * 100) / 100;
    return {
        pressure: round(7.5 + 3 * press),
        tension: round(0.45 + 0.2 * (press * 0.6 + random() * 0.4)),
        breathiness: round(0.25 - 0.17 * press),
    };
}
/** Where each breath sits between soft (0) and pressed (1). */
const centres = { soft: 0.15, plain: 0.5, pressed: 0.85 };
/**
 * Gathers a choir of `size` voices for a new Song. `random` returns a number
 * in [0, 1). If the Mood named a lead and a breath, the lead is that voice
 * and the whole choir breathes that way; the others are gathered by chance.
 */
export function gather(size, random = Math.random, guide, 
/** Which of the voices beside the lead, in order, sing above it: never a man's voice, which cannot reach that high. */
{ high = [] } = {}) {
    const pick = () => bodies[Math.floor(random() * bodies.length)];
    const choir = [
        {
            body: guide?.lead ?? pick(),
            harmony: 0,
            gain: 1,
            throat: throatOf(random, guide?.breath),
        },
        ...parts.slice(0, Math.max(0, size - 1)).map((part) => ({
            body: pick(),
            ...part,
            throat: throatOf(random, guide?.breath),
        })),
    ];
    // a voice that sings above the lead is a woman's or a child's
    for (const [k, above] of high.entries()) {
        const voice = choir[k + 1];
        if (above && voice?.body === 'male')
            voice.body = random() < 0.5 ? 'female' : 'child';
    }
    return choir;
}
/** How a choir reads, for anyone watching. */
export function introduce(choir) {
    const [lead, ...rest] = choir;
    return rest.length === 0
        ? `${lead.body} alone`
        : `${lead.body}, with ${rest.map((v) => v.body).join(' and ')}`;
}
//# sourceMappingURL=singers.js.map