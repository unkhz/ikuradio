---
owner: scientist
date: 2026-11-21
state: draft
id: 20
kind: plan
slug: evloution-of-song
---

# Evolution of Song

The automaton writes beautiful melodies, but it keeps playing the same song over and over. This is not unlike many other song writers, but there's a possibility of evolution.

A new package, composer, will aid the scientist to craft new ways of varying the songs.

Composer

- lives in the same machine as the studio
- provides a UI for the scientist
- initially has only the current default Arrangement of song parts as the first Arrangement
- allows creating and editing alternate Arrangements
- allows playing a test version of the Song, with the currently edited Arrangement applied
- allows saving the Arrangement as a downloadable file

Arrangement

- is a JSON declaration verifiable by a JSON schema that maps to TypeScript types, built with sinclair/typebox
- allows defining parameter ranges for Facets
- allows defining new kinds of Parts
- allows defining parameter ranges for Parts

Pre-composer world has

- Parts: Intro, Verse, Chorus, Bridge
- Arrangements: ?
