// The Archive, as a bucket: object storage in a cloud, reached over S3. The
// Studio puts Recordings and Sessions in with its keys; the Radio and every
// Receiver read them out again over plain HTTP, from the bucket's public
// address, and need no keys at all.
//
// A Session is listed in the index only after it and its Recordings are
// in, so nobody is ever sent to something that is not there yet. (Bun's S3
// client cannot set Cache-Control, so the bucket serves without it; the
// Radio and Receivers always ask afresh, and only a second visit misses the
// chance to keep a Recording, which never changes.)
import { S3Client } from 'bun';
import { mkdir, rename } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { paths, slugOf } from './session.js';
/** Where a bucket is, from its public, path-style address: https://<host>/<bucket>. */
export function bucketAt(url) {
    const { protocol, host, pathname } = new URL(url);
    const bucket = pathname.split('/').filter(Boolean)[0];
    if (!bucket)
        throw new Error(`no bucket in ${url}`);
    // Hetzner names its regions as the first part of the host: hel1, fsn1, nbg1
    const region = host.split('.')[0];
    return { endpoint: `${protocol}//${host}`, bucket, region };
}
export class BucketStore {
    client;
    constructor({ url, accessKeyId, secretAccessKey, }) {
        this.client = new S3Client({ ...bucketAt(url), accessKeyId, secretAccessKey });
    }
    /** Asks again, a little later each time, before giving up: the bucket is far away. */
    async patiently(what, work) {
        for (let attempt = 0;; attempt++) {
            try {
                return await work();
            }
            catch (error) {
                if (attempt >= 6)
                    throw error;
                console.warn(`the Archive did not answer (${what}), asking again: ${String(error).slice(0, 160)}`);
                await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
            }
        }
    }
    async put(key, body, type) {
        await this.patiently(`put ${key}`, () => this.client.write(key, body, { type, acl: 'public-read' }));
    }
    exists(key) {
        return this.patiently(`look for ${key}`, () => this.client.exists(key));
    }
    async hasSession(song) {
        return this.exists(paths.session(song));
    }
    async putRecording(file) {
        const id = basename(file);
        const key = paths.recording(id);
        if (await this.exists(key))
            return id;
        await this.put(key, Bun.file(file), 'audio/mp4');
        return id;
    }
    async index() {
        try {
            return (await this.client.file(paths.index).json());
        }
        catch {
            return { songs: [] };
        }
    }
    async session(song) {
        const key = paths.session(song);
        try {
            return (await this.client.file(key).json());
        }
        catch {
            if (!(await this.exists(key)))
                return undefined;
            // the Session is there, and the read of it failed: not a Song that is
            // not there, but a read that failed, and the Archive is asked again
            // before it may go on without an answer
            return (await this.patiently(`read the Session of Song ${song}`, () => this.client.file(key).json()));
        }
    }
    async putSession(session) {
        await this.put(paths.session(session.song), JSON.stringify(session), 'application/json');
        if (session.name)
            await this.wear(session);
        const { songs } = await this.index();
        const listed = [...new Set([...songs, session.song])].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
        await this.put(paths.index, JSON.stringify({ songs: listed }), 'application/json');
    }
    async putDiary({ writing, books }) {
        let shelved = 0;
        for (const file of books) {
            const key = paths.diaryBook(basename(file));
            if (await this.exists(key))
                continue;
            await this.put(key, Bun.file(file), 'application/x-ndjson');
            shelved++;
        }
        // a book just closed leaves nothing being written in, and so does the copy
        const open = Bun.file(writing);
        await this.put(paths.diary, (await open.exists()) ? open : '', 'application/x-ndjson');
        return shelved;
    }
    async putThoughts(file) {
        const month = basename(file, '.jsonl');
        if (!/^\d{4}-\d{2}$/.test(month))
            throw new Error(`not a month of thoughts: ${file}`);
        await this.put(paths.thoughts(month), Bun.file(file), 'application/x-ndjson');
    }
    async newestSong() {
        if (!(await this.exists(paths.index)))
            return undefined;
        const { songs } = await this.patiently('read the index', () => this.client.file(paths.index).json());
        return songs.at(-1);
    }
    async names() {
        if (!(await this.exists(paths.names)))
            return {};
        return (await this.patiently('read the names', () => this.client.file(paths.names).json()));
    }
    /**
     * Lets a Song wear its name: its slug, and itself, beside the others'. A
     * slug already worn by another Song is never taken from it, so no two
     * Songs ever wear the same link.
     */
    async wear(session) {
        const slug = slugOf(session.name);
        if (!slug)
            return;
        const names = await this.names();
        for (const [worn, song] of Object.entries(names))
            if (song === session.song && worn !== slug)
                delete names[worn];
        if (!names[slug] || names[slug] === session.song)
            names[slug] = session.song;
        await this.put(paths.names, JSON.stringify(names), 'application/json');
    }
    async kept(prefix) {
        const keys = [];
        let startAfter;
        for (;;) {
            const page = await this.patiently(`list ${prefix}`, () => this.client.list({ prefix, ...(startAfter ? { startAfter } : {}) }));
            const found = (page.contents ?? []).map(({ key }) => key);
            keys.push(...found);
            if (!page.isTruncated || !found.length)
                return keys;
            startAfter = found.at(-1);
        }
    }
    async copyOut(key, file) {
        if (!(await this.exists(key)))
            return false;
        await mkdir(dirname(file), { recursive: true });
        // copied beside it first, so a copy cut off halfway is never mistaken for the thing itself
        const coming = `${file}.${process.pid}.coming`;
        await this.patiently(`copy out ${key}`, () => Bun.write(coming, this.client.file(key)));
        await rename(coming, file);
        return true;
    }
}
//# sourceMappingURL=bucket.js.map