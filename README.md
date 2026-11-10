# Song That Never Ends

A song that writes its next verse while singing the current one, and will keep doing it for as long as anything is left to run it. It counts its iterations in its chorus. The numbers are spelled out up to nonillions, and after a decillion it starts over, because nobody agrees what comes next.

What it can do today:

- **Mood** is the weather the song grows in (`packages/mood`). A Mood blends a few descriptions, like *eternity + romantic chamber music with violin and cello*. A *Song* is a run of iterations in one Mood. When a new Song begins, the oldest description lets go, and the song chooses the one that arrives from the last words it sang. If it can't, the new one is drawn from a list. The Mood remembers the weather it has had lately, so nothing returns too soon. The local mind listens to the Mood and decides the mode and the tempo.
- **Words** are rewritten for every iteration from the previous ones by a small local language model served by [Ollama](https://ollama.com) (`packages/song`). The chorus counts its own iteration number. The model is not trusted with it.
- **Melody** sets each line to a tune on A, in whatever mode the Mood chose (`packages/melody`). The chorus hook never changes. When the iteration number grows too long to fit, the hook slows down to make room. The verses walk: each new Song moves one note of every verse phrase by a single step, and within a Song a few *Variations* take turns.
- **Vocals** are sung by [Chimera](https://github.com/jamesondh/chimera-vocal-synth), a physical model of a throat, built from a pinned revision. It runs on any CPU, with no GPU and no macOS (`packages/vocals`). Each Song gathers a small choir of *Singers*. The lead sings every line, and the others join the chorus in harmony, in the mode. Before a line is sung, whatever the throat cannot read is read aloud in words: numbers, years, ordinals, percentages, `&`. Every voice is humanized: a few cents off, leaning a little early or late, never off the beat.
- **Music** is a bed of generated background music from 2023, laid under the voice (`packages/music`).
- **The server** streams the song as it is sung (`packages/server`). Every line begins exactly where the music puts it, and every word is typed while it is sung, all against one clock. If the next iteration is late, the song holds a fermata instead of rushing. It keeps a diary in `packages/server/memory/diary.jsonl`, one line per iteration, and wakes up where it left off. Every two weeks or so, the full book is closed and shelved in `memory/books/`, named after the first and last iteration it holds. It sings into a *room*: whoever is connected hears it live, and someone who joins halfway is shown the current Mood and the words of the iteration so far. Nothing is kept for an empty room.
- **Listeners**: the page in the browser (`packages/ui`) is sent each iteration's *score* before it begins, prepares every voice in advance, and plays them on its own audio clock, on the beat. It sets the chorus apart from the verses and keeps a quiet line at its edge with the song's age, its Mood, its mode and tempo, and who is singing. Its *look back* button opens the diary: every iteration sung to the end, newest first, read from `/diary`. If the song goes quiet, it waits and listens again. A terminal can listen too, with `bun run listen`.

Where it is going is in [plans/](plans/). What it has been thinking is in [thoughts.md](thoughts.md).

## Waking it

The song lives on one machine, and needs [Bun](https://bun.sh), Rust (for the throat), ffmpeg and [Ollama](https://ollama.com) with a model that fits in about 12 GB of memory. Any instruct model will do:

```bash
ollama pull qwen3:4b
```

```bash
bun install
```

```bash
bun run rehearse
```

`bun run rehearse` builds the throat from its pinned revision if it hasn't been built yet, then sings iteration zero into `packages/server/audio/rehearsal/` without a server or an audience. `bun run rehearse 5` sings iterations zero to five, each grown from the one before, past the first change of Mood.

To hear it live, wake the song and open http://localhost:3000, then press Play:

```bash
bun run song
```

`bun run listen` listens from a terminal instead. `bun run check` runs the types and the tests, as the CI does. The song's pulse is served at `/pulse`: status 200 while it is alive, 503 when it has missed its beat for a quarter of an hour. When the machine stops it, it tells its listeners it is resting, and the next time it wakes it carries on from its diary.

Configuration lives in `.env`, with local overrides in `.env.local`. `CHOIR_COUNT` sets how many voices sing the chorus, the lead included, and `VARIATION_COUNT` how many Variations of the tune take turns in a Song. `THROATS` sets how many recordings may be made at once, half the machine's cores by default, always at a lower priority than anything else on the machine. `ITERATION_COUNT` sets how many iterations a Song lasts, and `MOOD_COUNT` how many descriptions a Mood blends. `LYRICS_MODEL` chooses the mind, and `OLLAMA_HOST` says where it lives (default `http://127.0.0.1:11434`).
