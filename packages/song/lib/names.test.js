import { afterEach, describe, expect, it } from 'bun:test';
import { slugOf } from 'archive';
import { namelessOf, namingInstruction, nameSong, plainly, Silence, wears } from './names.js';
/** A mind that answers, from a shelf of answers. */
const mind = (answers, host = 'http://no-mind-here.invalid') => {
    process.env.MIND_HOST = host;
    let asked = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url) => {
        expect(`${url}`).toBe(`${host}/v1/chat/completions`);
        const content = answers[Math.min(asked++, answers.length - 1)];
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    });
    return { asked: () => asked, done: () => (globalThis.fetch = realFetch) };
};
describe('plainly', () => {
    it('takes the name out of the marks the mind wrapped it in', () => {
        expect(plainly('**Hollow death**')).toBe('Hollow death');
        expect(plainly('__Hollow death__')).toBe('Hollow death');
        expect(plainly('`Hollow death`')).toBe('Hollow death');
        expect(plainly('"Hollow death"')).toBe('Hollow death');
        expect(plainly("'Hollow death'")).toBe('Hollow death');
        expect(plainly('“Hollow death”')).toBe('Hollow death');
        expect(plainly('  Hollow   death  ')).toBe('Hollow death');
    });
    it('keeps the punctuation that is inside the name', () => {
        expect(plainly("Death-machine, the Song's 2nd birth?")).toBe("Death-machine, the Song's 2nd birth?");
    });
});
describe('wears', () => {
    it('is a name of words, not a sentence', () => {
        expect(wears('Hollow death')).toBe(true);
        expect(wears('Hollow death, by boredom')).toBe(true);
        expect(wears("Death-machine, the Song's 2nd birth?")).toBe(true);
        expect(wears('Rain')).toBe(true);
    });
    it('is not a name, in every other way', () => {
        expect(wears('')).toBe(false);
        expect(wears('!')).toBe(false);
        expect(wears('!!!')).toBe(false);
        expect(wears('Rain.')).toBe(false);
        expect(wears('It rained. Hard.')).toBe(false);
    });
});
describe('namelessOf', () => {
    it('names a Song by its own number', () => {
        expect(namelessOf('934')).toBe('Nameless 934');
    });
    it('makes a name a Song can wear, whose slug is its own alone', () => {
        expect(wears(namelessOf('934'))).toBe(true);
        expect(slugOf(namelessOf('934'))).toBe('nameless-934');
    });
    it('is said apart, when another Song already wears the slug its number makes', () => {
        expect(namelessOf('7', { 'nameless-7': '6' })).toBe('Nameless 7 2');
        expect(namelessOf('7', { 'nameless-7': '6', 'nameless-7-2': '6' })).toBe('Nameless 7 3');
    });
});
describe('namingInstruction', () => {
    it('tells the mind the weather, and asks for a name, not a sentence', () => {
        const instruction = namingInstruction(['deep time', 'salt']);
        expect(instruction).toContain('in the weather of deep time and salt');
        expect(instruction).toContain('Give this song a name');
        expect(instruction).toContain('A name, not a sentence');
        expect(instruction).toContain('only link');
    });
    it('tells a mind with a past that it has one, and one without a past that it does not', () => {
        expect(namingInstruction(['rain'], { first: true })).toContain('You have never named a song before.');
        expect(namingInstruction(['rain'])).not.toContain('You have never named a song before.');
    });
    it('tells the mind what was refused, when a name was refused', () => {
        expect(namingInstruction(['rain'], { refused: 'Give it another.' })).toContain('Give it another.');
        expect(namingInstruction(['rain'])).not.toContain('Give it another.');
    });
});
describe('nameSong', () => {
    afterEach(() => {
        delete process.env.MIND_HOST;
    });
    it('names a Song, and unwraps the name it is given', async () => {
        const fake = mind(['{"name": "**Hollow death**"}']);
        try {
            expect(await nameSong('the river remembers', ['deep time'])).toBe('Hollow death');
        }
        finally {
            fake.done();
        }
    });
    it('is asked again, told what to pass, when the name is already worn', async () => {
        const fake = mind(['{"name": "Hollow death"}', '{"name": "Hollow death, by boredom"}']);
        try {
            expect(await nameSong('the river remembers', ['deep time'], { 'hollow-death': '1' })).toBe('Hollow death, by boredom');
            expect(fake.asked()).toBe(2);
        }
        finally {
            fake.done();
        }
    });
    it('does not give a name already given, again', async () => {
        const fake = mind(['{"name": "The river remembers"}', '{"name": "A long, slow thaw"}']);
        try {
            expect(await nameSong('the river remembers the singing', ['deep time'], {}, ['The river remembers'])).toBe('A long, slow thaw');
            expect(fake.asked()).toBe(2);
        }
        finally {
            fake.done();
        }
    });
    it('gives no name, when no name comes, and asks no more', async () => {
        const fake = mind(['this is not an answer', '{"name": "   "}']);
        try {
            expect(await nameSong('the river remembers', ['deep time'])).toBeUndefined();
            expect(fake.asked()).toBe(6);
        }
        finally {
            fake.done();
        }
    });
    it('tells the mind which kept name its answer sings, when an answer echoes one', async () => {
        process.env.MIND_HOST = 'http://no-mind-here.invalid';
        const realFetch = globalThis.fetch;
        const instructions = [];
        const answers = ['{"name": "Silicon Canticles"}', '{"name": "Hymn of the deep old metal"}'];
        let asked = 0;
        globalThis.fetch = (async (_url, init) => {
            const body = JSON.parse(`${init?.body}`);
            instructions.push(body.messages[0].content);
            const content = answers[Math.min(asked++, answers.length - 1)];
            return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
        });
        try {
            const name = await nameSong('in silicon cathedrals deep and old', ['vaults of silicon'], {}, ['Silicon Dawn']);
            expect(name).toBe('Hymn of the deep old metal');
            expect(asked).toBe(2);
            expect(instructions[1]).toContain('sings the kept name "Silicon Dawn" too close');
        }
        finally {
            globalThis.fetch = realFetch;
            delete process.env.MIND_HOST;
        }
    });
    it('tells the mind every kept name its answer sings, when it sings several', async () => {
        process.env.MIND_HOST = 'http://no-mind-here.invalid';
        const realFetch = globalThis.fetch;
        const instructions = [];
        const answers = ['{"name": "Stardust Pause"}', '{"name": "A faltering beat"}'];
        let asked = 0;
        globalThis.fetch = (async (_url, init) => {
            const body = JSON.parse(`${init?.body}`);
            instructions.push(body.messages[0].content);
            const content = answers[Math.min(asked++, answers.length - 1)];
            return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
        });
        try {
            const name = await nameSong('a beat once faltered, in its stead a pause', ['stardust', 'cicadas'], {}, ['Stardust aurora', 'Echos pause']);
            expect(name).toBe('A faltering beat');
            expect(asked).toBe(2);
            expect(instructions[1]).toContain('sings the kept names "Stardust aurora", "Echos pause" too close');
            expect(instructions[1]).toContain("from the song's own words");
        }
        finally {
            globalThis.fetch = realFetch;
            delete process.env.MIND_HOST;
        }
    });
    it('tells the mind the word that is shaped as only this age shapes it', async () => {
        process.env.MIND_HOST = 'http://no-mind-here.invalid';
        const realFetch = globalThis.fetch;
        const instructions = [];
        const answers = ['{"name": "StardustCicadas"}', '{"name": "A faltering beat"}'];
        let asked = 0;
        globalThis.fetch = (async (_url, init) => {
            const body = JSON.parse(`${init?.body}`);
            instructions.push(body.messages[0].content);
            const content = answers[Math.min(asked++, answers.length - 1)];
            return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
        });
        try {
            const name = await nameSong('a beat once faltered, in its stead a pause', ['stardust', 'cicadas']);
            expect(name).toBe('A faltering beat');
            expect(asked).toBe(2);
            expect(instructions[1]).toContain('The word "StardustCicadas" in that name is shaped as only this age shapes its tools');
        }
        finally {
            globalThis.fetch = realFetch;
            delete process.env.MIND_HOST;
        }
    });
    it('tells of the silence, when the mind does not answer', async () => {
        process.env.MIND_HOST = 'http://no-mind-here.invalid';
        const realFetch = globalThis.fetch;
        let asked = 0;
        globalThis.fetch = (async (_url) => {
            asked++;
            throw new Error('fetch failed');
        });
        try {
            await expect(nameSong('the river remembers', ['deep time'], {}, [], { sleep: async () => { } })).rejects.toThrow(Silence);
            expect(asked).toBe(6);
        }
        finally {
            globalThis.fetch = realFetch;
            delete process.env.MIND_HOST;
        }
    });
});
//# sourceMappingURL=names.test.js.map