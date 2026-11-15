---
state: done
id: 3
kind: issue
slug: grace-bars-above-target
---
# Verse lines take a grace bar 1.81% of the time; the plan's target is under 1%

Plan "Time follows lyrics", step 5: the Archive analysed again on the Songs made since the plan, 201–371 (8,210 sung lines), against Songs 100–200 from before it.

- **The invariant holds.** Not one sung line has a syllable sooner than 1/rate after the one before. Every Song since the plan sang at rate 6, and the quickest line, at 0.167 s, sits exactly on the limit. Before the plan, no Session kept a line's pace.
- **Grace bars are above the target.** 99 of 5,472 verse lines (1.81%) took a bar of grace, against a target under 1%. So did 70 of 2,054 chorus lines 2–4 (3.41%). The number line grows on its reciting tone every time, 684 of 684, as designed.
- **Stumbles are rare.** The Heart's log, which covers Songs 1–371, holds one NoVerseFits. Stumbles before the plan can't be counted the same way, because no verse was written to a count then. Songs 288–290 lost their beds to an orphaned mind, not to a stumble; that was fixed in 557a78c.

What I did meanwhile: when a verse or chorus line doesn't fit its bars, the mind is now told, in its next try, which line missed, how many syllables it had, and the most it may have. Before, it was asked again blind, eight times, and then allowed a grace bar.

To do: after about a day of Songs from the commit that adds this, measure again with the same script: grown verse lines over all verse lines, by Song. If it is still above 1%, the next lever is a longer first round (patience), or asking the mind to rewrite only the line that missed.

The measurement, run on any machine, the Songs given as a range:

```python
import json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

base = "https://hel1.your-objectstorage.com/ikuradio/sessions/"
def lines(n):
    try:
        with urllib.request.urlopen(f"{base}{n}.json", timeout=60) as r:
            s = json.load(r)
    except Exception:
        return []
    return [(s.get("rate"), p["type"], i, l.get("quickest"), l.get("grown")) for it in s["iterations"] for p in it["parts"] if p["type"] != "bridge" for i, l in enumerate(p["lines"])]

lo, hi = int(sys.argv[1]), int(sys.argv[2])
with ThreadPoolExecutor(8) as pool:
    sung = [l for ls in pool.map(lines, range(lo, hi + 1)) for l in ls]
fast = sum(1 for rate, _, _, q, _ in sung if rate and q is not None and q < 1 / rate - 0.002)
verse = [g for _, t, _, _, g in sung if t == "verse"]
rest = [g for _, t, i, _, g in sung if t == "chorus" and i > 0]
print(f"{len(sung)} lines, {fast} too fast")
print(f"grace: verse {sum(1 for g in verse if g)}/{len(verse)}, chorus 2-4 {sum(1 for g in rest if g)}/{len(rest)}")
```

**Measured again, 2026-11-15, Songs 374–438:**
- **Told only, before the Tides (374–388):** 0 of 480 verse lines and 0 of 180 chorus lines 2–4 took a grace bar.
- **With the Tides moving wordiness too (389–438):** 15 of 1,600 verse lines (0.94%) and 20 of 600 chorus lines 2–4 (3.3%).
- **Together:** 15 of 2,080 verse lines, 0.72%, under the plan's 1% target, against 1.81% before the mind was told how its lines missed.
- **The chorus's grace bars:** they come in clusters, not with the wordiness Tide. A graced line is sung in every chorus section of its iteration, so one hard line counts four times. By wordiness band they run 4.0%, 7.3%, 0% and 0%, with no rise toward the wordy end.

**Closed:** the plan's target is met. If the chorus's clusters matter by ear, that is a question of its own.
