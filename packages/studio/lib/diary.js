// The song's memory is a diary. Every iteration it writes, it writes down:
// its number, its Mood, its words. One line per iteration, never rewritten.
//
// When the machine is switched off and on again, the song reads the last
// page and carries on from there. If the last page was only half written
// when the power went, it reads the one before.
//
// A diary that is written in for ever cannot be one book. When the book
// being written in is full, it is closed and put on a shelf, named after
// its place on the shelf and the first and last iteration inside it, and a
// new book is begun. Anyone looking for an iteration from long ago goes
// straight to the book that holds it.
import { appendFile, mkdir, open, readdir, readFile, rename, stat, writeFile, } from 'node:fs/promises';
import { dirname, join } from 'node:path';
/** How far from either end of a book the song looks for its first or last page, in bytes. */
const lookback = 256 * 1024;
/**
 * How much anyone may read at one time, in bytes: about 33,000 pages of two
 * kilobytes, a little over two months of singing. Reading starts at the book
 * that holds what was asked for, however old, so this limits only how far
 * one reading goes on from there.
 */
const remembering = 64 * 1024 * 1024;
/** When the book being written in grows this large, it is closed: about 8,000 pages, two weeks of singing. */
const fullBook = 16 * 1024 * 1024;
/** How a closed book is named on the shelf: its place, and its first and last iteration. */
export const bookName = /^(\d+)\.(\d+)-(\d+)\.jsonl$/;
function isPage(page) {
    const p = page;
    return Boolean(p?.iteration && p.mood && p.lyrics);
}
function readPage(line) {
    try {
        const page = JSON.parse(line);
        return isPage(page) ? page : undefined;
    }
    catch {
        return undefined; // torn by a power cut, or empty
    }
}
/** The first or last readable page of a book, looking no further than `lookback` from that end. */
async function endPage(file, end) {
    let handle;
    try {
        handle = await open(file, 'r');
    }
    catch {
        return undefined;
    }
    try {
        const { size } = await handle.stat();
        const length = Math.min(size, lookback);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, end === 'first' ? 0 : size - length);
        const lines = buffer.toString('utf8').split('\n');
        for (const line of end === 'first' ? lines : lines.reverse()) {
            const page = readPage(line);
            if (page)
                return page;
        }
        return undefined;
    }
    finally {
        await handle.close();
    }
}
/**
 * Reads one book backwards, page by page, handing each readable page to
 * `visit` until it says to stop or the budget of bytes is spent. Returns
 * what is left of the budget, or 0 if `visit` asked to stop.
 */
async function readBackwards(file, budget, chunk, visit) {
    let handle;
    try {
        handle = await open(file, 'r');
    }
    catch {
        return budget;
    }
    try {
        const { size } = await handle.stat();
        let end = size;
        let carried = '';
        while (end > 0 && budget > 0) {
            const start = Math.max(0, end - chunk);
            const buffer = Buffer.alloc(end - start);
            await handle.read(buffer, 0, buffer.length, start);
            budget -= buffer.length;
            const lines = (buffer.toString('utf8') + carried).split('\n');
            // the first line may begin in the chunk before; carry it back
            carried = start > 0 ? (lines.shift() ?? '') : '';
            for (const line of lines.reverse()) {
                const page = readPage(line);
                if (page && visit(page))
                    return 0;
            }
            end = start;
        }
        return budget;
    }
    finally {
        await handle.close();
    }
}
export class Diary {
    file;
    bookSize;
    /** Where the closed books are kept. */
    shelf;
    constructor(file, bookSize = fullBook) {
        this.file = file;
        this.bookSize = bookSize;
        this.shelf = join(dirname(file), 'books');
    }
    async write(page) {
        await mkdir(dirname(this.file), { recursive: true });
        await appendFile(this.file, JSON.stringify(page) + '\n');
        if ((await stat(this.file)).size >= this.bookSize)
            await this.closeBook();
    }
    /**
     * Takes back the last pages of the book being written, as long as they
     * belong to the Song `song`: a Song that was written down but never
     * reached the Archive is unwritten, to be made again. Returns how many
     * pages were taken back.
     */
    async unwrite(song) {
        let text;
        try {
            text = await readFile(this.file, 'utf8');
        }
        catch {
            return 0;
        }
        const lines = text.split('\n').filter(Boolean);
        let taken = 0;
        while (lines.length) {
            const page = JSON.parse(lines.at(-1));
            if (page.song?.number !== song)
                break;
            lines.pop();
            taken++;
        }
        if (taken === 0)
            return 0;
        const rewritten = `${this.file}.${process.pid}.rewritten`;
        await writeFile(rewritten, lines.map((line) => `${line}\n`).join(''));
        await rename(rewritten, this.file);
        return taken;
    }
    /** The closed books, in the order they were written. */
    async books() {
        const names = await readdir(this.shelf).catch(() => []);
        return names
            .map((name) => bookName.exec(name))
            .filter((match) => match !== null)
            .map((match) => ({
            file: join(this.shelf, match[0]),
            place: Number(match[1]),
            first: BigInt(match[2]),
            last: BigInt(match[3]),
        }))
            .sort((a, b) => a.place - b.place);
    }
    /** Closes the book being written in, and puts it on the shelf. The next page begins a new one. */
    async closeBook() {
        const first = await endPage(this.file, 'first');
        const last = await endPage(this.file, 'last');
        if (!first || !last)
            return;
        const place = ((await this.books()).at(-1)?.place ?? 0) + 1;
        await mkdir(this.shelf, { recursive: true });
        const name = `${String(place).padStart(9, '0')}.${first.iteration}-${last.iteration}.jsonl`;
        await rename(this.file, join(this.shelf, name));
    }
    /**
     * Reads backwards, the most recent iterations first, each only once, as
     * it was last written. Torn pages are passed over. When an iteration is
     * asked for, reading begins at the book that holds it, however old.
     */
    async recent({ count, before, chunk = 64 * 1024, }) {
        const pages = [];
        const seen = new Set();
        const visit = (page) => {
            if (seen.has(page.iteration))
                return false;
            seen.add(page.iteration);
            if (before !== undefined && BigInt(page.iteration) >= before)
                return false;
            pages.push(page);
            return pages.length === count;
        };
        // a book that begins at or after the iteration asked for holds nothing before it
        const holdsEarlier = (first, last) => before === undefined ||
            first === undefined ||
            (last !== undefined && last < first) || // the count started over in this book
            first < before;
        const current = await endPage(this.file, 'first');
        const sources = [
            ...(holdsEarlier(current ? BigInt(current.iteration) : undefined)
                ? [this.file]
                : []),
            ...(await this.books())
                .reverse()
                .filter((book) => holdsEarlier(book.first, book.last))
                .map((book) => book.file),
        ];
        let budget = remembering;
        for (const source of sources) {
            if (pages.length >= count || budget <= 0)
                break;
            budget = await readBackwards(source, budget, chunk, visit);
        }
        return pages;
    }
    /** The last page that can still be read, or nothing if the diary was never begun. */
    async lastPage() {
        const page = await endPage(this.file, 'last');
        if (page)
            return page;
        // the book being written in was just closed; the last page is in the last book
        for (const book of (await this.books()).reverse()) {
            const last = await endPage(book.file, 'last');
            if (last)
                return last;
        }
        return undefined;
    }
}
//# sourceMappingURL=diary.js.map