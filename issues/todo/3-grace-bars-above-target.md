---
state: todo
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
