import { firstCharacter } from 'melody';
import { hear, settle } from './lib/character.js';
import { firstWeather, weather } from './lib/weather.js';
import { forecast, isWeather } from './lib/forecast.js';
export { hear, settle, weather, firstWeather, forecast, isWeather };
/** How many departed descriptions the weather remembers. */
const memory = 12;
/** The Mood the song was born in: eternity, chamber music, A minor, 76 beats per minute. */
export const firstMood = {
    descriptions: [...firstWeather],
    character: firstCharacter,
};
/**
 * The Mood of the next Song: the oldest description lets go, and a new one
 * arrives. The mind chooses it, from the Mood and the last words sung; if it
 * cannot, the new description is drawn from the list. Then the mind listens
 * to the new Mood and decides its mode and tempo.
 */
export async function nextMood(previous, count, { words = '', random = Math.random, mind = true, letGo = 1 } = {}) {
    const staying = previous.descriptions.slice(Math.max(0, previous.descriptions.length - count + Math.max(1, letGo)));
    const leaving = previous.descriptions.filter((d) => !staying.includes(d));
    const remembered = [...(previous.remembered ?? []), ...leaving].slice(-memory);
    const descriptions = [...staying];
    while (descriptions.length < count) {
        const offered = mind
            ? await forecast({ staying: descriptions, leaving, remembered, words })
            : undefined;
        if (offered && !descriptions.includes(offered)) {
            descriptions.push(offered);
            continue;
        }
        const avoid = new Set([...descriptions, ...leaving, ...remembered]);
        const fresh = weather.filter((d) => !avoid.has(d));
        const pool = fresh.length > 0
            ? fresh
            : weather.filter((d) => !descriptions.includes(d));
        if (pool.length === 0)
            break;
        descriptions.push(pool[Math.floor(random() * pool.length)]);
    }
    const character = mind
        ? await hear(descriptions, previous.character)
        : previous.character;
    return { descriptions, character, remembered };
}
/** How a Mood reads, for anyone watching. */
export function describe({ descriptions, character }) {
    const sound = character.sound ? `, ${character.sound}` : '';
    return `${descriptions.join(' + ')} (${character.mode}, ${character.tempo} bpm${sound})`;
}
//# sourceMappingURL=index.js.map