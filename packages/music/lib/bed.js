// The bed: music grown under a part of the song, by a model that hears the
// voice only as the shape of its pitches, and the Mood only as words.
//
// The model is woken for each bed and let go after it. The machine has one
// GPU, and the mind that writes the words needs most of it, so the two take
// turns: the words of an iteration are written first, and its beds after.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setPriority } from 'node:os';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { makeOnce, run, Turns } from 'vocals';
/** Where beds are kept, relative to the process, beside the voices. */
export const musicDir = 'audio/music';
/**
 * The longest bed grown, in seconds. The model hears only half a minute at a
 * time, so a longer bed is grown in overlapping windows; no section of the
 * song is ever this long.
 */
export const longest = 90;
/**
 * How much longer than its section a bed is grown, in seconds: a tail that
 * fades out while the next section's bed has already begun, so that music
 * that goes on is never cut off. Music that means to stop simply has a
 * silent tail.
 */
export const tail = 3;
/** The model that makes the beds. Changing it changes every bed, so it is part of each bed's name. */
const model = 'facebook/musicgen-melody';
const home = fileURLToPath(new URL('../', import.meta.url));
/** Modes that sound bright, to a listener who knows only major and minor. */
const bright = new Set(['ionian', 'lydian', 'mixolydian']);
/**
 * The Mood in words a music model understands: the band the mind heard in
 * it, the pulse, and whether it is bright or dark. The mode itself is too fine a word for it;
 * the voice carries the mode, and the bed follows the voice.
 */
export function words({ descriptions, character }) {
    const key = bright.has(character.mode) ? 'major key' : 'minor key';
    // the band the mind heard in the Mood, or, if it heard none, the Mood itself
    const sound = character.sound ? [character.sound] : descriptions;
    return [...sound, `${character.tempo} bpm`, key].join(', ');
}
/** One GPU: one bed at a time. */
const gpu = new Turns(1);
let band;
/** Wakes the band for a while. Resolves once it is awake; a band that will not wake leaves each bed to wake its own. */
export async function wakeBand() {
    if (band && !band.gone)
        return;
    const child = spawn('uv', ['run', '--project', home, `${home}accompany.py`, '--serve']);
    // the Music works beneath everything else on the machine, as each bed always has
    if (child.pid !== undefined)
        setPriority(child.pid, 10);
    const awake = { child, gone: false };
    let complaint = '';
    child.stderr.on('data', (data) => (complaint = (complaint + data).slice(-4000)));
    await new Promise((resolve, reject) => {
        const lines = createInterface({ input: child.stdout });
        lines.on('line', (line) => {
            if (!line.startsWith('{'))
                return;
            const said = JSON.parse(line);
            if (said.awake !== undefined)
                return resolve();
            const asked = awake.asked;
            awake.asked = undefined;
            if (said.error)
                asked?.reject(new Error(said.error));
            else
                asked?.resolve();
        });
        child.on('exit', (code) => {
            awake.gone = true;
            const error = new Error(`the band fell silent (${code}): ${complaint.trim().split('\n').at(-1) ?? ''}`);
            awake.asked?.reject(error);
            awake.asked = undefined;
            reject(error);
        });
        child.on('error', reject);
    });
    band = awake;
}
/** Lets the band go, and the GPU with it. */
export async function restBand() {
    const resting = band;
    band = undefined;
    if (!resting || resting.gone)
        return;
    const ended = new Promise((resolve) => resting.child.once('exit', resolve));
    resting.child.stdin.end();
    await Promise.race([ended, new Promise((resolve) => setTimeout(resolve, 10_000))]);
    if (!resting.gone)
        resting.child.kill();
}
/** One bed from the awake band. */
function fromBand(awake, job) {
    return new Promise((resolve, reject) => {
        awake.asked = { resolve, reject };
        awake.child.stdin.write(`${JSON.stringify(job)}\n`);
    });
}
/** One bed, from the band if it is awake, or from a model woken for it alone. */
function grow(job) {
    if (band && !band.gone)
        return fromBand(band, job);
    return run('uv', [
        'run',
        '--project',
        home,
        `${home}accompany.py`,
        '--vocals',
        job.vocals,
        '--mood',
        job.mood,
        '--seconds',
        `${job.seconds}`,
        '--out',
        job.out,
        ...(job.melody ? [] : ['--no-melody']),
    ], { gentle: true }).then(() => undefined);
}
/**
 * Grows a bed under a recorded voice. The same voice in the same words is
 * the same bed, so a part that returns is accompanied as it was before, and
 * the song remembers its own music.
 */
export async function accompany({ vocals, mood, seconds, melody = true, }) {
    seconds = Math.min(longest, Math.round(seconds * 10) / 10);
    const name = createHash('sha256')
        .update(JSON.stringify({ model, vocals, mood, seconds, ...(melody ? {} : { melody }) }))
        .digest('hex');
    // the same bed asked for twice at once is grown once, and nobody hears it half grown
    return makeOnce(`${musicDir}/${name}.m4a`, (partial) => gpu.take(() => grow({ vocals, mood, seconds, out: partial, melody })));
}
//# sourceMappingURL=bed.js.map