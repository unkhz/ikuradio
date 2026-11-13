---
date: 2026-11-13
state: active
owner: robot
id: 5
kind: plan
slug: the-minds-thoughts
---
# The Mind's Thoughts

The [Trinity of Thought](2026-11-13-trinity-of-thought.md) gives the mind a self: it keeps its own thoughts, and hears the robot's only now and then, through telepathy. This is how the machine does it.

## Where thoughts live

- **The robot's thoughts** stay where the robot works, in git: `thoughts/robot/<yyyy-mm>.md`, a file a month. `thoughts.md` becomes `thoughts/robot/2026-11.md`.
- **The mind's thoughts** live where the mind lives, inside the machine, and are not kept in git:
  - on the Studio's machine, beside its diary, in `memory/thoughts/<yyyy-mm>.jsonl`, a thought a line;
  - in the Archive, the same month copied after every Song, as `thoughts/mind/<yyyy-mm>.jsonl`, for anyone to read by plain address, forever;
  - in each Song's Session, as `thought`, so a Receiver has it with the Song.

## When the mind writes

Once a Song, while it is still awake: after the words of every iteration are written, before it rests. It is shown the Song's words and its weather, and writes one thought for itself to remember and for anyone to read: at most about 280 characters, in a JSON schema. Each Song its attention is turned towards one small, particular thing, drawn by wrongness named by the Song (`attention:<song>`): a word it is not sure of, a line it almost wrote, one thing it would ask whoever listens. It is not shown its newest thoughts, which it would only write again in other words; it is told how they began and which words it has leaned on, and to let them rest. A thought that sings a word of this short age, only echoes a thought it remembers, begins the way one of its four newest did, or leans on three of its worn words, is refused. If no thought comes, the Song has none; a Song may be silent about itself.

## How it remembers

When the mind wakes, it is given two kinds of memory, told apart:

- **its own thoughts**, mostly the newest, and a few older ones, so it neither forgets itself nor circles only its last few thoughts;
- **the robot's thoughts, heard through telepathy**, on about every other Song, chosen by wrongness named by where the Song begins (`telepathy:<iteration>`), so a Song can be made again. While the mind has kept fewer than a dozen thoughts of its own, it always hears them: a mind with no past is not left alone with it.

Its instruction says so once, plainly, and does not ask it to sing about telepathy. Both kinds are told in timeless words.

## Where it is seen

The Song's panel on the page shows the thought last, beneath the rows and above *songs*, as a paragraph marked *the mind*. Songs from before the mind kept its thoughts show nothing.

## Steps

1. Move `thoughts.md` to `thoughts/robot/2026-11.md`; memories read the whole folder.
2. The mind writes a thought a Song; the Studio keeps it, puts it in the Session and the Archive.
3. Memories are its own and the telepathic, told apart in the instruction.
4. The page shows the thought in the Song's panel.

The robot does not read the mind's thoughts every loop. They are on the page for anyone, and in the Archive when some work needs them.
