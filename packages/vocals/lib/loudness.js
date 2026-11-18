// How loud a Recording sounds. Not how high its waveform reaches, which
// says little about how loud it is heard, but its perceived loudness, as
// the broadcasters measure it (EBU R128): its integrated loudness in LUFS,
// and its true peak in dBTP. It is measured from the Recording itself,
// after it is made, so that what a Receiver is told is what it will hear.
import { run, Turns } from './exec.js';
/** The quietest loudness there is: what silence is said to have. */
export const silence = -70;
/** Reads ffmpeg's loudnorm analysis, the last JSON it printed. */
export function parseLoudness(said) {
    const found = [...said.matchAll(/\{[^{}]*"input_i"[^{}]*\}/g)].at(-1);
    if (!found)
        return undefined;
    try {
        const { input_i, input_tp } = JSON.parse(found[0]);
        const level = (value) => {
            const n = Number.parseFloat(value);
            return Number.isFinite(n) ? Math.max(silence, Math.round(n * 100) / 100) : silence;
        };
        return { lufs: level(input_i), peak: level(input_tp) };
    }
    catch {
        return undefined;
    }
}
/** A few measurements at a time; each is quick, and the machine has other work. */
const listening = new Turns(4);
/** Measures how loud a Recording sounds. Undefined if it cannot be measured. */
export async function loudnessOf(file) {
    try {
        const said = await listening.take(() => run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { gentle: true, heard: 'complaint' }));
        return parseLoudness(said);
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=loudness.js.map