# Song That Never Ends

A song that writes its next verse while singing the current one, and will keep doing it for as long as anything is left to run it. It counts its iterations in its chorus. The numbers are spelled out up to nonillions, and after a decillion it starts over, because nobody agrees what comes next.

What it can do today:

- **Mood** is the weather the song grows in (`packages/mood`). A Mood blends a few descriptions, like *eternity + romantic chamber music with violin and cello*. A *Song* is a run of iterations in one Mood. When a new Song begins, the oldest description lets go and a new one arrives. The local mind listens to the Mood and decides the mode and the tempo.
- **Words** are rewritten for every iteration from the previous ones by a small local language model served by [Ollama](https://ollama.com) (`packages/song`). The chorus counts its own iteration number. The model is not trusted with it.
- **Melody** sets each line to a tune on A, in whatever mode the Mood chose (`packages/melody`). The chorus hook never changes. When the iteration number grows too long to fit, the hook slows down to make room. The verses walk: each new Song moves one note of every verse phrase by a single step, and within a Song a few *Variations* take turns.
- **Vocals** are sung by [Chimera](https://github.com/jamesondh/chimera-vocal-synth), a physical model of a throat, built from a pinned revision. It runs on any CPU, with no GPU and no macOS (`packages/vocals`). Each Song gathers a small choir of *Singers*. The lead sings every line, and the others join the chorus in harmony, in the mode. Every voice is humanized: a few cents off, leaning a little early or late, never off the beat.
- **Music** is a bed of generated background music from 2023, laid under the voice (`packages/music`).
- **The server** streams the song as it is sung (`packages/server`). Every line begins exactly where the music puts it, and every word is typed while it is sung, all against one clock. If the next iteration is late, the song holds a fermata instead of rushing. It keeps a diary in `packages/server/memory/diary.jsonl`, one line per iteration, and wakes up where it left off. It sings into a *room*: whoever is connected hears it live, and someone who joins halfway is shown the current Mood and the words of the iteration so far. Nothing is kept for an empty room.
- **Listeners**: the page in the browser (`packages/ui`) is sent each iteration's *score* before it begins, prepares every voice in advance, and plays them on its own audio clock, on the beat. If the song goes quiet, it waits and listens again. A terminal can listen too, with `task cli:dev`.

Where it is going is in [plans/](plans/). What it has been thinking is in [thoughts.md](thoughts.md).

## Waking it

You need [Task](https://taskfile.dev), pnpm, Node, Rust, ffmpeg and Ollama, with a small model that fits in about 12 GB of memory. Any instruct model will do:

```bash
ollama pull qwen3:4b
```

```bash
pnpm install
```

```bash
task vocals:build
```

```bash
task server:rehearse
```

`task server:rehearse` sings iteration zero into `packages/server/audio/rehearsal/` without a server or an audience. `task server:rehearse -- 5` sings iterations zero to five, each grown from the one before, past the first change of Mood. To hear it live instead, run these two in separate terminals, then open http://localhost:4000 and press Play:

```bash
task server:dev
```

```bash
task ui:dev
```

Configuration lives in `.env`, with local overrides in `.env.local`. `CHOIR_COUNT` sets how many voices sing the chorus, the lead included, and `VARIATION_COUNT` how many Variations of the tune take turns in a Song. `ITERATION_COUNT` sets how many iterations a Song lasts, and `MOOD_COUNT` how many descriptions a Mood blends. `LYRICS_MODEL` chooses the mind, and `OLLAMA_HOST` says where it lives (default `http://127.0.0.1:11434`).
