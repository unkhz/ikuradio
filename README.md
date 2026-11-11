# Song That Never Ends

A song that writes its next verse while singing the current one, and will keep doing it for as long as anything is left to run it. It counts its iterations in its chorus. The numbers are spelled out up to nonillions, and after a decillion it starts over, because nobody agrees what comes next.

What it can do today:

- **Mood** is the weather the song grows in (`packages/mood`). A Mood blends a few descriptions, like *eternity + romantic chamber music with violin and cello*. A *Song* is a run of iterations in one Mood, and it lasts as long as its weather holds: about `ITERATION_COUNT` iterations, a little more or less, the same weather always for the same time. When a new Song begins, the oldest description lets go, and the song chooses the one that arrives from the last words it sang. If it can't, the new one is drawn from a list. The Mood remembers the weather it has had lately, so nothing returns too soon. The local mind listens to the Mood and decides the mode, the tempo, and the band that plays under the voice.
- **Words** are rewritten for every iteration from the previous ones by a local language model, the song's *mind*, served by [llama.cpp](https://github.com/ggml-org/llama.cpp) (`packages/song`, `packages/tools`). The song wakes the mind itself, with every layer on the GPU and one slot for each verse, so all five verses of an iteration are written at once. Every answer is held to a JSON schema, which llama.cpp turns into a grammar. The chorus counts its own iteration number, and the model is not trusted with it. A pronouncing dictionary checks that the chorus rhymes with its number, and only with words the mind reads whole, so that no name from the dictionary is sung. A verse that only echoes the one before is refused. The words the last iteration leaned on most are let rest in the next, except the Mood's own.
- **Melody** sets each line to a tune on A, in whatever mode the Mood chose (`packages/melody`). The chorus hook never changes. When the iteration number grows too long to fit, the hook slows down to make room. The verses walk: each new Song moves one note of every verse phrase by a single step, and within a Song a few *Variations* take turns.
- **Vocals** are sung by [Chimera](https://github.com/jamesondh/chimera-vocal-synth), a physical model of a throat, built from a pinned revision. It runs on any CPU, with no GPU and no macOS (`packages/vocals`). Each Song gathers a small choir of *Singers*. The lead sings every line, and the others join the chorus in harmony, in the mode. Before a line is sung, whatever the throat cannot read is read aloud in words: numbers, years, ordinals, percentages, `&`. Every singer breathes through a throat of their own, softer and breathier or more pressed and clear, through a small patch the song carries to its pinned Chimera. Every voice is humanized: a few cents off, leaning a little early or late, never off the beat.
- **Music** is grown from the voice (`packages/music`). The 2023 MusicGen melody model, run today through `transformers`, hears each part of an iteration as the shape of its pitches. It doesn't hear the sung voice, whose melody moves too fast for it, but a *guide* the lead hums for it alone, for every bed it grows: the same melody at the same tempo with fewer notes, the note on every second beat held until the next. The guides are kept in the Archive with their scores, listed in the Session apart from its Recordings, and never played, and hears the Mood as words: the band the mind heard in it, its tempo, major or minor. The bed it grows for each part lies under every section of that part. Wherever the song turns between a verse and the chorus, a *bridge* carries it across: four bars without words, over a bed of its own. It begins with the last line of the part it leaves, slowed, in that part's key, and walks through the key of the part to come to arrive on its first note. Sometimes the lead hums that journey aloud. A bridge into the chorus and one out of it are different journeys, with different beds. Every bed is grown three seconds past its section, and fades out under the next one, which has already begun. The model hears only half a minute at a time, so a longer section, at a slow tempo, has its bed grown in overlapping windows joined by a crossfade. When a Song begins, both parts grow new beds. After that, each iteration grows a bed for one part and plays one of the other part's beds from the same Song again, like a band keeping its arrangements. Eight beds of each part are kept on a *shelf*, and a new Mood clears it. The mind and the Music cannot share the GPU, so they take turns: the Studio writes every word of a Song while the mind is awake, and grows every bed after it rests.
- **The trinity** (`plans/2026-11-11-trinity-of-song.md`). The song is made, kept and played by three lives:
  - The **Studio** (`packages/studio`) is short-lived. It wakes, reads its diary (`packages/studio/memory/diary.jsonl`, shelved in books every two weeks or so), and makes the next Song whole: every word of every iteration while the mind is awake, then every voice, then every bed. Then it leaves the Song in the Archive and ends.
  - The **Archive** (`packages/archive`) keeps each Song's *Session*, the complete declaration of the Song, and its *Recordings*. The Session holds every Recording at its moment, each singer's voice a Recording of its own, and every character of every line at the moment it is typed. Here the Archive is the folder `archive/` behind a small static file server; in production it will be cloud storage.
  - The **Radio** (`packages/radio`) is long-lived and keeps the *Tactus*: when each Song begins. A Song begins exactly when the one before it ends, or a little after it arrives if the Studio was late. The Radio tells Receivers the time, what plays and what comes next, and where to fetch them. It never touches a Recording.
- **Receivers** are where the song is heard. The page in the browser (`packages/ui`), served by the Radio, measures its clock against the Tactus. It fetches each coming Song whole from the Archive, its Session and every Recording, before the Song begins. Then, many times a second, it asks what should have happened by now:
  - Every voice and bed is placed on its audio clock, each singer standing in their own place in the stereo mix. The Studio measures how loud every Recording sounds (EBU R128, in the Session), and the Receiver brings each to the loudness of its kind: the lead voice at -16 LUFS, the choir beneath it, the Music 6 LU under the voices.
  - Every character is typed at its moment.
  - Arriving late is only asking for a later moment.

  While a bridge plays, the page draws a line of its own, the tide or a breath or stars, which settles into a quiet ~ when the next part begins. A quiet line at its edge shows the song's age, its Mood, its mode and tempo, and who is singing. *Look back* opens the Songs that have aired, newest first. A terminal can listen too, with `bun run listen`: it fetches the Song the same way, keeps the same time, and plays it through ffplay.

Where it is going is in [plans/](plans/). What it has been thinking is in [thoughts.md](thoughts.md).

## Waking it

The song lives on one machine. It needs [Bun](https://bun.sh), Rust (for the throat), ffmpeg, `llama-server` from llama.cpp built with CUDA, and [uv](https://docs.astral.sh/uv/) (for the Music). It also needs a GPU with about 12 GB of memory. The mind is any instruct model in GGUF that fits, kept at `models/mind.gguf`:

```bash
mkdir -p models && curl -L -o models/mind.gguf https://huggingface.co/bartowski/Mistral-Nemo-Gutenberg-Doppel-12B-GGUF/resolve/main/Mistral-Nemo-Gutenberg-Doppel-12B-Q5_K_M.gguf
```

```bash
bun install
```

```bash
(cd packages/music && uv sync)
```

```bash
bun run rehearse
```

`bun run rehearse` builds the throat from its pinned revision if it hasn't been built yet, then sings iteration zero into `packages/studio/audio/rehearsal/` without a Radio or an audience. `bun run rehearse 5` sings iterations zero to five, each grown from the one before, past the first change of Mood. When every iteration is sung, the mind rests and the Music lays a bed under each one, written beside the voice as `<iteration>.music.m4a` and under it as `<iteration>.together.m4a`. The first bed downloads the Music's model, about 6 GB. Add `--dry` for the voices alone.

To put it on air, run the Archive's door, the Radio, and a Studio called in whenever fewer than two Songs wait ahead, then open http://localhost:3000 and press Play:

```bash
bun run on-air
```

The first Song takes a few minutes to make. They can also be run apart: `bun run archive`, `bun run radio`, and `bun run studio`, which makes one Song and ends. `bun run listen` listens from a terminal. `bun run check` runs the types and the tests, as the CI does. The Radio's pulse is served at `/pulse`: status 200 while a Song is playing, about to, or late by less than a quarter of an hour, and 503 after that. When a Studio wakes, it sweeps away whatever an earlier one left unfinished, and it lets the Archive forget the Recordings of all but the last few Songs. The words of a Song stay in the Archive, for looking back.

Configuration lives in `.env`, with local overrides in `.env.local`. `CHOIR_COUNT` sets how many voices sing the chorus, the lead included, and `VARIATION_COUNT` how many Variations of the tune take turns in a Song. `THROATS` sets how many recordings may be made at once, half the machine's cores by default, always at a lower priority than anything else on the machine. `ITERATION_COUNT` sets about how many iterations a Song lasts, and `MOOD_COUNT` how many descriptions a Mood blends. `MIND_MODEL` and `MIND_HOST` say which mind to wake and where. `ARCHIVE_DIR` and `ARCHIVE_PORT` place the Archive. `RADIO_PUBLIC_HOST` and `ARCHIVE_PUBLIC_HOST` are the names the Radio and the Archive are reached by from elsewhere, such as a dev box's address on the home network. The Radio sends Receivers to the Archive at its name, even when they came in through a tunnel. `PUBLIC_ARCHIVE_URL` overrides the whole address, if the Archive lives somewhere else entirely. `SONGS_AHEAD` sets how many Songs wait ready ahead of the one playing.

## Living on its machine

To keep the song singing with nobody watching, `deploy/` has three systemd user units. `song.service` runs `bun run on-air` from `~/Work/song` and starts it again if it falls. `song-pulse.timer` feels the pulse every five minutes, and wakes the song again if its heart has stopped, or if it doesn't answer at all.

```bash
cp deploy/song.service deploy/song-pulse.service deploy/song-pulse.timer ~/.config/systemd/user/
```

```bash
systemctl --user daemon-reload && systemctl --user enable --now song.service song-pulse.timer
```

For the song to keep singing after its keeper logs out:

```bash
sudo loginctl enable-linger $USER
```

