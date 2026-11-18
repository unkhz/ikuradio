// Choosing a Song's Perspectives. When a Song begins, a few are drawn from
// the active ones, by weight, never two on the same Facet, from the
// wrongness of the Song's number: the same Song always gets the same ones.
// Then each Turns its Facet, and what comes out (the Settings) is what the
// Studio's hooks follow for the whole Song.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrongness } from 'melody';
import { defaults, facets, parts } from './facets.js';
/** Where the Perspectives live: a folder each, beside this package's own code. */
export const perspectivesHome = fileURLToPath(new URL('../', import.meta.url));
/** Reads a record's stored fields from its frontmatter, and its title from its heading. */
export function parseRecord(text, dir) {
    const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
    if (!match)
        throw new Error(`${dir}: a Perspective record begins with frontmatter`);
    const fields = Object.fromEntries(match[1].split('\n').flatMap((line) => {
        const at = line.indexOf(':');
        return at > 0 ? [[line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"(.*)"$/, '$1')]] : [];
    }));
    const title = /^# (.+)$/m.exec(text.slice(match[0].length))?.[1].trim() ?? fields.slug;
    const facet = fields.facet;
    if (!facets.includes(facet))
        throw new Error(`${dir}: no such Facet: ${fields.facet}`);
    const weight = Number(fields.weight);
    if (!Number.isInteger(weight) || weight < 1 || weight > 10)
        throw new Error(`${dir}: weight is 1 to 10`);
    const part = fields.part;
    if (part !== undefined && !parts.includes(part))
        throw new Error(`${dir}: no such part: ${fields.part}`);
    return { slug: fields.slug, title, facet, weight, state: fields.state, ...(part ? { part } : {}), dir };
}
/** Whether two Perspectives would turn the same thing: one Facet, and not two different parts of it. */
export const clash = (a, b) => a.facet === b.facet && (!a.part || !b.part || a.part === b.part);
/** Every Perspective there is, in the order of their names. */
export function readPerspectives(home = perspectivesHome) {
    return readdirSync(home, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join(home, entry.name, 'perspective.md')))
        .map((entry) => parseRecord(readFileSync(join(home, entry.name, 'perspective.md'), 'utf8'), join(home, entry.name)))
        .sort((a, b) => a.slug.localeCompare(b.slug));
}
/**
 * Draws `count` active Perspectives for a Song, by weight and without
 * putting two on one Facet. Fewer are drawn if fewer Facets are left.
 */
/**
 * How often a Song is heard from no Perspective, from one, or from two: it
 * is mostly heard plainly, as itself. A way of hearing that comes every
 * time is no longer a different way, only the usual one.
 */
export const perspectiveOdds = [0.6, 0.35, 0.05];
/**
 * How many Perspectives a Song is heard from, by `perspectiveOdds`, from a
 * wrongness of its own, so that which ones are drawn is not disturbed by it.
 */
export function howMany(song) {
    let left = wrongness(`perspectives:count:${song}`)();
    for (const [count, odds] of perspectiveOdds.entries())
        if ((left -= odds) < 0)
            return count;
    return perspectiveOdds.length - 1;
}
export function draw(records, song, count) {
    const random = wrongness(`perspectives:${song}`);
    const drawn = [];
    for (let k = 0; k < count; k++) {
        const open = records.filter((r) => r.state === 'active' && !drawn.some((d) => clash(d, r)));
        if (open.length === 0)
            break;
        let left = random() * open.reduce((sum, r) => sum + r.weight, 0);
        const chosen = open.find((r) => (left -= r.weight) < 0) ?? open.at(-1);
        drawn.push(chosen);
    }
    return drawn;
}
async function actionsOf(record) {
    const actions = (await import(join(record.dir, 'actions.ts'))).default;
    if (actions?.facet !== record.facet) {
        throw new Error(`${record.slug}: its actions turn ${actions?.facet}, its record says ${record.facet}`);
    }
    return actions;
}
function promptsOf(record) {
    const file = join(record.dir, 'prompts.json');
    if (!existsSync(file))
        return [];
    const prompts = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(prompts) || !prompts.every((p) => typeof p === 'string')) {
        throw new Error(`${record.slug}: prompts.json is a list of words for a model`);
    }
    return prompts;
}
/** Lets each drawn Perspective turn its Facet, from the defaults, or from `base` (where the Tides have moved them). */
export async function resolve(drawn, song, choirSize, base) {
    const settings = base ? structuredClone(base) : defaults(choirSize);
    const perspectives = [];
    for (const record of drawn) {
        const { facet, turn } = await actionsOf(record);
        const turned = turn(settings[facet], {
            random: wrongness(`perspective:${record.slug}:${song}`),
            prompts: promptsOf(record),
        });
        settings[facet] = turned.setting;
        perspectives.push({
            slug: record.slug,
            title: record.title,
            facet,
            ...(turned.variant ? { variant: turned.variant } : {}),
        });
    }
    return { perspectives, settings };
}
/**
 * A Song's Perspectives and the Settings they make, from its number. `only`
 * names the Perspectives to hear it from instead of drawing them, drafts
 * too: how a rehearsal hears a Perspective before it is made active.
 */
export async function perspectivesFor(song, { count = howMany(song), choirSize, only, home = perspectivesHome, base, }) {
    const records = readPerspectives(home);
    if (!only)
        return resolve(draw(records, song, count), song, choirSize, base);
    const named = only.map((slug) => {
        const record = records.find((r) => r.slug === slug);
        if (!record)
            throw new Error(`there is no Perspective ${slug}`);
        return record;
    });
    if (named.some((r, i) => named.slice(0, i).some((d) => clash(d, r)))) {
        throw new Error('a Song is heard from only one Perspective on each Facet, or each part of one');
    }
    return resolve(named, song, choirSize, base);
}
/** How a Song's Perspectives read, for anyone watching, after the word "heard". */
export function describePerspectives(perspectives) {
    return perspectives.length === 0
        ? 'plainly'
        : perspectives.map(({ title, variant }) => (variant ? `${title}: ${variant}` : title)).join(', ');
}
//# sourceMappingURL=choose.js.map