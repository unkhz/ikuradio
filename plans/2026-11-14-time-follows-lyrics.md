---
date: 2026-11-14
state: active
owner: scientist
id: 6
kind: plan
slug: time-follows-lyrics
---
# Time follows lyrics

Today a line's time is fixed, and the words are squeezed into it. Each phrase is two bars, and `fitPhrase` splits notes down to a quarter of a beat before it gives the line any more time. That rule doesn't know the tempo: a quarter beat is 0.25 s at 60 bpm and 0.13 s at 116 bpm. The lyrics live their own life, so the time has to give way, not the singing.

**From now on, time follows lyrics.** The words decide how long a line lasts. The tune, the guide hum and the Music then follow that time, as they already do from each line's `seconds`. The words are placed **bar by bar**, so they stay in rhythm as well as in time.

## The rate: at most 6 syllables per second

`SYLLABLES_PER_SECOND` sets the limit. It defaults to 6 and is checked by zod in `tools/lib/env.ts`.

- **Why 6:** it is English speech speed, 6.2 syl/s (Pellegrino, Coupé & Marsico 2011), well under the point where understanding collapses, about 9 syl/s (Ghitza & Greenberg 2009). It is still fast next to music's typical 2 Hz (Ding et al. 2017).
- **It is tuned by ear, not in a lab.** The scientist listens to the Radio, and when a line sounds like syllable soup, lowers the rate. A change applies from the next Song.
- **It is recorded.** The rate in use is written into the diary and the Session with each Song, so the Archive shows which rate made which Song.

**The invariant:** in every take, after humanizing, no sung syllable starts sooner than 1 / rate seconds after the one before it. At 6, that is 0.167 s. Rests and bridge hums count the same way.

Today 11.5 % of verse lines and 16 % of chorus lines break it. For the chorus's first line, which carries the number, it is 21 %.

## The grid: what the rate allows at each tempo

Notes sit on a sixteenth-note grid. One sixteenth lasts 15 / bpm seconds. Two syllables must be at least **k** sixteenths apart:

`k = ceil(bpm / (15 × rate))`

With the rate at 6:

| Tempo | k | Shortest note | Most syllables in a bar |
|---|---|---|---|
| 60–90 bpm | 1 | a sixteenth (0.25–0.17 s) | 16 |
| 92–180 bpm | 2 | an eighth (0.33–0.17 s) | 8 |

That is how songs behave anyway: slow songs can sing sixteenths, fast ones sing eighths. A rate of 4 would give k = 1 only up to 60 bpm. No triplets for now.

## Fitting bar by bar

A phrase is written as bars: two bars of notes, then the rest. The last line's rest fills a third bar.

1. **Syllables with their stress.** Each word's syllables, and which one is stressed, come from the throat's pronouncing dictionary, the same one `rhyme.ts` reads (stress marks 1 and 2). A word not in the dictionary takes its syllable count from `countSyllables`, with the stress on its first syllable.
2. **Words into bars.** Words are dealt into the phrase's bars, aiming at the phrase's own spread: each bar's target is its note count.
   - A bar line falls between words, and a comma is preferred as the place.
   - A word crosses a bar line only if it can't fit within one bar.
   - No bar holds more than `floor(16 / k)` syllables, nor more than its notes can be split into at k-sixteenth spacing.
3. **Syllables into each bar.** Inside each bar, the phrase's notes are folded or split as they are today, but never to less than k sixteenths. Of the possible fits, the one chosen puts the most stressed syllables on strong beats (1 and 3, then 2 and 4) and the fewest unstressed syllables on beat 1. Ties are broken deterministically, so the same words always meet the tune the same way.
4. **More words than bars.** When the words don't fit the phrase's bars, the line grows, and how depends on the part (below).

The guide hum, the Music's sections and the Receivers' clocks take whatever beats a line has; their code is checked in step 4 of the order of work. Bars stay whole, so the meter and the Music's grid stay whole.

## The number line: pays the price of time

The chorus is evolutionary. Its first line, "This is the song, iteration …", carries the age of the song, and it grows with every order of magnitude. It is never shortened to fit; the time grows instead. **This is the only line that grows.** The other three chorus lines, the rhyme with the age included, are written by the mind and follow the verse logic below, each to its own phrase's count.

- When the number needs more bars, **whole bars are added on a reciting tone** before the cadence bar. This is a psalm tone: one held pitch that takes as many syllables as it needs. The reciting tone is the note under "iteration", marked on the first chorus phrase in `hooks.ts`.
- Reciting bars are sung **at the phrase's own pace** (its median note spacing, eighths today), not at the rate's limit. The growth is meant to sound sung, not crammed.
- The departure and the cadence keep their shape. The number is chanted, and then the hook resolves as it always has.
- There is no ceiling. The number line grows bar by bar for as long as the number does.

The price, worked out from the throat's dictionary syllables of the opening line "This is the song, iteration …":

| Iteration | Syllables in line 1 |
|---|---|
| 5 | 9 |
| 377 | 17 |
| 7,777 | 22 |
| 777,777 | 30 |
| 777,777,777 | 42 |
| 777,777,777,777,777 | 66 |

An iteration lasts about 233 s (median), so a quadrillion iterations is about 7.4 billion years. By then line 1 carries over 50 syllables more than now, which is about seven more bars of eighths. Five iterations in, it costs nothing yet: the first breath.

## Verses and the rest of the chorus: written to the count

The verses stay time-bound, and so do chorus lines 2–4. For those three lines, read "verse" below as "chorus": `pickChorus` gets the same count, check, grace bar and refusal as `editVerse`. Line 2 must still rhyme with the age, so its rhyme words are offered with their syllable counts.

- **The mind is told each line's count.** The verse instruction gives a target for each line (the phrase's note count, 9 or 10 today, walking as the verse tune walks) and a ceiling (the most that fits the phrase's bars at this tempo and rate). It replaces "eight to fourteen".
- **The Studio checks the verse before accepting it.** In `editVerse`'s `accept`, every line is fitted bar by bar. A verse with any line that doesn't fit its bars is refused, and the mind writes again, with the existing retries.
- **One bar of grace.** If the retries run out, a line may grow by one reciting bar, like the number line. The grace is counted in the Session.
- **Then it fails and is recreated.** A line that would need more than one extra bar, or a word longer than a bar, refuses the verse outright. If no verse can be written, the iteration stumbles and is made again by the retry machinery that is already there.

## The backstop

After `humanize`, every take is checked against the invariant before the throat sings it.

- `humanize` limits its timing shifts so that it never breaks the invariant. Today it trades length between neighbouring notes freely, which is one way the current lines dip below 0.167 s.
- A take that still breaks the invariant throws an error, and the iteration stumbles and is recreated. Syllable soup is never sung; at worst, the iteration is late.

## What else moves

- **`tools/lib/env.ts`**: `SYLLABLES_PER_SECOND`, from 1 to 12, default 6.
- **`melody/lib/fit.ts`**: bars, the k-sixteenth grid, placing stress, and growth on a reciting tone. Today's halving of `shortest` and doubling of the whole phrase go away.
- **`melody/lib/hooks.ts`**: phrases written as bars, with the reciting tone marked on the first chorus phrase.
- **`song`**: syllables with their stress, from the dictionary that `rhyme.ts` already reads; per-line targets and ceilings in the verse and chorus instructions; the bar-by-bar check in `editVerse`'s `accept` and in `pickChorus`.
- **`vocals/lib/humanize.ts`**: shifts limited by the rate; the backstop check.
- **`studio/lib/perform.ts`**: passes the rate and tempo into the fit; records each line's bars, grown bars and fastest spacing.
- **Diary and Session**: the rate per Song, and each line's bars, grown bars and fastest spacing, so the price of time can be read back over the years.
- **Downstream timing**: check the guide, Music sections and beds, the Radio's and Receivers' clocks, and the page's typing with lines longer than 8 beats.

## Order of work

1. The rate in env, the grid, and the backstop in `humanize`. Lines are refused, not sung, if they break the invariant. This alone ends the soup, at the cost of stumbles.
2. The bar-by-bar fit, with stress. Unit tests replay Archive lines at 60, 76, 92 and 116 bpm and check that none breaks the invariant.
3. The number line grows on its reciting tone. Rehearse iterations 5, 377, 7,777 and 777,777,777,777,777, and listen.
4. The verses and chorus lines 2–4 are written to the count, with the check, the grace bar and refusal. Measure over a day of Songs how often the mind fits first time, how often a grace bar is needed, and how often an iteration stumbles.
5. Re-run the Archive analysis on the new Songs. Success means no sung syllable breaks the invariant, fewer than 1 % of verse lines use a grace bar, and stumbles are no more common than they are today.
